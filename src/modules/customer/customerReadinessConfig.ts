import { settingsGet, settingsSet, settingsSetAwait } from "../../shared/settingsStore";

/**
 * การพร้อมใช้ (Readiness) — เงื่อนไขที่ทำให้ลูกค้า "พร้อมให้ดำเนินการ/ติดตามต่อ"
 * เลือกเปิดได้หลายรูปแบบ + ตั้งพารามิเตอร์ · เก็บที่ backend (tenant_setting)
 *   afterSaleDone = ปิดการขาย/บริการเสร็จแล้ว (หน่วงได้กี่วัน เพราะบางงานบริการนาน)
 *   sinceContact  = ไม่ได้ติดต่อมาแล้วไม่ต่ำกว่า N เดือน
 *   calendarDue   = ถึงกำหนดที่นัดไว้ใน calendar
 */
export type ReadinessConfig = {
  afterSaleDone: { on: boolean; days: number };
  sinceContact: { on: boolean; months: number };
  calendarDue: { on: boolean; days: number };   // มีกำหนดในปฏิทินภายใน ±days วัน (ยังไม่เสร็จ)
};

const KEY = "crm.readiness";
const DEFAULT: ReadinessConfig = {
  afterSaleDone: { on: false, days: 0 },
  sinceContact: { on: false, months: 6 },
  calendarDue: { on: false, days: 15 },
};

export function getReadiness(): ReadinessConfig {
  const v = settingsGet<Partial<ReadinessConfig>>(KEY, {});
  return {
    afterSaleDone: { ...DEFAULT.afterSaleDone, ...(v.afterSaleDone ?? {}) },
    sinceContact: { ...DEFAULT.sinceContact, ...(v.sinceContact ?? {}) },
    calendarDue: { ...DEFAULT.calendarDue, ...(v.calendarDue ?? {}) },   // days เก่าที่ไม่มีจะได้ค่า default 15
  };
}

export function setReadiness(c: ReadinessConfig): void {
  settingsSet(KEY, c);
}

/** บันทึกแบบ await — คืน true เมื่อลง backend (DB) สำเร็จจริง */
export function saveReadiness(c: ReadinessConfig): Promise<boolean> {
  return settingsSetAwait(KEY, c);
}

/** จำนวนรูปแบบที่เปิดใช้ (สำหรับโชว์ในหน้าตั้งค่า) */
export function readinessCount(): number {
  const c = getReadiness();
  return [c.afterSaleDone.on, c.sinceContact.on, c.calendarDue.on].filter(Boolean).length;
}
