import { getSession } from "../../shared/session";

/**
 * Cost Center (โมดูลบัญชี / CO) — master + ใบคำขอดำเนินการ
 * frontend-first: เก็บใน localStorage ต่อบริษัท (เลียนแบบระบบคำขอของ product/customer) · ต่อ backend ทีหลัง
 */
export type CCFieldType = "text" | "select" | "date" | "checkbox";
/** ชนิดความจำเป็น: REQUIRED = ต้องกรอกถึงบันทึกได้ · SYSTEM = ระบบใส่ให้ (ดึงจาก config แก้ไม่ได้) · OPTIONAL = เลือกเปิด/ปิดได้ */
export type CCReqType = "REQUIRED" | "OPTIONAL" | "SYSTEM";
/** label = ศัพท์ SAP (EN) · th = ชื่อไทย · desc/descEn = คำอธิบาย 2 ภาษา (โชว์ใต้ช่องตามภาษาที่เลือก) */
export type CCField = {
  key: string; label: string; th: string; desc: string; descEn: string;
  reqType: CCReqType; type: CCFieldType;
  opts?: string[]; placeholder?: string; def?: string; max?: number;
};
export type CCSection = { title: string; titleTh: string; fields: CCField[] };

/** โครงฟอร์ม Cost Center — สเปกเต็ม (REQUIRED ต้องกรอกครบ มิฉะนั้นบันทึกไม่ได้) */
export const CC_SECTIONS: CCSection[] = [
  { title: "Identification", titleTh: "ข้อมูลระบุตัว", fields: [
    { key: "costCenter", label: "Cost Center", th: "รหัส Cost Center", reqType: "REQUIRED", type: "text", placeholder: "1001", max: 10,
      desc: "รหัส Cost Center — ต้องไม่ซ้ำในระบบ ใช้ได้ 1-10 ตัวอักษร · เช่น 1001",
      descEn: "Cost Center code — must be unique, 1-10 characters · e.g. 1001" },
    { key: "controllingArea", label: "Controlling Area", th: "พื้นที่ Controlling", reqType: "SYSTEM", type: "select", opts: ["TH01"], def: "TH01",
      desc: "พื้นที่ Controlling — ระบบดึงจากการตั้งค่าให้อัตโนมัติ · เช่น TH01",
      descEn: "Controlling area — set automatically from system config · e.g. TH01" },
    { key: "validFrom", label: "Valid From", th: "วันที่เริ่มมีผล", reqType: "REQUIRED", type: "date", def: "2026-01-01",
      desc: "วันที่เริ่มมีผล · เช่น 2026-01-01",
      descEn: "Effective start date · e.g. 2026-01-01" },
    { key: "validTo", label: "Valid To", th: "วันที่สิ้นสุด", reqType: "OPTIONAL", type: "date", def: "9999-12-31",
      desc: "วันที่สิ้นสุด (ปกติใส่ 9999-12-31)",
      descEn: "End date (normally 9999-12-31)" },
  ] },
  { title: "Basic Data", titleTh: "ข้อมูลพื้นฐาน", fields: [
    { key: "name", label: "Name", th: "ชื่อแผนก/หน่วยงาน", reqType: "REQUIRED", type: "text", placeholder: "Injection Molding", max: 50,
      desc: "ชื่อแผนก/หน่วยงาน (ไม่เกิน 50 ตัวอักษร) · เช่น Injection Molding",
      descEn: "Department/unit name (max 50 characters) · e.g. Injection Molding" },
    { key: "description", label: "Description", th: "คำอธิบาย", reqType: "OPTIONAL", type: "text", placeholder: "แผนกฉีดพลาสติก",
      desc: "คำอธิบายเพิ่มเติม (ไทย/อังกฤษ) · เช่น แผนกฉีดพลาสติก",
      descEn: "Additional description (TH/EN) · e.g. Plastic injection dept." },
    { key: "ccCategory", label: "CC Category", th: "ประเภท Cost Center", reqType: "REQUIRED", type: "select",
      opts: ["E — Production (ผลิต)", "F — Overhead (โสหุ้ย)", "S — Service (บริการ)", "A — Administration (ธุรการ)", "V — Sales (ขาย)", "H — HR (บุคคล)"],
      desc: "ประเภท: E=ผลิต, F=โสหุ้ย, S=บริการ, A=ธุรการ, V=ขาย, H=บุคคล",
      descEn: "Category: E=Production, F=Overhead, S=Service, A=Admin, V=Sales, H=HR" },
    { key: "responsible", label: "Responsible Person", th: "ผู้รับผิดชอบ", reqType: "OPTIONAL", type: "text", placeholder: "เอกชัย ทองดี",
      desc: "ชื่อผู้รับผิดชอบ (Person Code) · เช่น เอกชัย ทองดี",
      descEn: "Responsible person (Person Code) · e.g. Ekachai Thongdee" },
    { key: "department", label: "Department", th: "แผนกในองค์กร", reqType: "OPTIONAL", type: "text", placeholder: "Production",
      desc: "ชื่อแผนกในองค์กร · เช่น Production",
      descEn: "Department within the organization · e.g. Production" },
  ] },
  { title: "Organization", titleTh: "โครงสร้างองค์กร", fields: [
    { key: "companyCode", label: "Company Code", th: "รหัสบริษัท", reqType: "REQUIRED", type: "select", opts: ["TH01"], def: "TH01",
      desc: "รหัสบริษัท — ระบบ default ให้อัตโนมัติ · เช่น TH01",
      descEn: "Company code — defaulted automatically · e.g. TH01" },
    { key: "profitCenter", label: "Profit Center", th: "ศูนย์กำไร", reqType: "OPTIONAL", type: "text", placeholder: "PC-PROD-01",
      desc: "เชื่อมกับ Profit Center เพื่อออกรายงานกำไร (Profitability) · เช่น PC-PROD-01",
      descEn: "Linked Profit Center for profitability reporting · e.g. PC-PROD-01" },
    { key: "plant", label: "Plant", th: "โรงงานที่สังกัด", reqType: "OPTIONAL", type: "select", opts: ["PL01 — Chachoengsao", "PL02 — Rayong"],
      desc: "โรงงานที่ CC นี้สังกัด · เช่น PL01",
      descEn: "Plant this cost center belongs to · e.g. PL01" },
  ] },
  { title: "Control Parameters", titleTh: "พารามิเตอร์ควบคุม", fields: [
    { key: "currency", label: "Currency", th: "สกุลเงิน", reqType: "REQUIRED", type: "select", opts: ["THB", "USD"], def: "THB",
      desc: "สกุลเงินหลักของ CC นี้ · เช่น THB",
      descEn: "Main currency of this cost center · e.g. THB" },
    { key: "activityType", label: "Activity Type", th: "ประเภทกิจกรรม", reqType: "OPTIONAL", type: "text", placeholder: "LAB01, MCH01",
      desc: "ประเภทกิจกรรมที่ CC นี้ทำ (LAB01=แรงงาน, MCH01=เครื่องจักร)",
      descEn: "Activity types performed (LAB01=Labor, MCH01=Machine)" },
    { key: "overheadKey", label: "OH Key (Overhead Key)", th: "กุญแจโสหุ้ย", reqType: "OPTIONAL", type: "select", opts: ["OH-PROD", "OH-ADMIN", "OH-SELL"],
      desc: "กุญแจคำนวณ Overhead เพิ่มเติมจาก Costing Sheet · เช่น OH-PROD",
      descEn: "Key for extra overhead from the costing sheet · e.g. OH-PROD" },
    { key: "lockActual", label: "Lock: Actual", th: "ล็อกบันทึกจริง", reqType: "OPTIONAL", type: "checkbox",
      desc: "ล็อกการบันทึกค่าใช้จ่ายจริง (Actual posting) — ปกติไม่ติ๊ก",
      descEn: "Lock actual posting — normally unchecked" },
    { key: "lockPlan", label: "Lock: Plan", th: "ล็อกแผน", reqType: "OPTIONAL", type: "checkbox",
      desc: "ล็อกการบันทึกแผน (Plan posting) — ปกติไม่ติ๊ก",
      descEn: "Lock plan posting — normally unchecked" },
    { key: "lockCommit", label: "Lock: Commitment", th: "ล็อกภาระผูกพัน", reqType: "OPTIONAL", type: "checkbox",
      desc: "ล็อกการบันทึกภาระผูกพัน (Commitment posting) — ปกติไม่ติ๊ก",
      descEn: "Lock commitment posting — normally unchecked" },
    { key: "ccHierarchy", label: "CC Hierarchy Node", th: "ตำแหน่งใน Hierarchy", reqType: "OPTIONAL", type: "select", opts: ["JRBI-PROD", "JRBI-ADMIN", "JRBI-SELL"],
      desc: "ตำแหน่งใน Hierarchy Tree สำหรับรายงานรวม · เช่น JRBI-PROD",
      descEn: "Node in the hierarchy tree for consolidated reporting · e.g. JRBI-PROD" },
  ] },
];
export const CC_FIELDS: CCField[] = CC_SECTIONS.flatMap((s) => s.fields);

