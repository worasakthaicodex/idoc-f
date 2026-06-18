/**
 * ทะเบียนฟิลด์ข้อมูลลูกค้า (configurable) — เลือก/จัดได้แบบเดียวกับ Employee fields
 * ยุบมาจากตารางลูกค้าเดิม: ตัด extension_column / ฟิลด์ระบบ, รวม register_id+code+daterun เป็น code (REG{ปีเดือน}-{เลขรัน}),
 * ตัด register_type (แยกลูกค้า/คู่ค้าเป็นคนละโมดูลแล้ว)
 *  - core = ฟิลด์บังคับ ปิดไม่ได้
 *  - def  = เปิดไว้เป็นค่าตั้งต้น
 * label แปลผ่าน i18n: custFields.<key> · กลุ่มผ่าน custFields.group.<group>
 */
export type FieldGroup =
  | "general" | "classify" | "contact" | "address" | "finance" | "approver" | "note";

export type FieldType = "text" | "select" | "date" | "textarea" | "address";

export type CustField = {
  key: string;
  group: FieldGroup;
  core?: boolean;
  def?: boolean;
  type?: FieldType;
  opts?: string[];
};

export const fieldType = (key: string): FieldType => CUST_FIELDS.find((f) => f.key === key)?.type ?? "text";
export const isSelectField = (key: string) => fieldType(key) === "select";

/**
 * ฟิลด์ที่มี "คอลัมน์จริง" ในตาราง customer → ส่งเป็น field ตรงใน request
 * ฟิลด์อื่น ๆ ที่บริษัทเปิดใช้ → เก็บลง attributes (JSONB)
 */
export const COLUMN_KEYS: string[] = ["name", "groupName"];
export const isColumnField = (key: string) => COLUMN_KEYS.includes(key);

export const GROUPS: FieldGroup[] = [
  "general", "classify", "contact", "address", "finance", "approver", "note",
];

export const CUST_FIELDS: CustField[] = [
  // ----- ทั่วไป -----
  { key: "registerTitle", group: "general", def: true, type: "select", opts: ["บจก", "บมจ", "หจก", "หสม", "สำนักงาน", "วิสาหกิจชุมชน", "ร้าน/บุคคลธรรมดา", "ราชการ/รัฐวิสาหกิจ", "อื่นๆ"] },
  { key: "name", group: "general", core: true },
  { key: "partyType", group: "general", def: true, type: "select", opts: ["นิติบุคคล", "บุคคลธรรมดา"] },
  { key: "groupName", group: "general", def: true, type: "select", opts: ["ไม่ระบุ", "อาหาร", "ยา", "เครื่องสำอาง", "วัตถุอันตราย", "เครื่องมือแพทย์", "ขนส่ง", "food chain", "อื่นๆ"] },
  { key: "grade", group: "general", def: true, type: "select", opts: ["A", "B", "C", "D", "NONE", "NEW"] },

  // ----- จัดประเภท -----
  { key: "businessType", group: "classify", def: true, type: "select", opts: ["ไม่ระบุ", "ผลิต", "งานบริการ", "แปรรูป", "แปรรูปขั้นต้น", "ร้านอาหาร / โรงแรม", "ซื้อมาขายไป", "ตัดแต่ง", "แบ่งบรรจุ", "คัดบรรจุ"] },
  { key: "productCategory", group: "classify", type: "select", opts: ["สินค้าทั่วไป", "วัตถุดิบ", "อะไหล่", "บริการ"] },
  { key: "categorization", group: "classify", type: "select", opts: ["ลูกค้าใหม่", "ลูกค้าประจำ", "ลูกค้าเก่า", "ลูกค้าหยุดซื้อ"] },
  { key: "behavior", group: "classify", type: "textarea" },
  { key: "point", group: "classify" },

  // ----- ติดต่อ -----
  { key: "contactPerson", group: "contact", def: true },
  { key: "personPosition", group: "contact" },
  { key: "personNumber", group: "contact" },
  { key: "personEmail", group: "contact" },
  { key: "phone", group: "contact", def: true },
  { key: "mobile", group: "contact", def: true },
  { key: "email", group: "contact", def: true },
  { key: "fax", group: "contact" },
  { key: "website", group: "contact" },
  { key: "social", group: "contact" },

  // ----- ที่อยู่ -----
  { key: "addressFull", group: "address", def: true, type: "address" },
  { key: "address", group: "address", type: "textarea" },
  { key: "region", group: "address", type: "select", opts: ["กรุงเทพและปริมณฑล", "ภาคกลาง", "ภาคเหนือ", "ภาคตะวันออกเฉียงเหนือ", "ภาคตะวันออก", "ภาคตะวันตก", "ภาคใต้"] },
  { key: "lat", group: "address" },
  { key: "lon", group: "address" },

  // ----- การเงิน / ภาษี -----
  { key: "taxId", group: "finance", def: true },
  { key: "branchCode", group: "finance" },
  { key: "paymentTerms", group: "finance", def: true, type: "select", opts: ["เงินสด", "เครดิต 7 วัน", "เครดิต 15 วัน", "เครดิต 30 วัน", "เครดิต 45 วัน", "เครดิต 60 วัน", "เครดิต 90 วัน"] },
  { key: "creditLimit", group: "finance", def: true },
  { key: "bankAccount", group: "finance" },
  { key: "preferredCurrency", group: "finance", type: "select", opts: ["THB", "USD", "EUR", "JPY", "CNY"] },
  { key: "capital", group: "finance" },
  { key: "headcount", group: "finance" },
  { key: "horsepower", group: "finance" },
  { key: "dbd", group: "finance" },

  // ----- ผู้อนุมัติ -----
  { key: "approverName", group: "approver" },
  { key: "approverPosition", group: "approver" },
  { key: "approverPhone", group: "approver" },
  { key: "approverEmail", group: "approver" },

  // ----- หมายเหตุ -----
  { key: "note", group: "note", type: "textarea" },
  { key: "otherConditions", group: "note", type: "textarea" },
];

const keysWhere = (f: (x: CustField) => boolean) => CUST_FIELDS.filter(f).map((x) => x.key);

export const CORE_KEYS = keysWhere((f) => !!f.core);
export const DEFAULT_KEYS = keysWhere((f) => !!f.core || !!f.def);

export const PRESETS: { id: string; keys: string[] }[] = [
  { id: "basic", keys: DEFAULT_KEYS },
  { id: "all", keys: CUST_FIELDS.map((f) => f.key) },
];
