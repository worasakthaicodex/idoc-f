import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";
import { settingsGet, settingsSet } from "../../shared/settingsStore";

/** รายงานลูกค้า — เรียก backend (/api/customers/reports) + ตัวช่วยจัดรอบเดือน/ส่งออก CSV */
export type Distribution = { b0: number; b1: number; b2: number; b3plus: number };
export type Completeness = { complete: number; noPhone: number; noGroup: number; noBoth: number };
export type Member = { code: string; name: string; c1: string; c2: string };
export type GradeCount = { grade: string; count: number };
export type GradeMovement = { period: string | null; total: number; up: number; down: number; same: number; newlyGraded: number; droppedToNone: number; dist: GradeCount[] };
export type RevisionEvent = { action: "CREATE" | "UPDATE"; code: string; changedBy?: string | null; at: string; fields: string[] };
export type StatusCount = { status: string; count: number };
export type CompletenessPct = { total: number; avg: number; buckets: { bucket: number; count: number }[] };

const tenant = () => getSession()?.companyId ?? "";

export const fetchContactDistribution = (gradeAbc: boolean) =>
  apiFetch<Distribution>(`/customers/reports/contact-distribution?grade=${gradeAbc ? "abc" : "all"}`, { tenant: tenant() });
export const fetchContactMembers = (bucket: number, gradeAbc: boolean) =>
  apiFetch<Member[]>(`/customers/reports/contact-members?bucket=${bucket}&grade=${gradeAbc ? "abc" : "all"}`, { tenant: tenant() });
export const fetchCompleteness = () => apiFetch<Completeness>(`/customers/reports/completeness`, { tenant: tenant() });
export const fetchCompletenessMembers = (kind: string) =>
  apiFetch<Member[]>(`/customers/reports/completeness-members?kind=${encodeURIComponent(kind)}`, { tenant: tenant() });
export const fetchGradeMovement = () => apiFetch<GradeMovement>(`/customers/reports/grade-movement`, { tenant: tenant() });
export const fetchStatusDistribution = () => apiFetch<StatusCount[]>(`/customers/reports/status-distribution`, { tenant: tenant() });
export const fetchStatusMembers = (status: string) =>
  apiFetch<Member[]>(`/customers/reports/status-members?status=${encodeURIComponent(status)}`, { tenant: tenant() });
export const fetchCompletenessPct = (fields: string[]) =>
  apiFetch<CompletenessPct>(`/customers/reports/completeness-pct?fields=${encodeURIComponent(fields.join(","))}`, { tenant: tenant() });
export const fetchCompletenessPctMembers = (fields: string[], bucket: number) =>
  apiFetch<Member[]>(`/customers/reports/completeness-pct-members?bucket=${bucket}&fields=${encodeURIComponent(fields.join(","))}`, { tenant: tenant() });
export const recordGradeCut = (period?: string) =>
  apiFetch<{ rows: number }>(`/customers/reports/grade-cut${period ? `?period=${period}` : ""}`, { method: "POST", tenant: tenant() });
export const fetchRevisions = (fromISO: string, toISO: string) =>
  apiFetch<RevisionEvent[]>(`/customers/reports/revisions?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`, { tenant: tenant() });

// ----- รอบเดือนกำหนดเอง -----
const CKEY = "crm.report.cycleStart";
/** วันเริ่มรอบ (1-28) · ปกติ 1 · ตั้ง 25 = รอบ 25 เดือนนี้ ถึง 24 เดือนหน้า */
export const getCycleStart = (): number => Math.min(28, Math.max(1, settingsGet<number>(CKEY, 1)));
export const setCycleStart = (d: number): void => { settingsSet(CKEY, Math.min(28, Math.max(1, Math.round(d) || 1))); };

const pad = (n: number) => String(n).padStart(2, "0");

/** เดือนเชิงรอบของวันที่ (label = เดือนเริ่มรอบ YYYY-MM) */
export function cycleMonth(iso: string, cycleStart: number): string {
  const d = new Date(iso);
  let y = d.getFullYear(), m = d.getMonth();   // 0-based
  if (d.getDate() < cycleStart) { m -= 1; if (m < 0) { m = 11; y -= 1; } }
  return `${y}-${pad(m + 1)}`;
}

function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${pad(week)}`;
}

export type Granularity = "day" | "week" | "month" | "year";
/** คีย์จัดกลุ่มตามช่วง — month/year ใช้รอบเดือนกำหนดเอง */
export function groupKey(iso: string, g: Granularity, cycleStart: number): string {
  const d = new Date(iso);
  if (g === "day") return iso.slice(0, 10);
  if (g === "week") return isoWeek(d);
  const cm = cycleMonth(iso, cycleStart);          // YYYY-MM (เริ่มรอบ)
  return g === "year" ? cm.slice(0, 4) : cm;
}

/** ส่งออก CSV (รองรับไทย ใส่ BOM) */
export function exportCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const esc = (v: string | number) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const body = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click(); URL.revokeObjectURL(url);
}
