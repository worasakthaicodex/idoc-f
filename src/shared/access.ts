import { getSession, type Session } from "./session";

/**
 * สิทธิ์เข้าโมดูลตามตำแหน่ง (ผูกจากตำแหน่ง → session.modules) — 3 ระดับ:
 *   USER < ADMIN (ผู้ดูแล) < SUPER_ADMIN (ผู้ดูแลสูงสุด)
 * เจ้าของระบบ/เจ้าของบริษัท = สูงสุดทุกโมดูลเสมอ
 */
export const MODULE = {
  CUSTOMER: "ลูกค้า",
  SALES: "งานขาย",
  HR: "บุคคล",
  PRODUCT: "สินค้าและบริการ",
  ACCOUNTING: "บัญชี",
  FINANCE: "การเงิน",
  PP: "การวางแผนการผลิต",
  MANUFACTURING: "การผลิต",
} as const;

export type AccessLevel = "USER" | "ADMIN" | "SUPER_ADMIN";

const isOwner = (s: Session | null) => s?.role === "PLATFORM_OWNER" || s?.role === "COMPANY_OWNER";

/** ระดับสิทธิ์ของผู้ใช้ในโมดูลนี้ — owner = SUPER_ADMIN · ไม่มีสิทธิ์ = null */
export function moduleLevel(code: string, s: Session | null = getSession()): AccessLevel | null {
  if (isOwner(s)) return "SUPER_ADMIN";
  const lv = s?.modules?.[code];
  return lv === "SUPER_ADMIN" || lv === "ADMIN" || lv === "USER" ? lv : null;
}

/** เป็น "ผู้ดูแล" ขึ้นไป (ADMIN/SUPER_ADMIN) ของโมดูลนี้ไหม — ใช้กับ เพิ่ม/แก้ไขตรง */
export function isModuleAdmin(code: string, s: Session | null = getSession()): boolean {
  const lv = moduleLevel(code, s);
  return lv === "ADMIN" || lv === "SUPER_ADMIN";
}

/** เป็น "ผู้ดูแลสูงสุด" (SUPER_ADMIN) ของโมดูลนี้ไหม — ใช้กับ หน้าตั้งค่า */
export function isModuleSuperAdmin(code: string, s: Session | null = getSession()): boolean {
  return moduleLevel(code, s) === "SUPER_ADMIN";
}