/* ===== ตัวช่วย 2 ภาษา (ใช้ร่วมทุกหน้า Cost Center) ===== */
export const ccFieldDesc = (f: CCField, thai: boolean) => (thai ? f.desc : f.descEn);
export const ccFieldLabel = (f: CCField, thai: boolean) => (thai ? f.th : f.label);
export const ccSectionTitle = (s: CCSection, thai: boolean) => (thai ? s.titleTh : s.title);
export const ccReqTypeLabel = (rt: CCReqType, thai: boolean) =>
  rt === "REQUIRED" ? (thai ? "จำเป็น" : "Required") : rt === "SYSTEM" ? (thai ? "ระบบ" : "System") : (thai ? "เลือกได้" : "Optional");

/* ===== ฟิลด์ที่เปิดใช้ (ตั้งได้ที่ /accounting/settings/cc-fields) =====
 *  REQUIRED + SYSTEM = ล็อกเปิดเสมอ ปิด/ลบออกไม่ได้ · OPTIONAL เลือกเปิด-ปิด/จัดลำดับได้ */
export const CC_CORE_KEYS = CC_FIELDS.filter((f) => f.reqType !== "OPTIONAL").map((f) => f.key);
const fldKey = () => `idoc.acc.cc.fields.${tenant()}`;
export function getEnabledCCFields(): string[] {
  try {
    const raw = localStorage.getItem(fldKey());
    const arr = raw ? (JSON.parse(raw) as string[]) : CC_FIELDS.map((f) => f.key);
    const set = new Set(arr.filter((k) => CC_FIELDS.some((f) => f.key === k)));
    CC_CORE_KEYS.forEach((k) => set.add(k));   // ฟิลด์จำเป็น/ระบบ ต้องอยู่เสมอ
    return [...set];
  } catch { return CC_FIELDS.map((f) => f.key); }
}
export function setEnabledCCFields(keys: string[]): void {
  const set = new Set(keys);
  CC_CORE_KEYS.forEach((k) => set.add(k));
  try { localStorage.setItem(fldKey(), JSON.stringify([...set])); } catch { /* ignore */ }
}

