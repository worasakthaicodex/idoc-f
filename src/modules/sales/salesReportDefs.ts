import { type ClDoc } from "./clRequests";
import { groupKey, type Granularity } from "../customer/reportStore";
import { ageInfo, ageStartMs } from "./salesAge";
import { palette, num, type Series } from "./salesCharts";

export type Act = { id: string; createdBy?: string; customerCode?: string; occurredAt?: string; payload?: Record<string, string> };
export type ReportCtx = {
  gran: Granularity; cycle: number; fromMs: number; toMs: number;
  cl: ClDoc[]; fo: ClDoc[]; qt: ClDoc[]; so: ClDoc[];
  acts: Record<string, Act[]>;
};
export type ReportOut = { periods: string[]; series: Series[] };
export type RawOut = { headers: string[]; rows: (string | number)[][] };
export type HistReport = {
  id: string;
  title: { th: string; en: string };
  desc: { th: string; en: string };
  timeBased: boolean;             // true = ใช้ รายวัน/สัปดาห์/เดือน/ปี + รอบตัด · false = แกนเป็นหมวดคงที่
  fmt?: "int" | "baht";
  activityKinds?: string[];       // ชนิด activity ที่ต้องดึงจาก backend
  build: (ctx: ReportCtx) => ReportOut;
  raw: (ctx: ReportCtx) => RawOut;   // ข้อมูลดิบ (สำหรับตรวจ/ส่งออก)
};

