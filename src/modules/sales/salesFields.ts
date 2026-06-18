/**
 * ทะเบียนฟิลด์เอกสารงานขาย (configurable) — เลือก/จัดเรียงได้แบบเดียวกับฟิลด์ลูกค้า/พนักงาน
 * เริ่มที่ CL (ใบคัดรายชื่อมาโทรเสนอ) — ยุบจากฟอร์ม jobDD เดิม + เพิ่มหัวข้อที่ควรมี
 * โครงเป็น map ต่อชนิดเอกสาร เผื่อขยาย FO/QT/SO ภายหลัง
 *  - core = ฟิลด์บังคับ ปิดไม่ได้ · def = เปิดเป็นค่าตั้งต้น
 * label แปลผ่าน i18n: salesFields.<key> · กลุ่มผ่าน salesFields.group.<group>
 */
export type SalesFieldGroup = "general" | "custKey" | "saleData" | "quote" | "items" | "target" | "classify" | "terms" | "amount" | "delivery" | "schedule" | "teleAssess" | "saleAssess" | "addl" | "payment" | "extra" | "note";
// member = รายชื่อมาจากผู้ที่อยู่ในเอกสารสิทธิ์ (authority frame) ของเอกสารนี้ ณ ขั้นที่ระบุ (ไม่ใช่ตัวเลือกตายตัว)
export type SalesFieldType = "text" | "number" | "select" | "multiselect" | "date" | "textarea" | "member";

export type SalesField = {
  key: string;
  group: SalesFieldGroup;
  core?: boolean;
  def?: boolean;
  type?: SalesFieldType;
  opts?: string[];
  /** เฉพาะ type="member": ดึงรายชื่อจากผู้ที่นั่งขั้นนี้ในเอกสารสิทธิ์ ("exec"=ดำเนินการ, "review"=ตรวจสอบ, "approve"=อนุมัติ) */
  memberStage?: "head" | "exec" | "review" | "approve";
  /** ช่องซ่อน — เก็บค่าใน data แต่ไม่โชว์ในฟอร์ม/หน้าตั้งค่า (เช่น อ้างอิงเอกสารต้นทาง, รหัสลูกค้า) */
  hidden?: boolean;
};

const REGION = ["กรุงเทพและปริมณฑล", "ภาคกลาง", "ภาคเหนือ", "ภาคตะวันออกเฉียงเหนือ", "ภาคตะวันออก", "ภาคตะวันตก", "ภาคใต้"];

// ----- ตัวเลือกของ FO (อ้างอิงฟอร์มจริง) — บางชุดใช้ร่วมกันทั้งฝั่ง Tele Sale และ Sale -----
const FO_USAGE = ["ยังไม่ทราบ", "ทราบคร่าว ๆ", "ทราบกำหนดการ"];
const FO_URGENCY = ["ยังไม่มีกำหนด", "พิจารณาภายใน 31-60 วัน", "พิจารณาภายใน 30 วัน"];
const FO_ENGAGE = ["ได้ขอรับใบเสนอราคาและนัดหมายนำเสนอแล้ว", "สอบถามรายละเอียดบริการอย่างเจาะจง", "สอบถามข้อมูลทั่วไปไม่ระบุความสนใจเฉพาะ"];
const FO_COMPETE = ["มีคู่เทียบเพียง 1-2 ราย", "อยู่ระหว่างหาข้อมูลเทียบราคา หรือมีคู่เทียบหลายราย", "ยังไม่มีความต้องการที่จะซื้อ"];
const FO_CONTACT_ROLE = ["ผู้ตัดสินใจหรือทำหน้าที่โดยตรง", "ผู้รวบรวมข้อมูลหรือเป็นส่วนหนึ่งของทีมผู้ตัดสินใจ", "ผู้ไม่มีส่วนเกี่ยวข้อง"];
const FO_TEMP = ["Cold", "Warm", "HOT"];
const FO_CALLBACK = ["ไม่ติดต่อกลับเลย", "ติดต่อกลับ 1-2 ครั้งภายในเดือน", "มากกว่า 2 ครั้งต่อเดือน"];
const FO_TRAITS = ["มีกำลังซื้อสูง", "มีเงื่อนไขมากมาย", "สนใจด้านข้อมูล", "สนใจด้านราคา"];
const FO_PLAN = ["ยังไม่นำเสนอเลย", "แค่พูดคุย", "ได้นำเสนอ"];
const FO_CLOSING = ["แนวคิดใหม่ๆ หรือวิธีการที่แตกต่าง", "ผลลัพธ์ที่จับต้องได้และตัวชี้วัด", "ประโยชน์ในระยะยาว", "นำเสนอข้อมูลเชิงประจักษ์"];

