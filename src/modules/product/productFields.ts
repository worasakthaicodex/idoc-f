/**
 * ทะเบียนฟิลด์สินค้า/วัตถุดิบ (Material Master) — จัดกลุ่มตาม "มุมมอง" แบบ SAP
 *  - core = บังคับ ปิดไม่ได้ (name)
 *  - def  = เปิดเป็นค่าเริ่มต้น
 *  - group = มุมมอง (บันทึกตรงๆ ว่าฟิลด์นี้อยู่มุมมองอะไร — โมดูลอื่นดึงไปใช้ได้)
 *  - groupName = หมวดหมู่ (เก็บเป็นคอลัมน์จริง เหมือน customer.group_name)
 * มุมมอง: พื้นฐาน · ประเภทสินค้า · หน่วยนับ · จัดประเภท · ขาย · จัดซื้อ · วางแผน(MRP) · คลัง · บัญชี · ต้นทุน · คุณภาพ
 */
export type FieldGroup =
  | "basic" | "type" | "uom" | "classification" | "sales"
  | "purchasing" | "mrp" | "storage" | "accounting" | "costing" | "quality";
export type FieldType = "text" | "select" | "date" | "textarea" | "number" | "table";

export type ProdField = {
  key: string;
  group: FieldGroup;
  core?: boolean;
  def?: boolean;
  type?: FieldType;
  opts?: string[];
  th: string;
  en: string;
};

export const GROUPS: FieldGroup[] = [
  "basic", "type", "uom", "classification", "sales",
  "purchasing", "mrp", "storage", "accounting", "costing", "quality",
];
export const GROUP_LABEL: Record<FieldGroup, { th: string; en: string }> = {
  basic: { th: "พื้นฐาน", en: "Basic" },
  type: { th: "ประเภทสินค้า", en: "Material type" },
  uom: { th: "หน่วยนับ", en: "Units (UoM)" },
  classification: { th: "จัดประเภท", en: "Classification" },
  sales: { th: "มุมมองขาย", en: "Sales" },
  purchasing: { th: "มุมมองจัดซื้อ", en: "Purchasing" },
  mrp: { th: "มุมมองวางแผน (MRP)", en: "MRP / Planning" },
  storage: { th: "มุมมองคลัง", en: "Storage / WM" },
  accounting: { th: "มุมมองบัญชี", en: "Accounting" },
  costing: { th: "มุมมองต้นทุน", en: "Costing" },
  quality: { th: "มุมมองคุณภาพ", en: "Quality (QM)" },
};

/** ฟิลด์ที่เป็น "คอลัมน์จริง" ในตาราง product (ที่เหลือเก็บใน attributes JSONB) */
export const COLUMN_KEYS = ["name", "groupName"];
export const isColumnField = (key: string) => COLUMN_KEYS.includes(key);

const UNIT_OPTS = ["รายการ", "ชิ้น", "กล่อง", "ลัง", "แพ็ค", "ใบ", "เล่ม", "ชุด", "กิโลกรัม", "เมตร", "ลิตร", "MD", "-"];

