import { getSession, type Session } from "../../shared/session";
import { settingsGet, settingsSet } from "../../shared/settingsStore";
import { MODULE, isModuleAdmin, isModuleSuperAdmin } from "../../shared/access";

/**
 * ตั้งค่าโมดูลลูกค้า (CRM) — toggle "เปิดบังคับสิทธิ์" (เก็บที่ backend)
 *  - ปิด (default) = ใครก็เข้าหน้าตั้งค่าได้ (กันล็อกตัวเอง)
 *  - เปิด = เข้าได้เฉพาะ admin ของ CRM
 */
const KEY = "crm.enforce";

export function isCrmEnforced(): boolean {
  return settingsGet<boolean>(KEY, false) === true;
}

export function setCrmEnforced(on: boolean): void {
  settingsSet(KEY, on);
}

/** เป็น "ผู้ดูแล" (ADMIN+) ของลูกค้าไหม — ใช้กับ เพิ่ม/แก้ไขตรง/ย้อนเวอร์ชัน */
export function isCrmAdmin(s: Session | null = getSession()): boolean {
  return isModuleAdmin(MODULE.CUSTOMER, s);
}

/** เข้าหน้า "ตั้งค่า" ได้ไหม — เฉพาะ "ผู้ดูแลสูงสุด" ของลูกค้า */
export function canAccessCrmSettings(s: Session | null = getSession()): boolean {
  return isModuleSuperAdmin(MODULE.CUSTOMER, s);
}
