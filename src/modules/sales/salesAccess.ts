import { getSession, type Session } from "../../shared/session";
import { MODULE, isModuleAdmin, isModuleSuperAdmin } from "../../shared/access";

/** เป็น "ผู้ดูแล" (ADMIN+) ของงานขายไหม */
export function isSalesAdmin(s: Session | null = getSession()): boolean {
  return isModuleAdmin(MODULE.SALES, s);
}

/** เข้าหน้า "ตั้งค่างานขาย" ได้ไหม — เฉพาะ "ผู้ดูแลสูงสุด" ของงานขาย */
export function canAccessSalesSettings(s: Session | null = getSession()): boolean {
  return isModuleSuperAdmin(MODULE.SALES, s);
}