/** ฟิลด์ของเอกสาร CL (ลูกค้ามุ่งหวัง) */
const CL_FIELDS: SalesField[] = [
  // ----- ทั่วไป -----
  { key: "campaignName", group: "general", core: true },                                   // ชื่อชุด/แคมเปญ (หัวเรื่องใบ)
  { key: "telesale", group: "general", def: true, type: "member", memberStage: "exec" },   // TeleSale — รายชื่อจากผู้ที่นั่งขั้น "ดำเนินการ" ในเอกสารสิทธิ์ CL
  { key: "team", group: "general" },                                                       // ทีมขาย
  { key: "strategy", group: "general", def: true, type: "select", opts: ["แนวคิดใหม่ๆ หรือวิธีการที่แตกต่าง", "ผลลัพธ์ที่จับต้องได้และตัวชี้วัด", "ประโยชน์ในระยะยาว", "นำเสนอข้อมูลเชิงประจักษ์"] },
  { key: "priority", group: "general", type: "select", opts: ["สูง", "ปานกลาง", "ต่ำ"] },

  // ----- เป้าหมาย -----
  { key: "targetFO", group: "target", def: true, type: "number" },                         // เป้าหมายเปิด FO
  { key: "targetQT", group: "target", def: true, type: "number" },                         // เป้าหมายเปิด QT
  { key: "targetSO", group: "target", def: true, type: "number" },                         // เป้าหมายเปิด SO
  { key: "salesTarget", group: "target", type: "number" },                                 // เป้ายอดขาย (฿)
  { key: "timeframeCL", group: "target", def: true, type: "number" },                      // กรอบเวลา CL (วัน)

  // ----- จัดประเภท -----
  { key: "leadSource", group: "classify", def: true, type: "multiselect", opts: ["งานแสดงสินค้า", "เว็บไซต์ / Inbound", "ลูกค้าเก่า reactivate", "ซื้อรายชื่อ", "แนะนำต่อ", "โซเชียลมีเดีย", "อื่นๆ"] },
  { key: "targetIndustry", group: "classify", type: "select", opts: ["ไม่ระบุ", "อาหาร", "ยา", "เครื่องสำอาง", "วัตถุอันตราย", "เครื่องมือแพทย์", "ขนส่ง", "food chain", "อื่นๆ"] },
  { key: "channel", group: "classify", type: "select", opts: ["โทรศัพท์", "อีเมล", "LINE", "Walk-in", "โซเชียลมีเดีย"] },
  { key: "region", group: "classify", type: "select", opts: REGION },
  { key: "listCount", group: "classify", type: "number" },                                 // จำนวนรายชื่อในชุด

  // ----- กำหนดการ -----
  { key: "startDate", group: "schedule", def: true, type: "date" },
  { key: "dueDate", group: "schedule", def: true, type: "date" },

  // ----- ข้อมูลประกอบ -----
  { key: "promotionCode", group: "extra", type: "select" },                                // โปรโมชั่น (เลือกชุดข้อมูล)
  { key: "budget", group: "extra", type: "number" },                                       // งบประมาณแคมเปญ (฿)

  // ----- หมายเหตุ -----
  { key: "callScript", group: "note", type: "textarea" },                                  // สคริปต์การโทร / บทพูด
  { key: "note", group: "note", type: "textarea" },
];

/**
 * ฟิลด์ของเอกสาร FO (ใบติดตาม) — แบ่ง 3 กลุ่ม "ตามบทบาท" (= 3 แท็บในฟอร์มจริง):
 *   general   = ข้อมูลทั่วไป → ของผู้เปิดเอกสาร (ปกติเทเลเซล บางครั้งเซลเปิดเอง) รวมบริการที่ลูกค้าสนใจ
 *   teleAssess = ประเมินโดยเทเลเซล
 *   saleAssess = ประเมิน + สรุป/เสนอราคา โดยเซล
 * ผูกกลุ่ม↔ขั้น workflow ได้ที่หน้า stages (ดู DOC_STAGE_GROUPS)
 */
