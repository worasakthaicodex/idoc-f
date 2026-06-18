import { getSession } from "../../shared/session";
import { type ReqPhase } from "./costCenterStore";

/**
 * คำขอดำเนินการ "วางแผน (Planning)" ของ Cost Center (CC02) — เดินตาม workflow เหมือนคำขอ CC
 * ฟิลด์ input ของฟอร์มยังไม่กำหนด (เตรียมไว้ก่อน) เก็บใน values ได้เลยภายหลัง
 */
export type PlanTopic = "PLAN" | "REPLAN" | "CANCEL";
export const PLAN_TOPICS: { code: PlanTopic; th: string; en: string }[] = [
  { code: "PLAN", th: "ขอวางแผน", en: "Request plan" },
  { code: "REPLAN", th: "ขอปรับแผน", en: "Request re-plan" },
  { code: "CANCEL", th: "ขอยกเลิกแผน", en: "Request cancel plan" },
];
export const planTopicLabel = (c: string, thai: boolean) => {
  const tp = PLAN_TOPICS.find((t) => t.code === c);
  return tp ? (thai ? tp.th : tp.en) : c;
};

/* ===== แผนงบ (budget grid) — 3 ชั้นค่าต่อช่อง: แผนปีก่อน / จริงปีก่อน / แผนปีนี้ ===== */
export type PlanCell = { ty: string; lyPlan: string; lyActual: string };   // เก็บเป็นสตริงตัวเลข (มี , ได้)
/** annual = ยอดทั้งปีที่กรอกเองในช่อง TOTAL (รอปันส่วนลงรายเดือน) — มีค่า = ใช้แทนผลรวมเดือน · ว่าง = รวมจากเดือน */
export type PlanLine = { ceCode: string; ceName: string; cells: PlanCell[]; annual?: string };   // 12 เดือน
export type PlanPart = { id: string; owner: string; ceCodes: string[]; done: boolean };   // โหมดแยกกรอกตามกลุ่ม CE

export const PLAN_VERSIONS: { code: string; th: string; en: string; descTh: string; descEn: string; baseline?: boolean; readonly?: boolean }[] = [
  { code: "V0", th: "งบตั้งต้น", en: "Original Budget", descTh: "งบประมาณที่อนุมัติครั้งแรก ล็อกไม่ให้แก้ไข", descEn: "First approved budget — locked", baseline: true },
  { code: "V1", th: "แผนประจำปี", en: "Annual Plan", descTh: "แผนประจำปีที่ใช้งานหลัก เปรียบเทียบกับ Actual", descEn: "Main annual plan — compared with actual" },
  { code: "V2", th: "แผนปรับปรุง", en: "Revised Plan", descTh: "แผนปรับปรุง เมื่อมีการ Revise งบกลางปี", descEn: "Revised plan for mid-year revision" },
  { code: "PY", th: "ปีก่อน", en: "Prior Year", descTh: "ข้อมูล Actual ปีก่อน ใช้เป็นฐานในการวางแผน", descEn: "Prior-year actual — used as planning base", readonly: true },
];
export const planVersionLabel = (c: string, thai: boolean) => { const v = PLAN_VERSIONS.find((x) => x.code === c); return v ? `${c} — ${thai ? v.th : v.en}` : c; };
export const planVersionDesc = (c: string, thai: boolean) => { const v = PLAN_VERSIONS.find((x) => x.code === c); return v ? (thai ? v.descTh : v.descEn) : ""; };
export const planVersionReadonly = (c: string) => !!PLAN_VERSIONS.find((x) => x.code === c)?.readonly;
export const FY_OPTS = ["2026", "2025", "2024"];
export const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** ทะเบียน Cost Element (mock — ภายหลังต่อ master จริง) */
export const CE_MASTER: { code: string; name: string }[] = [
  { code: "400000", name: "Raw Material" },
  { code: "410000", name: "Chemical Additive" },
  { code: "620000", name: "Direct Labour" },
  { code: "630000", name: "Overtime" },
  { code: "640000", name: "Electricity" },
  { code: "650000", name: "Depreciation" },
  { code: "660000", name: "Maintenance" },
];

/** ค่าอ้างอิงปีก่อน (mock) — ฐานต่อเดือนของแต่ละ CE: [แผน, จริง] */
const LY_BASE: Record<string, [number, number]> = {
  "400000": [530000, 512000], "410000": [70000, 67500], "620000": [260000, 258000],
  "630000": [30000, 33500], "640000": [130000, 134000], "650000": [120000, 120000], "660000": [80000, 78500],
};

export const numOf = (s: string) => Number(String(s).replace(/[^0-9.-]/g, "")) || 0;
export const fmtNum = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const emptyCell = (): PlanCell => ({ ty: "", lyPlan: "", lyActual: "" });

