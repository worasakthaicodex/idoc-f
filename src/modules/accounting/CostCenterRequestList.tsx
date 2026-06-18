import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Search, Building, ArrowLeft } from "../../shared/icons";
import { getSession } from "../../shared/session";
import AccTopbar from "./AccTopbar";
import CostCenterSide from "./CostCenterSide";
import { loadCCRequests, REQ_PHASES, ccPhaseLabel, ccTopicLabel, type ReqPhase } from "./costCenterStore";
import "../customer/customer.css";

const TONE: Record<ReqPhase, string> = { RECEIVE: "blue", PROCESS: "amber", EXPORT: "gray", DONE: "green" };
const fmt = (ts: number) => { const d = new Date(ts), p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

export default function CostCenterRequestList() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const thai = i18n.language.startsWith("th");
  const T = (a: string, b: string) => (thai ? a : b);
  const session = getSession();
  const [all] = useState(() => loadCCRequests());
  const [tab, setTab] = useState<ReqPhase>("RECEIVE");
  const [q, setQ] = useState("");

  const me = session?.fullName || session?.email || session?.companyCode || "";
  // เห็นใน "รอรับ" ไหม — ส่งทั้งกลุ่มทุกคนเห็น · ส่งเจาะจงเฉพาะคนนั้น (เหมือนคำขอสินค้า/ลูกค้า)
  const canSee = (r: (typeof all)[number]): boolean => {
    const rc = r.sent?.recipients;
    return !rc || rc.length === 0 || rc.includes(me);
  };
  const inTab = (r: (typeof all)[number], p: ReqPhase): boolean => {
    switch (p) {
      case "RECEIVE": return r.phase === "RECEIVE" && !r.received && !r.bounce && canSee(r);
      case "PROCESS": return r.phase === "PROCESS";
      case "EXPORT": return !!r.sent && r.sent.by === me && r.phase !== "DONE";
      case "DONE": return r.phase === "DONE";
      default: return false;
    }
  };
  const counts = useMemo(() => {
    const m: Record<ReqPhase, number> = { RECEIVE: 0, PROCESS: 0, EXPORT: 0, DONE: 0 };
    REQ_PHASES.forEach((p) => { m[p] = all.filter((r) => inTab(r, p)).length; });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter((r) => inTab(r, tab) && (!s || r.code.toLowerCase().includes(s) || r.ccName.toLowerCase().includes(s) || r.ccCode.toLowerCase().includes(s)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, tab, q]);

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err"><Building size={15} />{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}><ArrowLeft size={15} />{t("custForm.goLogin")}</button></div></div>;
  }

  return (
    <div className="p-crm">
      <AccTopbar />
      <div className="crm-main">
        <CostCenterSide active="requests" />
        <div className="crm-content">
          <div className="subbar">
            <div className="company-pick"><Building size={15} />{T("คำขอดำเนินการ Cost Center", "Cost Center action requests")}</div>
            <div className="u-spacer" />
            <div className="fields" onClick={() => nav("/accounting/cost-center/requests/new?topic=ADD")}><Plus size={16} />{T("สร้างคำขอ", "New request")}</div>
          </div>

          <div className="tabs">
            {REQ_PHASES.map((p) => (
              <div key={p} className={`tab${tab === p ? " active" : ""}`} onClick={() => setTab(p)}>
                {ccPhaseLabel(p, thai)}{counts[p] > 0 && <span className="soon">{counts[p]}</span>}
              </div>
            ))}
          </div>

          <div className="crm-body">
            <div className="card">
              <div className="ch">
                <div className="req-search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("ค้นหา เลขที่ / Cost Center", "Search code / Cost Center")} /></div>
                <span className="muted">{filtered.length} {T("รายการ", "items")}</span>
              </div>
              <table className="data-grid">
                <thead><tr>
                  <th>{T("เลขที่", "Code")}</th><th>{T("ประเภท", "Topic")}</th><th>Cost Center</th>
                  <th>{T("ผู้ขอ", "Requester")}</th><th>{T("วันที่", "Date")}</th><th>{T("สถานะ", "Status")}</th>
                </tr></thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr className="empty-row"><td colSpan={6}>{T("ไม่มีคำขอในสถานะนี้", "No requests in this state")}</td></tr>
                  ) : filtered.map((r) => (
                    <tr key={r.code} style={{ cursor: "pointer" }} onClick={() => nav(`/accounting/cost-center/requests/${encodeURIComponent(r.code)}`)}>
                      <td className="docno">{r.code}</td>
                      <td>{ccTopicLabel(r.topic, thai)}</td>
                      <td>{r.ccCode}{r.ccName ? ` · ${r.ccName}` : ""}</td>
                      <td>{r.requester}</td>
                      <td>{fmt(r.savedAt)}</td>
                      <td>{tab === "EXPORT"
                        ? <span className={`chip ${r.received ? "green" : r.bounce ? "red" : "blue"}`}>{r.received ? T("รับแล้ว", "Received") : r.bounce ? T("ตีกลับ", "Bounced") : T("ยังไม่รับ", "Not received")}</span>
                        : <span className={`chip ${TONE[r.phase]}`}>{ccPhaseLabel(r.phase, thai)}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