const FO_FIELDS: SalesField[] = [
  // ----- ข้อมูลทั่วไป (ผู้เปิดเอกสาร) -----
  { key: "customerName", group: "general", core: true },                                        // ลูกค้า / บริษัท (จากฐานลูกค้า)
  { key: "clRef", group: "general", def: true },                                                // เอกสาร CL (กรณีมาจาก CL)
  { key: "salesperson", group: "general", def: true, type: "member", memberStage: "exec" },     // พนักงานขาย
  { key: "contactPerson", group: "general", def: true },
  { key: "contactPhone", group: "general", def: true },
  { key: "servicesWanted", group: "general", def: true, type: "select", opts: ["บริการฝึกอบรม", "บริการที่ปรึกษาระบบ", "บริการตรวจประเมิน / ออกใบรับรอง", "อื่นๆ"] }, // บริการที่ลูกค้าต้องการ (ตัวเลือกเพิ่ม/แก้ได้ใน field-options)
  { key: "customerNeed", group: "general", def: true, type: "textarea" },                       // ความต้องการของลูกค้า (อธิบาย)

  // ----- ประเมินโดยเทเลเซล -----
  { key: "teleNote", group: "teleAssess", def: true, type: "textarea" },                        // บันทึกเพิ่มเติม
  { key: "usageSchedule", group: "teleAssess", def: true, type: "select", opts: FO_USAGE },     // กำหนดการใช้บริการ
  { key: "teleUrgency", group: "teleAssess", def: true, type: "select", opts: FO_URGENCY },     // ความเร่งด่วนในการตัดสินใจซื้อ
  { key: "teleEngagement", group: "teleAssess", def: true, type: "select", opts: FO_ENGAGE },   // การมีส่วนร่วม
  { key: "teleCompetition", group: "teleAssess", def: true, type: "select", opts: FO_COMPETE }, // สถานะการแข่งขัน
  { key: "teleContactRole", group: "teleAssess", def: true, type: "select", opts: FO_CONTACT_ROLE }, // ความสำคัญของผู้ประสานงาน
  { key: "teleTraits", group: "teleAssess", def: true, type: "multiselect", opts: FO_TRAITS },  // ลักษณะลูกค้า
  { key: "teleDocStatus", group: "teleAssess", def: true, type: "select", opts: FO_TEMP },      // สถานะเอกสาร

  // ----- ประเมิน + สรุป/เสนอราคา โดยเซล -----
  { key: "saleUrgency", group: "saleAssess", def: true, type: "select", opts: FO_URGENCY },
  { key: "saleEngagement", group: "saleAssess", def: true, type: "select", opts: FO_ENGAGE },
  { key: "saleCompetition", group: "saleAssess", def: true, type: "select", opts: FO_COMPETE },
  { key: "callbackFreq", group: "saleAssess", def: true, type: "select", opts: FO_CALLBACK },   // การติดต่อกลับ
  { key: "saleContactRole", group: "saleAssess", def: true, type: "select", opts: FO_CONTACT_ROLE },
  { key: "saleTraits", group: "saleAssess", def: true, type: "multiselect", opts: FO_TRAITS },    // ลักษณะลูกค้า (Sale)
  // ข้อมูลกิจการ (เก็บกับ FO ล่าสุด — ค่าที่เปลี่ยน/ต้องถามบ่อย ไม่ผูกเป็นฟิลด์ลูกค้า)
  { key: "numEmployees", group: "saleAssess", def: true, type: "number" },                        // จำนวนพนักงาน
  { key: "machineHp", group: "saleAssess", def: true, type: "number" },                           // แรงม้าเครื่องจักร
  { key: "registeredCapital", group: "saleAssess", def: true, type: "number" },                   // ทุนจดทะเบียน (฿)
  { key: "saleDocStatus", group: "saleAssess", def: true, type: "select", opts: FO_TEMP },
  { key: "planPresented", group: "saleAssess", def: true, type: "select", opts: FO_PLAN },      // นำเสนอแผนงาน
  { key: "winProbability", group: "saleAssess", def: true, type: "number" },                    // โอกาสปิดการขาย (0-100 %)
  { key: "closingMethod", group: "saleAssess", def: true, type: "multiselect", opts: FO_CLOSING }, // วิธีที่จะใช้ปิดการขาย
  { key: "expectedPrice", group: "saleAssess", def: true, type: "number" },                     // ราคาที่ลูกค้าน่าจะคาดหวัง
  { key: "suggestedPrice", group: "saleAssess", def: true, type: "number" },                    // ราคาที่ควรเสนอ
  { key: "competitorPrice", group: "saleAssess", type: "number" },                              // ราคาคู่แข่งถ้าทราบ

  // ----- ช่องซ่อน (อ้างอิงต้นทาง) — ค่ามาจากต้นทาง/กรอกเอง (ทำภายหลัง) -----
  { key: "srcCl", group: "general", hidden: true },          // มาจากเอกสาร CL ใด
  { key: "customerRef", group: "general", hidden: true },    // รหัสลูกค้า (REG)
];