/** สร้างแถวเปล่าของ CE (ดึงค่าอ้างอิงปีก่อนจาก mock ให้เลย) */
export function makeLine(ceCode: string, opts?: { copyTy?: boolean }): PlanLine {
  const ce = CE_MASTER.find((c) => c.code === ceCode);
  const base = LY_BASE[ceCode];
  const cells = MONTHS.map((_, i) => {
    if (!base) return emptyCell();
    const lyPlan = base[0];
    // จริงปีก่อนแกว่งเล็กน้อยรายเดือน ให้เห็นภาพ
    const lyActual = Math.round(base[1] * (0.96 + ((i * 7) % 9) / 100));
    return { ty: opts?.copyTy ? String(lyPlan) : "", lyPlan: String(lyPlan), lyActual: String(lyActual) } as PlanCell;
  });
  return { ceCode, ceName: ce?.name ?? ceCode, cells };
}

export const lineTotal = (l: PlanLine) => (l.annual?.trim() ? numOf(l.annual) : l.cells.reduce((a, c) => a + numOf(c.ty), 0));
export const planTotal = (lines: PlanLine[]) => lines.reduce((a, l) => a + lineTotal(l), 0);

/* ===== วิธีปันส่วนงบทั้งปี → รายเดือน (Distribute) ===== */
export type DistMethod = "EQUAL" | "SEASONAL" | "WORKDAYS" | "MANUAL";
export const DIST_METHODS: { code: DistMethod; th: string; en: string; descTh: string; descEn: string }[] = [
  { code: "EQUAL", th: "เท่ากัน (1/12)", en: "Equal (1/12)", descTh: "แบ่งเท่ากัน 12 เดือน", descEn: "Split evenly across 12 months" },
  { code: "SEASONAL", th: "ตามฤดูกาล", en: "Seasonal Factor", descTh: "ตาม Seasonal Pattern", descEn: "By seasonal pattern" },
  { code: "WORKDAYS", th: "ตามวันทำงาน", en: "Working Days", descTh: "ตามจำนวนวันทำงานของเดือน", descEn: "By working days per month" },
  { code: "MANUAL", th: "กรอกเองรายเดือน", en: "Manual per Month", descTh: "ไม่กระจายอัตโนมัติ — กรอกเอง", descEn: "No auto split — enter manually" },
];

/** น้ำหนักฤดูกาล (รวม ≈ 12) — โรงงานทั่วไป (ตั้งค่าเองได้ภายหลัง) */
const SEASONAL_W = [0.90, 0.85, 0.95, 1.00, 1.05, 1.00, 1.05, 1.10, 1.00, 1.05, 1.00, 1.05];

/** จำนวนวันทำงาน (จ-ศ) ของแต่ละเดือนในปีนั้น */
export function workdaysPerMonth(year: number): number[] {
  return Array.from({ length: 12 }, (_, m) => {
    const days = new Date(year, m + 1, 0).getDate();
    let w = 0;
    for (let d = 1; d <= days; d++) { const wd = new Date(year, m, d).getDay(); if (wd !== 0 && wd !== 6) w++; }
    return w;
  });
}

/** กระจาย annual ตามน้ำหนัก ให้ผลรวมเท่ากับ annual เป๊ะ (ปัดเศษไปเดือนที่เศษมากสุด) */
export function spreadAnnual(annual: number, weights: number[]): number[] {
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (annual * w) / wsum);
  const res = raw.map((x) => Math.floor(x));
  let rem = Math.round(annual - res.reduce((a, b) => a + b, 0));
  const order = raw.map((x, i) => ({ i, f: x - Math.floor(x) })).sort((a, b) => b.f - a.f);
  for (let k = 0; k < rem; k++) res[order[k % 12].i]++;
  return res;
}

/** น้ำหนักของแต่ละวิธี (year ใช้กับ WORKDAYS) */
export function distWeights(method: DistMethod, year: number): number[] {
  if (method === "SEASONAL") return SEASONAL_W;
  if (method === "WORKDAYS") return workdaysPerMonth(year);
  return Array.from({ length: 12 }, () => 1);   // EQUAL
}

/* ===== Activity Type + Plan Rate (KSPI) ===== */
export type PlanActivity = { code: string; unit: string; planQty: string; fixedRate: string; variableRate: string };
export const ACT_UNITS = ["H (Hours)", "MH (Machine Hr)", "EA (Each)", "KG", "M3", "—"];
export const ACT_PRESETS: { code: string; unit: string }[] = [
  { code: "LAB01", unit: "H (Hours)" }, { code: "MCH01", unit: "MH (Machine Hr)" },
  { code: "SET01", unit: "H (Hours)" }, { code: "QC01", unit: "H (Hours)" },
];
export const actTotalRate = (a: PlanActivity) => numOf(a.fixedRate) + numOf(a.variableRate);
/** KSPI: Rate = ต้นทุนรวม ÷ ปริมาณกิจกรรม */
export const kspiRate = (totalCost: number, planQty: number) => (planQty > 0 ? Math.round(totalCost / planQty) : 0);

