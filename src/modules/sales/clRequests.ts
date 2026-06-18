import { getSession } from "../../shared/session";
import { apiFetch } from "../../shared/api";
import { pingNotifs } from "../../shared/notifications";

/**
 * เอกสารงานขาย (CL/FO/QT/SO) — บันทึกจริงที่ backend (/api/sales-docs) + mirror localStorage
 * (getter ทำงาน sync จาก localStorage · ยิง backend แบบ fire-and-forget เหมือน settingsStore)
 * ใช้กล่องงานแบบเดียวกัน: รอรับ → รอดำเนินการ → ส่งออก → เสร็จสิ้น
 * ฟังก์ชันรับ doc (CL/FO/QT/SO) · ค่าเริ่มต้น "CL" เพื่อความเข้ากันได้
 */
export type ReqPhase = "RECEIVE" | "PROCESS" | "EXPORT" | "DONE";
export const REQ_PHASES: ReqPhase[] = ["RECEIVE", "PROCESS", "EXPORT", "DONE"];

export type ClDoc = {
  code: string;
  title: string;            // หัวเรื่อง (CL=ชื่อชุด, QT/FO=เรื่อง/ลูกค้า)
  telesale: string;         // ผู้รับผิดชอบ
  phase: ReqPhase;
  savedAt: number;
  values?: Record<string, string>;
  stageId?: string;
  received?: { by: string; at: number };
  bounce?: { by: string; at: number; reason: string };
  sent?: { by: string; to: string; at: number; fromStage?: string; toStage?: string; recipients?: string[] };
};

// เก็บใน localStorage ไม่เกินนี้ (กัน quota เต็ม) — เป็นแค่ persist ข้ามรีโหลด
const MAX = 800;
const DONE_MAX = 200;   // เสร็จสิ้นเก็บแค่ 200 ใบล่าสุดพอ (งานปิดแล้วไม่ต้องถือทั้งหมด) · งานที่ยัง active เก็บครบ
const tenant = () => getSession()?.companyId ?? "";
// ผู้ใช้ปัจจุบัน — ใช้กรอง "ของฉัน" ที่ backend (workbox list) · ตรงกับ me ใน SalesDocuments/StagePicker
const me = () => { const s = getSession(); return s?.fullName || s?.email || s?.companyCode || ""; };
const key = (doc: string) => `idoc.sales.${doc.toLowerCase()}.${tenant()}`;

/** event ให้หน้าจอ re-render เมื่อ sync จาก backend เสร็จ */
export const SALES_DOCS_EVENT = "idoc.salesdocs";

// แคชในหน่วยความจำ = แหล่งอ่านหลักของ UI (เขียนสำเร็จเสมอ) · localStorage = persist ข้ามรีโหลด (best-effort)
// กัน "เอกสารหายเกลี้ยง" ตอน localStorage เต็ม: เขียน localStorage ไม่ได้ก็ยังอ่านจาก memory ได้
const _memDocs = new Map<string, ClDoc[]>();

function writeCache(doc: string, list: ClDoc[]): ClDoc[] {
  const sorted = list.slice().sort((a, b) => b.savedAt - a.savedAt);
  // เก็บงานที่ยัง active ครบ + เสร็จสิ้นเฉพาะ 200 ใบล่าสุด (ไม่ต้องถือทุกใบ — ใบเก่าเปิดจาก by-code ได้)
  let done = 0;
  const kept = sorted.filter((r) => r.phase !== "DONE" || ++done <= DONE_MAX);
  _memDocs.set(key(doc), kept);                                                          // memory = active ครบ + done ล่าสุด (แหล่งอ่านหลักของ workbox)
  try { localStorage.setItem(key(doc), JSON.stringify(kept.slice(0, MAX))); } catch { /* quota เต็ม — memory ต่อได้ */ }
  return kept;
}

export function loadClDocs(doc = "CL"): ClDoc[] {
  const mk = key(doc);
  const mem = _memDocs.get(mk);
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(mk);
    const list = raw ? (JSON.parse(raw) as ClDoc[]) : [];
    const sorted = list.sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX);
    if (sorted.length) _memDocs.set(mk, sorted);
    return sorted;
  } catch {
    return [];
  }
}