// ----- ตัวเลือกของ QT (อ้างอิงฟอร์มจริง jobDD) -----
const QT_ITEM_SERVICE = ["บริการฝึกอบรมภายใน", "บริการคำปรึกษาระบบคุณภาพ", "บริการ One Stop Service"];
const QT_UNIT = ["เล่ม", "ใบ", "รายการ", "MD"];
const QT_PAYMENT = ["ชำระเงินก่อนเริ่มดำเนินกิจกรรม ไม่เกิน 7 วัน", "เเบ่งจ่าย 2 งวด", "เเบ่งจ่าย 2 งวด  (70/30)", "เเบ่งจ่าย 3 งวด", "เเบ่งจ่าย 4 งวด", "เเบ่งจ่าย 4 งวด ( แบบไตรมาส )"];
const QT_LASTPAY = ["เมื่อสิ้นสุดการทำงาน MD สุดท้าย", "ก่อนส่งมอบงาน", "-"];

/**
 * ฟิลด์ของเอกสาร QT (ใบเสนอราคา) — 2 กลุ่มหลักตามฟอร์มจริง + ตารางย่อย:
 *   saleData = ข้อมูลจาก Sale (หัวเอกสาร: บริษัท/ลูกค้า/ผู้ขาย/อ้างอิง FO/วันที่ + บันทึก)
 *   quote    = การเสนอราคา (บริการที่นำเสนอ + ยอดรวม/ส่วนลด/VAT + เงื่อนไขชำระเงิน + หมายเหตุ)
 *   items    = รายการย่อย (ตารางในฟอร์ม — คำนวณยอดให้ quote)
 */
const QT_FIELDS: SalesField[] = [
  // ----- ข้อมูลจาก Sale (หัวเอกสาร) -----
  { key: "companyName", group: "saleData", def: true, type: "select", opts: ["บริษัท คิวคอมแพค จำกัด"] }, // ในนามบริษัท
  { key: "customerCode", group: "saleData", core: true },                                     // รหัสลูกค้า / ลูกค้า (เลือกจากฐานลูกค้า)
  { key: "salesperson", group: "saleData", def: true, type: "member", memberStage: "exec" },  // พนักงานขาย
  { key: "saleDocStatus", group: "saleData", def: true, type: "select", opts: FO_TEMP },      // สถานะเอกสาร (Sale) — สืบทอดจาก FO, Sale ปรับได้
  { key: "documentRef", group: "saleData", def: true },                                       // FO อ้างอิง
  { key: "followupDate", group: "saleData", def: true, type: "date" },                        // วันที่จัดทำ
  { key: "extraNote", group: "saleData", type: "textarea" },                                  // บันทึกเพิ่มเติม
  { key: "editRequest", group: "saleData", type: "textarea" },                                // รายละเอียดการขอแก้ไข

  // ----- การเสนอราคา -----
  { key: "servicesOffered", group: "quote", def: true },                                      // บริการที่นำเสนอ
  { key: "grandTotal", group: "quote", def: true, type: "number" },                           // ราคารวมก่อนลด
  { key: "grandDiscount", group: "quote", def: true, type: "number" },                        // ส่วนลดรวม
  { key: "grandTotal2", group: "quote", def: true, type: "number" },                          // ราคาหลังหักส่วนลด
  { key: "vat", group: "quote", def: true, type: "number" },                                  // ราคารวม VAT
  { key: "netAmount", group: "quote", def: true, type: "number" },                            // ราคาเสนอรวม
  { key: "paymentTerms", group: "quote", def: true, type: "select", opts: QT_PAYMENT },       // เงื่อนไขการชำระเงิน
  { key: "lastPayment", group: "quote", type: "select", opts: QT_LASTPAY },                   // การเก็บเงินงวดสุดท้าย
  { key: "promotionInfo", group: "quote", def: true, type: "textarea" },                      // หมายเหตุใบเสนอราคา

  // ----- รายการย่อย (Items) = ตารางย่อยในฟอร์ม -----
  { key: "itemName", group: "items", def: true },                                             // รายการ
  { key: "itemServiceType", group: "items", def: true, type: "select", opts: QT_ITEM_SERVICE }, // ประเภทบริการ
  { key: "itemPrice", group: "items", def: true, type: "number" },                            // ราคา
  { key: "itemDiscount", group: "items", def: true, type: "number" },                         // ส่วนลด
  { key: "itemQty", group: "items", def: true, type: "number" },                              // จำนวน
  { key: "itemUnit", group: "items", def: true, type: "select", opts: QT_UNIT },              // หน่วย
  { key: "itemTotal", group: "items", def: true, type: "number" },                            // ราคารวม (ต่อรายการ)

  // ----- ช่องซ่อน (อ้างอิงต้นทาง) — auto จากต้นทาง หรือกรอกเองได้ -----
  { key: "customerRef", group: "saleData", hidden: true },    // รหัสลูกค้า (REG)
  { key: "srcCl", group: "saleData", hidden: true },          // CL ปลายทาง
  { key: "srcFo", group: "saleData", hidden: true },          // FO ปลายทาง
];

