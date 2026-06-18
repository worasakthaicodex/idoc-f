import { settingsGet, settingsSet } from "../../shared/settingsStore";

/**
 * ตั้งค่า "กล่องงาน (Work box)" — แต่ละกล่อง (บทบาท) ให้ตำแหน่งไหนมองเห็นได้บ้าง — กันพนักงานกดผิดกล่อง
 *  map: roleKey (mk/telesale/sale/adminsale) → รายชื่อตำแหน่งที่เห็นกล่องนี้
 *  - กล่องที่ไม่มีตำแหน่ง (หรือไม่มีในแมป) = "เห็นตลอด" (ทุกตำแหน่ง) · ถ้ามีตำแหน่ง = เห็นเฉพาะตำแหน่งที่เพิ่มไว้
 */
const KEY = "sales.workbox.byPosition";
export type WorkboxMap = Record<string, string[]>;

/** บทบาทกล่องงานขาย (ตรงกับ ROLES ใน SalesHome) */
export const WORKBOX_ROLES: { key: string; code: string; th: string; en: string }[] = [
  { key: "mk", code: "MK", th: "การตลาด (MK) — CL", en: "Marketing (MK) — CL" },
  { key: "telesale", code: "TS", th: "เทเลเซล — FO", en: "Telesale — FO" },
  { key: "sale", code: "SL", th: "เซล — QT", en: "Sale — QT" },
  { key: "adminsale", code: "AD", th: "แอดมินขาย — SO", en: "Admin Sale — SO" },
];

export const getWorkboxByPosition = (): WorkboxMap => settingsGet<WorkboxMap>(KEY, {});
export const setWorkboxByPosition = (m: WorkboxMap): void => settingsSet(KEY, m);
