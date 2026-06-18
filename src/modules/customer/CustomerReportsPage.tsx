import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, Building, ArrowLeft, BarChart, Download, X, Refresh } from "../../shared/icons";
import CrmHelpButton from "./CrmHelpButton";
import LangSwitcher from "../../shared/LangSwitcher";
import CustomerSide from "./CustomerSide";
import {
  fetchContactDistribution, fetchContactMembers,
  fetchGradeMovement, recordGradeCut, fetchRevisions, getCycleStart, setCycleStart,
  fetchStatusDistribution, fetchStatusMembers,
  fetchCompletenessPct, fetchCompletenessPctMembers,
  groupKey, exportCSV, type Distribution, type GradeMovement, type RevisionEvent,
  type Member, type Granularity, type StatusCount, type CompletenessPct,
} from "./reportStore";
import { loadRequests, type CustomerRequest } from "./customerRequests";
import { getEnabledFields } from "./customerFieldConfig";
import { statusTone } from "./customerStatus";
import { getStatusOverride } from "./customerStatusConfig";
import "./customer.css";

type Drill = { title: string; headers: string[]; rows: (string | number)[][]; file: string } | null;
type Bar = { label: string; value: number; tone?: string };
const palette = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];
type Series = { name: string; color: string; values: number[] };
type ReqType = "add" | "edit" | "status";
type ReqRow = { period: string; requester: string; reviewer: string; add: number; edit: number; status: number };

/** กราฟแกนเวลาหลายชุด (แท่งกลุ่ม/เส้น) — แยก series ตาม user · เรียงเก่า→ใหม่ */
function MultiChart({ periods, series, type, empty }: { periods: string[]; series: Series[]; type: "bar" | "line"; empty: string }) {
  if (periods.length === 0) return <div className="muted" style={{ padding: 8 }}>{empty}</div>;
  const n = periods.length;
  const W = Math.max(n * 64, 320), H = 210, padT = 14, padB = 30, padL = 10, padR = 10;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const slot = (W - padL - padR) / n;
  const cx = (i: number) => padL + slot * i + slot / 2;
  const base = H - padB;
  const cy = (v: number) => padT + (1 - v / max) * (base - padT);
  return (
    <svg className="rp-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img">
      <line x1={padL} y1={base} x2={W - padR} y2={base} stroke="var(--field-bd)" />
      {type === "line" && series.map((s, si) => (
        <g key={si}>
          <polyline points={periods.map((_, i) => `${cx(i)},${cy(s.values[i])}`).join(" ")} fill="none" stroke={s.color} strokeWidth={2} />
          {s.values.map((v, i) => <circle key={i} cx={cx(i)} cy={cy(v)} r={2.5} fill={s.color} />)}
        </g>
      ))}
      {type === "bar" && periods.map((_, i) => {
        const k = series.length, gw = Math.min(slot * 0.74, 46), bw = gw / k, x0 = cx(i) - gw / 2;
        return series.map((s, si) => { const v = s.values[i], h = base - cy(v); return <rect key={`${i}-${si}`} x={x0 + bw * si} y={cy(v)} width={Math.max(1, bw - 1)} height={Math.max(0, h)} fill={s.color} rx={1} />; });
      })}
      {periods.map((p, i) => <text key={i} x={cx(i)} y={H - 9} textAnchor="middle" fontSize={10.5} fill="var(--txt3)">{p}</text>)}
    </svg>
  );
}

/** ตารางคำขอ — แถวต่อ (ช่วง × ผู้ขอ × ผู้ตรวจ) คอลัมน์ ประเภทการขอ (เพิ่ม/แก้ไข/เปลี่ยนสถานะ) + รวม */
function ReqTable({ rows, th }: { rows: ReqRow[]; th: boolean }) {
  const tot = rows.reduce((a, r) => ({ add: a.add + r.add, edit: a.edit + r.edit, status: a.status + r.status }), { add: 0, edit: 0, status: 0 });
  const grand = tot.add + tot.edit + tot.status;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-grid">
        <thead><tr>
          <th>{th ? "ช่วง" : "Period"}</th>
          <th>{th ? "ผู้ขอ" : "Requester"}</th>
          <th>{th ? "ผู้ตรวจ" : "Reviewer"}</th>
          <th>{th ? "ขอเพิ่ม" : "Add"}</th>
          <th>{th ? "ขอแก้ไข" : "Edit"}</th>
          <th>{th ? "ขอเปลี่ยนสถานะ" : "Status change"}</th>
          <th>{th ? "รวม" : "Total"}</th>
        </tr></thead>
        <tbody>
          {rows.length === 0 ? <tr className="empty-row"><td colSpan={7}>{th ? "ไม่มีข้อมูลในช่วงนี้" : "No data in range"}</td></tr>
            : rows.map((r, i) => (
              <tr key={i}><td className="docno">{r.period}</td><td>{r.requester}</td><td>{r.reviewer}</td>
                <td>{r.add || "—"}</td><td>{r.edit || "—"}</td><td>{r.status || "—"}</td>
                <td><b>{(r.add + r.edit + r.status).toLocaleString()}</b></td></tr>
            ))}
        </tbody>
        {rows.length > 0 && <tfoot><tr><td colSpan={3}><b>{th ? "รวม" : "Total"}</b></td>
          <td><b>{tot.add.toLocaleString()}</b></td><td><b>{tot.edit.toLocaleString()}</b></td>
          <td><b>{tot.status.toLocaleString()}</b></td><td><b>{grand.toLocaleString()}</b></td></tr></tfoot>}
      </table>
    </div>
  );
}

