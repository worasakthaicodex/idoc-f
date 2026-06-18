import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { apiFetch } from "../../shared/api";
import { Grid, ChevronDown, Help, Building, ArrowLeft, BarChart, Refresh, Download, X } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import NotifBell from "../../shared/NotifBell";
import SalesSide from "./SalesSide";
import { loadClDocs, syncSalesDocs } from "./clRequests";
import { getCycleStart, setCycleStart, exportCSV, type Granularity } from "../customer/reportStore";
import { MultiChart, baht } from "./salesCharts";
import { HIST_BY_ID, type Act, type ReportCtx, type RawOut } from "./salesReportDefs";
import "../customer/customer.css";
import "./sales.css";

/** หน้ารายงานย้อนหลัง 1 ใบ — กราฟแท่ง/เส้น + เลือก รายวัน/สัปดาห์/เดือน/ปี + รอบตัด (โหลดเฉพาะรายงานนี้) */
export default function SalesReportDetail() {
  const nav = useNavigate();
  const { id = "" } = useParams();
  const { i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const session = getSession();
  const tenant = session?.companyId ?? "";
  const def = HIST_BY_ID[id];

  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 11); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [gran, setGran] = useState<Granularity>("month");
  const [cycle, setCycle] = useState(getCycleStart());
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [view, setView] = useState<"chart" | "table">("chart");
  const [tick, setTick] = useState(0);
  const [acts, setActs] = useState<Record<string, Act[]>>({});
  const [drill, setDrill] = useState<RawOut | null>(null);

  const reload = () => { Promise.all(["CL", "FO", "QT", "SO"].map((d) => syncSalesDocs(d).catch(() => {}))).then(() => setTick((n) => n + 1)); };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  // ดึง activity เฉพาะที่รายงานนี้ต้องใช้ (ตามช่วงเวลา) — โหลดเฉพาะที่จำเป็น
  useEffect(() => {
    if (!def?.activityKinds || !tenant) { setActs({}); return; }
    const fromMs = Date.parse(`${from}T00:00:00`), toMs = Date.parse(`${to}T23:59:59`);
    if (isNaN(fromMs) || isNaN(toMs)) return;
    let alive = true;
    Promise.all(def.activityKinds.map((k) => apiFetch<Act[]>(`/activities/report?kind=${k}&from=${fromMs}&to=${toMs}`, { tenant }).then((r) => [k, r || []] as const).catch(() => [k, [] as Act[]] as const)))
      .then((pairs) => { if (alive) setActs(Object.fromEntries(pairs)); });
    return () => { alive = false; };
  }, [id, from, to, tenant, def]);

  const onCycle = (v: number) => { const d = Math.min(28, Math.max(1, v || 1)); setCycle(d); setCycleStart(d); };

  const ctx = (): ReportCtx => ({ gran, cycle, fromMs: Date.parse(`${from}T00:00:00`) || -Infinity, toMs: Date.parse(`${to}T23:59:59`) || Infinity, cl: loadClDocs("CL"), fo: loadClDocs("FO"), qt: loadClDocs("QT"), so: loadClDocs("SO"), acts });
  const out = useMemo(() => {
    void tick;
    if (!def) return { periods: [], series: [] };
    return def.build(ctx());
  }, [def, tick, from, to, gran, cycle, acts]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtV = (n: number) => (def?.fmt === "baht" ? baht(n) : n.toLocaleString());
  const seriesTotals = out.series.map((s) => s.values.reduce((a, b) => a + b, 0));

  if (!session) return <div className="p-crm"><div className="crm-body"><div className="banner err"><Building size={15} />{th ? "กรุณาเข้าสู่ระบบ" : "Please log in"}</div><button className="btn primary" onClick={() => nav("/login")}><ArrowLeft size={15} />{th ? "ไปหน้าเข้าสู่ระบบ" : "Login"}</button></div></div>;
  if (!def) return <div className="p-crm"><div className="crm-body"><div className="banner err">{th ? "ไม่พบรายงาน" : "Report not found"}: {id}</div><button className="btn" onClick={() => nav("/sales/reports")}><ArrowLeft size={15} />{th ? "กลับสารบัญรายงาน" : "Back to index"}</button></div></div>;

  const csv = () => exportCSV(def.id, [th ? "ช่วง" : "Period", ...out.series.map((s) => s.name), th ? "รวม" : "Total"],
    out.periods.map((p, i) => [p, ...out.series.map((s) => s.values[i]), out.series.reduce((a, s) => a + s.values[i], 0)]));

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title="กลับหน้าหลัก" onClick={() => nav("/app")}>iDoc ERP</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{th ? "งานขาย" : "Sales"}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <NotifBell />
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <SalesSide active="reports" />
        <div className="crm-content">
          <div className="subbar">
            <div className="tb" title={th ? "กลับสารบัญ" : "Back"} style={{ cursor: "pointer" }} onClick={() => nav("/sales/reports")}><ArrowLeft /></div>
            <div className="company-pick"><BarChart size={15} />{th ? def.title.th : def.title.en}</div>
            <div className="u-spacer" />
            <div className="tb" title={th ? "รีเฟรช" : "Refresh"} style={{ cursor: "pointer" }} onClick={reload}><Refresh /></div>
          </div>

          <div className="crm-body">
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{th ? def.desc.th : def.desc.en}</div>

            <div className="rd-filter" style={{ marginBottom: 12 }}>
              <span className="rd-filter-lb">{th ? "ช่วง" : "Range"}</span>
              <input type="date" className="rd-filter-sel" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="muted">–</span>
              <input type="date" className="rd-filter-sel" value={to} onChange={(e) => setTo(e.target.value)} />
              {def.timeBased && <>
                <span className="rd-filter-lb" style={{ marginLeft: 8 }}>{th ? "จัดตาม" : "By"}</span>
                <select className="rd-filter-sel" value={gran} onChange={(e) => setGran(e.target.value as Granularity)}>
                  <option value="day">{th ? "วัน" : "Day"}</option><option value="week">{th ? "สัปดาห์" : "Week"}</option>
                  <option value="month">{th ? "เดือน (รอบ)" : "Month"}</option><option value="year">{th ? "ปี" : "Year"}</option>
                </select>
                {(gran === "month" || gran === "year") && <>
                  <span className="rd-filter-lb" style={{ marginLeft: 8 }} title={th ? "วันเริ่มรอบเดือน เช่น 25 = รอบ 25–24" : "Cycle start day"}>{th ? "เริ่มรอบวันที่" : "Cycle start"}</span>
                  <input type="number" min={1} max={28} className="rd-filter-sel" style={{ width: 64 }} value={cycle} onChange={(e) => onCycle(Number(e.target.value))} />
                </>}
              </>}
              <span className="rd-filter-lb" style={{ marginLeft: 8 }}>{th ? "มุมมอง" : "View"}</span>
              <div className="cust-seg">
                <button className={view === "chart" ? "on" : ""} onClick={() => setView("chart")}>{th ? "กราฟ" : "Chart"}</button>
                <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}>{th ? "ตาราง" : "Table"}</button>
              </div>
              {view === "chart" && <div className="cust-seg">
                <button className={chartType === "bar" ? "on" : ""} onClick={() => setChartType("bar")}>{th ? "แท่ง" : "Bar"}</button>
                <button className={chartType === "line" ? "on" : ""} onClick={() => setChartType("line")}>{th ? "เส้น" : "Line"}</button>
              </div>}
            </div>

            <div className="card">
              <div className="sh">{th ? def.title.th : def.title.en}
                <button className="btn rp-csv" onClick={() => setDrill(def.raw(ctx()))}>{th ? "ข้อมูลดิบ" : "Raw"}</button>
                <button className="btn rp-csv" onClick={csv}><Download size={13} />CSV</button>
              </div>
              <div className="rp-body">
                {view === "chart" ? (
                  <MultiChart type={chartType} periods={out.periods} series={out.series} empty={th ? "ไม่มีข้อมูลในช่วงนี้" : "No data in range"} />
                ) : (
                  <div style={{ overflowX: "auto", width: "100%" }}><table className="data-grid">
                    <thead><tr><th>{th ? "ช่วง" : "Period"}</th>{out.series.map((s) => <th key={s.name}>{s.name}</th>)}<th>{th ? "รวม" : "Total"}</th></tr></thead>
                    <tbody>
                      {out.periods.length === 0 ? <tr className="empty-row"><td colSpan={out.series.length + 2}>{th ? "ไม่มีข้อมูลในช่วงนี้" : "No data in range"}</td></tr>
                        : out.periods.map((p, i) => <tr key={p}><td className="docno">{p}</td>{out.series.map((s) => <td key={s.name}>{s.values[i] ? fmtV(s.values[i]) : "—"}</td>)}<td><b>{fmtV(out.series.reduce((a, s) => a + s.values[i], 0))}</b></td></tr>)}
                    </tbody>
                    {out.periods.length > 0 && <tfoot><tr><td><b>{th ? "รวม" : "Total"}</b></td>{seriesTotals.map((t1, i) => <td key={i}><b>{fmtV(t1)}</b></td>)}<td><b>{fmtV(seriesTotals.reduce((a, b) => a + b, 0))}</b></td></tr></tfoot>}
                  </table></div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {drill && (
        <div className="grp-pop-overlay" onClick={() => setDrill(null)}>
          <div className="grp-pop" onClick={(e) => e.stopPropagation()}>
            <div className="grp-pop-head">
              <div className="gp-title"><b>{th ? "ข้อมูลดิบ" : "Raw data"} · {th ? def.title.th : def.title.en}</b></div>
              <span className="gp-total">{drill.rows.length.toLocaleString()}</span>
              <button className="gp-x" onClick={() => setDrill(null)}><X size={16} /></button>
            </div>
            <div className="grp-pop-body" style={{ padding: 0 }}>
              <table className="data-grid">
                <thead><tr>{drill.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {drill.rows.length === 0 ? <tr className="empty-row"><td colSpan={drill.headers.length}>{th ? "ไม่มีข้อมูล" : "No data"}</td></tr>
                    : drill.rows.map((r, i) => <tr key={i}>{r.map((cval, j) => <td key={j} className={j === 0 ? "docno" : undefined}>{cval}</td>)}</tr>)}
                </tbody>
              </table>
            </div>
            <div className="grp-pop-foot">
              <button className="btn" onClick={() => setDrill(null)}>{th ? "ปิด" : "Close"}</button>
              <button className="btn primary" onClick={() => exportCSV(`${def.id}_raw`, drill.headers, drill.rows)}><Download size={14} />{th ? "ส่งออก CSV" : "Export CSV"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
