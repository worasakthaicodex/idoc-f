import { settingsGet, settingsSet } from "../../shared/settingsStore";

/**
 * ตั้งค่า "การปิดการขาย" ของ QT (ต่อบริษัท ผ่าน tenant_setting) — ผู้ใช้ปรับเองได้
 *  - strategies   = กลยุทธที่ใช้ปิด (กรณีปิดได้)
 *  - lostReasons  = สาเหตุดีลที่ปิดไม่สำเร็จ (กรณีปิดไม่ได้)
 *  - fileTypes    = ชนิดไฟล์แนบทั้งหมด (ใช้ร่วมกับเครื่องมือ "ไฟล์แนบ" ของลูกค้า)
 *  - requiredFiles = ชนิดไฟล์ที่ "บังคับต้องมี" ก่อนปิดการขายได้ (เช่น ใบโอนยอด)
 */
const K_STRAT = "sales.close.strategies";
const K_LOST = "sales.close.lostReasons";
const K_FILETYPES = "sales.attach.fileTypes";
const K_REQFILES = "sales.close.requiredFiles";

export const DEFAULT_STRATEGIES = ["นำเสนอราคาพิเศษ / ส่วนลด", "ต่อรองเงื่อนไขการชำระเงิน", "เพิ่มบริการเสริม", "ปิดด้วยความสัมพันธ์", "เร่งรอบการตัดสินใจ", "อื่นๆ"];
export const DEFAULT_LOST_REASONS = [
  "ลูกค้าไม่เกี่ยวข้องกับบริการของบริษัท",
  "บริการไม่ครอบคลุมไม่ทันสมัย ( ระบุในคอมเม้นว่าบริการอะไร )",
  "ไม่ตรงรอบการใช้บริการ (ระบุว่าเมื่อไร)",
  "ขาดความน่าเชื่อถือหรือมีผู้ให้บริการประจำ",
  "แผนงานไม่ชัดเจนไม่คุ้มค่า",
  "ราคาเเพง",
  "ไม่ทราบเหตุผล",
];
export const DEFAULT_FILE_TYPES = ["ใบเสนอราคา", "สัญญา", "ใบรับรอง", "เอกสารบริษัท", "ใบโอนยอด / หลักฐานชำระเงิน", "อื่นๆ"];

export const getCloseStrategies = (): string[] => settingsGet<string[]>(K_STRAT, DEFAULT_STRATEGIES);
export const setCloseStrategies = (v: string[]): void => settingsSet(K_STRAT, v);
export const getLostReasons = (): string[] => settingsGet<string[]>(K_LOST, DEFAULT_LOST_REASONS);
export const setLostReasons = (v: string[]): void => settingsSet(K_LOST, v);
export const getAttachFileTypes = (): string[] => settingsGet<string[]>(K_FILETYPES, DEFAULT_FILE_TYPES);
export const setAttachFileTypes = (v: string[]): void => settingsSet(K_FILETYPES, v);
export const getRequiredCloseFiles = (): string[] => settingsGet<string[]>(K_REQFILES, []);
export const setRequiredCloseFiles = (v: string[]): void => settingsSet(K_REQFILES, v);
