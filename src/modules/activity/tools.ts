import { Chat, Phone, Box, Paperclip } from "../../shared/icons";

/**
 * ทะเบียนเครื่องมือเอกสารใช้ร่วม (shared tools) — โมดูลไหนก็เปิดใช้ได้
 *  - key  = คีย์คงที่ (ใช้ใน config การเปิดใช้ และเป็น kind ของ activity)
 *  - kind = ชนิดข้อมูลที่ไปเก็บใน activity (ตรงกับฝั่ง backend ภายหลัง)
 *  - fields = ฟิลด์ของเครื่องมือ (payload) · auto fields (ผู้บันทึก/เวลา) ระบบเติมให้เอง
 *  - writesCalendar = เครื่องมือนี้สร้างรายการในปฏิทินด้วย
 * label แปลผ่าน i18n: tools.<key>.title / tools.<key>.desc · ฟิลด์: tools.fields.<fieldKey>
 * เพิ่มเครื่องมือใหม่ในอนาคต = เพิ่มอีก 1 แถวที่นี่ที่เดียว
 */
export type ToolKind = "COMMUNICATION" | "CALL_RESULT" | "CUSTOMER_SYSTEM" | "ATTACHMENT" | "SALES_SUMMARY";
export type ToolFieldType = "text" | "textarea" | "select" | "number" | "date" | "file";

/** log = บันทึกเพิ่มทีละรายการ · summary = ดึงสรุปอ่านอย่างเดียว (เช่น ประวัติการขาย) */
export type ToolMode = "log" | "summary";

export type ToolField = {
  key: string;
  type: ToolFieldType;
  opts?: string[];
  wide?: boolean;
};

export type ToolDef = {
  key: string;
  kind: ToolKind;
  Icon: typeof Chat;
  def?: boolean;
  writesCalendar?: boolean;
  mode?: ToolMode;          // ไม่ระบุ = "log"
  primary?: string;
  fields: ToolField[];
  /** เฉพาะ mode summary: คีย์ตัวเลขที่จะแสดง (label จาก tools.metrics.<key>) */
  metrics?: string[];
};

export const TOOLS: ToolDef[] = [
  {
    key: "comm", kind: "COMMUNICATION", Icon: Chat, def: true, primary: "message",
    fields: [{ key: "message", type: "textarea", wide: true }],
  },
  {
    key: "call", kind: "CALL_RESULT", Icon: Phone, def: true, primary: "result",
    fields: [
      { key: "result", type: "select", opts: ["สนใจ / นัดหมาย", "ระหว่างการพิจารณา", "นัดโทรกลับ", "ไม่รับสาย", "พบปัญหาการติดต่อ", "ไม่สนใจ / ปฏิเสธ", "ส่งต่อเปิด FO"] },
      { key: "minutes", type: "number" },
      { key: "problem", type: "text" },
      { key: "badInfo", type: "select", opts: ["-", "เบอร์ผิด", "อีเมลผิด", "ที่อยู่ผิด", "ผู้ติดต่อเปลี่ยน", "ปิดกิจการ"] },
    ],
  },
  {
    key: "systems", kind: "CUSTOMER_SYSTEM", Icon: Box, def: true, writesCalendar: true, primary: "system",
    fields: [
      { key: "system", type: "select", opts: ["ISO 9001", "ISO 14001", "ISO 45001", "ISO9001-2015", "ISO14001", "ISO22000",
    "GMP", "GMP Codex", "GMP for Packaging", "GMP เครื่องสำอาง", "GMP วัตถุอันตราย",
    "GHP", "HACCP", "HALAL", "HACCP/ HALAL", "FSSC", "BRC", "IFS", "IQA",
    "อย.", "ภพ.20", "รง.4", "สบ.1", "สบ.5", "สบ.7", "อ.2", "อ.7", 
    "อื่นๆ"] },
      { key: "expiry", type: "date" },
      { key: "scope", type: "text" },
      { key: "note", type: "textarea", wide: true },
    ],
  },
  {
    key: "files", kind: "ATTACHMENT", Icon: Paperclip, def: true, primary: "file",
    fields: [
      { key: "file", type: "file", wide: true },
      { key: "fileType", type: "select", opts: ["ใบเสนอราคา", "สัญญา", "ใบรับรอง", "เอกสารบริษัท", "อื่นๆ"] },
    ],
  },
];

/**
 * ประวัติการขาย — ตัวชี้วัดสรุป CL/FO/QT/SO ของลูกค้า (ดึงจากระบบขายผ่าน api ภายหลัง)
 * แยกเป็น tab ของตัวเองในหน้าลูกค้า ไม่ใช่ tool บันทึก (ดู SalesHistoryPanel)
 */
export const SALES_HISTORY_METRICS = ["won", "everFo", "clCount", "foCount", "qtCount", "soCount", "totalSales", "lastDoc"];

export const TOOL_BY_KEY: Record<string, ToolDef> = Object.fromEntries(TOOLS.map((tt) => [tt.key, tt]));
export const DEFAULT_TOOL_KEYS = TOOLS.filter((tt) => tt.def).map((tt) => tt.key);