export type CCTopic = "ADD" | "EDIT" | "CANCEL";
export const CC_TOPICS: { code: CCTopic; th: string; en: string }[] = [
  { code: "ADD", th: "ขอเพิ่ม", en: "Request add" },
  { code: "EDIT", th: "ขอแก้ไข", en: "Request edit" },
  { code: "CANCEL", th: "ขอยกเลิก", en: "Request cancel" },
];
export const ccTopicLabel = (c: string, thai: boolean) => {
  const tp = CC_TOPICS.find((t) => t.code === c);
  return tp ? (thai ? tp.th : tp.en) : c;
};
export type ReqPhase = "RECEIVE" | "PROCESS" | "EXPORT" | "DONE";
export const REQ_PHASES: ReqPhase[] = ["RECEIVE", "PROCESS", "EXPORT", "DONE"];
const PHASE_LABEL: Record<ReqPhase, { th: string; en: string }> = {
  RECEIVE: { th: "รอรับ", en: "To receive" },
  PROCESS: { th: "รอดำเนินการ", en: "Processing" },
  EXPORT: { th: "ส่งออก", en: "Sent" },
  DONE: { th: "เสร็จสิ้น", en: "Done" },
};
export const ccPhaseLabel = (p: ReqPhase, thai: boolean) => (thai ? PHASE_LABEL[p].th : PHASE_LABEL[p].en);

