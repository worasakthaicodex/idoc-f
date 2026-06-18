import { User, Mail, Hexagon, Clock, Calendar, BarChart, Box } from "../../shared/icons";

/**
 * เมนูซ้ายของโมดูลลูกค้า (CRM) — label จาก i18n: customer.menu.<key>
 *  to = ปลายทางที่กดแล้วไป (ถ้ามี) · enabled=false = ยังไม่เปิด (เร็วๆ นี้)
 * (settings "ตั้งค่า CRM" แสดงแยกใต้เส้นคั่นใน CustomerSide ตามสิทธิ์)
 */
export type CustMenuItem = { key: string; Icon: typeof User; enabled: boolean; to?: string };

export const customerMenu: CustMenuItem[] = [
  { key: "core", Icon: User, enabled: true, to: "/customer" },
  { key: "requests", Icon: Mail, enabled: true, to: "/customer/requests" },
  { key: "groups", Icon: Hexagon, enabled: true, to: "/customer/groups" },
  { key: "basket", Icon: Box, enabled: true, to: "/customer/basket" },
  { key: "active", Icon: Clock, enabled: true, to: "/customer/active" },
  { key: "calendar", Icon: Calendar, enabled: true, to: "/customer/calendar" },
  { key: "reports", Icon: BarChart, enabled: true, to: "/customer/reports" },
];
