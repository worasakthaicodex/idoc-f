import { apiFetch, type Page } from "../../shared/api";
import { getSession } from "../../shared/session";
import { settingsGet, settingsSetAwait } from "../../shared/settingsStore";

/**
 * การตั้งค่า "ตัดเกรดลูกค้า" ตามประวัติการเปิด SO (ใบสั่งขาย)
 * ผู้ใช้ปรับเกณฑ์ได้ · มีค่าเริ่มต้นตามนโยบาย:
 *   A = เปิด SO > 2 ครั้งใน N ปี   (ค่าเริ่ม N=3 → A คือ ≥ 3 ครั้ง)
 *   B = เปิด SO = 2 ครั้งใน N ปี
 *   C = เปิด SO = 1 ครั้งใน N ปี
 *   D = เคยเปิด SO แต่ในช่วง N ปีไม่มี
 *   NONE = ไม่เคยซื้อ (ติดต่อแล้วแต่ไม่มี SO)
 *   NEW  = ไม่เคยติดต่อ (ไม่มีเอกสารใดเลย)
 * ตัดเกรดทุก ๆ cutMonths เดือน (ตั้งได้)
 */
export type Grade = "A" | "B" | "C" | "D" | "NONE" | "NEW";
export const GRADE_ORDER: Grade[] = ["A", "B", "C", "D", "NONE", "NEW"];

export type GradeConfig = {
  windowYears: number; // ช่วงปีที่พิจารณา (ค่าเริ่ม 3)
  aMin: number;        // A: SO ในช่วง ≥ ค่านี้ (ค่าเริ่ม 3 = ">2")
  bMin: number;        // B: SO ในช่วง ≥ ค่านี้ (ค่าเริ่ม 2)
  cMin: number;        // C: SO ในช่วง ≥ ค่านี้ (ค่าเริ่ม 1)
  cutMonths: number;   // ตัดเกรดทุกกี่เดือน (ค่าเริ่ม 12)
  lastCutAt?: number;  // เวลาที่ตัดเกรดล่าสุด (ms)
};

export const GRADE_DEFAULTS: GradeConfig = { windowYears: 3, aMin: 3, bMin: 2, cMin: 1, cutMonths: 12 };
const KEY = "crm.grade.config";

export function getGradeConfig(): GradeConfig {
  return { ...GRADE_DEFAULTS, ...settingsGet<Partial<GradeConfig>>(KEY, {}) };
}
export function setGradeConfig(c: GradeConfig): Promise<boolean> {
  return settingsSetAwait(KEY, c);
}

/** เวลาที่ครบกำหนดตัดเกรดรอบถัดไป (ms) — null ถ้ายังไม่เคยตัด */
export function nextCutDue(c: GradeConfig): number | null {
  if (!c.lastCutAt) return null;
  const d = new Date(c.lastCutAt);
  d.setMonth(d.getMonth() + Math.max(1, c.cutMonths));
  return d.getTime();
}
export const isCutDue = (c: GradeConfig): boolean => {
  const due = nextCutDue(c);
  return due == null ? false : Date.now() >= due;
};

/** คำนวณเกรดจากวันเปิด SO (ms) + เคยติดต่อไหม */
export function computeGrade(soDatesMs: number[], contacted: boolean, cfg: GradeConfig): Grade {
  if (soDatesMs.length > 0) {
    const cutoff = Date.now() - cfg.windowYears * 365.25 * 24 * 3600 * 1000;
    const inWin = soDatesMs.filter((d) => d >= cutoff).length;
    if (inWin >= cfg.aMin) return "A";
    if (inWin >= cfg.bMin) return "B";
    if (inWin >= cfg.cMin) return "C";
    return "D"; // เคยมี SO แต่ไม่มีในช่วง
  }
  return contacted ? "NONE" : "NEW";
}

type Doc = { savedAt?: number; values?: Record<string, string> };
type Cust = { id: string; code: string; name: string; groupName?: string | null; status?: string; attributes?: Record<string, string> };
const tenant = () => getSession()?.companyId ?? "";

/** ตัดเกรดจริง: ดึงลูกค้า+เอกสารทั้งหมด → คำนวณเกรด → อัปเดตลูกค้าที่เกรดเปลี่ยน + บันทึกเวลาตัด */
export async function runGradeCut(cfg: GradeConfig): Promise<{ scanned: number; changed: number; dist: Record<Grade, number> }> {
  const t = tenant();
  const dist = { A: 0, B: 0, C: 0, D: 0, NONE: 0, NEW: 0 } as Record<Grade, number>;
  if (!t) return { scanned: 0, changed: 0, dist };

  const docTypes = ["SO", "FO", "CL", "QT"] as const;
  const lists = await Promise.all(docTypes.map((dt) => apiFetch<Doc[]>(`/sales-docs?docType=${dt}`, { tenant: t }).catch(() => [] as Doc[])));
  const soDates = new Map<string, number[]>();
  const contacted = new Set<string>();
  docTypes.forEach((dt, i) => {
    (lists[i] || []).forEach((d) => {
      const ref = d.values?.customerRef || d.values?.customerCode;
      if (!ref) return;
      contacted.add(ref);
      if (dt === "SO") { const arr = soDates.get(ref) || []; arr.push(d.savedAt || Date.now()); soDates.set(ref, arr); }
    });
  });

  const page = await apiFetch<Page<Cust>>(`/customers?size=5000`, { tenant: t });
  const custs = page.content || [];
  let changed = 0;
  for (const c of custs) {
    const g = computeGrade(soDates.get(c.code) || [], contacted.has(c.code), cfg);
    dist[g] += 1;
    if ((c.attributes?.grade || "") === g) continue;
    const attributes = { ...(c.attributes || {}), grade: g };
    const body = { name: c.name, groupName: c.groupName ?? null, attributes, status: c.status, changedBy: "ระบบ (ตัดเกรด)" };
    try { await apiFetch(`/customers/${c.id}`, { method: "PUT", tenant: t, body }); changed += 1; } catch { /* ข้ามรายที่พลาด */ }
  }

  const saved = { ...cfg, lastCutAt: Date.now() };
  await setGradeConfig(saved);
  return { scanned: custs.length, changed, dist };
}
