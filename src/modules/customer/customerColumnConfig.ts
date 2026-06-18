import { settingsGet, settingsSet } from "../../shared/settingsStore";
import { getEnabledFields } from "./customerFieldConfig";

/**
 * มุมมองตารางลูกค้า — เลือก/เรียงคอลัมน์ที่จะโชว์ในหน้า /customer
 * เลือกได้จาก: คอลัมน์พิเศษ (รหัส, สถานะ) + ฟิลด์ที่บริษัทเปิดใช้เท่านั้น
 */
const KEY = "crm.columns";

/** คอลัมน์พิเศษ (ไม่ใช่ฟิลด์ข้อมูล) ใช้ได้เสมอ */
export const SPECIAL_COLS = ["code", "status"];
export const DEFAULT_COLUMNS = ["code", "name", "groupName", "phone", "status"];

/** คอลัมน์ทั้งหมดที่ "เลือกได้" = พิเศษ + ฟิลด์ที่เปิดใช้ */
export function availableColumns(): string[] {
  const fields = getEnabledFields();
  return [...SPECIAL_COLS, ...fields.filter((k) => !SPECIAL_COLS.includes(k))];
}

export function getColumns(): string[] {
  const cols = settingsGet<string[]>(KEY, [...DEFAULT_COLUMNS]);
  const allowed = new Set(availableColumns());
  const filtered = cols.filter((k) => allowed.has(k));
  return filtered.length ? filtered : DEFAULT_COLUMNS.filter((k) => allowed.has(k));
}

export function setColumns(keys: string[]): void {
  settingsSet(KEY, keys);
}