export type PlanRequest = {
  code: string; topic: PlanTopic; ccCode: string; ccName: string;
  requester: string; phase: ReqPhase; savedAt: number; values: Record<string, string>;
  planVersion?: string; fy?: string; mode?: "DIRECT" | "ASSEMBLE";
  lines?: PlanLine[]; parts?: PlanPart[]; activities?: PlanActivity[];
  stageId?: string;
  received?: { by: string; at: number };
  bounce?: { by: string; at: number; reason: string };
  sent?: { by: string; to: string; at: number; fromStage?: string; toStage?: string; recipients?: string[] };
};

const tenant = () => getSession()?.companyId ?? "";
const reqKey = () => `idoc.acc.plan.requests.${tenant()}`;
const MAX = 2000;

function read(): PlanRequest[] { try { const r = localStorage.getItem(reqKey()); return r ? (JSON.parse(r) as PlanRequest[]) : []; } catch { return []; } }
function write(list: PlanRequest[]): void { try { localStorage.setItem(reqKey(), JSON.stringify(list.slice(0, MAX))); } catch { /* ignore */ } }

export function loadPlanRequests(): PlanRequest[] {
  return read().sort((a, b) => b.savedAt - a.savedAt);
}
export function getPlanRequest(code: string): PlanRequest | null {
  return loadPlanRequests().find((r) => r.code === code) ?? null;
}
export function savePlanRequest(rec: PlanRequest): void {
  const list = loadPlanRequests();
  const i = list.findIndex((r) => r.code === rec.code);
  if (i >= 0) list[i] = rec; else list.unshift(rec);
  write(list);
}

/** ออกเลขเอกสาร: REQ-PLAN-YYYYMM-N */
export function nextPlanReqCode(): string {
  const ym = new Date().toISOString().slice(0, 7).replace("-", "");
  const n = loadPlanRequests().filter((r) => r.code.includes(`REQ-PLAN-${ym}`)).length + 1;
  return `REQ-PLAN-${ym}-${String(n).padStart(3, "0")}`;
}

/* ===== แผนที่อนุมัติแล้ว (ApprovedPlan) + ล็อก V0 ===== */
export type ApprovedPlan = { ccCode: string; fy: string; version: string; lines: PlanLine[]; approvedAt: number; locked: boolean };
const apKey = () => `idoc.acc.plan.approved.${tenant()}`;
export function loadApprovedPlans(): ApprovedPlan[] {
  try { const r = localStorage.getItem(apKey()); return r ? (JSON.parse(r) as ApprovedPlan[]) : []; } catch { return []; }
}
export function getApprovedPlan(ccCode: string, fy: string, version: string): ApprovedPlan | null {
  return loadApprovedPlans().find((p) => p.ccCode === ccCode && p.fy === fy && p.version === version) ?? null;
}
/** เวอร์ชันนี้ถูกล็อกไหม — V0 (baseline) เมื่ออนุมัติแล้ว = ล็อกถาวร แก้ไม่ได้ */
export function isVersionLocked(ccCode: string, fy: string, version: string): boolean {
  const ap = getApprovedPlan(ccCode, fy, version);
  return !!ap?.locked;
}
/** บันทึกแผนเป็น "อนุมัติแล้ว" — V0 ตั้ง locked = true (ล็อกถาวร) */
export function commitApprovedPlan(ccCode: string, fy: string, version: string, lines: PlanLine[]): void {
  const list = loadApprovedPlans().filter((p) => !(p.ccCode === ccCode && p.fy === fy && p.version === version));
  list.push({ ccCode, fy, version, lines, approvedAt: Date.now(), locked: version === "V0" });
  try { localStorage.setItem(apKey(), JSON.stringify(list.slice(0, 2000))); } catch { /* ignore */ }
}

/** Copy: สร้าง lines ตั้งต้นจากแผนปีก่อน (FY-1) ที่อนุมัติไว้ ถ้ามี ไม่งั้นใช้ค่า mock จาก CE master
 *  - filterCes = เฉพาะกลุ่ม CE (โหมดแยกกรอกตามแผนก) · ว่าง = ทุก CE
 *  - ดึง "แผนปีนี้ตั้งต้น" จากแผนปีก่อน + อ้างอิงแผน/จริงปีก่อนใส่ในแต่ละช่อง */
export function copyFromLastYear(ccCode: string, fy: string, filterCes?: string[]): PlanLine[] {
  const prevFy = String(Number(fy) - 1);
  const prev = getApprovedPlan(ccCode, prevFy, "V0") ?? getApprovedPlan(ccCode, prevFy, "V1");
  const codes = (filterCes && filterCes.length ? filterCes : CE_MASTER.map((c) => c.code));
  return codes.map((code) => {
    const prevLine = prev?.lines.find((l) => l.ceCode === code);
    if (prevLine) {
      // ปีนี้ตั้งต้น = แผนปีก่อน · อ้างอิง = แผน/จริง ปีก่อนจริง
      return { ceCode: code, ceName: prevLine.ceName, cells: prevLine.cells.map((c) => ({ ty: c.ty, lyPlan: c.ty, lyActual: c.lyActual })) };
    }
    return makeLine(code, { copyTy: true });   // ไม่มีปีก่อน → ใช้ mock
  });
}
