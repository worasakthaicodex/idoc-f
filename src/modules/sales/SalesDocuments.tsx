import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getRoleBoxes, fetchStages } from "../workflow/workflowConfig";
import { getSession } from "../../shared/session";
import {
  Grid, ChevronDown, Help, Refresh, Calendar, Check, ArrowLeft, Plus, Search,
} from "../../shared/icons";
import StagePicker from "./StagePicker";
import { loadClDocs, saveClDoc, syncSalesDocs, syncSalesDocsDaily, syncReceive, loadDoneDocs, fetchSalesEnrich, clearSalesDocsSynced, refreshOneDoc, SALES_DOCS_EVENT, REQ_PHASES, type ReqPhase, type ClDoc } from "./clRequests";
import { fetchClBoxRows, fetchClOps, type ClBoxRow, type ClOps } from "./clLeads";
import { loadCalendar } from "../inbox/calendarStore";
import { ageDaysFor, ageStartMs } from "./salesAge";
import { X } from "../../shared/icons";
import NotifBell from "../../shared/NotifBell";
import "./sales.css";

const PHASE_LABEL: Record<ReqPhase, string> = { RECEIVE: "รับเข้า", PROCESS: "ดำเนินการ", EXPORT: "ส่งออก", DONE: "เสร็จสิ้น" };
const PHASE_TONE: Record<ReqPhase, string> = { RECEIVE: "blue", PROCESS: "amber", EXPORT: "gray", DONE: "green" };
const fmtDate = (ts: number) => { const d = new Date(ts), p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const fmtAny = (v: string | number | null | undefined) => { if (v == null || v === "") return "—"; const t = typeof v === "number" ? v : Date.parse(v); return isNaN(t) ? String(v) : fmtDate(t); };
/** ตัดข้อความยาวให้บรรทัดเดียว + ... + hover ดูเต็ม (กันตารางพัง) */
const clip = (s?: string, w = 240): ReactNode => (s && s !== "—")
  ? <span title={s} style={{ display: "inline-block", maxWidth: w, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>{s}</span>
  : "—";
/** แถวบาร์รายงาน (label + จำนวน + แถบสัดส่วน) — ใช้ในแผงขวา */
const barList = (entries: [string, number][]): ReactNode => {
  if (!entries.length) return <div className="rnote">— ไม่มีข้อมูล</div>;
  const mx = Math.max(1, ...entries.map((x) => x[1]));
  return entries.map(([name, c]) => (
    <div className="brow" key={name}>
      <div className="bl"><span title={name} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150, display: "inline-block" }}>{name}</span><span className="num">{c}</span></div>
      <div className="bt"><span className="ba" style={{ width: `${Math.round((c / mx) * 100)}%` }} /></div>
    </div>
  ));
};
const baht = (n: number) => (n || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 });
const daysSince = (ts?: number) => (ts ? Math.max(0, Math.floor((Date.now() - ts) / 86400000)) : null);

