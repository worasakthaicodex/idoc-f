/**
 * สถานะหลักของลูกค้า — โค้ดตายตัว (ตรงกับ enum ฝั่ง backend)
 * บริษัทเปิด/ปิด + เปลี่ยนคำที่แสดงได้ (ดู customerStatusConfig)
 *  - locked       = ปิดไม่ได้ (ACTIVE)
 *  - visibleOnMain= แสดงในหน้าหลัก (เฉพาะ ACTIVE) — สถานะอื่นถูกซ่อน
 *  - retentionYears = ตั้งคิวลบอัตโนมัติ (PENDING_DELETE = 1 ปี)
 * label เริ่มต้นมาจาก i18n: custStatus.<code>
 */
export type CustStatusCode =
  | "ACTIVE" | "INFORMATION_INCOMPLETE" | "NO_INTEREST"
  | "LEGAL_HOLD" | "BLACKLISTED" | "BUSINESS_CLOSED" | "PENDING_DELETE";

export type CustStatus = {
  code: CustStatusCode;
  def: boolean;
  locked?: boolean;
  visibleOnMain?: boolean;
  tone: "green" | "gray" | "red";
  retentionYears?: number;
};

export const STATUSES: CustStatus[] = [
  { code: "ACTIVE", def: true, locked: true, visibleOnMain: true, tone: "green" },
  { code: "INFORMATION_INCOMPLETE", def: true, tone: "gray" },
  { code: "NO_INTEREST", def: true, tone: "gray" },
  { code: "LEGAL_HOLD", def: false, tone: "red" },
  { code: "BLACKLISTED", def: true, tone: "red" },
  { code: "BUSINESS_CLOSED", def: true, tone: "gray" },
  { code: "PENDING_DELETE", def: true, tone: "red", retentionYears: 1 },
];

export const STATUS_BY_CODE: Record<string, CustStatus> =
  Object.fromEntries(STATUSES.map((s) => [s.code, s]));

export const DEFAULT_STATUS_CODES = STATUSES.filter((s) => s.def).map((s) => s.code);

export const statusTone = (code: string): "green" | "gray" | "red" =>
  STATUS_BY_CODE[code]?.tone ?? "gray";
