/**
 * ระบบแจ้งเตือนกลาง (เบาๆ) — แต่ละโมดูลลงทะเบียน "provider" คืนรายการแจ้งเตือนของตัวเอง
 * ตัวกระดิ่งที่ /app รวมจากทุก provider · ออกแบบให้เพิ่มแหล่งใหม่ได้ในอนาคต (งานอนุมัติ, แชท ฯลฯ)
 */
export type AppNotif = {
  id: string;        // ไม่ซ้ำ (ใช้ key + กันเด้งซ้ำ)
  kind: string;      // ชนิด → i18n: notif.kind.<kind>
  primary: string;   // บรรทัดหลัก (เช่น รหัสเอกสาร)
  secondary?: string; // บรรทัดรอง (เช่น ชื่อลูกค้า)
  to?: string;       // route ที่กดแล้วไป
  at: number;        // เวลา (ใช้เรียงใหม่→เก่า)
};

type Provider = () => AppNotif[];
const providers: Provider[] = [];

/** ลงทะเบียนแหล่งแจ้งเตือน (idempotent) */
export function registerNotifProvider(p: Provider): void {
  if (!providers.includes(p)) providers.push(p);
}

/** รวมแจ้งเตือนจากทุกแหล่ง (ใหม่ → เก่า) · เอาแค่ 50 ใบล่าสุดพอ ไม่ให้ยาวเกิน */
const NOTIF_CAP = 50;
export function getNotifs(): AppNotif[] {
  return providers
    .flatMap((p) => { try { return p(); } catch { return []; } })
    .sort((a, b) => b.at - a.at)
    .slice(0, NOTIF_CAP);
}

export function notifCount(): number {
  return getNotifs().length;
}

/* ===== สถานะ "อ่านแล้ว" (แยกจาก "ทำแล้ว") — เก็บ id ที่อ่านแล้วใน localStorage ===== */
const READ_KEY = "idoc.notif.read";
function readSet(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]") as string[]); } catch { return new Set(); } }
function writeReadSet(s: Set<string>): void { try { localStorage.setItem(READ_KEY, JSON.stringify([...s].slice(-3000))); } catch { /* ignore */ } }
export function isNotifRead(id: string): boolean { return readSet().has(id); }
/** จำนวนที่ "ยังไม่ได้อ่าน" (ใช้กับตัวเลขกระดิ่ง) */
export function unreadCount(): number { const s = readSet(); return getNotifs().filter((n) => !s.has(n.id)).length; }
export function markNotifRead(id: string): void { const s = readSet(); if (!s.has(id)) { s.add(id); writeReadSet(s); pingNotifs(); } }
export function markAllNotifsRead(): void { const s = readSet(); getNotifs().forEach((n) => s.add(n.id)); writeReadSet(s); pingNotifs(); }

/** ส่งสัญญาณว่ามีการเปลี่ยนแปลง → UI ที่ subscribe จะรีเฟรช */
export const NOTIF_EVENT = "idoc:notify";
export function pingNotifs(): void {
  try { window.dispatchEvent(new Event(NOTIF_EVENT)); } catch { /* ignore */ }
}

/** subscribe การเปลี่ยนแปลง (ภายในแท็บ + ข้ามแท็บผ่าน storage) — คืนฟังก์ชัน unsubscribe */
export function subscribeNotifs(fn: () => void): () => void {
  window.addEventListener(NOTIF_EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(NOTIF_EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}
