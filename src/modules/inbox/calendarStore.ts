import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";
import { pingNotifs } from "../../shared/notifications";

/**
 * ปฏิทินกิจกรรม (Calendar) — โมดูลกลาง "เตือน & ปฏิทิน" · บันทึกจริงที่ backend (/api/calendar)
 * cache ในหน่วยความจำ + mirror localStorage เพื่อให้ provider แจ้งเตือนอ่านแบบ sync ได้
 */
export type CalPriority = "LOW" | "NORMAL" | "HIGH";
export type CalStatus = "PENDING" | "DONE" | "OVERDUE";

export type CalEvent = {
  id?: string;
  activityDate: string;          // yyyy-mm-dd (วันที่กิจกรรม)
  remindDate?: string | null;    // วันที่เตือนล่วงหน้า
  priority: CalPriority;         // HIGH = สำคัญ ต้องยืนยันว่าทำแล้ว
  status: CalStatus;            // รอดำเนินการ / ดำเนินการแล้ว / เลยกำหนด
  confirmed: boolean;
  title: string;                 // กิจกรรมอะไร
  customerRef?: string | null;   // รหัสลูกค้า (ถ้ามี)
  refType?: string | null;       // เอกสารอ้างอิง: CL/FO/QT/SO/...
  refCode?: string | null;
  module?: string | null;        // โมดูลต้นทาง
  createdBy?: string | null;     // ผู้บันทึก
  note?: string | null;
};

const tenant = () => getSession()?.companyId ?? "";
const lsKey = () => `idoc.calendar.${tenant()}`;
let cache: CalEvent[] | null = null;
// แคชเฉพาะ "ถึงกำหนดเตือน" สำหรับกระดิ่ง — poll เติมแบบเบา (due=1) · full sync ก็คำนวณใหม่ให้ตรงกัน
let dueCache: CalEvent[] | null = null;
const computeDue = (list: CalEvent[]): CalEvent[] => {
  const today = new Date().toISOString().slice(0, 10);
  return list.filter((e) => e.status !== "DONE" && !e.confirmed && (e.remindDate || e.activityDate) <= today);
};

export function loadCalendar(): CalEvent[] {
  if (cache) return cache;
  try { const raw = localStorage.getItem(lsKey()); cache = raw ? (JSON.parse(raw) as CalEvent[]) : []; }
  catch { cache = []; }
  return cache;
}

function persist(list: CalEvent[]): void {
  cache = [...list].sort((a, b) => a.activityDate.localeCompare(b.activityDate));
  dueCache = computeDue(cache);   // full sync → คำนวณ due ใหม่ ให้กระดิ่งตรงกับข้อมูลล่าสุด
  try {
    localStorage.setItem(lsKey(), JSON.stringify(cache));
    localStorage.setItem(DUE_KEY(), JSON.stringify(dueCache));   // ให้ TTL cache ของ syncCalendarDue สอดคล้องกัน
    localStorage.setItem(DUE_AT_KEY(), String(Date.now()));
  } catch { /* ignore */ }
  pingNotifs();
}

/** ดึงจาก backend → อัปเดต cache + แจ้งเตือน */
export async function syncCalendar(): Promise<CalEvent[]> {
  const t = tenant();
  if (!t) return loadCalendar();
  try {
    // ดึงเฉพาะช่วงที่หน้า inbox แสดงจริง (ย้อนหลัง ~6 เดือนเป็นต้นไป) — เก่ากว่านั้นหน้าตัดทิ้งอยู่แล้ว (cutoff 3 เดือน)
    // กันดึง "ทั้งปฏิทินทั้งบริษัท" (ไม่มี limit, โตตามเวลา) ทุกครั้งที่เปิดหน้า · อนาคตไม่จำกัด (นัดล่วงหน้าต้องเห็น)
    const from = (() => { const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toISOString().slice(0, 10); })();
    const list = await apiFetch<CalEvent[]>(`/calendar?from=${from}`, { tenant: t });
    persist(list ?? []);
    return cache!;
  } catch { return loadCalendar(); }
}