export function getClDoc(code: string, doc = "CL"): ClDoc | null {
  return loadClDocs(doc).find((r) => r.code === code) ?? null;
}

/** ดึงเอกสารทีละใบจาก backend — สำหรับ doc ที่อยู่นอก cache (เกิน MAX 2000 ใบ เช่นข้อมูลที่ย้ายมา) */
export async function fetchClDoc(code: string, doc = "CL"): Promise<ClDoc | null> {
  const t = tenant();
  if (!t) return null;
  try { return await apiFetch<ClDoc>(`/sales-docs/${doc}/${encodeURIComponent(code)}`, { tenant: t }); }
  catch { return null; }
}

/** ค่าเสริมกล่องงาน (เกรด/ติดต่อล่าสุด/รอบโทร/วันนัด) ของ "งานฉัน" — คำนวณรวดเดียวที่ backend
 *  แทนการไล่ยิง /customers, /activities, /calendar รายแถว (ทะยอย เผา transfer) → คำขอเดียว แสดงตรงไปตรงมา */
export type SalesEnrich = { code: string; customerRef?: string | null; grade?: string | null; latestCommAt?: number | null; latestCommMsg?: string | null; rounds?: number | null; apptDate?: string | null };
export async function fetchSalesEnrich(doc: string): Promise<SalesEnrich[]> {
  const t = tenant();
  if (!t) return [];
  try { return (await apiFetch<SalesEnrich[]>(`/sales-docs/enrich?docType=${doc}&owner=${encodeURIComponent(me())}`, { tenant: t })) ?? []; }
  catch { return []; }
}

/** ดึงเฉพาะเอกสารของลูกค้ารายเดียว (กรองที่ backend) — ใช้สร้างสายเอกสาร/ประวัติ ไม่ดึงทั้งตาราง (ลด egress มาก) */
export async function fetchDocsByCustomer(doc: string, customerRef: string): Promise<ClDoc[]> {
  const t = tenant();
  if (!t || !customerRef) return [];
  try { return (await apiFetch<ClDoc[]>(`/sales-docs?docType=${doc}&customerRef=${encodeURIComponent(customerRef)}`, { tenant: t })) ?? []; }
  catch { return []; }
}

/** ดึงรายการเอกสาร "เต็ม" (ไม่ cap) จาก backend — cache ระดับ module (TTL 60s)
 *  ใช้สร้างสายเอกสาร (doc-tree) ของลูกค้า โดยไม่ยิงซ้ำทุกครั้งที่เปลี่ยนหน้า/อัปเดต state */
const _allCache = new Map<string, { at: number; data: ClDoc[] }>();
export async function fetchAllDocs(doc = "CL", ttlMs = 60000): Promise<ClDoc[]> {
  const t = tenant();
  if (!t) return [];
  const k = `${t}:${doc}`;
  const c = _allCache.get(k);
  if (c && Date.now() - c.at < ttlMs) return c.data;
  try {
    const list = (await apiFetch<ClDoc[]>(`/sales-docs?docType=${doc}`, { tenant: t })) ?? [];
    _allCache.set(k, { at: Date.now(), data: list });
    return list;
  } catch { return c?.data ?? []; }
}

/** บันทึกเอกสาร — เขียน localStorage ทันที + บันทึกขึ้น backend (await ให้เสร็จก่อน คืน true/false)
 *  คืนค่าเพื่อให้ผู้เรียกรู้ผลจริง และกัน race: นำทางไปหน้าถัดไปหลัง PUT เสร็จ จะ sync เจอข้อมูลเสมอ */
export async function saveClDoc(rec: ClDoc, doc = "CL"): Promise<boolean> {
  try {
    const list = loadClDocs(doc);
    const i = list.findIndex((r) => r.code === rec.code);
    if (i >= 0) list[i] = rec; else list.unshift(rec);
    writeCache(doc, list);   // memory = ครบ, localStorage = cap MAX
  } catch { /* ignore */ }
  const t = tenant();
  if (!t) return true;   // ไม่มี tenant (เช่น preview) — เก็บ local อย่างเดียว
  try {
    await apiFetch(`/sales-docs/${doc}/${encodeURIComponent(rec.code)}`, { method: "PUT", tenant: t, body: rec });
    return true;
  } catch {
    return false;
  }
}

