import { settingsGet, settingsSet } from "../../shared/settingsStore";

/**
 * อายุเอกสาร (วัน) — เริ่มนับถอยหลังเมื่อเอกสารอยู่ในกล่อง "รอดำเนินการ" (เริ่มที่วันที่รับเรื่อง)
 *  - ตั้งค่าต่อชนิดเอกสาร: CL / FO / QT (SO ไม่มีอายุ)
 *  - CL: ผู้ใช้ปรับเองได้ที่ฟอร์ม (ฟิลด์ timeframeCL) ถ้าไม่ใส่ → ใช้ค่าตั้งต้นนี้
 */
const KEY = "sales.age.days";
export const AGE_DOCS = ["CL", "FO", "QT"] as const;
export const DEFAULT_AGE: Record<string, number> = { CL: 30, FO: 60, QT: 30 };

export type AgeMap = Record<string, number>;
export const getAgeMap = (): AgeMap => settingsGet<AgeMap>(KEY, DEFAULT_AGE);
export const setAgeMap = (m: AgeMap): void => settingsSet(KEY, m);
export const ageDaysFor = (doc: string): number => { const v = getAgeMap()[doc]; return (v && v > 0) ? v : (DEFAULT_AGE[doc] ?? 0); };

/**
 * จุดเริ่มนับอายุของเอกสาร — เริ่มเมื่อ "รับเรื่อง" (กดรับ) เท่านั้น
 *  - ยังไม่กดรับ → ยังไม่เริ่มนับ (คืน undefined) · ก่อนรับยังไม่นับอายุ/หมดอายุ
 *  - มีรีวิชั่น (values.ageRestartAt) → รีเซ็ตเริ่มนับใหม่จากเวลานั้น
 */
export function ageStartMs(r?: { values?: Record<string, string> | null; received?: { at: number } | null; sent?: { at: number } | null; savedAt?: number } | null): number | undefined {
  if (!r) return undefined;
  const restart = Number(r.values?.ageRestartAt);
  if (restart > 0) return restart;
  return r.received?.at;   // เริ่มนับเมื่อรับเรื่องเท่านั้น (ยังไม่รับ = ยังไม่เริ่มนับ)
}

export type AgeInfo = { lifespan: number; used: number | null; left: number | null; expired: boolean; started: boolean; frozen: boolean };
/** สถานะอายุของเอกสาร — startMs = เวลาเข้ารอดำเนินการ (รับเรื่อง/ส่ง/บันทึก) · overrideDays = ค่าจากฟอร์ม (CL)
 *  endMs = เวลาที่ "หยุดนับ" (เช่นวันปิดเอกสารที่เสร็จสิ้นแล้ว) — ถ้ามี อายุจะแช่ไว้ ไม่นับต่อถึงวันนี้ */
export function ageInfo(doc: string, startMs?: number | null, overrideDays?: number, endMs?: number | null): AgeInfo {
  const lifespan = overrideDays && overrideDays > 0 ? overrideDays : ageDaysFor(doc);
  const frozen = !!(endMs && endMs > 0);   // ปิดแล้ว (มีวันปิด) — แม้ไม่มีวันเริ่มก็ถือว่า frozen
  if (!lifespan || !startMs) return { lifespan, used: null, left: null, expired: false, started: !!startMs, frozen };
  const end = frozen ? (endMs as number) : Date.now();
  const used = Math.max(0, Math.floor((end - startMs) / 86400000));
  const left = lifespan - used;
  return { lifespan, used, left, expired: left < 0, started: true, frozen };
}
