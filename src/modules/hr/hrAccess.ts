import { getSession, type Session } from "../../shared/session";
import { settingsGet, settingsSet } from "../../shared/settingsStore";
import { MODULE, isModuleAdmin, isModuleSuperAdmin } from "../../shared/access";

/**
 * ตั้งค่าโมดูล HR — toggle "เปิดบังคับสิทธิ์" (เก็บที่ backend)
 *  - ปิด (default) = ใครก็เข้าหน้าตั้งค่าได้ (กันล็อกตัวเองออก)
 *  - เปิด = เข้าได้เฉพาะ super admin ของ HR
 */
const KEY = "hr.enforce";

export function isHrEnforced(): boolean {
  return settingsGet<boolean>(KEY, false) === true;
}

export function setHrEnforced(on: boolean): void {
  settingsSet(KEY, on);
}

/**
 * เป็น super admin ของ HR ไหม — ตอนนี้: เจ้าของระบบ/เจ้าของบริษัท
 * (ภายหลังต่อสิทธิ์ระดับโมดูล SUPER_ADMIN จาก position ของผู้ใช้ได้)
 */
export function isHrAdmin(s: Session | null = getSession()): boolean {
  return isModuleAdmin(MODULE.HR, s);
}

/** เข้าหน้า "ตั้งค่า" ได้ไหม — เฉพาะ "ผู้ดูแลสูงสุด" ของบุคคล */
export function canAccessHrSettings(s: Session | null = getSession()): boolean {
  return isModuleSuperAdmin(MODULE.HR, s);
}