/** ฟิลด์ของเอกสาร SO (ใบสั่งขาย) — ตามดราฟ: ข้อมูลสำคัญลูกค้า + เพิ่มเติม + งวดชำระ 5 งวด */
const SO_FIELDS: SalesField[] = [
  // ----- ข้อมูลสำคัญจากลูกค้า -----
  { key: "customerName", group: "custKey", core: true },                                      // ลูกค้า / บริษัท
  { key: "salesperson", group: "custKey", def: true, type: "member", memberStage: "exec" },   // ผู้ขาย (Sale)
  { key: "quotationRef", group: "custKey", def: true },                                       // อ้างอิงใบเสนอราคา (QT)
  { key: "poNumber", group: "custKey" },                                                      // เลขที่ PO ลูกค้า
  { key: "orderDate", group: "custKey", def: true, type: "date" },                            // วันที่สั่งขาย
  // ----- ข้อมูลเพิ่มเติม -----
  { key: "saleAmount", group: "addl", def: true, type: "number" },                            // ยอดขาย (฿) — ใช้สรุปยอดขายย้อนหลังใน CL
  { key: "salesTechnique", group: "addl", def: true, type: "select", opts: FO_CLOSING },      // เทคนิคในการขายที่นำเสนอ
  { key: "closedService", group: "addl", def: true, type: "select", opts: QT_ITEM_SERVICE },  // ปิดบริการอะไร
  { key: "additionalInfo", group: "addl", def: true, type: "textarea" },                      // ข้อมูลเพิ่มเติม
  { key: "quoteItemsNote", group: "addl", def: true, type: "textarea" },                       // บันทึกรายการ (ดึงรายการย่อยจาก QT มาบันทึกทั้งหมด)
  { key: "expectedWorkDays", group: "addl", def: true, type: "number" },                      // จำนวนวันทำงานที่คาดการณ์
  { key: "expectedConsultants", group: "addl", def: true, type: "number" },                   // จำนวนที่ปรึกษาที่คาดการณ์
  // ----- การชำระเงิน (งวดที่ 1-5) -----
  { key: "pay1Date", group: "payment", def: true, type: "date" }, { key: "pay1Amount", group: "payment", def: true, type: "number" },
  { key: "pay2Date", group: "payment", type: "date" }, { key: "pay2Amount", group: "payment", type: "number" },
  { key: "pay3Date", group: "payment", type: "date" }, { key: "pay3Amount", group: "payment", type: "number" },
  { key: "pay4Date", group: "payment", type: "date" }, { key: "pay4Amount", group: "payment", type: "number" },
  { key: "pay5Date", group: "payment", type: "date" }, { key: "pay5Amount", group: "payment", type: "number" },

  // ----- ช่องซ่อน (อ้างอิงต้นทาง) — auto จากต้นทาง หรือกรอกเองได้ -----
  { key: "customerRef", group: "custKey", hidden: true },    // รหัสลูกค้า (REG)
  { key: "srcCl", group: "custKey", hidden: true },          // CL ปลายทาง
  { key: "srcFo", group: "custKey", hidden: true },          // FO ปลายทาง
  { key: "srcQt", group: "custKey", hidden: true },          // QT ปลายทาง
];