// ---------- helpers ----------
const parseItems = (s?: string): { serviceType?: string; price?: string; discount?: string; qty?: string }[] => { try { const a = s ? JSON.parse(s) : []; return Array.isArray(a) ? a : []; } catch { return []; } };
const qtAmount = (r: ClDoc) => { const n = num(r.values?.netAmount); if (n > 0) return n; const its = parseItems(r.values?.items); const before = its.reduce((a, it) => a + num(it.price) * num(it.qty), 0); const disc = its.reduce((a, it) => a + num(it.discount), 0); return (before - disc) * 1.07; };
const amountOf = (r: ClDoc) => { const sa = num(r.values?.saleAmount); return sa > 0 ? sa : qtAmount(r); };
const person = (r: ClDoc) => (r.values?.salesperson || r.telesale || "(ไม่ระบุ)").trim() || "(ไม่ระบุ)";
const cust = (r: ClDoc) => (r.values?.customerName || r.values?.customerCode || r.values?.customerRef || "—");
const parseRevs = (s?: string): { by: string; at: number }[] => { try { const a = s ? JSON.parse(s) : []; return Array.isArray(a) ? a.map((x) => ({ by: String(x.by || ""), at: Number(x.at) || 0 })) : []; } catch { return []; } };
const dOf = (s?: string, fb?: number) => (s ? Date.parse(`${s}T00:00:00`) : 0) || fb || 0;
const fdate = (ms?: number) => (ms ? new Date(ms).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const inR = (ms: number, c: ReportCtx) => ms >= c.fromMs && ms <= c.toMs;

type Rec = { dateMs: number; key: string; val: number };
function bucket(records: Rec[], gran: Granularity, cycle: number): ReportOut {
  const periodsSet = new Set<string>(); const keys: string[] = []; const seen = new Set<string>();
  const map = new Map<string, Map<string, number>>();
  for (const r of records) {
    const p = groupKey(new Date(r.dateMs).toISOString(), gran, cycle);
    periodsSet.add(p);
    if (!seen.has(r.key)) { seen.add(r.key); keys.push(r.key); }
    if (!map.has(p)) map.set(p, new Map());
    const km = map.get(p)!; km.set(r.key, (km.get(r.key) || 0) + r.val);
  }
  const periods = [...periodsSet].sort();
  const series = keys.map((k, i) => ({ name: k, color: palette[i % palette.length], values: periods.map((p) => map.get(p)?.get(k) || 0) }));
  return { periods, series };
}
const fixed = (labels: string[], series: Series[]): ReportOut => ({ periods: labels, series });
const ST = ["HOT", "Warm", "Cold"];
const soDate = (r: ClDoc, qtByCode: Map<string, ClDoc>) => dOf(qtByCode.get(r.values?.srcQt || r.values?.quotationRef || "")?.values?.closeDate, r.savedAt);

// ---------- registry ----------
export const HIST_REPORTS: HistReport[] = [
  {
    id: "cl-opened", timeBased: true, title: { th: "การเปิด CL (ปริมาณงาน)", en: "CL opened" }, desc: { th: "จำนวน CL ที่เปิด แยกตามคน/ช่วงเวลา", en: "CL created per person over time" },
    build: (c) => bucket(c.cl.filter((r) => inR(r.savedAt, c)).map((r) => ({ dateMs: r.savedAt, key: person(r), val: 1 })), c.gran, c.cycle),
    raw: (c) => ({ headers: ["วันที่", "เลขที่ CL", "พนักงาน", "ลูกค้า"], rows: c.cl.filter((r) => inR(r.savedAt, c)).sort((a, b) => b.savedAt - a.savedAt).map((r) => [fdate(r.savedAt), r.code, person(r), cust(r)]) }),
  },
  {
    id: "qt-activity", timeBased: true, title: { th: "การเปิด/ปรับปรุง QT", en: "QT opened & revised" }, desc: { th: "เปิด QT และจำนวนการปรับปรุง (รีวิชั่น) ตามช่วงเวลา", en: "QT opened & revisions over time" },
    build: (c) => {
      const recs: Rec[] = [];
      c.qt.filter((r) => inR(r.savedAt, c)).forEach((r) => recs.push({ dateMs: r.savedAt, key: "เปิด QT", val: 1 }));
      c.qt.forEach((r) => parseRevs(r.values?.revHistory).forEach((rv) => { if (inR(rv.at, c)) recs.push({ dateMs: rv.at, key: "ปรับปรุง QT", val: 1 }); }));
      return bucket(recs, c.gran, c.cycle);
    },
    raw: (c) => {
      const rows: (string | number)[][] = [];
      c.qt.filter((r) => inR(r.savedAt, c)).forEach((r) => rows.push([fdate(r.savedAt), r.code, "เปิด QT", person(r)]));
      c.qt.forEach((r) => parseRevs(r.values?.revHistory).forEach((rv) => { if (inR(rv.at, c)) rows.push([fdate(rv.at), r.code, "ปรับปรุง QT", rv.by || "—"]); }));
      return { headers: ["วันที่", "เลขที่ QT", "ประเภท", "โดย"], rows: rows.sort((a, b) => String(b[0]).localeCompare(String(a[0]))) };
    },
  },
  {
    id: "docs-received", timeBased: true, title: { th: "FO/QT ที่ได้รับ (ปริมาณงาน)", en: "FO/QT received" }, desc: { th: "เอกสารที่รับเข้า แยก FO/QT ตามช่วงเวลา", en: "Docs received over time" },
    build: (c) => {
      const recs: Rec[] = [];
      c.fo.filter((r) => r.received && inR(r.received.at, c)).forEach((r) => recs.push({ dateMs: r.received!.at, key: "FO", val: 1 }));
      c.qt.filter((r) => r.received && inR(r.received.at, c)).forEach((r) => recs.push({ dateMs: r.received!.at, key: "QT", val: 1 }));
      return bucket(recs, c.gran, c.cycle);
    },
    raw: (c) => {
      const rows: (string | number)[][] = [];
      c.fo.filter((r) => r.received && inR(r.received.at, c)).forEach((r) => rows.push([fdate(r.received!.at), "FO", r.code, r.received!.by || "—", cust(r)]));
      c.qt.filter((r) => r.received && inR(r.received.at, c)).forEach((r) => rows.push([fdate(r.received!.at), "QT", r.code, r.received!.by || "—", cust(r)]));
      return { headers: ["วันที่รับ", "ชนิด", "เลขที่", "ผู้รับ", "ลูกค้า"], rows };
    },
  },
  {
    id: "lost-reason", timeBased: true, title: { th: "ปิดไม่ได้ — แยกสาเหตุ", en: "Lost by reason" }, desc: { th: "QT ที่ปิดไม่ได้ แยกตามสาเหตุ ตามช่วงเวลา", en: "Lost QT by reason over time" },
    build: (c) => bucket(c.qt.filter((r) => r.values?.closeResult === "lost").map((r) => ({ dateMs: dOf(r.values?.closeDate, r.savedAt), key: (r.values?.lostReason || "(ไม่ระบุ)").trim() || "(ไม่ระบุ)", val: 1 })).filter((x) => inR(x.dateMs, c)), c.gran, c.cycle),
    raw: (c) => ({ headers: ["วันที่ปิด", "เลขที่ QT", "สาเหตุ", "พนักงาน", "ลูกค้า"], rows: c.qt.filter((r) => r.values?.closeResult === "lost" && inR(dOf(r.values?.closeDate, r.savedAt), c)).map((r) => [fdate(dOf(r.values?.closeDate, r.savedAt)), r.code, (r.values?.lostReason || "(ไม่ระบุ)").trim() || "(ไม่ระบุ)", person(r), cust(r)]) }),
  },
  {
    id: "sales-person", timeBased: true, fmt: "baht", title: { th: "ยอดขาย (SO) แยกคน", en: "Sales by person" }, desc: { th: "ยอดขายจาก SO ใช้วันปิด QT แยกตามพนักงาน", en: "Sales from SO by salesperson (QT close date)" },
    build: (c) => { const m = new Map(c.qt.map((r) => [r.code, r])); return bucket(c.so.filter((r) => r.values?.closeResult !== "cancel").map((r) => ({ dateMs: soDate(r, m), key: (r.values?.salesperson || "(ไม่ระบุ)").trim() || "(ไม่ระบุ)", val: amountOf(r) })).filter((x) => inR(x.dateMs, c)), c.gran, c.cycle); },
    raw: (c) => { const m = new Map(c.qt.map((r) => [r.code, r])); return { headers: ["วันที่ปิด QT", "เลขที่ SO", "พนักงาน", "บริการ", "ยอด(บาท)"], rows: c.so.filter((r) => r.values?.closeResult !== "cancel" && inR(soDate(r, m), c)).map((r) => [fdate(soDate(r, m)), r.code, (r.values?.salesperson || "—"), (r.values?.closedService || "—"), Math.round(amountOf(r))]) }; },
  },
  {
    id: "sales-service", timeBased: true, fmt: "baht", title: { th: "ยอดขาย (SO) แยกบริการ", en: "Sales by service" }, desc: { th: "ยอดขายจาก SO ใช้วันปิด QT แยกตามบริการ", en: "Sales from SO by service (QT close date)" },
    build: (c) => { const m = new Map(c.qt.map((r) => [r.code, r])); return bucket(c.so.filter((r) => r.values?.closeResult !== "cancel").map((r) => ({ dateMs: soDate(r, m), key: (r.values?.closedService || "(ไม่ระบุ)").trim() || "(ไม่ระบุ)", val: amountOf(r) })).filter((x) => inR(x.dateMs, c)), c.gran, c.cycle); },
    raw: (c) => { const m = new Map(c.qt.map((r) => [r.code, r])); return { headers: ["วันที่ปิด QT", "เลขที่ SO", "บริการ", "พนักงาน", "ยอด(บาท)"], rows: c.so.filter((r) => r.values?.closeResult !== "cancel" && inR(soDate(r, m), c)).map((r) => [fdate(soDate(r, m)), r.code, (r.values?.closedService || "—"), (r.values?.salesperson || "—"), Math.round(amountOf(r))]) }; },
  },
  {
    id: "followups", timeBased: true, activityKinds: ["COMMUNICATION"], title: { th: "การติดตาม (บันทึกสื่อสาร) แยกคน", en: "Follow-ups per person" }, desc: { th: "จำนวนบันทึกการสื่อสารจากเครื่องมือ แยกคน/ช่วงเวลา", en: "Communication logs per person over time" },
    build: (c) => bucket((c.acts.COMMUNICATION || []).map((a) => ({ dateMs: Date.parse(a.occurredAt || "") || 0, key: a.createdBy || "(ไม่ระบุ)", val: 1 })).filter((x) => x.dateMs), c.gran, c.cycle),
    raw: (c) => ({ headers: ["วันที่", "พนักงาน", "ลูกค้า", "ข้อความ"], rows: (c.acts.COMMUNICATION || []).map((a) => [fdate(Date.parse(a.occurredAt || "") || 0), a.createdBy || "—", a.customerCode || "—", a.payload?.message || ""]) }),
  },
  {
    id: "calls", timeBased: true, activityKinds: ["CALL_RESULT"], title: { th: "ผลการโทร แยกคน", en: "Calls per person" }, desc: { th: "จำนวนผลการโทรจากเครื่องมือ แยกคน/ช่วงเวลา", en: "Call results per person over time" },
    build: (c) => bucket((c.acts.CALL_RESULT || []).map((a) => ({ dateMs: Date.parse(a.occurredAt || "") || 0, key: a.createdBy || "(ไม่ระบุ)", val: 1 })).filter((x) => x.dateMs), c.gran, c.cycle),
    raw: (c) => ({ headers: ["วันที่", "พนักงาน", "ลูกค้า", "ผลการโทร", "ปัญหา"], rows: (c.acts.CALL_RESULT || []).map((a) => [fdate(Date.parse(a.occurredAt || "") || 0), a.createdBy || "—", a.customerCode || "—", a.payload?.result || "—", a.payload?.problem || a.payload?.badInfo || "—"]) }),
  },
  {
    id: "calls-by-type", timeBased: true, activityKinds: ["CALL_RESULT"], title: { th: "ผลการโทร แยกประเภท", en: "Calls by result type" }, desc: { th: "ผลการโทรแยกตามประเภทผลลัพธ์/ปัญหา ตามช่วงเวลา", en: "Call results by type over time" },
    build: (c) => bucket((c.acts.CALL_RESULT || []).map((a) => ({ dateMs: Date.parse(a.occurredAt || "") || 0, key: (a.payload?.result || "(ไม่ระบุ)").trim() || "(ไม่ระบุ)", val: 1 })).filter((x) => x.dateMs), c.gran, c.cycle),
    raw: (c) => ({ headers: ["วันที่", "ประเภทผล", "พนักงาน", "ลูกค้า", "ปัญหา"], rows: (c.acts.CALL_RESULT || []).map((a) => [fdate(Date.parse(a.occurredAt || "") || 0), a.payload?.result || "(ไม่ระบุ)", a.createdBy || "—", a.customerCode || "—", a.payload?.problem || a.payload?.badInfo || "—"]) }),
  },
  {
    id: "expired", timeBased: false, title: { th: "เอกสารหมดอายุ (ตอนนี้)", en: "Expired (now)" }, desc: { th: "จำนวน FO/QT ที่หมดอายุในกล่องดำเนินการ", en: "Expired FO/QT in processing" },
    build: (c) => {
      const foN = c.fo.filter((r) => r.phase !== "DONE" && ageInfo("FO", ageStartMs(r)).expired).length;
      const qtN = c.qt.filter((r) => r.phase !== "DONE" && ageInfo("QT", ageStartMs(r)).expired).length;
      return fixed(["FO", "QT"], [{ name: "หมดอายุ", color: palette[3], values: [foN, qtN] }]);
    },
    raw: (c) => {
      const rows: (string | number)[][] = [];
      c.fo.filter((r) => r.phase !== "DONE" && ageInfo("FO", ageStartMs(r)).expired).forEach((r) => rows.push(["FO", r.code, person(r), cust(r), Math.abs(ageInfo("FO", ageStartMs(r)).left ?? 0)]));
      c.qt.filter((r) => r.phase !== "DONE" && ageInfo("QT", ageStartMs(r)).expired).forEach((r) => rows.push(["QT", r.code, person(r), cust(r), Math.abs(ageInfo("QT", ageStartMs(r)).left ?? 0)]));
      return { headers: ["ชนิด", "เลขที่", "พนักงาน", "ลูกค้า", "เกินมา(วัน)"], rows };
    },
  },
  {
    id: "strategy", timeBased: false, title: { th: "กลยุทธ์ (CL) → FO/QT/SO", en: "Strategy → funnel" }, desc: { th: "กลยุทธ์ที่ใช้ใน CL ได้ผลเป็น FO/QT/SO เท่าไร", en: "Strategy of CL → resulting FO/QT/SO" },
    build: (c) => {
      const clStrat = new Map<string, string>(); const strats: string[] = [];
      c.cl.filter((r) => inR(r.savedAt, c)).forEach((r) => { const s = (r.values?.strategy || "(ไม่ระบุ)").trim() || "(ไม่ระบุ)"; clStrat.set(r.code, s); if (!strats.includes(s)) strats.push(s); });
      const idx = (s: string) => strats.indexOf(s);
      const clV = strats.map((s) => [...clStrat.values()].filter((x) => x === s).length);
      const foV = strats.map(() => 0), qtV = strats.map(() => 0), soV = strats.map(() => 0);
      const add = (arr: number[], srcCl?: string) => { if (!srcCl) return; const s = clStrat.get(srcCl); if (s) arr[idx(s)]++; };
      c.fo.forEach((r) => add(foV, r.values?.srcCl)); c.qt.forEach((r) => add(qtV, r.values?.srcCl)); c.so.forEach((r) => add(soV, r.values?.srcCl));
      return fixed(strats.length ? strats : ["(ไม่มีข้อมูล)"], [
        { name: "CL", color: palette[4], values: strats.length ? clV : [0] },
        { name: "FO", color: palette[2], values: strats.length ? foV : [0] },
        { name: "QT", color: palette[1], values: strats.length ? qtV : [0] },
        { name: "SO", color: palette[0], values: strats.length ? soV : [0] },
      ]);
    },
    raw: (c) => ({ headers: ["วันที่", "เลขที่ CL", "กลยุทธ์", "พนักงาน", "ลูกค้า"], rows: c.cl.filter((r) => inR(r.savedAt, c)).sort((a, b) => b.savedAt - a.savedAt).map((r) => [fdate(r.savedAt), r.code, (r.values?.strategy || "(ไม่ระบุ)").trim() || "(ไม่ระบุ)", person(r), cust(r)]) }),
  },
  {
    id: "hwc", timeBased: false, title: { th: "ทิศทาง H-W-C: Tele vs Sale (FO)", en: "Status direction Tele vs Sale" }, desc: { th: "เทียบสถานะเอกสาร Telesale กับ Sale บน FO", en: "Compare Telesale vs Sale status on FO" },
    build: (c) => {
      const fo = c.fo.filter((r) => inR(r.savedAt, c));
      const series = ST.map((sale, i) => ({ name: `Sale ${sale}`, color: palette[i], values: ST.map((tele) => fo.filter((r) => r.values?.teleDocStatus === tele && r.values?.saleDocStatus === sale).length) }));
      return fixed(ST.map((t) => `Tele ${t}`), series);
    },
    raw: (c) => ({ headers: ["เลขที่ FO", "Tele", "Sale", "ตรงกัน?", "พนักงาน"], rows: c.fo.filter((r) => inR(r.savedAt, c) && ST.includes(r.values?.teleDocStatus || "") && ST.includes(r.values?.saleDocStatus || "")).map((r) => [r.code, r.values!.teleDocStatus!, r.values!.saleDocStatus!, r.values!.teleDocStatus === r.values!.saleDocStatus ? "ตรง" : "ต่าง", person(r)]) }),
  },
];

export const HIST_BY_ID: Record<string, HistReport> = Object.fromEntries(HIST_REPORTS.map((r) => [r.id, r]));

export const REALTIME_REPORTS = [
  { id: "held-person", th: "ถือครองต่อคน CL/FO/QT", en: "Held per person" },
  { id: "held-status", th: "ถือครองแยกสถานะ H-W-C", en: "Held by status" },
  { id: "held-service", th: "QT ถือครองแยกบริการ", en: "Held QT by service" },
  { id: "held-value", th: "มูลค่า QT ที่ถือครอง", en: "Held QT value" },
];
