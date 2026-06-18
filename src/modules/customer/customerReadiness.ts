import { getReadiness } from "./customerReadinessConfig";

/**
 * การคำนวณ "พร้อมใช้" ย้ายไปทำที่ DB แล้ว (GROUP BY + readiness ใน SQL ผ่าน /api/customers/group-counts)
 * เหลือเฉพาะตัวช่วยฝั่งหน้า: มีเงื่อนไข readiness เปิดอยู่ไหม (สำหรับ enable/disable ตัวกรอง)
 */
export function readinessActive(): boolean {
  const c = getReadiness();
  return c.sinceContact.on || c.calendarDue.on;
}
