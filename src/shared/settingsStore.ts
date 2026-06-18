import { apiFetch } from "./api";
import { getSession } from "./session";

/**
 * ค่าตั้งค่าต่อบริษัท (key-value) — แหล่งจริงอยู่ backend (/api/settings)
 * มี cache ในหน่วยความจำ + mirror localStorage เพื่อให้ getter ทำงานแบบ sync (ไม่ต้องแก้ทุกหน้า)
 *  - settingsGet/Set ใช้ key สั้น ๆ (ไม่ต้องใส่ companyId — backend scope ตาม tenant)
 *  - loadSettings() ดึงจาก backend มาเติม cache ตอนเข้าระบบ แล้วยิง event ให้ re-render
 */
const cache = new Map<string, unknown>();
const tenant = () => getSession()?.companyId ?? "";
const lsKey = (t: string, key: string) => `idoc.set.${t}.${key}`;
const cacheKey = (t: string, key: string) => `${t}:${key}`;

export function settingsGet<T>(key: string, def: T): T {
  const t = tenant();
  const ck = cacheKey(t, key);
  if (cache.has(ck)) return cache.get(ck) as T;
  try {
    const raw = localStorage.getItem(lsKey(t, key));
    if (raw != null) { const v = JSON.parse(raw); cache.set(ck, v); return v as T; }
  } catch { /* ignore */ }
  return def;
}

export function settingsSet(key: string, value: unknown): void {
  const t = tenant();
  cache.set(cacheKey(t, key), value);
  try { localStorage.setItem(lsKey(t, key), JSON.stringify(value)); } catch { /* ignore */ }
  if (t) apiFetch(`/settings/${encodeURIComponent(key)}`, { method: "PUT", tenant: t, body: { value } }).catch(() => {});
}

/** เหมือน settingsSet แต่ await การบันทึกขึ้น backend จริง คืน true/false ว่าลง DB สำเร็จไหม */
export async function settingsSetAwait(key: string, value: unknown): Promise<boolean> {
  const t = tenant();
  cache.set(cacheKey(t, key), value);
  try { localStorage.setItem(lsKey(t, key), JSON.stringify(value)); } catch { /* ignore */ }
  if (!t) return false;
  try {
    await apiFetch(`/settings/${encodeURIComponent(key)}`, { method: "PUT", tenant: t, body: { value } });
    return true;
  } catch {
    return false;
  }
}

export async function loadSettings(): Promise<void> {
  const t = tenant();
  if (!t) return;
  try {
    const all = await apiFetch<Record<string, unknown>>("/settings", { tenant: t });
    Object.entries(all).forEach(([key, value]) => {
      cache.set(cacheKey(t, key), value);
      try { localStorage.setItem(lsKey(t, key), JSON.stringify(value)); } catch { /* ignore */ }
    });
    window.dispatchEvent(new CustomEvent("idoc:settings-loaded"));
  } catch { /* ignore */ }
}