export const PROD_FIELDS: ProdField[] = [
  // ----- พื้นฐาน (Basic) -----
  { key: "name", group: "basic", core: true, th: "ชื่อสินค้า/บริการ", en: "Name" },
  { key: "groupName", group: "basic", def: true, type: "select", th: "หมวดหมู่", en: "Category",
    opts: ["บริการฝึกอบรมภายใน", "บริการคำปรึกษาระบบคุณภาพ", "บริการ One Stop Service", "-"] },
  { key: "sku", group: "basic", def: true, th: "รหัส SKU", en: "SKU" },
  { key: "barcode", group: "basic", th: "บาร์โค้ด", en: "Barcode" },
  { key: "weight", group: "basic", type: "number", th: "น้ำหนัก (กก.)", en: "Weight (kg)" },
  { key: "dimensions", group: "basic", th: "ขนาด/มิติ (กxยxส)", en: "Dimensions" },
  { key: "image", group: "basic", th: "รูป (URL)", en: "Image URL" },
  { key: "description", group: "basic", def: true, type: "textarea", th: "รายละเอียด", en: "Description" },
  { key: "note", group: "basic", type: "textarea", th: "หมายเหตุ", en: "Note" },

  // ----- ประเภทสินค้า (Material Type) -----
  { key: "materialType", group: "type", def: true, type: "select", th: "ประเภทสินค้า", en: "Material type",
    opts: ["สินค้าสำเร็จรูป", "กึ่งสำเร็จรูป", "วัตถุดิบ", "ซื้อมาขายไป", "บริการ", "บรรจุภัณฑ์"] },
  { key: "kind", group: "type", type: "select", th: "ชนิด", en: "Kind",
    opts: ["สินค้า", "บริการ", "วัตถุดิบ", "สินค้าประกอบ (BOM)"] },
  { key: "productType", group: "type", type: "select", th: "ประเภทบริการ", en: "Service type",
    opts: ["บริการ", "สินค้า", "วัตถุดิบ", "อะไหล่", "อื่นๆ"] },
  { key: "bom", group: "type", type: "select", th: "ประกอบจาก BOM", en: "Has BOM", opts: ["ใช่", "ไม่ใช่"] },

  // ----- หน่วยนับ (UoM + conversion) -----
  { key: "unit", group: "uom", def: true, type: "select", th: "หน่วยฐาน", en: "Base unit", opts: UNIT_OPTS },
  { key: "salesUnit", group: "uom", type: "select", th: "หน่วยขาย", en: "Sales unit", opts: UNIT_OPTS },
  { key: "purchaseUnit", group: "uom", type: "select", th: "หน่วยซื้อ", en: "Purchase unit", opts: UNIT_OPTS },
  { key: "stockUnit", group: "uom", type: "select", th: "หน่วยคลัง", en: "Stock unit", opts: UNIT_OPTS },
  { key: "uomConversion", group: "uom", th: "อัตราแปลงหน่วย", en: "UoM conversion" },   // เช่น 1 กล่อง = 12 ชิ้น

  // ----- จัดประเภท (Classification) -----
  { key: "brand", group: "classification", th: "ยี่ห้อ/แบรนด์", en: "Brand" },
  { key: "classGroup", group: "classification", th: "กลุ่มจัดประเภท", en: "Class group" },
  { key: "characteristics", group: "classification", type: "textarea", th: "คุณลักษณะเพิ่มเติม", en: "Characteristics" },
  { key: "tags", group: "classification", th: "ป้ายกำกับ (tag)", en: "Tags" },

  // ----- มุมมองขาย (Sales) -----
  { key: "price", group: "sales", def: true, type: "number", th: "ราคาขาย", en: "Sell price" },
  { key: "priceGroup", group: "sales", th: "กลุ่มราคา", en: "Price group" },
  { key: "currency", group: "sales", type: "select", th: "สกุลเงิน", en: "Currency", opts: ["THB", "USD", "EUR", "JPY", "CNY"] },
  { key: "taxType", group: "sales", type: "select", th: "ภาษี", en: "Tax", opts: ["มี VAT 7%", "ไม่มี VAT", "ยกเว้นภาษี"] },

  // ----- มุมมองจัดซื้อ (Purchasing) = ตารางผู้ขาย (vendors) เก็บ JSON คีย์เดียว · ฟอร์มเรนเดอร์เป็นตารางย่อย -----
  { key: "vendors", group: "purchasing", def: true, type: "table", th: "ผู้ขาย / ราคาซื้อ / Lead time", en: "Vendors / price / lead time" },

  // ----- มุมมองวางแผน (MRP) -----
  { key: "mrpType", group: "mrp", type: "select", th: "ชนิดการวางแผน", en: "MRP type",
    opts: ["ไม่วางแผน", "จุดสั่งซื้อ (Reorder)", "ตามความต้องการ (MRP)"] },
  { key: "reorderPoint", group: "mrp", type: "number", th: "จุดสั่งซื้อ", en: "Reorder point" },
  { key: "minStock", group: "mrp", type: "number", th: "สต๊อกขั้นต่ำ", en: "Min stock" },
  { key: "safetyStock", group: "mrp", type: "number", th: "สต๊อกปลอดภัย", en: "Safety stock" },
  { key: "lotSize", group: "mrp", type: "number", th: "ขนาดล็อตสั่ง", en: "Lot size" },
  { key: "plannedDeliveryTime", group: "mrp", type: "number", th: "เวลานำส่งวางแผน (วัน)", en: "Planned delivery time" },

  // ----- มุมมองคลัง (Storage / WM) -----
  { key: "warehouse", group: "storage", th: "คลัง/ที่จัดเก็บ", en: "Warehouse" },
  { key: "bin", group: "storage", th: "ตำแหน่งเก็บ (bin)", en: "Storage bin" },
  { key: "storageCondition", group: "storage", type: "select", th: "เงื่อนไขจัดเก็บ", en: "Storage condition",
    opts: ["ปกติ", "แช่เย็น", "แช่แข็ง", "ควบคุมความชื้น", "วัตถุอันตราย"] },
  { key: "shelfLife", group: "storage", type: "number", th: "อายุสินค้า (วัน)", en: "Shelf life (days)" },
  { key: "stockQty", group: "storage", type: "number", th: "จำนวนคงเหลือ", en: "Stock qty" },

  // ----- มุมมองบัญชี (Accounting) -----
  { key: "valuationClass", group: "accounting", th: "ประเภทมูลค่า (valuation class)", en: "Valuation class" },
  { key: "priceControl", group: "accounting", type: "select", th: "วิธีคิดราคา", en: "Price control",
    opts: ["ราคามาตรฐาน (S)", "ราคาเฉลี่ยเคลื่อนที่ (V)"] },
  { key: "standardPrice", group: "accounting", type: "number", th: "ราคามาตรฐาน", en: "Standard price" },
  { key: "movingAvgPrice", group: "accounting", type: "number", th: "ราคาเฉลี่ยเคลื่อนที่", en: "Moving avg price" },

  // ----- มุมมองต้นทุน (Costing) -----
  { key: "cost", group: "costing", def: true, type: "number", th: "ต้นทุน", en: "Cost" },
  { key: "costingLotSize", group: "costing", type: "number", th: "ขนาดล็อตคิดต้นทุน", en: "Costing lot size" },
  { key: "plannedCost", group: "costing", type: "number", th: "ต้นทุนวางแผน", en: "Planned cost" },

  // ----- มุมมองคุณภาพ (QM) -----
  { key: "qmActive", group: "quality", type: "select", th: "ต้องตรวจคุณภาพ", en: "QM active", opts: ["ใช่", "ไม่ใช่"] },
  { key: "inspectionType", group: "quality", type: "select", th: "ประเภทการตรวจ", en: "Inspection type",
    opts: ["รับเข้า", "ระหว่างผลิต", "ก่อนส่งมอบ"] },
  { key: "inspectionPlan", group: "quality", th: "แผนการตรวจ", en: "Inspection plan" },
];