/** ออกเลขจริงตามกฎ numbering (DRAFT → รหัสจริง) ที่ backend → คืนรหัสปัจจุบัน */
export async function issueClCode(code: string, doc = "CL"): Promise<string> {
  const t = tenant();
  if (!t) return code;
  try {
    const r = await apiFetch<{ code: string }>(`/sales-docs/${doc}/${encodeURIComponent(code)}/issue-code`, { method: "POST", tenant: t });
    return r?.code ?? code;
  } catch { return code; }
}

export function deleteClDoc(code: string, doc = "CL"): void {
  try {
    localStorage.setItem(key(doc), JSON.stringify(loadClDocs(doc).filter((r) => r.code !== code)));
  } catch { /* ignore */ }
  const t = tenant();
  if (t) apiFetch(`/sales-docs/${doc}/${encodeURIComponent(code)}`, { method: "DELETE", tenant: t }).catch(() => {});
}

/** poll เบาสำหรับแจ้งเตือน — ดึงเฉพาะใบ "รอรับ" (RECEIVE) แบบ slim (ตัด items) ทุกชนิด แล้ว merge เข้า cache
 *  คงงาน active/DONE เดิม (จาก sync เต็มตอนเปิดกล่อง) ไว้ · refresh เฉพาะชุด RECEIVE ที่ตัวแจ้งเตือนใช้
 *  → payload แทบ 0 ตอนไม่มีใบรอรับ (เดิม poll ดึง active+DONE เต็มทุกชนิดทุกครั้ง = เปลือง egress มาก) */
/** โหลด "รอรับ" (RECEIVE) ของชนิดเดียว แบบสด — รอรับมีน้อยมาก (<5 ใบ) จึงโหลดใหม่ได้ทุกครั้งที่เข้าหน้า
 *  แยกจากงานดำเนินการ (ที่ cache รายวัน) · owner=me + slim → payload จิ๋ว · merge คงงานที่ไม่ใช่รอรับไว้ */
export async function syncReceive(doc = "CL"): Promise<ClDoc[]> {
  const t = tenant();
  if (!t) return loadClDocs(doc);
  try {
    const fresh = (await apiFetch<ClDoc[]>(`/sales-docs?docType=${doc}&phase=RECEIVE&slim=1&owner=${encodeURIComponent(me())}`, { tenant: t })) ?? [];
    const kept = loadClDocs(doc).filter((r) => r.phase !== "RECEIVE");
    const sorted = writeCache(doc, [...fresh, ...kept]);
    window.dispatchEvent(new CustomEvent(SALES_DOCS_EVENT, { detail: doc }));
    return sorted;
  } catch { return loadClDocs(doc); }
}

export async function syncInbox(): Promise<void> {
  const t = tenant();
  if (!t) return;
  await Promise.all((["CL", "FO", "QT", "SO"] as const).map((doc) => syncReceive(doc)));
  pingNotifs();
}

/** วันนี้ (โลคัล) รูปแบบ YYYY-MM-DD — ใช้เป็น marker "ซิงค์ล่าสุดเมื่อไร" */
const dayStamp = (): string => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const syncedKey = (doc: string) => `idoc.sales.synced.${doc.toLowerCase()}.${tenant()}`;

/** ซิงค์ "วันละครั้งต่อผู้ใช้": ถ้าวันนี้เคยซิงค์แล้ว + มี cache อยู่ → คืน cache ไม่ยิง network
 *  (กล่องงานเข้า/ออก/สลับแท็บ จะไม่ดึง full list ซ้ำทั้งวัน · ใหม่จริงมาทาง SSE/ปุ่มรีเฟรช) */
export async function syncSalesDocsDaily(doc = "CL", doneLimit = 0): Promise<ClDoc[]> {
  const t = tenant();
  if (!t) return loadClDocs(doc);
  try {
    if (localStorage.getItem(syncedKey(doc)) === dayStamp() && loadClDocs(doc).length) return loadClDocs(doc);
  } catch { /* ignore */ }
  const list = await syncSalesDocs(doc, doneLimit);
  try { localStorage.setItem(syncedKey(doc), dayStamp()); } catch { /* ignore */ }
  return list;
}