/** ป๊อปอัป "ผลการดำเนินการ" ของ CL หนึ่งใบ — ดึงสด + เทียบเป้าจากค่าในเอกสาร */
function OpsModal({ doc, onClose }: { doc: ClDoc; onClose: () => void }) {
  const [ops, setOps] = useState<ClOps | null>(null);
  useEffect(() => { fetchClOps(doc.code).then(setOps).catch(() => {}); }, [doc.code]);
  const tgt = (k: string) => Number(doc.values?.[k] || 0);
  const bar = (lb: string, val: number, t: number) => {
    const pct = t > 0 ? Math.min(100, Math.round((val / t) * 100)) : 0;
    return (
      <div className="ops-bar" key={lb}>
        <div className="ops-bl"><span>{lb}</span><span className="num">{val}/{t || "—"}{t ? ` (${pct}%)` : ""}</span></div>
        <div className="ops-bt"><span style={{ width: `${pct}%` }} /></div>
      </div>
    );
  };
  return (
    <div className="ops-ov" onClick={onClose}>
      <div className="ops-card" onClick={(e) => e.stopPropagation()}>
        <div className="ops-h"><span>ผลการดำเนินการ · {doc.code}</span><button className="x" onClick={onClose}><X size={16} /></button></div>
        {!ops ? <div className="ops-b" style={{ color: "var(--txt3)" }}>กำลังโหลด…</div> : (
          <div className="ops-b">
            <div className="ops-kpis">
              <div className="ops-k"><div className="l">โทรติดตาม</div><div className="v">{ops.callCount}</div></div>
              <div className="ops-k"><div className="l">ไม่ซ้ำราย</div><div className="v">{ops.callDistinct}</div></div>
              <div className="ops-k"><div className="l">ประมาณการ (฿)</div><div className="v">{baht(ops.qtEstimate)}</div></div>
              <div className="ops-k"><div className="l">ยอดขาย (฿)</div><div className="v">{baht(ops.soSales)}</div></div>
            </div>
            {bar("เปิด FO", ops.foCount, tgt("targetFO"))}
            {bar("เปิด QT", ops.qtCount, tgt("targetQT"))}
            {bar("เปิด SO", ops.soCount, tgt("targetSO"))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- generic table model (กล่องโครงเดียวกันทุกขั้น) ---------- */
type Cell = { v: ReactNode; r?: boolean; num?: boolean; cls?: string; muted?: boolean };
type Row = { id: string; label: string; cells: Cell[]; to?: string }; // to = ปลายทางคลิก (override cfg.detail)
type Grp = { label: string; cells: Cell[]; rows: Row[] };

type Aside = { title: string; legend: [string, string]; bars: { name: string; val: string; a: number; b: number }[] };

type StageConfig = {
  title: string;
  tabs: { key: string; label: string; count: number }[];
  columns: { label: string; r?: boolean }[];
  totalCells: Cell[];
  groups: Grp[];
  count: number;
  detail: (id: string) => string;
  aside: Aside;
};

function ageClass(age: number) {
  if (age >= 5) return "age bad";
  if (age >= 1) return "age warn";
  return "age";
}

/* ---------- QT: ใบเสนอราคาหลายใบ ---------- */
const qtConfig: StageConfig = {
  title: "ใบเสนอราคา (QT)",
  tabs: [
    { key: "recv", label: "รับเข้า", count: 5 },
    { key: "proc", label: "ดำเนินการ", count: 9 },
    { key: "done", label: "ส่งออก", count: 14 },
  ],
  columns: [{ label: "เอกสาร" }, { label: "ลูกค้า" }, { label: "มูลค่า (฿)", r: true }, { label: "ค้าง (วัน)", r: true }, { label: "ผู้รับผิดชอบ" }],
  totalCells: [{ v: "" }, { v: "2,790,800", r: true, num: true }, { v: "" }, { v: "" }],
  count: 9,
  detail: (id) => `/sales/qt/${id}`,
  groups: [
    {
      label: "เกินกำหนด (3)", cells: [{ v: "" }, { v: "1,762,300", r: true, num: true }, { v: "" }, { v: "" }],
      rows: [
        { id: "QT-2026-0605", label: "QT-2026-0605", cells: [{ v: "บริษัท เอเชีย ฟู้ดส์ จำกัด", muted: true }, { v: "487,500", r: true, num: true }, { v: 5, r: true, cls: ageClass(5) }, { v: "สมหญิง" }] },
        { id: "QT-2026-0603", label: "QT-2026-0603", cells: [{ v: "บริษัท ไทยสตีล โปรดักส์", muted: true }, { v: "1,250,000", r: true, num: true }, { v: 6, r: true, cls: ageClass(6) }, { v: "ธนกฤต" }] },
        { id: "QT-2026-0599", label: "QT-2026-0599", cells: [{ v: "หจก. เจริญทรัพย์", muted: true }, { v: "24,800", r: true, num: true }, { v: 7, r: true, cls: ageClass(7) }, { v: "สมหญิง" }] },
      ],
    },
    {
      label: "ใกล้กำหนด (4)", cells: [{ v: "" }, { v: "812,300", r: true, num: true }, { v: "" }, { v: "" }],
      rows: [
        { id: "QT-2026-0608", label: "QT-2026-0608", cells: [{ v: "บริษัท เมกะ โฮม จำกัด", muted: true }, { v: "312,000", r: true, num: true }, { v: 2, r: true, cls: ageClass(2) }, { v: "ปวีณา" }] },
        { id: "QT-2026-0607", label: "QT-2026-0607", cells: [{ v: "ร้าน สมชายการช่าง", muted: true }, { v: "86,500", r: true, num: true }, { v: 2, r: true, cls: ageClass(2) }, { v: "ธนกฤต" }] },
        { id: "QT-2026-0606", label: "QT-2026-0606", cells: [{ v: "บริษัท นอร์ทเทิร์น โลจิสติกส์", muted: true }, { v: "298,400", r: true, num: true }, { v: 1, r: true, cls: ageClass(1) }, { v: "ปวีณา" }] },
        { id: "QT-2026-0604", label: "QT-2026-0604", cells: [{ v: "บริษัท สยามเทค จำกัด", muted: true }, { v: "115,400", r: true, num: true }, { v: 1, r: true, cls: ageClass(1) }, { v: "สมหญิง" }] },
      ],
    },
    {
      label: "ปกติ (2)", cells: [{ v: "" }, { v: "216,200", r: true, num: true }, { v: "" }, { v: "" }],
      rows: [
        { id: "QT-2026-0610", label: "QT-2026-0610", cells: [{ v: "หจก. รุ่งเรืองพาณิชย์", muted: true }, { v: "158,800", r: true, num: true }, { v: 0, r: true, cls: ageClass(0) }, { v: "ธนกฤต" }] },
        { id: "QT-2026-0609", label: "QT-2026-0609", cells: [{ v: "ร้าน บ้านสวนวัสดุ", muted: true }, { v: "57,400", r: true, num: true }, { v: 0, r: true, cls: ageClass(0) }, { v: "ปวีณา" }] },
      ],
    },
  ],
  aside: {
    title: "มูลค่าตามลูกค้า (Top 6)", legend: ["ปิดได้", "คงค้าง"],
    bars: [
      { name: "ไทยสตีล โปรดักส์", val: "1,250K", a: 30, b: 70 },
      { name: "เอเชีย ฟู้ดส์", val: "487K", a: 55, b: 45 },
      { name: "เมกะ โฮม", val: "312K", a: 80, b: 20 },
      { name: "นอร์ทเทิร์น โลจิสติกส์", val: "298K", a: 40, b: 60 },
      { name: "รุ่งเรืองพาณิชย์", val: "158K", a: 65, b: 35 },
      { name: "สยามเทค", val: "115K", a: 50, b: 50 },
    ],
  },
};

/* ---------- CL: เอกสารชุดรายชื่อหลายใบ (เหมือน QT มีหลายใบ) ---------- */
const clConfig: StageConfig = {
  title: "ลูกค้ามุ่งหวัง (CL)",
  tabs: [
    { key: "all", label: "ทั้งหมด", count: 4 },
    { key: "active", label: "กำลังโทร", count: 2 },
    { key: "closed", label: "ปิดชุด", count: 1 },
  ],
  columns: [{ label: "เอกสาร" }, { label: "ชื่อชุด / แคมเปญ" }, { label: "รายชื่อ", r: true }, { label: "โทรแล้ว", r: true }, { label: "ผู้รับผิดชอบ" }],
  totalCells: [{ v: "" }, { v: "185", r: true, num: true }, { v: "105/185", r: true }, { v: "" }],
  count: 4,
  detail: (id) => `/sales/cl/${id}/full`,
  groups: [
    {
      label: "กำลังโทร (2)", cells: [{ v: "" }, { v: "105", r: true, num: true }, { v: "53/105", r: true }, { v: "" }],
      rows: [
        { id: "CL202605-088", label: "CL202605-088", cells: [{ v: "แคมเปญรายชื่อ ISO 14001 — ไตรมาส 2/2026", muted: true }, { v: 60, r: true, num: true }, { v: "23/60", r: true }, { v: "ทีมขาย A" }] },
        { id: "CL202605-082", label: "CL202605-082", cells: [{ v: "งานแสดงสินค้า Food Pack 2026", muted: true }, { v: 45, r: true, num: true }, { v: "30/45", r: true }, { v: "ทีมขาย B" }] },
      ],
    },
    {
      label: "รอเริ่ม (1)", cells: [{ v: "" }, { v: "28", r: true, num: true }, { v: "0/28", r: true }, { v: "" }],
      rows: [
        { id: "CL202605-090", label: "CL202605-090", cells: [{ v: "รายชื่อ Inbound จากเว็บไซต์", muted: true }, { v: 28, r: true, num: true }, { v: "0/28", r: true }, { v: "ปวีณา" }] },
      ],
    },
    {
      label: "ปิดชุดแล้ว (1)", cells: [{ v: "" }, { v: "52", r: true, num: true }, { v: "52/52", r: true }, { v: "" }],
      rows: [
        { id: "CL202604-061", label: "CL202604-061", cells: [{ v: "ลูกค้าเก่า reactivate Q1", muted: true }, { v: 52, r: true, num: true }, { v: "52/52", r: true }, { v: "ธนกฤต" }] },
      ],
    },
  ],
  aside: {
    title: "ความคืบหน้าตามชุด", legend: ["โทรแล้ว", "คงเหลือ"],
    bars: [
      { name: "CL202605-088", val: "23/60", a: 38, b: 62 },
      { name: "CL202605-082", val: "30/45", a: 67, b: 33 },
      { name: "CL202605-090", val: "0/28", a: 0, b: 100 },
      { name: "CL202604-061", val: "52/52", a: 100, b: 0 },
    ],
  },
};

const STAGE_NAME: Record<string, string> = { cl: "ลูกค้ามุ่งหวัง (CL)", fo: "ใบเปิดโอกาส (FO)", qt: "ใบเสนอราคา (QT)", so: "ใบสั่งขาย (SO)" };

const phaseChip = (p: ReqPhase) => <span className={`chip ${PHASE_TONE[p]}`}>{PHASE_LABEL[p]}</span>;
const GENERIC_COLS = [{ label: "เอกสาร" }, { label: "ลูกค้า / เรื่อง" }, { label: "ผู้รับผิดชอบ" }, { label: "วันที่" }, { label: "สถานะ" }];
const genericReal = (r: ClDoc): Cell[] => [{ v: r.title || "—", muted: true }, { v: r.telesale || r.values?.salesperson || "—" }, { v: fmtDate(r.savedAt) }, { v: phaseChip(r.phase) }];

/** การตั้งค่ากล่องงานต่อชนิดเอกสาร — add/detail/คอลัมน์/ข้อมูลตัวอย่าง */
type BoxCfg = {
  add: string;
  detail: (code: string) => string;
  cols: { label: string; r?: boolean }[];
  total?: Cell[];
  mockGroups?: Grp[];
  mockDetail?: (id: string) => string;
  aside?: Aside;
  real: (r: ClDoc) => Cell[];
};
const BOX: Record<string, BoxCfg> = {
  CL: {
    add: "/sales/cl/new", detail: (c) => `/sales/cl/${encodeURIComponent(c)}/full`,
    cols: clConfig.columns, total: clConfig.totalCells, aside: clConfig.aside,
    mockGroups: clConfig.groups.filter((g) => !g.label.includes("ปิดชุด")), mockDetail: clConfig.detail,
    real: (r) => [{ v: r.title || "—", muted: true }, { v: r.values?.listCount || "—", r: true, num: true }, { v: "0", r: true }, { v: r.telesale || "—" }],
  },
  QT: {
    add: "/sales/qt/new", detail: (c) => `/sales/qt/${encodeURIComponent(c)}`,
    cols: qtConfig.columns, total: qtConfig.totalCells, aside: qtConfig.aside,
    mockGroups: qtConfig.groups, mockDetail: qtConfig.detail,
    real: (r) => [{ v: r.title || "—", muted: true }, { v: r.values?.netAmount || "—", r: true, num: true }, { v: 0, r: true, cls: ageClass(0) }, { v: r.telesale || "—" }],
  },
  FO: {
    add: "/sales/fo/new", detail: (c) => `/sales/fo/d/${encodeURIComponent(c)}`, cols: GENERIC_COLS, real: genericReal,
    aside: {
      title: "สถานะการติดตาม (Top 6)", legend: ["คืบหน้า", "คงเหลือ"],
      bars: [
        { name: "บจก. ไทยสตีล โปรดักส์", val: "HOT", a: 80, b: 20 },
        { name: "บจก. เอเชีย ฟู้ดส์", val: "Warm", a: 55, b: 45 },
        { name: "บจก. เมกะ โฮม", val: "Warm", a: 50, b: 50 },
        { name: "หจก. เจริญทรัพย์", val: "Cold", a: 25, b: 75 },
        { name: "บจก. สยามเทค", val: "Warm", a: 45, b: 55 },
        { name: "ร้าน สมชายการช่าง", val: "Cold", a: 20, b: 80 },
      ],
    },
  },
  SO: {
    add: "/sales/so/new", detail: (c) => `/sales/so/d/${encodeURIComponent(c)}`, cols: GENERIC_COLS, real: genericReal,
    aside: {
      title: "ยอดสั่งขายตามลูกค้า (Top 6)", legend: ["ส่งแล้ว", "คงเหลือ"],
      bars: [
        { name: "บจก. ไทยสตีล โปรดักส์", val: "1,250K", a: 70, b: 30 },
        { name: "บจก. เอเชีย ฟู้ดส์", val: "487K", a: 55, b: 45 },
        { name: "บจก. เมกะ โฮม", val: "312K", a: 90, b: 10 },
        { name: "บจก. นอร์ทเทิร์น โลจิสติกส์", val: "298K", a: 40, b: 60 },
        { name: "หจก. รุ่งเรืองพาณิชย์", val: "158K", a: 65, b: 35 },
        { name: "บจก. สยามเทค", val: "115K", a: 50, b: 50 },
      ],
    },
  },
};

/** คอลัมน์ของกล่อง CL — ต่างกันตามขั้น (รอรับ/รอดำเนินการ/ส่งออก/เสร็จสิ้น) */
const CL_COLS: Record<ReqPhase, { label: string; r?: boolean }[]> = {
  RECEIVE: [{ label: "เอกสาร" }, { label: "ชื่อชุด / แคมเปญ" }, { label: "รายชื่อ", r: true }, { label: "วันที่ส่ง" }, { label: "ผู้ส่ง" }, { label: "ปัจจัยที่เลือก" }, { label: "ยอดขายประมาณการ (฿)", r: true }],
  PROCESS: [{ label: "เอกสาร" }, { label: "ชื่อชุด / แคมเปญ" }, { label: "รายชื่อ", r: true }, { label: "วันที่ส่ง" }, { label: "ในระบบ (วัน)", r: true }, { label: "ติดต่อล่าสุด" }, { label: "วันที่นัด" }, { label: "ผล" }],
  EXPORT: [{ label: "เอกสาร" }, { label: "ชื่อชุด / แคมเปญ" }, { label: "รายชื่อ", r: true }, { label: "วันที่ปิด" }, { label: "ผู้รับ" }, { label: "FO ที่ได้", r: true }, { label: "QT ที่ได้", r: true }, { label: "SO ที่ได้", r: true }, { label: "ผล" }],
  DONE: [{ label: "เอกสาร" }, { label: "ชื่อชุด / แคมเปญ" }, { label: "รายชื่อ", r: true }, { label: "วันที่เสร็จ" }, { label: "ผู้รับ" }, { label: "FO ที่ได้", r: true }, { label: "QT ที่ได้", r: true }, { label: "SO ที่ได้", r: true }, { label: "ผล" }],
};

/** คอลัมน์ของกล่อง FO — ต่างกันตามขั้น (ตามที่ผู้ใช้กำหนด) */
const FO_COLS: Record<ReqPhase, { label: string; r?: boolean }[]> = {
  RECEIVE: [{ label: "เอกสาร" }, { label: "วันได้รับ FO" }, { label: "ชื่อลูกค้า" }, { label: "เกรด" }, { label: "โปรโมชั่น" }, { label: "รายการขาย" }, { label: "บันทึก Telesale" }, { label: "สถานะเอกสาร" }, { label: "ลักษณะลูกค้า" }, { label: "ผู้ประสานงาน" }, { label: "ผู้ส่ง" }],
  PROCESS: [{ label: "เอกสาร" }, { label: "ชื่อลูกค้า" }, { label: "เกรด" }, { label: "โปรโมชั่น" }, { label: "บริการที่ต้องการ" }, { label: "ความต้องการ" }, { label: "ติดต่อล่าสุด" }, { label: "วันที่นัด" }, { label: "สถานะเอกสาร" }, { label: "ลักษณะลูกค้า" }, { label: "ผู้ประสานงาน" }, { label: "ย้อนหลัง 3 ปี (FO/QT/SO)" }, { label: "วันในระบบ", r: true }, { label: "รอบติดตาม", r: true }, { label: "กลยุทธ" }],
  EXPORT: [{ label: "เอกสาร" }, { label: "วันที่ส่ง" }, { label: "ชื่อลูกค้า" }, { label: "รายการขาย" }, { label: "ราคาแนะนำ", r: true }, { label: "สถานะ (Tele/Sale)" }, { label: "สถานะรับ" }],
  DONE: [{ label: "เอกสาร" }, { label: "วันที่ปิด" }, { label: "ชื่อลูกค้า" }, { label: "รายการขาย" }, { label: "ราคาแนะนำ", r: true }, { label: "สถานะ (Tele/Sale)" }, { label: "ผล" }],
};
type FoEnrich = { grade?: string; latestComm?: string; rounds?: number; appt?: boolean; apptDate?: string; histFo?: number; histQt?: number; histSo?: number };
type QtEnrich = { grade?: string; latestComm?: string; apptDate?: string; rounds?: number; fo?: ClDoc };
/**
 * cache ประวัติ enrich (เกรด/ติดต่อล่าสุด/นัด/รอบโทร) ลง localStorage แบบ "รายวัน"
 *  - โหลดจริง (ยิง API) แค่ครั้งแรกของวัน (ข้ามวัน = เช้าอีกวัน) · ในวันเดียวกันใช้ค่าที่จำไว้ ไม่ยิงซ้ำ
 *  - ไม่เก็บ fo (เอกสารทั้งใบ) — เชื่อมใหม่ทุกครั้งแบบ lookup ฟรี
 */
/** ล้างแคชเสริมเก่า (ถ้ามีค้างใน localStorage จากเวอร์ชันก่อน) — ใช้ตอนกดรีเฟรช */
function clearEnrichCache(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("idoc.sales.enrich.")) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}

/** คอลัมน์ของกล่อง SO — เน้น ผู้ส่ง/ผู้รับ/วันที่ส่ง/สถานะรับ ให้ชัด */
const SO_COLS: Record<ReqPhase, { label: string; r?: boolean }[]> = {
  RECEIVE: [{ label: "เอกสาร" }, { label: "วันที่ส่ง" }, { label: "ผู้ส่ง" }, { label: "ชื่อลูกค้า" }, { label: "รายการขาย" }, { label: "ยอดขาย (฿)", r: true }, { label: "อ้างอิง QT" }],
  PROCESS: [{ label: "เอกสาร" }, { label: "ชื่อลูกค้า" }, { label: "รายการขาย" }, { label: "ยอดขาย (฿)", r: true }, { label: "ผู้รับผิดชอบ" }, { label: "วันที่รับ" }, { label: "วันในระบบ", r: true }],
  EXPORT: [{ label: "เอกสาร" }, { label: "วันที่ส่ง" }, { label: "ผู้ส่ง" }, { label: "ผู้รับ" }, { label: "ชื่อลูกค้า" }, { label: "ยอดขาย (฿)", r: true }, { label: "สถานะรับ" }],
  DONE: [{ label: "เอกสาร" }, { label: "วันที่ปิด" }, { label: "ชื่อลูกค้า" }, { label: "รายการขาย" }, { label: "ยอดขาย (฿)", r: true }, { label: "ผลลัพธ์" }, { label: "ผู้รับ" }],
};
const SO_OUTCOME: Record<string, string> = { production: "ส่งไปผลิต", project: "เปิดโครงการ", done: "ปิดสำเร็จ" };
/** ผลปิด FO — ครบทุกค่าที่ฟอร์มปิดได้ (กล่องเสร็จสิ้นไม่ตก "—") */
const FO_OUTCOME: Record<string, string> = { quote: "เสนอราคา", lost: "ปิดไม่ได้", production: "ส่งไปผลิต", project: "เปิดโครงการ", done: "ปิดสำเร็จ", won: "ปิดได้", cancel: "ยกเลิก" };
/** ช่อง "ผล" ในกล่องเสร็จสิ้น — ใส่สีให้อ่านง่าย (เขียว=ปิดได้ · แดง=ปิดไม่ได้ · ฟ้า=เสนอราคา · ส้ม=ยกเลิก) */
const resultCell = (o: string): Cell => {
  if (!o || o === "—") return { v: "—" };
  const c = o.includes("ไม่ได้") ? "#c23030"
    : o.includes("ยกเลิก") ? "#b26b00"
    : (o.includes("ปิด") || o.includes("สำเร็จ") || o.includes("ผลิต") || o.includes("โครงการ")) ? "#1f7a44"
    : o.includes("เสนอราคา") ? "#0a6ed1"
    : "#8a93a0";
  return { v: <span style={{ color: c, fontWeight: 600 }}>{o}</span> };
};
const amtNum = (s?: string) => Number((s || "").replace(/,/g, "")) || 0;
/** ยอดใบเสนอราคา — คิดจาก line items (×1.07) ก่อน ถ้าไม่มีใช้ grandTotal/netAmount · ตรงกับหน้า customer (qtNet) */
function qtAmount(v: Record<string, string>): number {
  try {
    const items = v.items ? JSON.parse(v.items) : [];
    if (Array.isArray(items) && items.length > 0) {
      return items.reduce((a: number, it: { price?: string; qty?: string; discount?: string }) => a + amtNum(it.price) * amtNum(it.qty) - amtNum(it.discount), 0) * 1.07;
    }
  } catch { /* ignore */ }
  return amtNum(v.grandTotal) || amtNum(v.netAmount);
}

/** คอลัมน์กล่อง QT — คล้าย FO แต่ข้อมูล "บริการ/ความต้องการ/%/กลยุทธ/สถานะ/ความเร่งด่วน/ราคาที่ควรเสนอ" ดึงจาก FO ที่แนบ */
const QT_COLS: Record<ReqPhase, { label: string; r?: boolean }[]> = {
  RECEIVE: [{ label: "เอกสาร" }, { label: "ประเภทคำขอ" }, { label: "วันที่ได้รับ" }, { label: "ชื่อลูกค้า" }, { label: "เกรด" }, { label: "บริการที่ต้องการ" }, { label: "ความต้องการ" }, { label: "อายุ FO", r: true }, { label: "% ปิดการขาย" }, { label: "กลยุทธที่ใช้" }, { label: "สถานะเอกสาร" }, { label: "ความเร่งด่วน" }, { label: "ราคาที่ควรเสนอ", r: true }, { label: "พนักงานขาย" }],
  PROCESS: [{ label: "เอกสาร" }, { label: "วันนัด" }, { label: "ติดตามล่าสุด" }, { label: "ราคาเสนอ", r: true }, { label: "ชื่อลูกค้า" }, { label: "เกรด" }, { label: "บริการที่ต้องการ" }, { label: "ความต้องการ" }, { label: "ลักษณะลูกค้า" }, { label: "สถานะเอกสาร" }, { label: "อายุใบเสนอ", r: true }, { label: "โทร QT", r: true }, { label: "กลยุทธที่ใช้" }, { label: "รีวิชั่น", r: true }],
  EXPORT: [{ label: "เอกสาร" }, { label: "วันที่ส่ง" }, { label: "ผู้รับ" }, { label: "ชื่อลูกค้า" }, { label: "บริการที่ต้องการ" }, { label: "ความต้องการ" }, { label: "ราคาเสนอ", r: true }, { label: "สถานะ (Tele/Sale)" }, { label: "สถานะรับ" }, { label: "สถานะที่ส่ง" }],
  DONE: [{ label: "เอกสาร" }, { label: "วันที่ปิด" }, { label: "ชื่อลูกค้า" }, { label: "บริการที่ต้องการ" }, { label: "ราคาเสนอ", r: true }, { label: "สถานะ (Tele/Sale)" }, { label: "ผล" }],
};
const QT_SEND: Record<string, string> = { normal: "ปกติ (ตามเส้นงาน)", more: "ขอใบเสนอราคาเพิ่ม", edit: "แก้ไขใบเสนอราคา" };
/** ป้ายเลขเอกสาร — ดราฟ (ยังไม่ออกเลขจริง) ให้ขึ้น "เลขใบเสนอราคาที่ส่งมาปิด" (srcQt) ถ้ามี ไม่งั้นขึ้น "ดราฟ" แทนรหัส DRAFT-... ที่อ่านไม่รู้เรื่อง */
const docLabel = (r: ClDoc): string => {
  if (!r.code.startsWith("DRAFT-")) return r.code;
  const sq = r.values?.srcQt || r.values?.quotationRef || r.values?.srcFo || "";
  return sq || "ดราฟ";
};
/** "ประเภทคำขอ/ที่มา" ของ QT (กล่องรับเข้า) — ใบเข้ามาจากอะไร: ขอเปิด/ขอแก้ไข/ขอเพิ่ม */
const qtReqType = (v: Record<string, string>): string =>
  v.editReqType === "revision" ? "ขอแก้ไขใบเสนอราคา"
    : (v.editReqType === "more" || v.qtOrigin === "more") ? "ขอเพิ่มใบเสนอราคา"
      : (v.qtOrigin === "open" || v.srcFo) ? "ขอเปิดใบเสนอราคา"
        : "ปกติ (ตามเส้นงาน)";
/** "สถานะที่ส่ง" ของ QT (กล่องส่งออก) — ปิดชนะ=รอสร้าง SO · ขอแก้ไข/ขอเพิ่ม · ไม่งั้น=ปกติ */
const qtSendStatus = (v: Record<string, string>): string =>
  v.closeResult === "won" ? "ปิดการขาย (รอสร้าง SO)"
    : v.editReqType === "revision" ? "ขอแก้ไขใบเสนอราคา"
      : v.editReqType === "more" ? "ขอเพิ่มใบเสนอราคา"
        : "ปกติ (ตามเส้นงาน)";

function cellTd(c: Cell, i: number) {
  const cls = [c.r ? "r" : "", c.num ? "num" : "", c.cls ?? ""].filter(Boolean).join(" ");
  return (
    <td key={i} className={cls || undefined} style={c.muted ? { color: "var(--txt2)" } : undefined}>
      {c.v}
    </td>
  );
}

const ROW_CAP = 300;     // โชว์ไม่เกิน 300 แถวต่อกล่อง (เสร็จสิ้น/ทั้งหมด มีเป็นพัน — render หมดช้า)

export default function SalesDocuments() {
  const nav = useNavigate();
  const { stage = "qt" } = useParams();
  const [sp] = useSearchParams();
  const role = sp.get("role") || undefined;
  const roleDocs = role ? getRoleBoxes("sales")[role] : undefined; // กล่องที่บทบาทนี้เห็น
  const code = stage.toUpperCase();
  const box = BOX[code]; // กล่องงานของเอกสารนี้ (CL/FO/QT/SO)
  const session = getSession();
  const me = session?.fullName || session?.email || session?.companyCode || "";
  // จำแท็บที่เลือกต่อชนิดเอกสาร (กลับเข้ามาอยู่แท็บเดิม) · box param จากปุ่ม "ส่ง" มาก่อน
  const tabKey = `idoc.sales.box.tab.${code}`;
  const PHASES_VALID = ["RECEIVE", "PROCESS", "EXPORT", "DONE"];
  const [activeTab, setActiveTabState] = useState(() => {
    const b = sp.get("box");
    if (b && PHASES_VALID.includes(b)) return b;
    try { const s = sessionStorage.getItem(tabKey); if (s && PHASES_VALID.includes(s)) return s; } catch { /* ignore */ }
    return "PROCESS";
  });
  const setActiveTab = (p: string) => { setActiveTabState(p); try { sessionStorage.setItem(tabKey, p); } catch { /* ignore */ } };

  // โหลดจาก backend (จริง) แล้ว re-render เมื่อ sync เสร็จ — getter ยังอ่าน sync จาก localStorage cache
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!box) return;
    // โหลดสดทุกครั้ง (ไม่แครช) — ข้อมูลเบาแล้ว (owner-filter + ค่าเก็บลง doc) · DONE โหลดตอนกดแท็บ
    // แล้วค่อยโหลด "รอรับ" — เรียงหลังกัน merge จะไม่ทับงานดำเนินการหาย
    syncSalesDocs(code, 0).then(() => syncReceive(code)).catch(() => {});
    // กลับจากหน้าเอกสาร → รีเฟรชเฉพาะ "แถวล่าสุดที่กดเข้าไป" ใบเดียว (ไม่โหลดทั้ง list)
    try { const last = sessionStorage.getItem(`idoc.sales.box.lastrow.${code}.${activeTab}`); if (last) refreshOneDoc(last, code).catch(() => {}); } catch { /* ignore */ }
    const h = () => setTick((n) => n + 1);
    window.addEventListener(SALES_DOCS_EVENT, h);
    return () => window.removeEventListener(SALES_DOCS_EVENT, h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box, code]);

  // กล่อง "เสร็จสิ้น": โหลด DONE ตอนกดแท็บเท่านั้น (ไม่ดึงมาตั้งแต่เข้ากล่อง) — ลด egress
  useEffect(() => {
    if (box && activeTab === "DONE") loadDoneDocs(code).then(() => setTick((n) => n + 1)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box, code, activeTab]);

  const all = useMemo(() => (box ? loadClDocs(code) : []), [box, code, tick]);
    // เจ้าของร่าง (ยังไม่ส่ง/ยังไม่รับ) — มี createdBy = เฉพาะคนนั้น · เอกสารเก่าที่ไม่มีข้อมูล = โชว์ไว้ (กันงานหาย)
  const ownerOf = (r: ClDoc) => r.values?.createdBy || r.telesale || r.values?.salesperson || "";
  const inPhase = (r: ClDoc, p: ReqPhase) => {
    if (p === "RECEIVE") { const rc = r.sent?.recipients; const see = !rc || rc.length === 0 || rc.includes(me); return r.phase === "RECEIVE" && !r.received && see; }
    if (p === "PROCESS") return r.phase === "PROCESS" && (r.received ? r.received.by === me : (!r.sent && (ownerOf(r) ? ownerOf(r) === me : true)));
    // ส่งออก = ที่ฉันส่งและยังไม่เสร็จ · ไม่รวม draft ที่ระบบสร้างให้ผู้อื่น (qt/soDraft) — เป็นของผู้รับ ไม่ใช่ของฉัน
    // ซ่อนใบที่ "ส่งเข้าตัวเอง" (ผู้รับ = ฉัน) เพราะมันโผล่ในรับเข้า/ดำเนินการอยู่แล้ว — ไม่ต้องซ้ำในส่งออก
    if (p === "EXPORT") {
      const sentToSelf = r.received?.by === me || r.sent?.to === me || !!r.sent?.recipients?.includes(me);
      return !!r.sent && r.sent.by === me && !sentToSelf && r.phase !== "DONE" && r.values?.qtDraft !== "1" && r.values?.soDraft !== "1";
    }
    // เสร็จสิ้น — ที่ฉันเกี่ยวข้อง (รับ/ส่ง/เจ้าของ) หรือเคยร่วมทำ (participants จากระบบเก่า) · เก่าไม่มีข้อมูล = โชว์
    const o = ownerOf(r);
    const parts = (r.values?.participants || "").split(",").map((s) => s.trim()).filter(Boolean);
    return r.phase === "DONE" && (r.received?.by === me || r.sent?.by === me || parts.includes(me) || (o ? o === me : true));
  };
  const phaseCount = (p: ReqPhase) => all.filter((r) => inPhase(r, p)).length;
  const rows = useMemo(() => (box ? all.filter((r) => inPhase(r, activeTab as ReqPhase)).slice(0, ROW_CAP) : []), [box, all, activeTab]); // โชว์ไม่เกิน ROW_CAP/กล่อง — eslint-disable-line react-hooks/exhaustive-deps

  // ค้นหา "ข้ามกล่อง" (CL/FO/QT/SO) — แสดงเป็น popup บอกว่าเจอในกล่องไหน คลิกแล้วเปิดเอกสารเลย
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");   // คำค้นที่ "กด Enter" แล้วเท่านั้น — ไม่ค้นทุกตัวอักษร
  const q = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return [] as { type: string; doc: ClDoc }[];
    const out: { type: string; doc: ClDoc }[] = [];
    for (const type of ["CL", "FO", "QT", "SO"]) {
      for (const r of loadClDocs(type)) {
        const v = r.values || {};
        const hay = [r.code, v.customerName, v.customerCode, v.customerRef, r.title, v.salesperson, r.telesale]
          .filter(Boolean).join(" ").toLowerCase();
        if (hay.includes(q)) out.push({ type, doc: r });
        if (out.length >= 100) return out;
      }
    }
    return out;
  }, [q, tick]);

  // ===== รับเข้าข้ามชนิด: เอกสารที่ปิดแล้วส่งมาให้ "สร้างเอกสารชนิดนี้" (FO→QT, QT→SO) =====
  const handoffSrc = code === "QT" ? "FO" : code === "SO" ? "QT" : null;   // ชนิดต้นทางที่ส่งมา
  const wantResult = code === "QT" ? "quote" : "won";                      // ผลปิดที่ทำให้ส่งต่อ
  const [srcTick, setSrcTick] = useState(0);
  useEffect(() => { if (handoffSrc) syncSalesDocsDaily(handoffSrc).then(() => setSrcTick((n) => n + 1)).catch(() => {}); }, [handoffSrc]);
  const handoffs = useMemo(() => {
    if (!handoffSrc) return [] as ClDoc[];
    return loadClDocs(handoffSrc).filter((r) => {
      const v = r.values || {};
      // ผู้รับที่เลือกตอนปิด (handoffTo) เท่านั้น · ถ้าไม่ได้เลือก → ตกที่ salesperson (ไม่โชว์ทุกคน)
      const recip = v.handoffTo || v.salesperson || "";
      return v.closeResult === wantResult && v.handoffType === code && v.handoffConsumed !== "1" && recip === me;
    });
  }, [handoffSrc, wantResult, code, me, srcTick, tick]);
  const handoffCreateUrl = (r: ClDoc): string => {
    const v = r.values || {};
    const qs = new URLSearchParams({ srcCl: v.srcCl || "", customerRef: v.customerRef || "", customerName: v.customerName || "", customerCode: v.customerCode || v.customerName || "", salesperson: v.salesperson || "" });
    if (code === "QT") { qs.set("srcFo", r.code); qs.set("documentRef", r.code); }
    else { qs.set("srcQt", r.code); qs.set("quotationRef", r.code); qs.set("closedService", v.closedService || ""); qs.set("saleAmount", v.saleAmount || ""); }
    return `${code === "QT" ? "/sales/qt/new" : "/sales/so/new"}?${qs.toString()}`;
  };
  // ยังไม่กดรับ = อยู่กล่องรับเข้า · กดรับแล้ว (handoffRecvBy=ฉัน) = "รอสร้าง" ในกล่องดำเนินการ
  const handoffsInbox = useMemo(() => handoffs.filter((r) => !(r.values?.handoffRecvBy)), [handoffs]);
  const handoffsMine = useMemo(() => handoffs.filter((r) => r.values?.handoffRecvBy === me), [handoffs, me]);
  const receiveHandoff = async (r: ClDoc) => {   // กดรับงานข้ามชนิด → จองไว้เป็นของฉัน (ดองไว้สร้างทีหลังได้)
    if (!handoffSrc) return;
    await saveClDoc({ ...r, values: { ...(r.values || {}), handoffRecvBy: me, handoffRecvAt: String(Date.now()) } }, handoffSrc);
    syncSalesDocs(handoffSrc).then(() => setSrcTick((n) => n + 1)).catch(() => {});
  };
  const showHandoffInbox = activeTab === "RECEIVE" && handoffsInbox.length > 0;   // รอรับ (ยังไม่กดรับ)
  const showHandoff = activeTab === "PROCESS" && handoffsMine.length > 0;          // รอสร้าง (กดรับแล้ว)
  const phaseCountUI = (p: ReqPhase) => phaseCount(p) + (p === "RECEIVE" ? handoffsInbox.length : p === "PROCESS" ? handoffsMine.length : 0);

  const isCL = code === "CL";
  const isFO = code === "FO";
  const isSO = code === "SO";
  const isQT = code === "QT";
  const tenant = session?.companyId ?? "";
  // ข้อมูลเสริมต่อ CL (ประมาณการ/เงื่อนไข/วันติดต่อ/นัด/FO-QT-SO) — ดึงรวบครั้งเดียว
  const [enrich, setEnrich] = useState<Map<string, ClBoxRow>>(new Map());
  const [foEnrich, setFoEnrich] = useState<Map<string, FoEnrich>>(new Map());
  const [foTab, setFoTab] = useState<"overview" | "cat" | "team">("overview"); // แท็บรายงานขวา FO
  // แท็บย่อยในรอดำเนินการ: รวมทั้งหมด / หมดอายุ (จำต่อชนิดเอกสาร)
  const subKey = `idoc.sales.box.sub.${code}`;
  const [procSub, setProcSubState] = useState<"all" | "expired">(() => { try { return sessionStorage.getItem(subKey) === "expired" ? "expired" : "all"; } catch { return "all"; } });
  const setProcSub = (s: "all" | "expired") => { setProcSubState(s); try { sessionStorage.setItem(subKey, s); } catch { /* ignore */ } };
  // จำ "แถวที่กดล่าสุด" ต่อ (ชนิดเอกสาร × แท็บ) — กลับมาไฮไลต์สี + เลื่อนไปแถวนั้น (ถ้าแถวไม่อยู่แล้วก็ข้าม)
  const rowKey = `idoc.sales.box.lastrow.${code}.${activeTab}`;
  const lastRow = (() => { try { return sessionStorage.getItem(rowKey) || ""; } catch { return ""; } })();
  const lastRowRef = useRef<HTMLTableRowElement>(null);
  const goRow = (id: string, to: string) => { try { sessionStorage.setItem(rowKey, id); } catch { /* ignore */ } nav(to); };
  // เลื่อนไปแถวล่าสุดเมื่อสลับแท็บ/แถวถูก render
  useEffect(() => {
    lastRowRef.current?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowKey, rows.length]);
  // ขั้น "ตรวจสอบ/อนุมัติ" ของเอกสารชนิดนี้ (จาก workflow) → จัดกลุ่มเอกสารที่อยู่ขั้นเหล่านี้แยก
  const [revStageIds, setRevStageIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!box) return;
    let alive = true;
    fetchStages(code)
      .then((stages) => { if (alive) setRevStageIds(new Set(stages.filter((s) => s.kind === "REVIEW" || s.kind === "APPROVE").map((s) => s.id))); })
      .catch(() => {});
    return () => { alive = false; };
  }, [box, code]);
  const inReview = (r: ClDoc) => !!r.stageId && revStageIds.has(r.stageId);

  // ข้อมูลเสริมต่อ FO: เกรด/ติดต่อล่าสุด/ย้อนหลัง 3 ปี/รอบติดตาม/มีนัด
  useEffect(() => {
    if (!isFO || activeTab === "DONE") return;   // แท็บเสร็จสิ้น: ค่านิ่งแล้ว ไม่ต้อง enrich ต่อ (ใช้ค่าจากเอกสารเอง)
    let alive = true;
    (async () => {
      // โหลดสดทุกครั้ง (ไม่แครช) — ข้อมูลเบาแล้ว
      const [fos, qts, sos] = await Promise.all([syncSalesDocs("FO", 0), syncSalesDocs("QT", 0), syncSalesDocs("SO", 0)]).catch(() => [loadClDocs("FO"), loadClDocs("QT"), loadClDocs("SO")] as const);
      const cutoff = Date.now() - 3 * 365 * 86400000;
      const hf = new Map<string, number>(), hq = new Map<string, number>(), hs = new Map<string, number>();
      const tally = (list: ClDoc[], mp: Map<string, number>) => list.forEach((d) => { const c = d.values?.customerRef; if (c && (d.savedAt || 0) >= cutoff) mp.set(c, (mp.get(c) || 0) + 1); });
      tally(fos, hf); tally(qts, hq); tally(sos, hs);
      const visAll = fos.filter((f) => inPhase(f, activeTab as ReqPhase)).slice(0, ROW_CAP);   // ทุกแถวที่เห็นในกล่อง
      const m = new Map<string, FoEnrich>();
      // ย้อนหลัง 3 ปี ต่อลูกค้า (จาก list ที่ sync มาแล้ว ฟรี)
      new Set(visAll.map((f) => f.values?.customerRef).filter(Boolean) as string[]).forEach((cc) => {
        const ce = m.get("c:" + cc) || {};
        m.set("c:" + cc, { ...ce, histFo: hf.get(cc) || 0, histQt: hq.get(cc) || 0, histSo: hs.get(cc) || 0 });
      });
      if (alive) setFoEnrich(new Map(m));
      // ค่าเสริมที่เหลือ (เกรด/ติดต่อล่าสุด/รอบโทร/วันนัด) — "รวดเดียว" จาก backend ไม่ไล่ยิงรายแถวอีก
      const rows = await fetchSalesEnrich("FO");
      rows.forEach((r) => {
        const prev = m.get(r.code) || {};
        m.set(r.code, { ...prev, rounds: r.rounds ?? undefined, appt: !!r.apptDate, apptDate: r.apptDate ?? undefined });   // ต่อเอกสาร
        const cc = r.customerRef || "";
        if (cc) {
          const ce = m.get("c:" + cc) || {};
          const comm = r.latestCommAt ? `${new Date(r.latestCommAt).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} ${r.latestCommMsg || ""}`.trim() : ce.latestComm;
          m.set("c:" + cc, { ...ce, grade: r.grade ?? ce.grade, latestComm: comm });   // ต่อลูกค้า
        }
      });
      if (!alive) return;
      setFoEnrich(new Map(m));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFO, tenant, activeTab]);

  // ข้อมูลเสริมต่อ QT: ดึง FO ที่แนบ (บริการ/ความต้องการ/%/กลยุทธ/สถานะ/ความเร่งด่วน/ราคา) + เกรด/ติดต่อล่าสุด/นัด/โทร
  const [qtEnrich, setQtEnrich] = useState<Map<string, QtEnrich>>(new Map());
  useEffect(() => {
    if (!isQT || activeTab === "DONE") return;   // แท็บเสร็จสิ้น: ค่านิ่งแล้ว ไม่ต้อง enrich ต่อ (ใช้ค่าจากเอกสารเอง)
    let alive = true;
    (async () => {
      // โหลดสดทุกครั้ง (ไม่แครช) — ข้อมูลเบาแล้ว (owner-filter + ค่าเก็บลง doc) · ค่าเสริมดึงรวดเดียวจาก backend
      const [qts, fos] = await Promise.all([syncSalesDocs("QT", 0), syncSalesDocs("FO", 0)]).catch(() => [loadClDocs("QT"), loadClDocs("FO")] as const);
      const foBy = new Map(fos.map((f) => [f.code, f]));
      const visAll = qts.filter((q) => inPhase(q, activeTab as ReqPhase)).slice(0, ROW_CAP);   // ทุกแถวที่เห็นในกล่อง
      const m = new Map<string, QtEnrich>();
      // เชื่อม FO ที่แนบ (ฟรี จาก cache) ทุกแถว → โชว์ทันที
      visAll.forEach((q) => { const fc = q.values?.srcFo || q.values?.documentRef; const prev = m.get(q.code) || {}; m.set(q.code, { ...prev, fo: fc ? foBy.get(fc) : prev.fo }); });
      if (alive) setQtEnrich(new Map(m));
      // ค่าเสริมที่เหลือ (เกรด/ติดต่อล่าสุด/รอบโทร/วันนัด) — "รวดเดียว" จาก backend ไม่ไล่ยิงรายแถวอีก
      const rows = await fetchSalesEnrich("QT");
      rows.forEach((r) => {
        const prev = m.get(r.code) || {};
        m.set(r.code, { ...prev, rounds: r.rounds ?? undefined, apptDate: r.apptDate ?? undefined });   // ต่อเอกสาร (คง fo)
        const cc = r.customerRef || "";
        if (cc) {
          const ce = m.get("c:" + cc) || {};
          const comm = r.latestCommAt ? `${new Date(r.latestCommAt).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} ${r.latestCommMsg || ""}`.trim() : ce.latestComm;
          m.set("c:" + cc, { ...ce, grade: r.grade ?? ce.grade, latestComm: comm });   // ต่อลูกค้า
        }
      });
      if (!alive) return;
      setQtEnrich(new Map(m));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQT, tenant, activeTab]);

  // นัดหมายล่าสุด — อ่านจาก calendar cache ที่มีอยู่ (ไม่ full-sync /api/calendar ทุกหน้า = เผาเน็ต)
  // ความสดของนัดมาจาก enrich รายแถว (fetchCalendarByRef) อยู่แล้ว · หน้าปฏิทินจะ sync เต็มเองตอนเปิด
  const apptByRef = useMemo(() => {
    const m = new Map<string, string>();
    for (const ev of loadCalendar()) {
      if (ev.refType !== code || !ev.refCode || ev.status === "DONE" || ev.confirmed) continue;
      const cur = m.get(ev.refCode);
      if (!cur || ev.activityDate < cur) m.set(ev.refCode, ev.activityDate);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, tick]);
  const apptOf = (r: ClDoc): string | undefined => apptByRef.get(r.code);
  // "รอนัด" = มีวันนัดที่ยัง "ไม่เลยวันนี้" เท่านั้น · นัดที่เลยกำหนด (ค้าง) เด้งกลับ รอโทร/รอติดตาม
  const todayStr = (() => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })();
  const upcoming = (d?: string | null) => !!d && d >= todayStr;

  const [opsCode, setOpsCode] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());   // แท็บย่อยที่พับอยู่
  const toggleGroup = (label: string) => setCollapsed((s) => { const n = new Set(s); n.has(label) ? n.delete(label) : n.add(label); return n; });
  useEffect(() => {
    if (!isCL) return;
    fetchClBoxRows().then((rs) => setEnrich(new Map(rs.map((r) => [r.code, r])))).catch(() => {});
  }, [isCL, tick]);

  // สร้าง cells ของ CL ตามขั้น
  const clCells = (r: ClDoc): Cell[] => {
    const e = enrich.get(r.code);
    const title: Cell = { v: r.title || "—", muted: true };
    const list: Cell = { v: r.values?.listCount || "—", r: true, num: true };
    const opsBtn: Cell = { v: <button className="ops-btn" onClick={(ev) => { ev.stopPropagation(); setOpsCode(r.code); }}>ผลการดำเนินการ</button> };
    const recips = r.sent?.recipients?.length ? r.sent.recipients.join(", ") : (r.sent?.to || "—");
    const fo: Cell = { v: e?.foCount ?? 0, r: true, num: true };
    const qt: Cell = { v: e?.qtCount ?? 0, r: true, num: true };
    const so: Cell = { v: e?.soCount ?? 0, r: true, num: true };
    switch (activeTab as ReqPhase) {
      case "RECEIVE": return [title, list, { v: fmtAny(r.sent?.at) }, { v: r.sent?.by || "—" }, { v: e?.conditions || "—", muted: true }, { v: baht(e?.salesEstimate || 0), r: true, num: true }];
      case "PROCESS": return [title, list, { v: fmtAny(r.sent?.at) }, { v: daysSince(r.received?.at) ?? "—", r: true, num: true }, { v: fmtAny(e?.lastContact) }, { v: fmtAny(e?.nextAppt) }, opsBtn];
      case "EXPORT": return [title, list, { v: fmtAny(r.sent?.at) }, { v: recips }, fo, qt, so, opsBtn];
      default: return [title, list, { v: fmtAny(r.sent?.at) }, { v: recips }, fo, qt, so, opsBtn];
    }
  };

  // สร้าง cells ของ FO ตามขั้น (ตามที่ผู้ใช้กำหนด)
  const foCells = (r: ClDoc): Cell[] => {
    const v = r.values || {};
    const ce = foEnrich.get("c:" + (v.customerRef || "")) || {};
    const fe = foEnrich.get(r.code) || {};
    const cust: Cell = { v: v.customerName || v.customerRef || "—", muted: true };
    const grade: Cell = { v: ce.grade || "—" };
    const promo: Cell = { v: v.promotionInfo || "—" };
    const sales: Cell = { v: clip(v.servicesWanted, 180) };
    // มั่นใจ/ลักษณะ/ผู้ประสานงาน → ใช้ของ Sale ก่อน ถ้ามี ไม่งั้นของ Telesale
    const conf: Cell = { v: v.saleDocStatus || v.teleDocStatus || "—" };
    const traits: Cell = { v: v.saleTraits || v.teleTraits || "—" };
    const role: Cell = { v: v.saleContactRole || v.teleContactRole || "—" };
    const docStatus: Cell = { v: `${v.teleDocStatus || "—"} / ${v.saleDocStatus || "—"}` };
    const price: Cell = { v: v.suggestedPrice || "—", r: true, num: true };
    switch (activeTab as ReqPhase) {
      case "RECEIVE": return [{ v: fmtAny(r.received?.at || r.sent?.at) }, cust, grade, promo, sales, { v: clip(v.teleNote), muted: true }, conf, traits, role, { v: r.sent?.by || "—" }];
      case "PROCESS": return [cust, grade, promo, sales, { v: clip(v.customerNeed), muted: true }, { v: clip(ce.latestComm, 300), muted: true }, { v: fmtAny(apptOf(r) || fe.apptDate) }, conf, traits, role, { v: `FO ${Math.max(0, (ce.histFo ?? 0) - 1)} · QT ${ce.histQt ?? 0} · SO ${ce.histSo ?? 0}` }, { v: daysSince(r.received?.at || r.sent?.at || r.savedAt) ?? "—", r: true, num: true }, { v: fe.rounds ?? 0, r: true, num: true }, { v: clip(v.closingMethod, 160) }];
      case "EXPORT": return [{ v: fmtAny(r.sent?.at) }, cust, sales, price, docStatus, { v: r.received ? "รับแล้ว" : "รอรับ" }];
      default: return [{ v: v.closeDate || fmtAny(r.savedAt) }, cust, sales, price, docStatus, resultCell(v.outcome || FO_OUTCOME[v.closeResult || ""] || "—")];
    }
  };

  // สร้าง cells ของ SO ตามขั้น
  const soCells = (r: ClDoc): Cell[] => {
    const v = r.values || {};
    const cust: Cell = { v: v.customerName || v.customerRef || "—", muted: true };
    const svc: Cell = { v: clip(v.closedService || v.quotationRef, 180) };
    const amt: Cell = { v: amtNum(v.saleAmount) ? baht(amtNum(v.saleAmount)) : "—", r: true, num: true };
    const sale: Cell = { v: v.salesperson || r.telesale || "—" };
    const sender: Cell = { v: r.sent?.by || "—" };
    const receiver: Cell = { v: r.received?.by || (r.sent?.recipients?.length ? r.sent.recipients.join(", ") : r.sent?.to) || "—" };
    switch (activeTab as ReqPhase) {
      case "RECEIVE": return [{ v: fmtAny(r.sent?.at) }, sender, cust, svc, amt, { v: v.quotationRef || v.srcQt || "—" }];
      case "PROCESS": return [cust, svc, amt, sale, { v: fmtAny(r.received?.at) }, { v: daysSince(r.received?.at || r.sent?.at || r.savedAt) ?? "—", r: true, num: true }];
      case "EXPORT": return [{ v: fmtAny(r.sent?.at) }, sender, receiver, cust, amt, { v: r.received ? "รับแล้ว" : "รอรับ" }];
      default: return [{ v: v.closeDate || fmtAny(r.savedAt) }, cust, svc, amt, resultCell(v.outcome || SO_OUTCOME[v.closeResult || ""] || "—"), receiver];
    }
  };

  // สร้าง cells ของ QT ตามขั้น (ดึงข้อมูลจาก FO ที่แนบ + เกรด/ติดต่อ/นัด/โทร/รีวิชั่น)
  const qtCells = (r: ClDoc): Cell[] => {
    const v = r.values || {};
    const ce = qtEnrich.get("c:" + (v.customerRef || "")) || {};
    const fe = qtEnrich.get(r.code) || {};
    // ฟิลด์จาก FO ที่ "เก็บลงตัว QT แล้ว" (denormalize) — อ่านจาก doc ก่อน ไม่ต้อง join FO ที่อาจไม่โหลด
    const fv: Record<string, string> = { ...(fe.fo?.values || {}) };
    ["servicesWanted", "customerNeed", "winProbability", "closingMethod", "saleDocStatus", "teleDocStatus", "saleUrgency", "teleUrgency", "saleTraits", "teleTraits", "suggestedPrice"].forEach((k) => { if (v[k]) fv[k] = v[k]; });
    const cust: Cell = { v: v.customerName || v.customerCode || v.customerRef || "—", muted: true };
    const grade: Cell = { v: ce.grade || "—" };
    const svc: Cell = { v: clip(fv.servicesWanted, 160) };
    const need: Cell = { v: clip(fv.customerNeed, 200), muted: true };
    const winP: Cell = { v: fv.winProbability ? `${fv.winProbability}%` : "—" };
    const strat: Cell = { v: clip(fv.closingMethod, 140) };
    const docSt: Cell = { v: fv.saleDocStatus || fv.teleDocStatus || "—" };
    const urgency: Cell = { v: fv.saleUrgency || fv.teleUrgency || "—" };
    const traits: Cell = { v: fv.saleTraits || fv.teleTraits || "—" };
    const suggest: Cell = { v: fv.suggestedPrice || "—", r: true, num: true };
    const qAmt = qtAmount(v);
    const quote: Cell = { v: qAmt ? baht(qAmt) : "—", r: true, num: true };
    const sale: Cell = { v: v.salesperson || r.telesale || "—" };
    const receiver = r.received?.by || (r.sent?.recipients?.length ? r.sent.recipients.join(", ") : r.sent?.to) || "—";
    switch (activeTab as ReqPhase) {
      case "RECEIVE": return [{ v: r.bounce ? <span style={{ color: "var(--red)", fontWeight: 600 }} title={r.bounce.reason || ""}>↩ ถูกตีกลับ</span> : qtReqType(v) }, { v: fmtAny(r.sent?.at || r.received?.at) }, cust, grade, svc, need, { v: fe.fo ? (daysSince(fe.fo.savedAt) ?? "—") : "—", r: true, num: true }, winP, strat, docSt, urgency, suggest, sale];
      case "PROCESS": return [{ v: fmtAny(apptOf(r) || fe.apptDate) }, { v: clip(ce.latestComm, 260), muted: true }, quote, cust, grade, svc, need, traits, docSt, { v: daysSince(r.received?.at || r.sent?.at || r.savedAt) ?? "—", r: true, num: true }, { v: fe.rounds ?? 0, r: true, num: true }, strat, { v: Math.max(0, Number(v.revNo || 1) - 1), r: true, num: true }];
      case "EXPORT": return [{ v: fmtAny(r.sent?.at) }, { v: receiver }, cust, svc, need, quote, { v: `${fv.teleDocStatus || "—"} / ${fv.saleDocStatus || "—"}` }, { v: r.received ? "รับแล้ว" : "รอรับ" }, { v: qtSendStatus(v) }];
      // กล่องเสร็จสิ้น: ใช้ค่าของ QT เองก่อน (เหมือนหน้า customer) แล้วค่อย fallback ไป FO ที่แนบ — DONE มีเป็นพัน ที่ FO link/enrich ไม่ครบจะได้ไม่ว่าง
      default: {
        const dAmt = qtAmount(v);
        return [{ v: v.closeDate || fmtAny(r.savedAt) }, cust,
          { v: clip(v.servicesOffered || v.closedService || fv.servicesWanted, 160) },
          { v: dAmt ? baht(dAmt) : "—", r: true, num: true },
          { v: `${v.teleDocStatus || fv.teleDocStatus || "—"} / ${v.saleDocStatus || fv.saleDocStatus || "—"}` },
          resultCell(v.outcome || (v.closeResult === "won" ? "ปิดได้" : v.closeResult === "lost" ? "ปิดไม่ได้" : v.closeResult === "cancel" ? "ยกเลิก" : "—"))];
      }
    }
  };

  const cols = isCL ? CL_COLS[activeTab as ReqPhase] : isFO ? FO_COLS[activeTab as ReqPhase] : isSO ? SO_COLS[activeTab as ReqPhase] : isQT ? QT_COLS[activeTab as ReqPhase] : (box?.cols ?? []);
  const buildCells = (r: ClDoc): Cell[] => (isCL ? clCells(r) : isFO ? foCells(r) : isSO ? soCells(r) : isQT ? qtCells(r) : box!.real(r));
  const realRows: Row[] = box ? rows.map((r) => ({ id: r.code, label: docLabel(r), to: box.detail(r.code), cells: buildCells(r) })) : [];
  const process = activeTab === "PROCESS";
  const flatTable = !process;                         // แท็บอื่น = ตารางปกติ ไม่แบ่งกลุ่ม
  const emptyCells: Cell[] = Array(Math.max(0, cols.length - 1)).fill(0).map(() => ({ v: "" }));
  const realGroup: Grp = { label: `สร้างใหม่ (${realRows.length})`, cells: emptyCells, rows: realRows };
  // อายุเอกสาร: CL ใช้ค่าจากฟอร์ม (timeframeCL) ถ้ามี ไม่งั้นค่าตั้งต้น · FO/QT ใช้ค่าตั้งต้น · เกินกำหนด = หมดอายุ
  const lifeDays = (r: ClDoc) => (isCL && Number(r.values?.timeframeCL) > 0) ? Number(r.values?.timeframeCL) : ageDaysFor(code);
  const isExpired = (r: ClDoc) => { const d = lifeDays(r); if (!d) return false; const used = daysSince(ageStartMs(r)); return used != null && used > d; };
  const expRows = (list: ClDoc[]) => list.filter(isExpired).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)).slice(0, 50);
  // รอดำเนินการ: CL แบ่งเป็น กำลังโทร / รอนัด (มีวันนัด) · เอกสารอื่นใช้ข้อมูลตัวอย่าง + "สร้างใหม่"
  const ageDoc = isCL || isFO || isQT;
  const procExpCount = (process && ageDoc) ? all.filter((r) => inPhase(r, "PROCESS") && isExpired(r)).length : 0; // หมดอายุของฉันในรอดำเนินการ (count จริง ไม่อิง rows ที่ cap)
  const procLiveCount = (process && ageDoc) ? phaseCount("PROCESS") - procExpCount : 0;
  const procSubBar = process && ageDoc && !!box;   // โชว์แท็บย่อย รวมทั้งหมด/หมดอายุ
  // ตัวเลขกล่อง (ทุกกล่อง): ไม่นับเอกสารหมดอายุ (เกินอายุ) — โชว์เฉพาะงานที่ยัง active
  const tabCount = (p: ReqPhase) => all.filter((r) => inPhase(r, p) && !isExpired(r)).length + (p === "RECEIVE" ? handoffsInbox.length : p === "PROCESS" ? handoffsMine.length : 0);
  const mkGrp = (label: string, list: ClDoc[]): Grp => ({ label: `${label} (${list.length})`, cells: emptyCells, rows: list.map((r) => ({ id: r.code, label: docLabel(r), to: box?.detail(r.code) ?? "/sales", cells: buildCells(r) })) });
  let groupsToShow: Grp[] = [];
  if (process) {
    if (ageDoc && box && procSub === "expired") {
      groupsToShow = [mkGrp("หมดอายุ", expRows(rows))];
    } else if (isCL && box) {
      const atCreate = (r: ClDoc) => !r.stageId || r.stageId === "st-head";
      const live = rows.filter((r) => !isExpired(r) && !inReview(r));
      const appt = live.filter((r) => upcoming(enrich.get(r.code)?.nextAppt));
      const rest = live.filter((r) => !upcoming(enrich.get(r.code)?.nextAppt));
      groupsToShow = [mkGrp("สร้างใหม่", rest.filter(atCreate)), mkGrp("รอโทร", rest.filter((r) => !atCreate(r))), mkGrp("รอนัด", appt), mkGrp("รอตรวจสอบ / อนุมัติ", rows.filter((r) => !isExpired(r) && inReview(r)))];
    } else if (isFO && box) {
      const atCreate = (r: ClDoc) => !r.stageId || r.stageId === "st-head";
      const live = rows.filter((r) => !isExpired(r) && !inReview(r));
      const appt = live.filter((r) => upcoming(apptOf(r)) || upcoming(foEnrich.get(r.code)?.apptDate));
      const rest = live.filter((r) => !(upcoming(apptOf(r)) || upcoming(foEnrich.get(r.code)?.apptDate)));
      groupsToShow = [mkGrp("สร้างใหม่", rest.filter(atCreate)), mkGrp("รอโทร", rest.filter((r) => !atCreate(r))), mkGrp("รอนัด", appt), mkGrp("รอตรวจสอบ / อนุมัติ", rows.filter((r) => !isExpired(r) && inReview(r)))];
    } else if (isQT && box) {
      const atCreate = (r: ClDoc) => !r.stageId || r.stageId === "st-head";
      const isRevReq = (r: ClDoc) => r.values?.editReqType === "revision";
      const isMoreReq = (r: ClDoc) => r.values?.editReqType === "more" || r.values?.qtOrigin === "more";
      const live = rows.filter((r) => !isExpired(r) && !inReview(r));
      const norm = live.filter((r) => !isRevReq(r) && !isMoreReq(r));     // ใบปกติ → จัดตามนัด/ติดตาม
      const appt = norm.filter((r) => upcoming(apptOf(r)) || upcoming(qtEnrich.get(r.code)?.apptDate));
      const rest = norm.filter((r) => !(upcoming(apptOf(r)) || upcoming(qtEnrich.get(r.code)?.apptDate)));
      groupsToShow = [
        mkGrp("สร้างใหม่", rest.filter(atCreate)),
        mkGrp("รอติดตาม", rest.filter((r) => !atCreate(r))),
        mkGrp("รอนัด", appt),
        mkGrp("ขอแก้ไขใบเสนอราคา", live.filter(isRevReq)),
        mkGrp("ขอเพิ่มใบเสนอราคา", live.filter(isMoreReq)),
        mkGrp("รอตรวจสอบ / อนุมัติ", rows.filter((r) => !isExpired(r) && inReview(r))),
      ];
    } else if (isSO && box) {
      groupsToShow = [mkGrp("รายการ", rows.filter((r) => !inReview(r))), mkGrp("รอตรวจสอบ / อนุมัติ", rows.filter(inReview))];
    } else {
      groupsToShow = [...(box?.mockGroups ?? []), realGroup];
    }
    // ซ่อนกลุ่มที่เป็น 0 (บางบทบาท เช่น ผู้ตรวจ/ผู้อนุมัติ จะมีบางกลุ่มเป็น 0 ตลอด)
    groupsToShow = groupsToShow.filter((g) => g.rows.length > 0);
  }
  const totalCells = (isCL || isFO || isQT || isSO) ? emptyCells : (box?.total ?? emptyCells);
  const mockNav = (id: string) => (box?.mockDetail ? box.mockDetail(id) : (box?.detail(id) ?? "/sales"));

  // รายงานขวา (CL) — ภาพรวมไปป์ไลน์ทุกกล่อง จากข้อมูลจริงที่โหลดไว้แล้ว
  const evAll = [...enrich.values()];
  const sumFO = evAll.reduce((s, e) => s + e.foCount, 0);
  const sumQT = evAll.reduce((s, e) => s + e.qtCount, 0);
  const sumSO = evAll.reduce((s, e) => s + e.soCount, 0);
  const sumEst = evAll.reduce((s, e) => s + (e.salesEstimate || 0), 0);
  const maxPhase = Math.max(1, ...REQ_PHASES.map((p) => phaseCount(p)));

  // รายงานขวา FO — บริการที่ต้องการ + สถานะเอกสาร (แยกหมวด + นับจำนวน) จากเอกสารทั้งกล่อง
  const foReport = useMemo(() => {
    if (!isFO) return null;
    const svc = new Map<string, number>(), st = new Map<string, number>(), grade = new Map<string, number>(), sale = new Map<string, number>(), urgency = new Map<string, number>();
    let quote = 0, lost = 0, done = 0; const ages: number[] = [];
    all.forEach((r) => {
      const v = r.values || {};
      const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) || 0) + 1);
      bump(svc, (v.servicesWanted || "").trim() || "ไม่ระบุ");
      bump(st, (v.saleDocStatus || v.teleDocStatus || "").trim() || "ไม่ระบุ");
      bump(grade, foEnrich.get("c:" + (v.customerRef || ""))?.grade || "ไม่ระบุ");
      bump(sale, (v.salesperson || r.telesale || "").trim() || "ไม่ระบุ");
      bump(urgency, (v.saleUrgency || v.teleUrgency || "").trim() || "ไม่ระบุ");
      if (r.phase === "DONE") { done++; if (v.closeResult === "quote") quote++; else if (v.closeResult === "lost") lost++; }
      else { const d = daysSince(r.received?.at || r.sent?.at || r.savedAt); if (d != null) ages.push(d); }
    });
    const sort = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    const avgAge = ages.length ? Math.round(ages.reduce((s, x) => s + x, 0) / ages.length) : 0;
    return { svc: sort(svc), st: sort(st), grade: sort(grade), sale: sort(sale).slice(0, 6), urgency: sort(urgency), quote, lost, done, avgAge, aging7: ages.filter((d) => d >= 7).length, convRate: (quote + lost) > 0 ? Math.round((quote / (quote + lost)) * 100) : 0 };
  }, [isFO, all, foEnrich]);

  // รายงานขวา SO — ยอดขายรวม + ผลลัพธ์ + ผู้รับผิดชอบ + รายการขาย
  const soReport = useMemo(() => {
    if (!isSO) return null;
    const sale = new Map<string, number>(), svc = new Map<string, number>();
    let prod = 0, proj = 0, done = 0, total = 0;
    all.forEach((r) => {
      const v = r.values || {};
      total += amtNum(v.saleAmount);
      const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) || 0) + 1);
      bump(sale, (v.salesperson || r.telesale || "").trim() || "ไม่ระบุ");
      bump(svc, (v.closedService || "").trim() || "ไม่ระบุ");
      if (r.phase === "DONE") { if (v.closeResult === "production") prod++; else if (v.closeResult === "project") proj++; else if (v.closeResult === "done") done++; }
    });
    const sort = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { sale: sort(sale).slice(0, 6), svc: sort(svc), prod, proj, done, total };
  }, [isSO, all]);

  // รายงานขวา QT (แท็บ overview/cat/team) — ผล/ค้าง/มูลค่า + บริการ/สถานะ/ความเร่งด่วน/เกรด/สถานะที่ส่ง/ทีม
  const qtReport = useMemo(() => {
    if (!isQT) return null;
    const svc = new Map<string, number>(), st = new Map<string, number>(), urg = new Map<string, number>(), grade = new Map<string, number>(), sale = new Map<string, number>(), sendT = new Map<string, number>();
    let won = 0, lost = 0, cancel = 0, done = 0, total = 0; const ages: number[] = [];
    all.forEach((r) => {
      const v = r.values || {}; const fe = qtEnrich.get(r.code) || {}; const fv = fe.fo?.values || {}; const ce = qtEnrich.get("c:" + (v.customerRef || "")) || {};
      const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) || 0) + 1);
      bump(svc, (fv.servicesWanted || "").trim() || "ไม่ระบุ");
      bump(st, (fv.saleDocStatus || fv.teleDocStatus || "").trim() || "ไม่ระบุ");
      bump(urg, (fv.saleUrgency || fv.teleUrgency || "").trim() || "ไม่ระบุ");
      bump(grade, ce.grade || "ไม่ระบุ");
      bump(sale, (v.salesperson || r.telesale || "").trim() || "ไม่ระบุ");
      bump(sendT, QT_SEND[v.qtSendType || "normal"] || "ปกติ");
      if (r.phase === "DONE") { done++; total += qtAmount(v); if (v.closeResult === "won") won++; else if (v.closeResult === "lost") lost++; else if (v.closeResult === "cancel") cancel++; }
      else { const d = daysSince(r.received?.at || r.sent?.at || r.savedAt); if (d != null) ages.push(d); }
    });
    const sort = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { svc: sort(svc), st: sort(st), urg: sort(urg), grade: sort(grade), sale: sort(sale).slice(0, 6), sendT: sort(sendT), won, lost, cancel, done, total, avgAge: ages.length ? Math.round(ages.reduce((s, x) => s + x, 0) / ages.length) : 0, aging7: ages.filter((d) => d >= 7).length, convRate: (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0 };
  }, [isQT, all, qtEnrich]);

  return (
    <div className="p-sales">
      {/* top bar */}
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title="กลับหน้าหลัก" onClick={() => nav("/app")}>iDoc ERP</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title="กลับไปเลือกระบบ" onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>งานขาย</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <NotifBell />
        <div className="ic"><Help /></div>
        <div className="me">A</div>
      </div>

      {/* sub toolbar — เหลือเฉพาะที่ใช้: กลับ · รีเฟรช · เพิ่ม */}
      <div className="subbar">
        <div className="fields" onClick={() => nav("/sales")} title="กลับกล่องงาน" style={{ cursor: "pointer" }}><ArrowLeft size={16} />กลับ</div>
        <div className="vsep" />
        <div className="tb" title="รีเฟรช — ล้างแคชแล้วโหลดหน้านี้ใหม่" style={{ cursor: "pointer" }} onClick={() => { clearSalesDocsSynced(); clearEnrichCache(); window.location.reload(); }}><Refresh /></div>
        <div className="vsep" />
        <div className="box-search">
          <Search size={15} />
          <input value={search}
            onChange={(e) => { setSearch(e.target.value); if (!e.target.value.trim()) setQuery(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") setQuery(search); else if (e.key === "Escape") { setSearch(""); setQuery(""); } }}
            placeholder={`ค้นหา ${code} · ลูกค้า · พนักงานขาย (กด Enter)`} />
          {search && <button className="bs-x" title="ล้าง" onClick={() => { setSearch(""); setQuery(""); }}><X size={13} /></button>}
        </div>
        <div className="u-spacer" />
        {box && <div className="fields" onClick={() => nav(box.add)} style={{ cursor: "pointer" }}><Plus size={16} />เพิ่ม {code}</div>}
      </div>

      <div className="layout">
        <StagePicker active={code} docs={roleDocs} role={role} />

        <div className="workzone">
          {box ? (
            <>
              <div className="tabs">
                {REQ_PHASES.map((p) => (
                  <div key={p} className={`tab${activeTab === p ? " active" : ""}`} onClick={() => setActiveTab(p)}>
                    {PHASE_LABEL[p]} {p !== "DONE" && tabCount(p) > 0 && <span className="badge">{tabCount(p)}</span>}
                  </div>
                ))}
              </div>

              <div className="content">
                {/* center table */}
                <div className="center">
                  <div className="chead">
                    {STAGE_NAME[stage] ?? code} · <b>{PHASE_LABEL[activeTab as ReqPhase]}</b> · {procSubBar ? (procSub === "expired" ? procExpCount : procLiveCount) : tabCount(activeTab as ReqPhase)} รายการ
                  </div>
                  {procSubBar && (
                    <div className="rtabs" style={{ margin: "0 0 8px" }}>
                      <button className={procSub === "all" ? "on" : ""} onClick={() => setProcSub("all")}>รวมทั้งหมด ({procLiveCount})</button>
                      <button className={procSub === "expired" ? "on" : ""} onClick={() => setProcSub("expired")}>หมดอายุ ({procExpCount})</button>
                    </div>
                  )}
                  <div className="tablewrap">
                    <table className="data-grid">
                      <thead>
                        <tr>{cols.map((c, i) => <th key={i} className={c.r ? "r" : undefined}>{c.label}</th>)}</tr>
                      </thead>
                      <tbody>
                        {flatTable ? (
                          (realRows.length === 0 && !showHandoffInbox) ? (
                            <tr><td colSpan={cols.length} style={{ textAlign: "center", color: "var(--txt3)", padding: "28px 12px" }}>ยังไม่มีเอกสารในกล่องนี้</td></tr>
                          ) : (
                            <>
                              {showHandoffInbox && (
                                <>
                                  <tr className="grp"><td colSpan={cols.length}><span className="tcell lvl1">รอรับเพื่อสร้าง {code} (จาก {handoffSrc}) ({handoffsInbox.length})</span></td></tr>
                                  {handoffsInbox.map((r) => (
                                    <tr key={"h-" + r.code} style={{ background: "#f0f7ff" }}>
                                      <td className="docno-cell"><span className="tcell docno">{r.code}</span></td>
                                      <td colSpan={Math.max(1, cols.length - 1)}>
                                        <span style={{ fontSize: 12.5 }}>{handoffSrc} → {code} · {r.values?.customerName || r.values?.customerRef || r.title || "—"} · {r.values?.salesperson || "—"} </span>
                                        <button type="button" className="btn" style={{ padding: "3px 12px", marginLeft: 8 }} onClick={(e) => { e.stopPropagation(); receiveHandoff(r); }}>กดรับ</button>
                                      </td>
                                    </tr>
                                  ))}
                                  {realRows.length > 0 && <tr className="grp"><td colSpan={cols.length}><span className="tcell lvl1">ส่งต่อขั้น (ชนิดเดียวกัน) ({realRows.length})</span></td></tr>}
                                </>
                              )}
                              {realRows.map((r) => (
                                <tr key={r.id} ref={r.id === lastRow ? lastRowRef : undefined} onClick={() => goRow(r.id, r.to ?? mockNav(r.id))} style={{ cursor: "pointer", ...(r.id === lastRow ? { background: "#fff5d6" } : {}) }}>
                                  <td className="docno-cell"><span className="tcell docno">{r.label}</span></td>
                                  {r.cells.map(cellTd)}
                                </tr>
                              ))}
                            </>
                          )
                        ) : (
                          /* รอดำเนินการ — ข้อมูลตัวอย่าง/ร่างเดิม + กลุ่ม "สร้างใหม่" */
                          <>
                            <tr className="grp">
                              <td><span className="tcell"><ChevronDown className="chev" />รวมทั้งหมด</span></td>
                              {totalCells.map(cellTd)}
                            </tr>
                            {showHandoff && (
                              <>
                                <tr className="grp"><td colSpan={cols.length}><span className="tcell lvl1">รอสร้าง {code} (จาก {handoffSrc}) ({handoffsMine.length})</span></td></tr>
                                {handoffsMine.map((r) => (
                                  <tr key={"h-" + r.code} onClick={() => nav(handoffCreateUrl(r))} style={{ cursor: "pointer", background: "#f0f7ff" }}>
                                    <td className="docno-cell"><span className="tcell lvl2 docno">{r.code}</span></td>
                                    <td colSpan={Math.max(1, cols.length - 1)}><span style={{ fontSize: 12.5 }}>{handoffSrc} → {code} · {r.values?.customerName || r.values?.customerRef || r.title || "—"} · {r.values?.salesperson || "—"} · <b style={{ color: "var(--blue)" }}>กดเพื่อสร้าง {code}</b></span></td>
                                  </tr>
                                ))}
                              </>
                            )}
                            {groupsToShow.map((g) => (
                              <Fragment key={g.label}>
                                <tr className="grp" onClick={() => toggleGroup(g.label)} style={{ cursor: "pointer" }}>
                                  <td><span className="tcell lvl1"><ChevronDown className={`chev${collapsed.has(g.label) ? " col" : ""}`} />{g.label}</span></td>
                                  {g.cells.map(cellTd)}
                                </tr>
                                {!collapsed.has(g.label) && g.rows.map((r) => (
                                  <tr key={r.id} ref={r.id === lastRow ? lastRowRef : undefined} onClick={() => goRow(r.id, r.to ?? mockNav(r.id))} style={{ cursor: "pointer", ...(r.id === lastRow ? { background: "#fff5d6" } : {}) }}>
                                    <td className="docno-cell"><span className="tcell lvl2 docno">{r.label}</span></td>
                                    {r.cells.map(cellTd)}
                                  </tr>
                                ))}
                              </Fragment>
                            ))}
                            {groupsToShow.length === 0 && !showHandoff && (
                              <tr><td colSpan={cols.length} style={{ textAlign: "center", color: "var(--txt3)", padding: 18 }}>ไม่มีรายการ</td></tr>
                            )}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* right panel */}
                {isCL ? (
                  <div className="right">
                    <div className="chart-title">ภาพรวม CL · {all.length} ชุด</div>
                    <div className="bars">
                      {REQ_PHASES.map((p) => {
                        const c = phaseCount(p);
                        return (
                          <div className="brow" key={p} style={{ cursor: "pointer" }} onClick={() => setActiveTab(p)}>
                            <div className="bl"><span>{PHASE_LABEL[p]}{activeTab === p ? " ●" : ""}</span><span className="num">{c}</span></div>
                            <div className="bt"><span className="ba" style={{ width: `${Math.round((c / maxPhase) * 100)}%` }} /></div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="chart-title" style={{ marginTop: 18 }}>เปิดเอกสารรวม (อ้างอิง CL)</div>
                    <div className="rmini">
                      <div className="rm"><span>FO</span><b>{sumFO}</b></div>
                      <div className="rm"><span>QT</span><b>{sumQT}</b></div>
                      <div className="rm"><span>SO</span><b>{sumSO}</b></div>
                    </div>

                    <div className="chart-title" style={{ marginTop: 18 }}>ยอดขายประมาณการรวม</div>
                    <div className="rbig">฿ {baht(sumEst)}</div>
                    <div className="rnote">ประมาณการ = ยอดขายย้อนหลังของลูกค้าในชุด × 50%</div>
                  </div>
                ) : isFO && foReport ? (
                  <div className="right">
                    <div className="chart-title">ใบเปิดโอกาส (FO) · {all.length} ใบ</div>
                    <div className="rtabs">
                      {([["overview", "ภาพรวม"], ["cat", "แยกหมวด"], ["team", "ทีม"]] as const).map(([k, l]) => (
                        <button key={k} className={foTab === k ? "on" : ""} onClick={() => setFoTab(k)}>{l}</button>
                      ))}
                    </div>

                    {foTab === "overview" && (
                      <>
                        <div className="chart-title">ตามขั้นตอน</div>
                        <div className="bars">
                          {REQ_PHASES.map((p) => {
                            const c = phaseCountUI(p); const mx = Math.max(1, ...REQ_PHASES.map((x) => phaseCountUI(x)));
                            return (
                              <div className="brow" key={p} style={{ cursor: "pointer" }} onClick={() => setActiveTab(p)}>
                                <div className="bl"><span>{PHASE_LABEL[p]}{activeTab === p ? " ●" : ""}</span><span className="num">{c}</span></div>
                                <div className="bt"><span className="ba" style={{ width: `${Math.round((c / mx) * 100)}%` }} /></div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="chart-title" style={{ marginTop: 18 }}>ผลลัพธ์ (เสร็จสิ้น {foReport.done})</div>
                        <div className="rmini">
                          <div className="rm"><span>เสนอราคา</span><b>{foReport.quote}</b></div>
                          <div className="rm"><span>ปิดไม่ได้</span><b>{foReport.lost}</b></div>
                          <div className="rm"><span>อัตราแปลง</span><b>{foReport.convRate}%</b></div>
                        </div>
                        <div className="chart-title" style={{ marginTop: 18 }}>ค้างในระบบ (ยังไม่ปิด)</div>
                        <div className="rmini">
                          <div className="rm"><span>เฉลี่ย (วัน)</span><b>{foReport.avgAge}</b></div>
                          <div className="rm"><span>เกิน 7 วัน</span><b>{foReport.aging7}</b></div>
                        </div>
                      </>
                    )}

                    {foTab === "cat" && (
                      <>
                        <div className="chart-title">บริการที่ต้องการ</div>
                        <div className="bars">{barList(foReport.svc)}</div>
                        <div className="chart-title" style={{ marginTop: 18 }}>สถานะเอกสาร</div>
                        <div className="bars">{barList(foReport.st)}</div>
                        <div className="chart-title" style={{ marginTop: 18 }}>ความเร่งด่วน</div>
                        <div className="bars">{barList(foReport.urgency)}</div>
                        <div className="chart-title" style={{ marginTop: 18 }}>เกรดลูกค้า</div>
                        <div className="bars">{barList(foReport.grade)}</div>
                      </>
                    )}

                    {foTab === "team" && (
                      <>
                        <div className="chart-title">ผู้รับผิดชอบ (Top)</div>
                        <div className="bars">{barList(foReport.sale)}</div>
                      </>
                    )}
                  </div>
                ) : isSO && soReport ? (
                  <div className="right">
                    <div className="chart-title">ใบสั่งขาย (SO) · {all.length} ใบ</div>
                    <div className="bars">
                      {REQ_PHASES.map((p) => {
                        const c = phaseCountUI(p); const mx = Math.max(1, ...REQ_PHASES.map((x) => phaseCountUI(x)));
                        return (
                          <div className="brow" key={p} style={{ cursor: "pointer" }} onClick={() => setActiveTab(p)}>
                            <div className="bl"><span>{PHASE_LABEL[p]}{activeTab === p ? " ●" : ""}</span><span className="num">{c}</span></div>
                            <div className="bt"><span className="ba" style={{ width: `${Math.round((c / mx) * 100)}%` }} /></div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="chart-title" style={{ marginTop: 18 }}>ยอดขายรวม</div>
                    <div className="rbig">฿ {baht(soReport.total)}</div>
                    <div className="chart-title" style={{ marginTop: 18 }}>ผลลัพธ์ (เสร็จสิ้น)</div>
                    <div className="rmini">
                      <div className="rm"><span>ส่งไปผลิต</span><b>{soReport.prod}</b></div>
                      <div className="rm"><span>เปิดโครงการ</span><b>{soReport.proj}</b></div>
                      <div className="rm"><span>ปิดสำเร็จ</span><b>{soReport.done}</b></div>
                    </div>
                    <div className="chart-title" style={{ marginTop: 18 }}>ผู้รับผิดชอบ (Top)</div>
                    <div className="bars">{barList(soReport.sale)}</div>
                    <div className="chart-title" style={{ marginTop: 18 }}>รายการขาย</div>
                    <div className="bars">{barList(soReport.svc)}</div>
                  </div>
                ) : isQT && qtReport ? (
                  <div className="right">
                    <div className="chart-title">ใบเสนอราคา (QT) · {all.length} ใบ</div>
                    <div className="rtabs">
                      {([["overview", "ภาพรวม"], ["cat", "แยกหมวด"], ["team", "ทีม"]] as const).map(([k, l]) => (
                        <button key={k} className={foTab === k ? "on" : ""} onClick={() => setFoTab(k)}>{l}</button>
                      ))}
                    </div>
                    {foTab === "overview" && (
                      <>
                        <div className="chart-title">ตามขั้นตอน</div>
                        <div className="bars">
                          {REQ_PHASES.map((p) => {
                            const c = phaseCountUI(p); const mx = Math.max(1, ...REQ_PHASES.map((x) => phaseCountUI(x)));
                            return (
                              <div className="brow" key={p} style={{ cursor: "pointer" }} onClick={() => setActiveTab(p)}>
                                <div className="bl"><span>{PHASE_LABEL[p]}{activeTab === p ? " ●" : ""}</span><span className="num">{c}</span></div>
                                <div className="bt"><span className="ba" style={{ width: `${Math.round((c / mx) * 100)}%` }} /></div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="chart-title" style={{ marginTop: 18 }}>ผลลัพธ์ (เสร็จสิ้น {qtReport.done})</div>
                        <div className="rmini">
                          <div className="rm"><span>ปิดได้</span><b>{qtReport.won}</b></div>
                          <div className="rm"><span>ปิดไม่ได้</span><b>{qtReport.lost}</b></div>
                          <div className="rm"><span>ยกเลิก</span><b>{qtReport.cancel}</b></div>
                          <div className="rm"><span>อัตราปิด</span><b>{qtReport.convRate}%</b></div>
                        </div>
                        <div className="chart-title" style={{ marginTop: 18 }}>ค้างในระบบ (ยังไม่ปิด)</div>
                        <div className="rmini">
                          <div className="rm"><span>เฉลี่ย (วัน)</span><b>{qtReport.avgAge}</b></div>
                          <div className="rm"><span>เกิน 7 วัน</span><b>{qtReport.aging7}</b></div>
                        </div>
                      </>
                    )}
                    {foTab === "cat" && (
                      <>
                        <div className="chart-title">บริการที่ต้องการ</div>
                        <div className="bars">{barList(qtReport.svc)}</div>
                        <div className="chart-title" style={{ marginTop: 18 }}>สถานะเอกสาร</div>
                        <div className="bars">{barList(qtReport.st)}</div>
                        <div className="chart-title" style={{ marginTop: 18 }}>ความเร่งด่วน</div>
                        <div className="bars">{barList(qtReport.urg)}</div>
                        <div className="chart-title" style={{ marginTop: 18 }}>เกรดลูกค้า</div>
                        <div className="bars">{barList(qtReport.grade)}</div>
                        <div className="chart-title" style={{ marginTop: 18 }}>สถานะที่ส่ง</div>
                        <div className="bars">{barList(qtReport.sendT)}</div>
                      </>
                    )}
                    {foTab === "team" && (
                      <>
                        <div className="chart-title">ผู้รับผิดชอบ (Top)</div>
                        <div className="bars">{barList(qtReport.sale)}</div>
                      </>
                    )}
                  </div>
                ) : box.aside && (
                  <div className="right">
                    <div className="selbox">
                      <div className="sl"><Calendar size={13} />ช่วงเวลา</div>
                      <div className="sv">เดือนนี้ (มิ.ย. 2026)<ChevronDown /></div>
                    </div>
                    <div className="selbox">
                      <div className="sl"><Check size={13} />ผู้รับผิดชอบ</div>
                      <div className="sv">ทั้งหมด<ChevronDown /></div>
                    </div>

                    <div className="chart-title">{box.aside.title}</div>
                    <div className="legend">
                      <span><i className="lg-a" />{box.aside.legend[0]}</span>
                      <span><i className="lg-b" />{box.aside.legend[1]}</span>
                    </div>
                    <div className="bars">
                      {box.aside.bars.map((b) => (
                        <div className="brow" key={b.name}>
                          <div className="bl"><span>{b.name}</span><span className="num">{b.val}</span></div>
                          <div className="bt">
                            <span className="ba" style={{ width: `${b.a}%` }} />
                            <span className="bb" style={{ width: `${b.b}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--txt3)", fontSize: 14, textAlign: "center", padding: 24 }}>
              ยังไม่มีข้อมูลตัวอย่างสำหรับขั้น {STAGE_NAME[stage] ?? code}
            </div>
          )}
        </div>
      </div>

      {opsCode && (() => { const d = all.find((x) => x.code === opsCode); return d ? <OpsModal doc={d} onClose={() => setOpsCode(null)} /> : null; })()}

      {/* popup ผลค้นหา — ข้ามกล่อง บอกว่าอยู่กล่องไหน คลิกเปิดเอกสารได้เลย */}
      {q && (
        <div className="bs-modal-ov" onClick={() => { setSearch(""); setQuery(""); }}>
          <div className="bs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bs-modal-head">
              <Search size={16} /><span>ผลค้นหา “{query.trim()}” · {searchResults.length} รายการ</span>
              <button className="bs-modal-x" title="ปิด" onClick={() => { setSearch(""); setQuery(""); }}><X size={15} /></button>
            </div>
            <div className="bs-modal-body">
              {searchResults.length === 0 ? (
                <div className="bs-empty">ไม่พบเอกสารที่ค้นหา</div>
              ) : searchResults.map(({ type, doc }) => (
                <div key={type + ":" + doc.code} className="bs-row" title={`เปิด ${doc.code}`}
                  onClick={() => { const b = BOX[type]; setSearch(""); setQuery(""); nav(b ? b.detail(doc.code) : "/sales"); }}>
                  <span className={`bs-badge bs-${type.toLowerCase()}`} title={STAGE_NAME[type.toLowerCase()] || type}>{type}</span>
                  <span className="bs-code">{doc.code}</span>
                  <span className="bs-cust">{doc.values?.customerName || doc.values?.customerRef || doc.title || "—"}</span>
                  <span className="bs-sale">{doc.values?.salesperson || doc.telesale || "—"}</span>
                  <span className="bs-phase">{PHASE_LABEL[doc.phase as ReqPhase] || doc.phase || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
