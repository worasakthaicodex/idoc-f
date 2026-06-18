import { getSession } from "../../shared/session";
import { type ReqPhase } from "./clRequests";

/**
 * เอกสาร FO (ใบติดตามการขาย) — เก็บต่อบริษัทใน localStorage ไปก่อน → ต่อ backend ภายหลัง
 * ใช้กล่องงานแบบเดียวกับ CL: รอรับ → รอดำเนินการ → ส่งออก → เสร็จสิ้น
 */
export type FoDoc = {
  code: string;
  title: string;            // ลูกค้า / บริษัท (customerName)
  salesperson: string;      // พนักงานขาย
  clRef?: string;           // เอกสาร CL ที่มา
  phase: ReqPhase;
  savedAt: number;
  values?: Record<string, string>;
  stageId?: string;
  received?: { by: string; at: number };
  bounce?: { by: string; at: number; reason: string };
  sent?: { by: string; to: string; at: number; fromStage?: string; toStage?: string; recipients?: string[] };
};

const MAX = 2000;
const key = () => `idoc.sales.fo.${getSession()?.companyId ?? ""}`;

export function loadFoDocs(): FoDoc[] {
  try {
    const raw = localStorage.getItem(key());
    const list = raw ? (JSON.parse(raw) as FoDoc[]) : [];
    return list.sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX);
  } catch {
    return [];
  }
}

export function getFoDoc(code: string): FoDoc | null {
  return loadFoDocs().find((r) => r.code === code) ?? null;
}

export function saveFoDoc(rec: FoDoc): void {
  try {
    const list = loadFoDocs();
    const i = list.findIndex((r) => r.code === rec.code);
    if (i >= 0) list[i] = rec; else list.unshift(rec);
    localStorage.setItem(key(), JSON.stringify(list.sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX)));
  } catch { /* ignore */ }
}

export function deleteFoDoc(code: string): void {
  try {
    localStorage.setItem(key(), JSON.stringify(loadFoDocs().filter((r) => r.code !== code)));
  } catch { /* ignore */ }
}

/** ออกเลขเอกสาร FO{ปีเดือน}-{เลขรัน} */
export function genFoCode(): string {
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const n = loadFoDocs().filter((x) => x.code.startsWith(`FO${ym}`)).length + 1;
  return `FO${ym}-${n}`;
}