/** โหลด "เสร็จสิ้น" (DONE ล่าสุด N ใบ) เมื่อกดแท็บเสร็จสิ้น — ไม่โหลดมาตั้งแต่แรก · merge เข้า cache (คงงาน active)
 *  โหลดสดทุกครั้งที่กดแท็บ (ไม่แครช) — งานเบาแล้ว · DONE จะถูก wipe ตอน sync active ใหม่ จึงต้องโหลดสดเสมอ */
export async function loadDoneDocs(doc = "CL", limit = 50): Promise<ClDoc[]> {
  const t = tenant();
  if (!t) return loadClDocs(doc);
  try {
    const done = (await apiFetch<ClDoc[]>(`/sales-docs?docType=${doc}&phase=DONE&doneLimit=${limit}&owner=${encodeURIComponent(me())}`, { tenant: t })) ?? [];
    const active = loadClDocs(doc).filter((r) => r.phase !== "DONE");
    const sorted = writeCache(doc, [...active, ...done]);
    window.dispatchEvent(new CustomEvent(SALES_DOCS_EVENT, { detail: doc }));
    return sorted;
  } catch { return loadClDocs(doc); }
}

/** ล้าง marker "ซิงค์วันนี้แล้ว" ทุกชนิด — ใช้ตอนกดปุ่มรีเฟรชเพื่อบังคับโหลดใหม่ */
export function clearSalesDocsSynced(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("idoc.sales.synced.")) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}

/** รีเฟรช "ทีละใบ" — ดึงเอกสารใบเดียวจาก backend แล้ว merge เข้า cache + ยิง event (ใช้ตอนกลับจากหน้าเอกสาร)
 *  ไม่ดึงทั้ง list · ใบที่หายจาก backend (ลบไปแล้ว) → เอาออกจาก cache ด้วย */
export async function refreshOneDoc(code: string, doc = "CL"): Promise<void> {
  const t = tenant();
  if (!t || !code) return;
  let fresh: ClDoc | null = null;
  try { fresh = await apiFetch<ClDoc>(`/sales-docs/${doc}/${encodeURIComponent(code)}`, { tenant: t }); }
  catch { return; }   // network พลาด — คง cache เดิม
  const rest = loadClDocs(doc).filter((r) => r.code !== code);
  writeCache(doc, fresh ? [fresh, ...rest] : rest);
  window.dispatchEvent(new CustomEvent(SALES_DOCS_EVENT, { detail: doc }));
}

/** ดึงรายการจาก backend → อัปเดต cache localStorage แล้วยิง event ให้หน้าจอ re-render (เรียกตอน mount ของกล่อง/รายการ)
 *  ส่ง doneLimit: ขอ DONE แค่ N ใบล่าสุด (ตรงกับที่ cache เก็บ DONE_MAX) — ลด egress มหาศาล ใบ DONE เก่าเปิดทีละใบผ่าน fetchClDoc ได้ */
export async function syncSalesDocs(doc = "CL", doneLimit = 250): Promise<ClDoc[]> {
  const t = tenant();
  if (!t) return loadClDocs(doc);
  try {
    // owner=me → กรอง "ของฉัน" ที่ backend (คนไม่มีงานได้ ~0) · DONE โหลดแยกตอนกดแท็บ (loadDoneDocs)
    const list = (await apiFetch<ClDoc[]>(`/sales-docs?docType=${doc}&doneLimit=${doneLimit}&owner=${encodeURIComponent(me())}`, { tenant: t })) ?? [];
    // ดึง active-only (ไม่มี DONE มาด้วย) → คง DONE เดิมที่ loadDoneDocs โหลดไว้ ไม่ให้ถูก wipe (กัน race กับแท็บเสร็จสิ้น)
    const merged = list.some((r) => r.phase === "DONE") ? list : [...list, ...loadClDocs(doc).filter((r) => r.phase === "DONE")];
    const sorted = writeCache(doc, merged);   // memory = ครบ, localStorage = cap MAX
    window.dispatchEvent(new CustomEvent(SALES_DOCS_EVENT, { detail: doc }));
    pingNotifs(); // ให้กระดิ่ง/ตัวแจ้งเตือนรวมประเมินใหม่ (มีเอกสารรอรับใหม่ไหม)
    return sorted;
  } catch {
    return loadClDocs(doc);
  }
}

