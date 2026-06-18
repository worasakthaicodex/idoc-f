import { settingsGet, settingsSet } from "../../shared/settingsStore";
import { PROD_FIELDS, CORE_KEYS, DEFAULT_KEYS, fieldOptsOf } from "./productFields";

/* ===== ฟิลด์ที่เปิดใช้ ===== */
const F_KEY = "prod.fields";
export function getEnabledFields(): string[] {
  const set = new Set<string>(settingsGet<string[]>(F_KEY, [...DEFAULT_KEYS]));
  CORE_KEYS.forEach((k) => set.add(k));
  return [...set];
}
export function setEnabledFields(keys: string[]): void {
  const set = new Set(keys);
  CORE_KEYS.forEach((k) => set.add(k));
  settingsSet(F_KEY, [...set]);
}

/* ===== ตัวเลือกของฟิลด์ select (ค่าตั้งต้นจาก registry + ที่บริษัทเพิ่มเอง) ===== */
const O_KEY = "prod.fieldopts";
export function getFieldOptions(key: string): string[] {
  const all = settingsGet<Record<string, string[]>>(O_KEY, {});
  const custom = all[key];
  return custom && custom.length ? custom : fieldOptsOf(key);
}
export function setFieldOptions(key: string, opts: string[]): void {
  const all = settingsGet<Record<string, string[]>>(O_KEY, {});
  settingsSet(O_KEY, { ...all, [key]: opts });
}

/* ===== สถานะ ===== */
export type ProdStatusCode = "ACTIVE" | "DISCONTINUED" | "OUT_OF_STOCK" | "DRAFT" | "PENDING_DELETE";
export const PROD_STATUSES: { code: ProdStatusCode; def: boolean; locked?: boolean; tone: "green" | "gray" | "red" }[] = [
  { code: "ACTIVE", def: true, locked: true, tone: "green" },
  { code: "DRAFT", def: true, tone: "gray" },
  { code: "OUT_OF_STOCK", def: true, tone: "red" },
  { code: "DISCONTINUED", def: true, tone: "gray" },
  { code: "PENDING_DELETE", def: false, tone: "red" },
];
export const STATUS_LABEL: Record<string, { th: string; en: string }> = {
  ACTIVE: { th: "ใช้งาน", en: "Active" },
  DRAFT: { th: "ฉบับร่าง", en: "Draft" },
  OUT_OF_STOCK: { th: "สินค้าหมด", en: "Out of stock" },
  DISCONTINUED: { th: "เลิกจำหน่าย", en: "Discontinued" },
  PENDING_DELETE: { th: "รอลบ", en: "Pending delete" },
};
export const statusTone = (code: string) => PROD_STATUSES.find((s) => s.code === code)?.tone ?? "gray";
const DEFAULT_STATUS_CODES = PROD_STATUSES.filter((s) => s.def).map((s) => s.code);

const SE_KEY = "prod.status.enabled";
const SL_KEY = "prod.status.labels";
export function getEnabledStatuses(): string[] {
  const arr = settingsGet<string[]>(SE_KEY, [...DEFAULT_STATUS_CODES]);
  return arr.includes("ACTIVE") ? arr : ["ACTIVE", ...arr];
}
export function setEnabledStatuses(codes: string[]): void {
  const set = new Set(codes); set.add("ACTIVE");
  settingsSet(SE_KEY, [...set]);
}
export function getStatusLabelOverrides(): Record<string, string> {
  return settingsGet<Record<string, string>>(SL_KEY, {});
}
export function getStatusOverride(code: string): string | undefined {
  const v = getStatusLabelOverrides()[code];
  return v && v.trim() ? v : undefined;
}
export function setStatusLabelOverrides(labels: Record<string, string>): void {
  settingsSet(SL_KEY, labels);
}
export const statusText = (code: string, lang: string): string =>
  getStatusOverride(code) || (STATUS_LABEL[code] ? (lang.startsWith("th") ? STATUS_LABEL[code].th : STATUS_LABEL[code].en) : code);

/* ===== มุมมองตาราง (คอลัมน์) ===== */
const C_KEY = "prod.columns";
export const COL_SPECIAL = ["code", "status"];
export const DEFAULT_COLUMNS = ["code", "name", "groupName", "price", "status"];
export function availableColumns(): string[] {
  return [...COL_SPECIAL, ...getEnabledFields().filter((k) => !COL_SPECIAL.includes(k))];
}
export function getColumns(): string[] {
  const cols = settingsGet<string[]>(C_KEY, [...DEFAULT_COLUMNS]);
  const allowed = new Set(availableColumns());
  const filtered = cols.filter((k) => allowed.has(k));
  return filtered.length ? filtered : DEFAULT_COLUMNS.filter((k) => allowed.has(k));
}
export function setColumns(keys: string[]): void { settingsSet(C_KEY, keys); }

/* ===== ฟิลด์ค้นเต็มพิกัด ===== */
const S_KEY = "prod.searchFields";
export const SEARCH_SPECIAL = ["code"];
export const DEFAULT_SEARCH = ["code", "name", "groupName", "sku"];
export function searchableUniverse(): string[] {
  return [...SEARCH_SPECIAL, ...getEnabledFields().filter((k) => !SEARCH_SPECIAL.includes(k))];
}
export function getSearchFields(): string[] {
  const cols = settingsGet<string[]>(S_KEY, [...DEFAULT_SEARCH]);
  const allowed = new Set(searchableUniverse());
  const filtered = cols.filter((k) => allowed.has(k));
  return filtered.length ? filtered : DEFAULT_SEARCH.filter((k) => allowed.has(k));
}
export function setSearchFields(keys: string[]): void { settingsSet(S_KEY, keys); }

export { PROD_FIELDS };