/** ฟิลด์ต่อชนิดเอกสาร — CL → FO → QT → SO */
export const SALES_FIELDS: Record<string, SalesField[]> = {
  CL: CL_FIELDS,
  FO: FO_FIELDS,
  QT: QT_FIELDS,
  SO: SO_FIELDS,
};

export const SALES_GROUPS: SalesFieldGroup[] = ["general", "custKey", "saleData", "quote", "target", "terms", "amount", "delivery", "classify", "schedule", "teleAssess", "saleAssess", "addl", "payment", "extra", "note", "items"];

/**
 * กลุ่ม "ตามบทบาท" ของเอกสาร — ใช้ผูกกับขั้นใน workflow (1 ขั้นเลือกได้หลายกลุ่ม)
 * เฉพาะเอกสารที่แบ่งงานหลายบทบาทเท่านั้น · CL ไม่มี (รายเดียวทำจบ → ไม่ต้องเลือกกลุ่ม)
 */
export const DOC_STAGE_GROUPS: Record<string, SalesFieldGroup[]> = {
  FO: ["general", "teleAssess", "saleAssess"],
  QT: ["saleData", "quote"], // 2 กลุ่ม: ข้อมูลจาก Sale · การเสนอราคา (items = ตารางในฟอร์ม)
  // SO ยังไม่แบ่งกลุ่ม (ขยายภายหลัง)
};

export const SALES_DOC_TYPES = ["CL", "FO", "QT", "SO"]; // ชนิดเอกสารที่เปิดให้ตั้งค่าฟิลด์ได้แล้ว

/**
 * กลุ่มของเอกสาร (ใช้ทั้งหน้าตั้งค่าฟิลด์ + ฟอร์ม) — อ้างอิง "กลุ่มจาก workflow stages" (DOC_STAGE_GROUPS)
 * เป็นแหล่งความจริงเดียว + ต่อท้าย "items" ถ้าเอกสารมีตารางย่อย
 * คืน [] = เอกสารไม่มีกลุ่ม (CL/SO) → แสดงฟิลด์แบบเรียงเดี่ยว (ไม่มีหัวข้อกลุ่ม)
 */
export function docGroupsOf(doc: string): SalesFieldGroup[] {
  const sg = DOC_STAGE_GROUPS[doc] ?? [];
  if (sg.length === 0) return [];
  const hasItems = fieldsOf(doc).some((f) => f.group === "items");
  return hasItems && !sg.includes("items") ? [...sg, "items"] : sg;
}

export const fieldsOf = (doc: string): SalesField[] => SALES_FIELDS[doc] ?? [];
export const fieldType = (doc: string, key: string): SalesFieldType => fieldsOf(doc).find((f) => f.key === key)?.type ?? "text";
export const isSelectField = (doc: string, key: string) => fieldType(doc, key) === "select";
/** ฟิลด์ที่มี "ชุดตัวเลือก" (select เดี่ยว + multiselect) — ใช้กับหน้าตั้งค่าตัวเลือกฟิลด์ */
export const hasOptionList = (doc: string, key: string) => { const t = fieldType(doc, key); return t === "select" || t === "multiselect"; };

const keysWhere = (doc: string, f: (x: SalesField) => boolean) => fieldsOf(doc).filter(f).map((x) => x.key);
export const coreKeysOf = (doc: string) => keysWhere(doc, (f) => !!f.core && !f.hidden);
export const defaultKeysOf = (doc: string) => keysWhere(doc, (f) => (!!f.core || !!f.def) && !f.hidden);
/** ฟิลด์ที่ผู้ใช้เลือก/จัดได้ (ไม่รวมช่องซ่อน) */
export const pickableFieldsOf = (doc: string) => fieldsOf(doc).filter((f) => !f.hidden);
export const presetsOf = (doc: string): { id: string; keys: string[] }[] => [
  { id: "basic", keys: defaultKeysOf(doc) },
  { id: "all", keys: pickableFieldsOf(doc).map((f) => f.key) },
];
