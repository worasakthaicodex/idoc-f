/**
 * ทะเบียนฟิลด์ข้อมูลพนักงาน (configurable) — ERP แต่ละบริษัทเลือกใช้ฟิลด์ไม่เหมือนกัน
 *  - core = ฟิลด์บังคับ ปิดไม่ได้
 *  - def  = เปิดไว้เป็นค่าตั้งต้น (สำคัญ)
 * label แปลผ่าน i18n: empFields.<key> · กลุ่มผ่าน empFields.group.<group>
 */
export type FieldGroup =
  | "general" | "employment" | "doc" | "contact" | "emergency" | "address" | "statutory";

/**
 * ประเภทฟิลด์ (ไม่ระบุ = text):
 *  - select   = dropdown มีตัวเลือก (ตั้งใน Field options)
 *  - date     = วันที่ (input type=date)
 *  - textarea = ข้อความยาว
 *  - address  = ที่อยู่แบบค้นหา (ดึง ต./อ./จ./รหัสไปรษณีย์ จาก DB ภูมิศาสตร์ไทย เก็บเป็นข้อความเต็ม)
 */
export type FieldType = "text" | "select" | "date" | "textarea" | "address";

export type EmpField = {
  key: string;
  group: FieldGroup;
  core?: boolean;
  def?: boolean;
  type?: FieldType;
  /** ตัวเลือกเริ่มต้นสำหรับ select (บริษัทเพิ่ม/แก้เองได้ภายหลัง) */
  opts?: string[];
};

export const fieldType = (key: string): FieldType => EMP_FIELDS.find((f) => f.key === key)?.type ?? "text";
export const isSelectField = (key: string) => fieldType(key) === "select";

/**
 * ฟิลด์ที่มี "คอลัมน์จริง" ในตาราง employee → ส่งเป็น field ตรงใน request
 * ฟิลด์อื่น ๆ ที่บริษัทเปิดใช้ทั้งหมด → เก็บลง attributes (JSONB) ไม่ต้อง migration
 */
export const COLUMN_KEYS: string[] = [
  "fullName", "birthday", "idCard", "position",
  "email", "tel", "mobile", "line",
  "houseNumber", "building", "village", "alley", "road", "subDistrict", "province", "zip", "address", "addressFull",
  "passportNo", "passportDate", "passportCountry", "passportDistrict",
];
export const isColumnField = (key: string) => COLUMN_KEYS.includes(key);

export const GROUPS: FieldGroup[] = [
  "general", "employment", "doc", "contact", "emergency", "address", "statutory",
];

export const EMP_FIELDS: EmpField[] = [
  // ทั่วไป
  { key: "prefix", group: "general", def: true, type: "select", opts: ["นาย", "นาง", "นางสาว"] },
  { key: "fullName", group: "general", core: true },
  { key: "nickName", group: "general" },
  { key: "education", group: "general", type: "select", opts: ["ต่ำกว่า ม.6", "ม.6 / ปวช.", "ปวส. / อนุปริญญา", "ปริญญาตรี", "ปริญญาโท", "ปริญญาเอก"] },
  { key: "gender", group: "general", def: true, type: "select", opts: ["ชาย", "หญิง", "อื่นๆ"] },
  { key: "birthday", group: "general", def: true, type: "date" },
  { key: "nationality", group: "general", def: true },
  { key: "idCard", group: "general", def: true },
  { key: "religion", group: "general", type: "select", opts: ["พุทธ", "อิสลาม", "คริสต์", "ฮินดู", "ซิกข์", "อื่นๆ"] },
  { key: "maritalStatus", group: "general", type: "select", opts: ["โสด", "สมรส", "หย่าร้าง", "หม้าย"] },
  { key: "bloodType", group: "general", type: "select", opts: ["A", "B", "AB", "O"] },
  // การจ้างงาน
  { key: "position", group: "employment", core: true },
  { key: "employeeType", group: "employment", def: true, type: "select", opts: ["ประจำ", "สัญญาจ้าง", "รายวัน", "พาร์ทไทม์", "ฝึกงาน", "แรงงานต่างด้าว"] },
  { key: "startDate", group: "employment", def: true, type: "date" },
  { key: "department", group: "employment" },
  { key: "division", group: "employment" },
  // เอกสาร / ต่างด้าว
  { key: "countryOfOrigin", group: "doc" },
  { key: "passportNo", group: "doc" },
  { key: "passportDate", group: "doc", type: "date" },
  { key: "passportExpiry", group: "doc", type: "date" },
  { key: "passportCountry", group: "doc" },
  { key: "workPermitNo", group: "doc" },
  { key: "workPermitExpiry", group: "doc", type: "date" },
  { key: "visaType", group: "doc", type: "select", opts: ["Non-B", "Non-O", "Work Permit", "ท่องเที่ยว", "อื่นๆ"] },
  { key: "visaExpiry", group: "doc", type: "date" },
  // ติดต่อ
  { key: "email", group: "contact", def: true },
  { key: "tel", group: "contact" },
  { key: "mobile", group: "contact", def: true },
  { key: "line", group: "contact" },
  // ผู้ติดต่อฉุกเฉิน
  { key: "emergencyName", group: "emergency" },
  { key: "emergencyPhone", group: "emergency" },
  { key: "emergencyRelation", group: "emergency" },
  // ที่อยู่
  { key: "addressFull", group: "address", def: true, type: "address" }, // ค้นหา ต./อ./จ./รหัสไปรษณีย์
  { key: "houseNumber", group: "address" },
  { key: "building", group: "address" },
  { key: "village", group: "address" },
  { key: "alley", group: "address" },
  { key: "road", group: "address" },
  { key: "subDistrict", group: "address" },
  { key: "province", group: "address" },
  { key: "zip", group: "address" },
  { key: "address", group: "address", type: "textarea" },
  // ทะเบียน / ภาษี
  { key: "ssoNumber", group: "statutory" },
  { key: "taxId", group: "statutory" },
  { key: "bankName", group: "statutory" },
  { key: "bankAccount", group: "statutory" },
];

const keysWhere = (f: (x: EmpField) => boolean) => EMP_FIELDS.filter(f).map((x) => x.key);

export const CORE_KEYS = keysWhere((f) => !!f.core);
export const DEFAULT_KEYS = keysWhere((f) => !!f.core || !!f.def);

/** เทมเพลตแนะนำ (ฟังก์ชันเสนอแนะ) */
export const PRESETS: { id: string; keys: string[] }[] = [
  { id: "basic", keys: DEFAULT_KEYS },
  {
    id: "foreign",
    keys: [
      ...DEFAULT_KEYS,
      "nationality", "countryOfOrigin",
      "passportNo", "passportDate", "passportExpiry", "passportCountry",
      "workPermitNo", "workPermitExpiry", "visaType", "visaExpiry",
    ],
  },
  { id: "all", keys: EMP_FIELDS.map((f) => f.key) },
];