/** สถานะทะเบียน Cost Center — เก็บเป็นโค้ด (รองรับข้อมูลเก่าที่เก็บเป็นไทย) */
export type CCStatus = "ACTIVE" | "CANCELLED";
export const ccStatusLabel = (s: string, thai: boolean) => {
  const code = s === "ใช้งาน" ? "ACTIVE" : s === "ยกเลิก" ? "CANCELLED" : s;
  return code === "CANCELLED" ? (thai ? "ยกเลิก" : "Cancelled") : (thai ? "ใช้งาน" : "Active");
};
export const ccStatusCancelled = (s: string) => s === "CANCELLED" || s === "ยกเลิก";

export type CostCenter = { code: string; name: string; status: string; values: Record<string, string>; createdAt: number };
export type CCRequest = {
  code: string; topic: CCTopic; ccCode: string; ccName: string;
  requester: string; phase: ReqPhase; savedAt: number; values: Record<string, string>;
  stageId?: string;                                            // ขั้นปัจจุบันใน workflow (CC_REQUEST)
  received?: { by: string; at: number };
  bounce?: { by: string; at: number; reason: string };
  // recipients = ใครเห็นใน "รอรับ" ([]/undefined = ทุกคน) · คนเดียว = ส่งเจาะจง
  sent?: { by: string; to: string; at: number; fromStage?: string; toStage?: string; recipients?: string[] };
};

const tenant = () => getSession()?.companyId ?? "";
const ccKey = () => `idoc.acc.costcenters.${tenant()}`;
const reqKey = () => `idoc.acc.cc.requests.${tenant()}`;
const MAX = 2000;

function read<T>(k: string): T[] { try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T[]) : []; } catch { return []; } }
function write<T>(k: string, list: T[]): void { try { localStorage.setItem(k, JSON.stringify(list.slice(0, MAX))); } catch { /* ignore */ } }

// ----- master Cost Center -----
export function loadCostCenters(): CostCenter[] {
  return read<CostCenter>(ccKey()).sort((a, b) => b.createdAt - a.createdAt);
}
export function saveCostCenter(rec: CostCenter): void {
  const list = loadCostCenters();
  const i = list.findIndex((c) => c.code === rec.code);
  if (i >= 0) list[i] = rec; else list.unshift(rec);
  write(ccKey(), list);
}

// ----- ใบคำขอ -----
export function loadCCRequests(): CCRequest[] {
  return read<CCRequest>(reqKey()).sort((a, b) => b.savedAt - a.savedAt);
}
export function getCCRequest(code: string): CCRequest | null {
  return loadCCRequests().find((r) => r.code === code) ?? null;
}
export function saveCCRequest(rec: CCRequest): void {
  const list = loadCCRequests();
  const i = list.findIndex((r) => r.code === rec.code);
  if (i >= 0) list[i] = rec; else list.unshift(rec);
  write(reqKey(), list);
}

/** ออกเลขเอกสารคำขอ: REQ-CC-YYYYMM-N */
export function nextReqCode(): string {
  const ym = new Date().toISOString().slice(0, 7).replace("-", "");
  const n = loadCCRequests().filter((r) => r.code.includes(`REQ-CC-${ym}`)).length + 1;
  return `REQ-CC-${ym}-${String(n).padStart(3, "0")}`;
}

/** ปลายทาง "เสร็จสิ้น" ของ workflow → ลงมือจริงตามเรื่อง: เพิ่ม=ขึ้นทะเบียน · แก้ไข=ทับค่า · ยกเลิก=ปิดสถานะ */
export function applyCCRequest(rec: CCRequest): boolean {
  const ccs = loadCostCenters();
  if (rec.topic === "ADD") {
    const code = (rec.values.costCenter || "").trim() || rec.ccCode || rec.code;
    saveCostCenter({ code, name: rec.values.name || "", status: "ACTIVE", values: { ...rec.values }, createdAt: Date.now() });
    return true;
  }
  const cc = ccs.find((c) => c.code === rec.ccCode);
  if (!cc) return false;
  if (rec.topic === "EDIT") {
    saveCostCenter({ ...cc, name: rec.values.name || cc.name, values: { ...rec.values } });
    return true;
  }
  saveCostCenter({ ...cc, status: "CANCELLED" });   // CANCEL
  return true;
}
