/** session ผู้ใช้ (mock) — เก็บบริษัทที่ login ไว้ ใช้เป็น tenant ของทุก API call */
const KEY = "idoc.session";

export type Session = {
  // tenant — ว่าง ("") สำหรับเจ้าของระบบ (ไม่ผูกบริษัท)
  companyId: string;
  companyCode: string;
  companyName: string;
  fullName?: string;
  email?: string;
  employeeCode?: string;
  /** สิทธิ์จาก backend: PLATFORM_OWNER | COMPANY_OWNER | STAFF */
  role?: string;
  /** สิทธิ์เข้าโมดูลตามตำแหน่ง: moduleCode → USER|ADMIN|SUPER_ADMIN (owner ไม่ต้องมี = สูงสุดทุกโมดูล) */
  modules?: Record<string, string>;
};

/**
 * ระดับสิทธิ์ 3 ระดับ (ตัดสินที่ backend, ส่งมากับ session.role):
 *   เจ้าของระบบ (PLATFORM_OWNER) > เจ้าของบริษัท (COMPANY_OWNER) > พนักงาน (STAFF)
 */
export function isPlatformOwner(s: Session | null = getSession()): boolean {
  return s?.role === "PLATFORM_OWNER";
}

/** เจ้าของบริษัท = ผู้ดูแล/คนเช่าระบบ (ผู้สมัครใช้งานต่อบริษัท) — เห็น "การจัดการบริษัท" */
export function isCompanyOwner(s: Session | null = getSession()): boolean {
  return s?.role === "COMPANY_OWNER";
}

export function getSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

/**
 * ล้างเฉพาะแคช "ที่สร้างใหม่ได้ 100%" เมื่อ localStorage เต็ม
 *  - idoc.sales.enrich.*  = ข้อมูลเสริม (เกรด/ติดต่อ/นัด) ดึงใหม่ได้
 *  - idoc.calendar.*      = mirror ปฏิทิน (ของจริงอยู่ backend)
 * ⚠️ ห้ามแตะแคชเอกสาร (idoc.sales.qt/fo/cl/so.*) และ flowlog — อาจมีร่างที่ยังไม่ sync = ข้อมูลหาย
 */
function evictDisposableCaches(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("idoc.sales.enrich.") || k.startsWith("idoc.calendar."))) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}

export function setSession(s: Session): void {
  const json = JSON.stringify(s);
  try {
    localStorage.setItem(KEY, json);
  } catch {
    // โควต้าเต็ม → ล้างแคชที่ดึงใหม่ได้ แล้วลองเขียน session อีกครั้ง (session สำคัญ ห้ามพัง)
    evictDisposableCaches();
    try { localStorage.setItem(KEY, json); } catch { /* ยังไม่พอ — อย่างน้อยไม่ throw */ }
  }
  // โหลด config ต่อบริษัทจาก backend หลังเข้าระบบ (dynamic import กัน import cycle)
  if (s.companyId) import("./settingsStore").then((m) => m.loadSettings()).catch(() => {});
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}
