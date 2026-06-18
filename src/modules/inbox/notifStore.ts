import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";
import { pingNotifs } from "../../shared/notifications";

/**
 * แจ้งเตือนที่ backend "เขียนไว้" ตอนมีเหตุการณ์จริง (ส่งเอกสาร/ปิดการขายได้)
 * อ่านตอนเปิดแอป + ตอน SSE "notify" เด้ง (event-driven ไม่ poll) · เก็บ cache ในหน่วยความจำให้ provider อ่าน sync
 */
export type ServerNotif = {
  id: string;
  kind: string;
  title: string;
  body?: string | null;
  refType?: string | null;
  refCode?: string | null;
  byUser?: string | null;
  createdAt: string;
  readAt?: string | null;
};

const tenant = () => getSession()?.companyId ?? "";
const me = () => { const s = getSession(); return s?.fullName || s?.email || s?.companyCode || ""; };

let cache: ServerNotif[] = [];
export function loadServerNotifs(): ServerNotif[] { return cache; }

/** ดึงรายการแจ้งเตือนของฉัน (ล่าสุด 50) — เรียกตอนเปิดแอป + ตอน SSE เด้ง */
export async function refreshServerNotifs(): Promise<void> {
  const t = tenant(); const u = me();
  if (!t || !u) return;
  try {
    cache = (await apiFetch<ServerNotif[]>(`/notifications?user=${encodeURIComponent(u)}&limit=50`, { tenant: t })) ?? [];
    pingNotifs();
  } catch { /* ignore */ }
}

/** ทำเครื่องหมายอ่านแล้วทั้งหมดที่ backend (sync ข้ามเครื่อง) */
export async function markAllServerNotifsRead(): Promise<void> {
  const t = tenant(); const u = me();
  if (!t || !u) return;
  cache = cache.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }));
  try { await apiFetch(`/notifications/read-all?user=${encodeURIComponent(u)}`, { method: "POST", tenant: t }); } catch { /* ignore */ }
}