/** กราฟวงกลม (donut) + คำอธิบาย — กดส่วน/แถวเพื่อ drill · ไม่พึ่ง chart lib */
function Donut({ items, onClick }: { items: Bar[]; onClick?: (i: number) => void }) {
  const sum = items.reduce((a, b) => a + b.value, 0);
  const size = 168, th = 30, r = (size - th) / 2, c = 2 * Math.PI * r, cc = size / 2;
  const col = (b: Bar, i: number) => b.tone ?? palette[i % palette.length];
  let acc = 0;
  return (
    <div className="rp-donut-wrap">
      <svg className="rp-donut" viewBox={`0 0 ${size} ${size}`} role="img">
        <g transform={`rotate(-90 ${cc} ${cc})`}>
          {sum === 0 ? <circle cx={cc} cy={cc} r={r} fill="none" stroke="var(--bg)" strokeWidth={th} />
            : items.map((b, i) => {
              const len = (c * b.value) / sum, seg = (
                <circle key={i} cx={cc} cy={cc} r={r} fill="none" stroke={col(b, i)} strokeWidth={th}
                  strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc}
                  className={onClick ? "clk" : ""} onClick={() => onClick?.(i)} />
              );
              acc += len; return seg;
            })}
        </g>
        <text x={cc} y={cc - 2} textAnchor="middle" fontSize={24} fontWeight={700} fill="var(--txt)">{sum.toLocaleString()}</text>
        <text x={cc} y={cc + 17} textAnchor="middle" fontSize={11} fill="var(--txt3)">รวม</text>
      </svg>
      <div className="rp-legend">
        {items.map((b, i) => (
          <div key={i} className={`rp-leg${onClick ? " clk" : ""}`} onClick={() => onClick?.(i)}>
            <span className="rp-dot" style={{ background: col(b, i) }} />
            <span className="rp-leg-lb">{b.label}</span>
            <span className="rp-leg-v">{b.value.toLocaleString()} · {sum ? Math.round((b.value / sum) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** รายงานลูกค้า — เรียลไทม์ (ติดต่อ/ครบถ้วน/เกรด · นับเฉพาะ ACTIVE) + ไม่เรียลไทม์ (เพิ่ม/แก้) */
export default function CustomerReportsPage() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const session = getSession();
  const tenant = session?.companyId ?? "";

  const [tab, setTab] = useState<"realtime" | "history">("realtime");
  const [drill, setDrill] = useState<Drill>(null);

  // เรียลไทม์
  const [gradeAbc, setGradeAbc] = useState(false);
  const [dist, setDist] = useState<Distribution | null>(null);
  const [compPct, setCompPct] = useState<CompletenessPct | null>(null);   // ความครบถ้วน — นับที่ DB
  const [statusCounts, setStatusCounts] = useState<StatusCount[] | null>(null);   // นับลูกค้าตามสถานะ (นับที่ DB)
  const [grade, setGrade] = useState<GradeMovement | null>(null);
  const [cutting, setCutting] = useState(false);

  // ไม่เรียลไทม์ (คำขอดำเนินการ)
  const [gran, setGran] = useState<Granularity>("month");
  const [histView, setHistView] = useState<"chart" | "table">("chart");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [cycle, setCycle] = useState(getCycleStart());
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 11); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [reqStatus, setReqStatus] = useState<"all" | "done" | "pending">("all");   // กรองตามสถานะเอกสาร
  const [reqTick, setReqTick] = useState(0);
  const [creates, setCreates] = useState<RevisionEvent[]>([]);   // การสร้างลูกค้าจริง (รวมที่ทำโดยตรง ไม่ผ่านใบคำขอ)
  const loadCreates = () => { if (tenant) fetchRevisions(from, to).then((rs) => setCreates(rs.filter((r) => r.action === "CREATE"))).catch(() => {}); };
  const refreshReqs = () => { setReqTick((n) => n + 1); loadCreates(); };

  // ความครบถ้วน = % ของฟิลด์ที่กรอกจริง (จากฟิลด์ที่เปิดใช้ ยกเว้น "ชื่อ") — นับที่ DB ตามรายชื่อฟิลด์ที่ส่งไป
  const compFields = useMemo(() => getEnabledFields().filter((k) => k !== "name"), []);
  const loadRealtime = () => {
    fetchContactDistribution(gradeAbc).then(setDist).catch(() => {});
    fetchCompletenessPct(compFields).then(setCompPct).catch(() => setCompPct({ total: 0, avg: 0, buckets: [] }));
    fetchStatusDistribution().then(setStatusCounts).catch(() => setStatusCounts([]));
    fetchGradeMovement().then(setGrade).catch(() => {});
  };
  useEffect(() => { if (tenant) loadRealtime(); /* eslint-disable-next-line */ }, [tenant, gradeAbc]);
  useEffect(() => { if (tenant && tab === "history") loadCreates(); /* eslint-disable-next-line */ }, [tenant, tab, from, to]);

  // ----- realtime drills -----
  const drillContact = async (bucket: number) => {
    const lbls = ["0", "1", "2", ">2"];
    const ms = await fetchContactMembers(bucket, gradeAbc);
    setDrill({ title: `${th ? "ติดต่อ" : "Contacted"} ${lbls[bucket]} ${th ? "ครั้ง" : "times"}${gradeAbc ? " · A·B·C" : ""}`,
      headers: [th ? "รหัส" : "Code", th ? "ชื่อ" : "Name", th ? "เกรด" : "Grade", th ? "จำนวนครั้ง" : "Contacts"],
      rows: ms.map((m: Member) => [m.code, m.name, m.c1 || "—", m.c2]), file: `contact_${lbls[bucket]}` });
  };
  const drillCompPct = async (idx: number) => {
    const lo = idx * 10, label = idx >= 10 ? "100%" : `${lo}–${lo + 9}%`;
    const ms = await fetchCompletenessPctMembers(compFields, idx).catch(() => [] as Member[]);
    setDrill({ title: (th ? "ความครบถ้วน " : "Completeness ") + label,
      headers: [th ? "รหัส" : "Code", th ? "ชื่อ" : "Name", th ? "ครบ" : "Complete"],
      rows: ms.map((m) => [m.code, m.name, (m.c2 || "0") + "%"]), file: `completeness_${lo}` });
  };
  const compStats = useMemo(() => {
    const counts = new Map<number, number>();
    (compPct?.buckets || []).forEach((b) => counts.set(b.bucket, b.count));
    const buckets = Array.from({ length: 11 }, (_, i) => ({ idx: i, label: i >= 10 ? "100%" : `${i * 10}–${i * 10 + 9}%`, count: counts.get(i) || 0 }));
    return { buckets, total: compPct?.total || 0, avg: compPct?.avg || 0, max: Math.max(1, ...buckets.map((b) => b.count)) };
  }, [compPct]);
  // แบ่งลูกค้าตามประเภท/สถานะ (พร้อมใช้=ACTIVE · บัญชีดำ=BLACKLISTED · อื่นๆ) — นับทุกสถานะ
  const statusLabel = (code: string) => getStatusOverride(code) || t(`custStatus.${code}`, { defaultValue: code });
  const TONE_COLOR: Record<string, string> = { green: "#16a34a", gray: "#94a3b8", red: "#dc2626" };
  const statusDist = useMemo(() => {
    // ACTIVE ขึ้นก่อนเสมอ · ที่เหลือเรียงจำนวนมาก→น้อย
    return [...(statusCounts || [])]
      .sort((a, b) => (a.status === "ACTIVE" ? -1 : b.status === "ACTIVE" ? 1 : b.count - a.count))
      .map((s) => ({ code: s.status, count: s.count, label: statusLabel(s.status), tone: TONE_COLOR[statusTone(s.status)] }));
  }, [statusCounts]); // eslint-disable-line react-hooks/exhaustive-deps
  const statusTotal = statusDist.reduce((a, s) => a + s.count, 0);
  const drillStatus = async (code: string) => {
    const ms = await fetchStatusMembers(code).catch(() => [] as Member[]);
    setDrill({ title: (th ? "สถานะ " : "Status ") + statusLabel(code),
      headers: [th ? "รหัส" : "Code", th ? "ชื่อ" : "Name"],
      rows: ms.map((m) => [m.code, m.name]), file: `status_${code}` });
  };

  const doCut = async () => {
    if (!window.confirm(th ? "ตัดเกรดรอบนี้ตอนนี้? (บันทึกเกรดปัจจุบันของลูกค้า ACTIVE ทั้งหมดเป็นรอบใหม่)" : "Cut grades now?")) return;
    setCutting(true);
    try { const r = await recordGradeCut(); alert(th ? `ตัดเกรดแล้ว ${r.rows} ราย` : `Cut ${r.rows}`); fetchGradeMovement().then(setGrade); }
    finally { setCutting(false); }
  };

  // ----- คำขอดำเนินการ (จาก localStorage · ตามใบคำขอ ไม่ใช่ข้อมูลที่แก้จริง) -----
  const allReqs = useMemo<CustomerRequest[]>(() => loadRequests(), [tenant, reqTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const reqTypeOf = (topic: string): ReqType => (topic === "ADD" ? "add" : topic === "STATUS" ? "status" : "edit");
  const TYPE_META: { key: ReqType; label: string; color: string }[] = [
    { key: "add", label: th ? "ขอเพิ่ม" : "Add", color: "#16a34a" },
    { key: "edit", label: th ? "ขอแก้ไข" : "Edit", color: "#2563eb" },
    { key: "status", label: th ? "ขอเปลี่ยนสถานะ" : "Status change", color: "#f59e0b" },
  ];
  const PHASE_LABEL: Record<string, string> = th
    ? { RECEIVE: "รอรับ", PROCESS: "รอดำเนินการ", EXPORT: "ส่งออก", DONE: "เสร็จสิ้น" }
    : { RECEIVE: "To receive", PROCESS: "Processing", EXPORT: "Exported", DONE: "Done" };

  // กรองตามช่วงวันที่ (savedAt) + สถานะเอกสาร (เสร็จแล้ว=DONE / รอดำเนินการ=ยังไม่ DONE)
  const filteredReqs = useMemo(() => {
    const fromMs = from ? Date.parse(`${from}T00:00:00`) : -Infinity;
    const toMs = to ? Date.parse(`${to}T23:59:59`) : Infinity;
    return allReqs.filter((r) => {
      if (r.savedAt < fromMs || r.savedAt > toMs) return false;
      const done = r.phase === "DONE";
      if (reqStatus === "done" && !done) return false;
      if (reqStatus === "pending" && done) return false;
      return true;
    });
  }, [allReqs, from, to, reqStatus]);

  // รวมตาม (ช่วง × ผู้ขอ × ผู้ตรวจ) แยกประเภทการขอ · byPeriod = ยอดต่อช่วง (สำหรับกราฟ)
  const reqData = useMemo(() => {
    const NA = th ? "(ไม่ระบุ)" : "(none)";
    const NOREV = th ? "(ยังไม่รับ)" : "(unreceived)";
    const rowMap = new Map<string, ReqRow>();
    const byPeriod = new Map<string, Record<ReqType, number>>();
    filteredReqs.forEach((r) => {
      const p = groupKey(new Date(r.savedAt).toISOString(), gran, cycle), tc = reqTypeOf(r.topic);
      const requester = (r.requester || "").trim() || NA;
      const reviewer = (r.received?.by || "").trim() || NOREV;
      const rk = `${p}|||${requester}|||${reviewer}`;
      if (!rowMap.has(rk)) rowMap.set(rk, { period: p, requester, reviewer, add: 0, edit: 0, status: 0 });
      rowMap.get(rk)![tc]++;
      if (!byPeriod.has(p)) byPeriod.set(p, { add: 0, edit: 0, status: 0 });
      byPeriod.get(p)![tc]++;
    });
    const rows = [...rowMap.values()].sort((a, b) => b.period.localeCompare(a.period) || a.requester.localeCompare(b.requester) || a.reviewer.localeCompare(b.reviewer));
    const periodsDesc = [...byPeriod.keys()].sort((a, b) => b.localeCompare(a));
    return { rows, byPeriod, periodsDesc };
  }, [filteredReqs, gran, cycle, th]);

  // การเพิ่มลูกค้า "เกิดขึ้นจริง" — นับการสร้างลูกค้าจาก backend (รวมที่ทำโดยตรง ไม่ผ่านใบคำขอ)
  // ตารางแยกตาม (ช่วง × ผู้เพิ่ม) · byPeriod = ยอดรวมต่อช่วง (สำหรับกราฟ)
  const addData = useMemo(() => {
    const NA = th ? "(ไม่ระบุ)" : "(none)";
    const rowMap = new Map<string, { period: string; by: string; count: number }>();
    const byPeriod = new Map<string, number>();
    creates.forEach((r) => {
      const p = groupKey(r.at, gran, cycle), by = (r.changedBy || "").trim() || NA;
      const rk = `${p}|||${by}`;
      if (!rowMap.has(rk)) rowMap.set(rk, { period: p, by, count: 0 });
      rowMap.get(rk)!.count++;
      byPeriod.set(p, (byPeriod.get(p) || 0) + 1);
    });
    const rows = [...rowMap.values()].sort((a, b) => b.period.localeCompare(a.period) || a.by.localeCompare(b.by));
    const periodsDesc = [...byPeriod.keys()].sort((a, b) => b.localeCompare(a));
    return { rows, byPeriod, periodsDesc, total: creates.length };
  }, [creates, gran, cycle, th]);
  const addPeriodsAsc = addData.periodsDesc.slice(0, 12).reverse();
  const addSeries: Series[] = [{ name: th ? "เพิ่มจริง" : "Created", color: "#16a34a", values: addPeriodsAsc.map((p) => addData.byPeriod.get(p) || 0) }];

  const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const onCycle = (v: number) => { const d = Math.min(28, Math.max(1, v || 1)); setCycle(d); setCycleStart(d); };

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err"><Building size={15} />{t("customer.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}><ArrowLeft size={15} />{t("customer.goLogin")}</button></div></div>;
  }

  const drillExport = () => drill && exportCSV(drill.file, drill.headers, drill.rows);
  const exportReq = () => exportCSV("customer_requests",
    [th ? "ช่วง" : "Period", th ? "ผู้ขอ" : "Requester", th ? "ผู้ตรวจ" : "Reviewer", th ? "ขอเพิ่ม" : "Add", th ? "ขอแก้ไข" : "Edit", th ? "ขอเปลี่ยนสถานะ" : "Status change", th ? "รวม" : "Total"],
    reqData.rows.map((r) => [r.period, r.requester, r.reviewer, r.add, r.edit, r.status, r.add + r.edit + r.status]));
  const reqPeriodsAsc = reqData.periodsDesc.slice(0, 12).reverse();
  const reqSeries: Series[] = TYPE_META.map((tm) => ({ name: tm.label, color: tm.color, values: reqPeriodsAsc.map((p) => reqData.byPeriod.get(p)?.[tm.key] ?? 0) }));

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{t("customer.title")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <CrmHelpButton />
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <CustomerSide active="reports" />

        <div className="crm-content">
          <div className="subbar">
            <div className="company-pick"><BarChart size={15} />{t("customer.menu.reports", { defaultValue: "รายงาน" })}</div>
            <div className="u-spacer" />
            <div className="tb" title={t("common.refresh")} onClick={() => (tab === "realtime" ? loadRealtime() : refreshReqs())} style={{ cursor: "pointer" }}><Refresh /></div>
          </div>

          <div className="crm-body">
            <div className="tabs" style={{ marginBottom: 14 }}>
              <div className={`tab${tab === "realtime" ? " active" : ""}`} onClick={() => setTab("realtime")}>{th ? "เรียลไทม์" : "Realtime"}</div>
              <div className={`tab${tab === "history" ? " active" : ""}`} onClick={() => setTab("history")}>{th ? "ไม่เรียลไทม์ (ย้อนหลัง)" : "Historical"}</div>
            </div>

            {tab === "realtime" ? (
              <>
                {/* ข้อมูลลูกค้าแบ่งตามประเภท/สถานะ — นับทุกสถานะ (พร้อมใช้/บัญชีดำ/อื่นๆ + รวม) */}
                <div className="card">
                  <div className="sh">{th ? "ลูกค้าแบ่งตามประเภท (สถานะ)" : "Customers by type (status)"} <span className="ff-count" style={{ marginLeft: 6 }}>{statusTotal.toLocaleString()}</span>
                    <button className="btn rp-csv" disabled={!statusCounts} onClick={() => exportCSV("customer_by_status", [th ? "สถานะ" : "Status", th ? "จำนวน" : "Count"], statusDist.map((s) => [s.label, s.count]))}><Download size={13} />CSV</button>
                  </div>
                  {statusCounts == null ? <div className="rp-body muted">{th ? "กำลังโหลด…" : "Loading…"}</div> : statusTotal === 0 ? (
                    <div className="rp-body muted">{th ? "ยังไม่มีข้อมูลลูกค้า" : "No customers"}</div>
                  ) : (
                    <div className="rp-body">
                      <Donut onClick={(i) => drillStatus(statusDist[i].code)} items={statusDist.map((s) => ({ label: s.label, value: s.count, tone: s.tone }))} />
                      <div className="muted rp-hint">{th ? "กดส่วนวงกลมเพื่อดูรายชื่อในสถานะนั้น" : "Click a slice to view names"}</div>
                    </div>
                  )}
                </div>

                <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{th ? "การ์ดด้านล่างนับเฉพาะลูกค้าสถานะ “ใช้งาน” (ACTIVE)" : "Cards below count active customers only"}</div>

                {/* ① + ② จำนวนครั้งที่ติดต่อ */}
                <div className="card">
                  <div className="sh">
                    {th ? "จำนวนครั้งที่ติดต่อไปแล้ว" : "Times contacted"}
                    <label className="rp-toggle"><input type="checkbox" checked={gradeAbc} onChange={(e) => setGradeAbc(e.target.checked)} />{th ? "เฉพาะเกรด A·B·C" : "Only A·B·C"}</label>
                    <button className="btn rp-csv" onClick={() => dist && exportCSV("contact_distribution", [th ? "ครั้ง" : "Times", th ? "จำนวน" : "Count"], [["0", dist.b0], ["1", dist.b1], ["2", dist.b2], [">2", dist.b3plus]])}><Download size={13} />CSV</button>
                  </div>
                  {dist && <div className="rp-body">
                    <Donut onClick={drillContact} items={[
                      { label: th ? "0 ครั้ง" : "0 times", value: dist.b0, tone: "#94a3b8" }, { label: th ? "1 ครั้ง" : "1 time", value: dist.b1, tone: "#2563eb" },
                      { label: th ? "2 ครั้ง" : "2 times", value: dist.b2, tone: "#16a34a" }, { label: th ? "มากกว่า 2 ครั้ง" : ">2 times", value: dist.b3plus, tone: "#f59e0b" },
                    ]} />
                    <div className="muted rp-hint">{th ? "กดส่วนวงกลมเพื่อดูรายชื่อ" : "Click a slice to view names"}</div>
                  </div>}
                </div>

                {/* ④ ความครบถ้วน — เป็น % แบ่งช่วงละ 10 */}
                <div className="card">
                  <div className="sh">{th ? "ความครบถ้วนของข้อมูล" : "Data completeness"} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>{th ? "(% ฟิลด์ที่กรอก · แบ่งช่วงละ 10%)" : "(% of fields filled · 10% buckets)"}</span>
                    <button className="btn rp-csv" onClick={() => exportCSV("completeness_pct", [th ? "ช่วง" : "Range", th ? "จำนวน" : "Count"], compStats.buckets.map((b) => [b.label, b.count]))}><Download size={13} />CSV</button>
                  </div>
                  {compPct == null ? <div className="rp-body muted">{th ? "กำลังโหลด…" : "Loading…"}</div> : (
                    <div className="rp-body">
                      <div className="rp-comp-avg">{th ? "เฉลี่ย" : "Average"} <b>{compStats.avg}%</b> <span className="muted">· {compStats.total.toLocaleString()} {th ? "ราย" : "customers"}</span></div>
                      {(() => {
                        const vis = compStats.buckets.filter((b) => b.count > 0);
                        return <Donut onClick={(i) => drillCompPct(vis[i].idx)} items={vis.map((b) => ({ label: b.label, value: b.count, tone: `hsl(${b.idx * 12}, 68%, 46%)` }))} />;
                      })()}
                      <div className="muted rp-hint">{th ? "กดส่วนวงกลมเพื่อดูรายชื่อในช่วงนั้น" : "Click a slice to view names"}</div>
                    </div>
                  )}
                </div>

                {/* ③ เกรดขึ้น/ลง */}
                <div className="card">
                  <div className="sh">{th ? "การขึ้น/ลงของเกรด (รอบล่าสุด)" : "Grade movement (latest cut)"}
                    <button className="btn primary rp-csv" disabled={cutting} onClick={doCut}>{cutting ? "…" : (th ? "ตัดเกรดตอนนี้" : "Cut grades now")}</button>
                  </div>
                  {!grade || !grade.period ? (
                    <div className="rp-body muted">{th ? "ยังไม่มีการตัดเกรด — กด “ตัดเกรดตอนนี้” เพื่อเริ่มรอบแรก (ระบบตัดรายเดือนเตรียมไว้แล้ว)" : "No grade cut yet — click “Cut grades now”."}</div>
                  ) : (
                    <div className="rp-body">
                      <div className="rp-grade-title">{th ? "การปรับเกรด" : "Grade movement"} <span className="muted">· {grade.period}</span></div>
                      <div className="rp-grade-arrows">
                        <span className="rp-up">↑ {grade.up}</span>
                        <span className="rp-grade-div" />
                        <span className="rp-down">↓ {grade.down}</span>
                      </div>
                      <div className="muted rp-grade-sub">{th ? `อัปเกรด ${grade.up} ราย / ตกเกรด ${grade.down} ราย` : `${grade.up} upgraded / ${grade.down} downgraded`}</div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* ตัวกรองร่วม */}
                <div className="rd-filter">
                  <span className="rd-filter-lb">{th ? "ช่วง" : "Range"}</span>
                  <input type="date" className="rd-filter-sel" value={from} onChange={(e) => setFrom(e.target.value)} />
                  <span className="muted">–</span>
                  <input type="date" className="rd-filter-sel" value={to} onChange={(e) => setTo(e.target.value)} />
                  <span className="rd-filter-lb" style={{ marginLeft: 8 }}>{th ? "จัดตาม" : "By"}</span>
                  <select className="rd-filter-sel" value={gran} onChange={(e) => setGran(e.target.value as Granularity)}>
                    <option value="day">{th ? "วัน" : "Day"}</option><option value="week">{th ? "สัปดาห์" : "Week"}</option>
                    <option value="month">{th ? "เดือน (รอบ)" : "Month"}</option><option value="year">{th ? "ปี" : "Year"}</option>
                  </select>
                  <span className="rd-filter-lb" style={{ marginLeft: 8 }}>{th ? "สถานะเอกสาร" : "Doc status"}</span>
                  <select className="rd-filter-sel" value={reqStatus} onChange={(e) => setReqStatus(e.target.value as "all" | "done" | "pending")}>
                    <option value="all">{th ? "ทั้งหมด" : "All"}</option>
                    <option value="done">{th ? "เสร็จแล้ว" : "Done"}</option>
                    <option value="pending">{th ? "รอดำเนินการ" : "Pending"}</option>
                  </select>
                  <span className="rd-filter-lb" style={{ marginLeft: 8 }} title={th ? "วันเริ่มรอบเดือน (เช่น 25 = รอบ 25–24)" : "Cycle start day"}>{th ? "เริ่มรอบวันที่" : "Cycle start"}</span>
                  <input type="number" min={1} max={28} className="rd-filter-sel" style={{ width: 64 }} value={cycle} onChange={(e) => onCycle(Number(e.target.value))} />
                  <span className="rd-filter-lb" style={{ marginLeft: 8 }}>{th ? "มุมมอง" : "View"}</span>
                  <div className="cust-seg">
                    <button className={histView === "chart" ? "on" : ""} onClick={() => setHistView("chart")}>{th ? "กราฟ" : "Chart"}</button>
                    <button className={histView === "table" ? "on" : ""} onClick={() => setHistView("table")}>{th ? "ตาราง" : "Table"}</button>
                  </div>
                  {histView === "chart" && (
                    <div className="cust-seg">
                      <button className={chartType === "bar" ? "on" : ""} onClick={() => setChartType("bar")}>{th ? "แท่ง" : "Bar"}</button>
                      <button className={chartType === "line" ? "on" : ""} onClick={() => setChartType("line")}>{th ? "เส้น" : "Line"}</button>
                    </div>
                  )}
                </div>

                {/* ① เพิ่มลูกค้าต่อรอบ */}
                {/* การเพิ่มลูกค้าที่เกิดขึ้นจริง (นับจากการสร้างลูกค้าใน DB — รวมที่ทำโดยตรง ไม่ผ่านใบคำขอ) */}
                <div className="card">
                  <div className="sh">{th ? "การเพิ่มลูกค้า (เกิดขึ้นจริง)" : "Customers created"} <span className="ff-count" style={{ marginLeft: 6 }}>{addData.total}</span>
                    <span className="muted" style={{ fontWeight: 400, fontSize: 12, marginLeft: 6 }}>{th ? "รวมที่ทำโดยตรง ไม่ผ่านใบคำขอ" : "incl. direct (non-request) adds"}</span>
                    <button className="btn rp-csv" onClick={() => exportCSV("customers_created", [th ? "ช่วง" : "Period", th ? "ผู้เพิ่ม" : "By", th ? "จำนวน" : "Count"], addData.rows.map((r) => [r.period, r.by, r.count]))}><Download size={13} />CSV</button>
                    <button className="btn rp-csv" onClick={() => setDrill({ title: th ? "ข้อมูลดิบ — เพิ่มลูกค้า" : "Raw — created", headers: [th ? "วันที่" : "Date", th ? "รหัส" : "Code", th ? "ผู้เพิ่ม" : "By"], rows: creates.map((r) => [fmtDate(r.at), r.code, r.changedBy || "—"]), file: "created_raw" })}>{th ? "ข้อมูลดิบ" : "Raw"}</button>
                  </div>
                  <div className="rp-body">
                    {histView === "table" ? (
                      <div style={{ overflowX: "auto" }}><table className="data-grid">
                        <thead><tr><th>{th ? "ช่วง" : "Period"}</th><th>{th ? "ผู้เพิ่ม" : "By"}</th><th>{th ? "เพิ่มจริง" : "Created"}</th></tr></thead>
                        <tbody>
                          {addData.rows.length === 0 ? <tr className="empty-row"><td colSpan={3}>{th ? "ไม่มีข้อมูลในช่วงนี้" : "No data in range"}</td></tr>
                            : addData.rows.map((r, i) => <tr key={i}><td className="docno">{r.period}</td><td>{r.by}</td><td>{r.count.toLocaleString()}</td></tr>)}
                        </tbody>
                        {addData.rows.length > 0 && <tfoot><tr><td colSpan={2}><b>{th ? "รวม" : "Total"}</b></td><td><b>{addData.total.toLocaleString()}</b></td></tr></tfoot>}
                      </table></div>
                    ) : (
                      <MultiChart type={chartType} periods={addPeriodsAsc} series={addSeries} empty={th ? "ไม่มีข้อมูลในช่วงนี้" : "No data in range"} />
                    )}
                  </div>
                </div>

                {/* คำขอดำเนินการ (ตามใบคำขอ — ไว้ตรวจว่าใครส่ง/ใครตรวจปล่อย) */}
                <div className="card">
                  <div className="sh">{th ? "คำขอดำเนินการ (เพิ่ม/แก้ไข/เปลี่ยนสถานะ)" : "Action requests"} <span className="ff-count" style={{ marginLeft: 6 }}>{filteredReqs.length}</span>
                    <button className="btn rp-csv" onClick={exportReq}><Download size={13} />CSV</button>
                    <button className="btn rp-csv" onClick={() => setDrill({
                      title: th ? "ข้อมูลดิบ — คำขอดำเนินการ" : "Raw — action requests",
                      headers: [th ? "วันที่" : "Date", th ? "เลขที่" : "Code", th ? "ลูกค้า" : "Customer", th ? "ประเภทการขอ" : "Type", th ? "สถานะเอกสาร" : "Doc status", th ? "ผู้ขอ" : "Requester", th ? "ผู้ตรวจ" : "Reviewer"],
                      rows: filteredReqs.map((r) => [fmtDate(new Date(r.savedAt).toISOString()), r.code, r.customer || "—", TYPE_META.find((m) => m.key === reqTypeOf(r.topic))?.label ?? r.topic, PHASE_LABEL[r.phase] ?? r.phase, r.requester || "—", r.received?.by || "—"]),
                      file: "requests_raw",
                    })}>{th ? "ข้อมูลดิบ" : "Raw"}</button>
                  </div>
                  <div className="rp-body">
                    {histView === "table" ? <ReqTable rows={reqData.rows} th={th} /> : (
                      <>
                        <div className="rp-legend-row">{TYPE_META.map((m) => <span key={m.key} className="rp-leg-chip"><span className="rp-dot" style={{ background: m.color }} />{m.label}</span>)}</div>
                        <MultiChart type={chartType} periods={reqPeriodsAsc} series={reqSeries} empty={th ? "ไม่มีข้อมูลในช่วงนี้" : "No data in range"} />
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ดูข้อมูลดิบ / drill */}
      {drill && (
        <div className="grp-pop-overlay" onClick={() => setDrill(null)}>
          <div className="grp-pop" onClick={(e) => e.stopPropagation()}>
            <div className="grp-pop-head">
              <div className="gp-title"><b>{drill.title}</b></div>
              <span className="gp-total">{drill.rows.length.toLocaleString()}</span>
              <button className="gp-x" onClick={() => setDrill(null)}><X size={16} /></button>
            </div>
            <div className="grp-pop-body" style={{ padding: 0 }}>
              <table className="data-grid">
                <thead><tr>{drill.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {drill.rows.length === 0 ? <tr className="empty-row"><td colSpan={drill.headers.length}>{th ? "ไม่มีข้อมูล" : "No data"}</td></tr>
                    : drill.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j === 0 ? "docno" : undefined}>{c}</td>)}</tr>)}
                </tbody>
              </table>
            </div>
            <div className="grp-pop-foot">
              <button className="btn" onClick={() => setDrill(null)}>{th ? "ปิด" : "Close"}</button>
              <button className="btn primary" onClick={drillExport}><Download size={14} />{th ? "ส่งออก CSV" : "Export CSV"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
