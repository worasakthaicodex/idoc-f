import { Users, Dollar, Clock, BarChart } from "../../shared/icons";

/**
 * เมนูซ้ายของระบบบุคคล (HR) — ใช้ร่วมกันทั้งหน้า /hr และฟอร์มพนักงาน
 * label มาจาก i18n: hr.menu.<key> · เพิ่มรายการใหม่/เปิดใช้งานได้ที่นี่ที่เดียว
 */
export const hrMenu = [
  { key: "core", Icon: Users, enabled: true },
  { key: "payroll", Icon: Dollar, enabled: false },
  { key: "timeoff", Icon: Clock, enabled: false },
  { key: "evaluation", Icon: BarChart, enabled: false },
];