/** กระดิ่ง — ดึงเฉพาะกิจกรรมที่ "ถึงกำหนดเตือน/เลยกำหนด" (due=1) ไม่ดึงทั้งปฏิทิน
 *  cache ผลใน localStorage (TTL) → รีโหลด/เปิดหน้า detail ภายในช่วงนี้ "ไม่ยิงซ้ำ" · กระดิ่งอ่านจาก cache ได้เลย
 *  ลด egress: เดิม boot ทุกครั้ง (รีโหลดหน้าไหนก็ตาม) ยิง due=1 ใหม่ */
const DUE_KEY = () => `idoc.calendar.due.${tenant()}`;
const DUE_AT_KEY = () => `idoc.calendar.dueAt.${tenant()}`;
export async function syncCalendarDue(maxAgeMs = 24 * 60 * 60 * 1000): Promise<void> {
  const t = tenant();
  if (!t) return;
  try {
    const at = Number(localStorage.getItem(DUE_AT_KEY()) || 0);
    if (Date.now() - at < maxAgeMs) {
      const raw = localStorage.getItem(DUE_KEY());
      if (raw) { dueCache = JSON.parse(raw) as CalEvent[]; pingNotifs(); return; }   // ยังสด → ไม่ยิง network
    }
  } catch { /* ignore */ }
  try {
    dueCache = (await apiFetch<CalEvent[]>("/calendar?due=1", { tenant: t })) ?? [];
    try { localStorage.setItem(DUE_KEY(), JSON.stringify(dueCache)); localStorage.setItem(DUE_AT_KEY(), String(Date.now())); } catch { /* ignore */ }
    pingNotifs();
  } catch { /* ignore */ }
}

/** ดึงเฉพาะกิจกรรมที่อ้างอิงเอกสารหนึ่ง (เจาะจง refType+refCode) — ไม่โหลดทั้งปฏิทินมา filter ที่ client */
export async function fetchCalendarByRef(refType: string, refCode: string): Promise<CalEvent[]> {
  const t = tenant();
  if (!t) return [];
  try {
    const qs = `refType=${encodeURIComponent(refType)}&refCode=${encodeURIComponent(refCode)}`;
    return (await apiFetch<CalEvent[]>(`/calendar?${qs}`, { tenant: t })) ?? [];
  } catch { return []; }
}

export async function saveCalendar(ev: CalEvent): Promise<boolean> {
  const t = tenant();
  if (!t) return false;
  try {
    if (ev.id) await apiFetch(`/calendar/${ev.id}`, { method: "PUT", tenant: t, body: ev });
    else await apiFetch("/calendar", { method: "POST", tenant: t, body: ev });
    await syncCalendar();
    return true;
  } catch { return false; }
}

export async function deleteCalendar(id: string): Promise<void> {
  const t = tenant();
  if (!t) return;
  try { await apiFetch(`/calendar/${id}`, { method: "DELETE", tenant: t }); await syncCalendar(); }
  catch { /* ignore */ }
}

const todayStr = () => new Date().toISOString().slice(0, 10);

/** เลยกำหนด = ยังไม่ทำ/ยังไม่ยืนยัน และวันที่กิจกรรมผ่านไปแล้ว */
export function isOverdue(e: CalEvent): boolean {
  return e.status !== "DONE" && !e.confirmed && e.activityDate < todayStr();
}

/** กิจกรรมที่ "ถึงกำหนดเตือน/เลยกำหนด" — ป้อนเข้ากระดิ่งแจ้งเตือน
 *  ใช้ dueCache จาก poll (เบา) ถ้ามี ไม่งั้นคำนวณจาก cache เต็ม */
export function dueEvents(): CalEvent[] {
  return dueCache ?? computeDue(loadCalendar());
}
