import { apiFetch } from "./api";
import { getSession } from "./session";

/**
 * ทะเบียนความสัมพันธ์โมดูล (กลาง) — ประกาศว่าโมดูลไหน "ต้องพึ่ง" โมดูลไหน
 * ใช้โชว์ในแถบ Documents ให้รู้ว่าเอกสารนี้เรียกใช้โมดูลอื่น + เช็คสถานะว่าพร้อมใช้ไหม
 * (สถานะความพร้อมตอนนี้อิงแคตตาล็อกกลาง /admin/modules · ภายหลังผูกกับ "โมดูลที่บริษัทซื้อ" ได้)
 */
export type ModuleDep = {
  key: string;       // คีย์โมดูล (ภายใน) เช่น "crm"
  label: string;     // ชื่อที่โชว์
  catalog: string;   // code ในแคตตาล็อกกลาง (ปัจจุบันเป็นชื่อไทย เช่น "ลูกค้า")
  to: string;        // route ที่กดแล้วไป
  reason: string;    // เหตุผลที่ต้องพึ่ง
};

export const MODULE_DEPS: Record<string, ModuleDep[]> = {
  sales: [
    { key: "crm", label: "ลูกค้า (CRM)", catalog: "ลูกค้า", to: "/customer", reason: "ใช้เลือก/อ้างอิงลูกค้าในรายชื่อ และตรวจสถานะลูกค้า" },
  ],
  customer: [
    { key: "sales", label: "งานขาย", catalog: "งานขาย", to: "/sales", reason: "ใช้สถิติการขาย (FO/QT/SO) ในมุมมอง “กลุ่ม → ตามงานขาย”" },
  ],
};

export function depsFor(moduleKey: string): ModuleDep[] {
  return MODULE_DEPS[moduleKey] ?? [];
}

/** dependency ที่ "ยังไม่พร้อม" (โมดูลไม่ได้เปิด/หมดอายุ) — ใช้ล็อกฟีเจอร์ที่ต้องพึ่งโมดูลนั้น */
export async function fetchUnavailableDeps(moduleKey: string): Promise<ModuleDep[]> {
  const avail = await fetchAvailableModules();
  return depsFor(moduleKey).filter((d) => !avail.has(d.catalog));
}

type CompanyModule = { moduleCode: string; active: boolean; expiresAt?: string | null };

/** เซ็ตของ code โมดูลที่บริษัทนี้ "เปิดไว้และยังไม่หมดอายุ" (ทะเบียนราย-บริษัท) */
export async function fetchAvailableModules(): Promise<Set<string>> {
  const tenant = getSession()?.companyId ?? "";
  try {
    const list = await apiFetch<CompanyModule[]>("/company-modules", { tenant });
    const today = new Date().toISOString().slice(0, 10);
    return new Set(
      list.filter((m) => m.active && (!m.expiresAt || m.expiresAt >= today)).map((m) => m.moduleCode),
    );
  } catch {
    return new Set();
  }
}
