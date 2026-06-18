import { settingsGet, settingsSet } from "../../shared/settingsStore";
import { DEFAULT_STATUS_CODES } from "./customerStatus";

/**
 * ตั้งค่าสถานะลูกค้าต่อบริษัท — เก็บที่ backend (tenant_setting)
 *  - enabled = โค้ดสถานะที่เปิดใช้ (ACTIVE บังคับเปิดเสมอ)
 *  - labels  = คำที่บริษัทเปลี่ยนเอง (override label เริ่มต้นจาก i18n)
 */
const EKEY = "crm.status.enabled";
const LKEY = "crm.status.labels";

export function getEnabledStatuses(): string[] {
  const arr = settingsGet<string[]>(EKEY, [...DEFAULT_STATUS_CODES]);
  if (!arr.includes("ACTIVE")) return ["ACTIVE", ...arr];
  return arr;
}

export function setEnabledStatuses(codes: string[]): void {
  const set = new Set(codes);
  set.add("ACTIVE"); // บังคับเปิดเสมอ
  settingsSet(EKEY, [...set]);
}

export function getStatusLabelOverrides(): Record<string, string> {
  return settingsGet<Record<string, string>>(LKEY, {});
}

export function getStatusOverride(code: string): string | undefined {
  const v = getStatusLabelOverrides()[code];
  return v && v.trim() ? v : undefined;
}

export function setStatusLabelOverrides(labels: Record<string, string>): void {
  settingsSet(LKEY, labels);
}