/** ===== Log การไหล/ตรวจทานของเอกสาร (ส่ง/รับ/ดึงกลับ/เสร็จ) — เก็บ localStorage ต่อบริษัท ===== */
export type FlowAction = "SEND" | "RECEIVE" | "RECALL" | "DONE" | "DECLINE";
export type FlowLogEntry = { code: string; action: FlowAction; by: string; to?: string; at: number; fromStage?: string; toStage?: string };
const flowKey = () => `idoc.sales.flowlog.${tenant()}`;

export function loadFlowLog(code: string): FlowLogEntry[] {
  try {
    const raw = localStorage.getItem(flowKey());
    const list = raw ? (JSON.parse(raw) as FlowLogEntry[]) : [];
    return list.filter((e) => e.code === code).sort((a, b) => b.at - a.at);   // ใหม่ → เก่า
  } catch { return []; }
}
export function appendFlowLog(e: FlowLogEntry): void {
  try {
    const raw = localStorage.getItem(flowKey());
    const list = raw ? (JSON.parse(raw) as FlowLogEntry[]) : [];
    list.push(e);
    localStorage.setItem(flowKey(), JSON.stringify(list.slice(-5000)));
  } catch { /* ignore */ }
}

/** ออกเลขเอกสาร {DOC}{ปีเดือน}-{เลขรัน} */
export function genClCode(doc = "CL"): string {
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const n = loadClDocs(doc).filter((x) => x.code.startsWith(`${doc}${ym}`)).length + 1;
  return `${doc}${ym}-${n}`;
}

/** จำแท็บล่าสุดของกล่อง (ต่อ doc) */
export function loadClTab(doc = "CL"): ReqPhase {
  const v = localStorage.getItem(`idoc.sales.${doc.toLowerCase()}.tab`) as ReqPhase | null;
  return v && REQ_PHASES.includes(v) ? v : "PROCESS";
}
export function saveClTab(p: ReqPhase, doc = "CL"): void {
  localStorage.setItem(`idoc.sales.${doc.toLowerCase()}.tab`, p);
}

/** ชื่อรายการย่อยของ QT (values.items = JSON) */
export function qtItemNames(itemsJson?: string | null): string[] {
  let arr: { name?: string }[];
  try { arr = itemsJson ? JSON.parse(itemsJson) : []; } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((it) => (it.name || "").trim()).filter(Boolean))];
}

/** ประเภทบริการที่ใช้จริงในรายการย่อยของ QT (อบรม/ที่ปรึกษา/...) — ไว้ทำตัวเลือก "บริการที่ปิดได้" */
export function qtItemServiceTypes(itemsJson?: string | null): string[] {
  let arr: { serviceType?: string }[];
  try { arr = itemsJson ? JSON.parse(itemsJson) : []; } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((it) => (it.serviceType || "").trim()).filter(Boolean))];
}

/** จัดรายการย่อยของ QT (values.items = JSON) เป็นข้อความบรรทัดต่อบรรทัด — ใช้กับช่อง "บันทึกรายการ" ของ SO */
export function fmtQtItems(itemsJson?: string | null): string {
  let arr: { name?: string; serviceType?: string; price?: string; discount?: string; qty?: string; unit?: string }[];
  try { arr = itemsJson ? JSON.parse(itemsJson) : []; } catch { return ""; }
  if (!Array.isArray(arr) || !arr.length) return "";
  return arr.map((it, i) => {
    const name = (it.name || "").trim();
    if (!name) return "";
    const parts = [name];
    if ((it.serviceType || "").trim()) parts.push(it.serviceType!.trim());
    const qty = (it.qty || "").toString().trim();
    if (qty) parts.push(`${qty}${(it.unit || "").trim() ? " " + it.unit!.trim() : ""}`);
    if ((it.price || "").toString().trim()) parts.push(`${it.price}฿`);
    if (Number(it.discount) > 0) parts.push(`ลด ${it.discount}`);
    return `${i + 1}. ${parts.join(" · ")}`;
  }).filter(Boolean).join("\n");
}