const BY_KEY: Record<string, ProdField> = Object.fromEntries(PROD_FIELDS.map((f) => [f.key, f]));

export const fieldType = (key: string): FieldType => BY_KEY[key]?.type ?? "text";
export const isSelectField = (key: string) => fieldType(key) === "select";
export const fieldOptsOf = (key: string): string[] => BY_KEY[key]?.opts ?? [];

/** มุมมองของฟิลด์ (สำหรับหน้าตั้งค่า — บอกว่าช่องนี้อยู่มุมมองอะไร) */
export const groupOfKey = (key: string): FieldGroup | undefined => BY_KEY[key]?.group;
export const groupLabelOf = (key: string, lang: string): string => {
  const g = BY_KEY[key]?.group;
  return g ? (lang.startsWith("th") ? GROUP_LABEL[g].th : GROUP_LABEL[g].en) : "";
};

/** label ตามภาษา */
export const prodLabel = (key: string, lang: string): string => {
  if (key === "code") return lang.startsWith("th") ? "รหัส" : "Code";
  if (key === "status") return lang.startsWith("th") ? "สถานะ" : "Status";
  const f = BY_KEY[key];
  if (!f) return key;
  return lang.startsWith("th") ? f.th : f.en;
};
export const groupLabel = (g: FieldGroup, lang: string): string => (lang.startsWith("th") ? GROUP_LABEL[g].th : GROUP_LABEL[g].en);

const keysWhere = (f: (x: ProdField) => boolean) => PROD_FIELDS.filter(f).map((x) => x.key);
export const CORE_KEYS = keysWhere((f) => !!f.core);
export const DEFAULT_KEYS = keysWhere((f) => !!f.core || !!f.def);
export const PRESETS: { id: string; th: string; en: string; keys: string[] }[] = [
  { id: "basic", th: "พื้นฐาน", en: "Basic", keys: DEFAULT_KEYS },
  { id: "all", th: "ทั้งหมด", en: "All", keys: PROD_FIELDS.map((f) => f.key) },
];
