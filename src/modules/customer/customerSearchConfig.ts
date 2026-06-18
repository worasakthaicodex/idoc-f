import { settingsGet, settingsSet } from "../../shared/settingsStore";
import { getEnabledFields } from "./customerFieldConfig";

/**
 * ฟิลด์ที่ใช้ "ค้นหาเต็มพิกัด" ได้ — ตั้งค่าได้ต่อบริษัท (คล้ายมุมมองตาราง)
 * เลือกจาก: รหัส (code) + ฟิลด์ที่บริษัทเปิดใช้ · (สถานะไม่อยู่ เพราะตารางโชว์เฉพาะ ACTIVE)
 */
const KEY = "crm.searchFields";

export const SEARCH_SPECIAL = ["code"];
export const DEFAULT_SEARCH = ["code", "name", "groupName", "phone"];

/** ฟิลด์ทั้งหมดที่ "เลือกให้ค้นได้" = รหัส + ฟิลด์ที่เปิดใช้ */
export function searchableUniverse(): string[] {
  const fields = getEnabledFields();
  return [...SEARCH_SPECIAL, ...fields.filter((k) => !SEARCH_SPECIAL.includes(k))];
}

export function getSearchFields(): string[] {
  const cols = settingsGet<string[]>(KEY, [...DEFAULT_SEARCH]);
  const allowed = new Set(searchableUniverse());
  const filtered = cols.filter((k) => allowed.has(k));
  return filtered.length ? filtered : DEFAULT_SEARCH.filter((k) => allowed.has(k));
}

export function setSearchFields(keys: string[]): void {
  settingsSet(KEY, keys);
}
