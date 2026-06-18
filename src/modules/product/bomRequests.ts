import { getSession } from "../../shared/session";

/**
 * คำขอดำเนินการสูตรการผลิต (BOM) — เก็บต่อบริษัทใน localStorage ไปก่อน (ต่อ backend ภายหลัง)
 * คล้ายคำขอดำเนินการ (CRM) — มีสถานะ/ผู้ขอ + ฟิลด์หัวสูตร BOM
 */
export type BomRequest = {
  code: string;
  topic: string;        // ADD=ขอเพิ่ม · EDIT=ขอแก้ไข · CANCEL=ยกเลิกใช้
  itemCode: string;
  description: string;
  bomType: string;
  baseUom: string;
  lotSize: string;
  validFrom: string;
  validTo: string;
  copyFrom: string;
  components?: string;   // JSON ของรายการส่วนประกอบ (เผื่ออนาคต)
  requester: string;
  status: string;        // ร่าง / รอดำเนินการ / อนุมัติ / เสร็จสิ้น
  savedAt: number;
};

export const BOM_TOPICS: { v: string; th: string; en: string }[] = [
  { v: "ADD", th: "ขอเพิ่ม", en: "Add" },
  { v: "EDIT", th: "ขอแก้ไข", en: "Edit" },
  { v: "CANCEL", th: "ยกเลิกใช้", en: "Cancel" },
];
export const bomTopicLabel = (v: string, th = true) => BOM_TOPICS.find((x) => x.v === v)?.[th ? "th" : "en"] || v;
export const BOM_TYPES = ["Production BOM", "Engineering BOM (eBOM)", "Sales BOM (Kit)", "Costing BOM"];
export const BOM_UOMS = ["PCS", "SET", "KG"];
export const BOM_STATUSES = ["รับเข้า", "ดำเนินการ", "ส่งออก", "เสร็จสิ้น"];

const tenant = () => getSession()?.companyId ?? "";
const key = () => `idoc.product.bomreq.${tenant()}`;

export function loadBomRequests(): BomRequest[] {
  if (!tenant()) return [];   // ไม่มี tenant = ไม่อ่าน (กันข้อมูลข้ามบริษัท)
  try { const r = localStorage.getItem(key()); const l = r ? (JSON.parse(r) as BomRequest[]) : []; return l.sort((a, b) => b.savedAt - a.savedAt); }
  catch { return []; }
}
export function getBomRequest(code: string): BomRequest | null {
  return loadBomRequests().find((r) => r.code === code) ?? null;
}
export function saveBomRequest(rec: BomRequest): void {
  if (!tenant()) return;   // ไม่มี tenant = ไม่บันทึก
  const list = loadBomRequests();
  const i = list.findIndex((r) => r.code === rec.code);
  if (i >= 0) list[i] = rec; else list.unshift(rec);
  try { localStorage.setItem(key(), JSON.stringify(list.slice(0, 2000))); } catch { /* ignore */ }
}
export function deleteBomRequest(code: string): void {
  if (!tenant()) return;
  try { localStorage.setItem(key(), JSON.stringify(loadBomRequests().filter((r) => r.code !== code))); } catch { /* ignore */ }
}
export function genBomReqCode(): string {
  const d = new Date(); const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const n = loadBomRequests().filter((x) => x.code.startsWith(`BOMR${ym}`)).length + 1;
  return `BOMR${ym}-${n}`;
}
