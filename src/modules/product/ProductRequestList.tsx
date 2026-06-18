import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, ChevronLeft, ChevronRight, Help, Plus, Building, ArrowLeft, Search } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import ProductSide from "./ProductSide";
import { loadRequests, loadReqTab, saveReqTab, REQ_PHASES, type ReqPhase, type ProductRequest } from "./productRequests";
import "../customer/customer.css";

const TONE: Record<ReqPhase, string> = { RECEIVE: "blue", PROCESS: "amber", EXPORT: "gray", DONE: "green" };
const PAGE_SIZE = 20;

const fmtDate = (ts: number) => {
  const d = new Date(ts), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function ProductRequestList() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();

  const [all] = useState<ProductRequest[]>(() => loadRequests());
  const [tab, setTabState] = useState<ReqPhase>(() => loadReqTab());
  const setTab = (p: ReqPhase) => { setTabState(p); saveReqTab(p); };
  const [q, setQ] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);

  const topicLabel = (code: string) =>
    code === "ADD" ? t("prodReq.topicAdd") : code === "EDIT" ? t("prodReq.topicEdit") : code === "STATUS" ? t("prodReq.topicStatus") : code;

  const me = session?.fullName || session?.email || session?.companyCode || "";
  // เห็นใน "รอรับ" ไหม — ส่งทั้งกลุ่มทุกคนเห็น · ส่งเจาะจงเฉพาะคนนั้น · ไม่ระบุ = ทุกคน
  const canSee = (r: ProductRequest): boolean => {
    const rc = r.sent?.recipients;
    return !rc || rc.length === 0 || rc.includes(me);
  };
  const inTab = (r: ProductRequest, p: ReqPhase): boolean => {
    switch (p) {
      case "RECEIVE": return r.phase === "RECEIVE" && !r.received && !r.bounce && canSee(r);
      case "PROCESS": return r.phase === "PROCESS";
      case "EXPORT": return !!r.sent && r.sent.by === me && r.phase !== "DONE";
      case "DONE": return r.phase === "DONE";
      default: return false;
    }
  };

  const countOf = useMemo(() => {
    const m: Record<ReqPhase, number> = { RECEIVE: 0, PROCESS: 0, EXPORT: 0, DONE: 0 };
    REQ_PHASES.forEach((p) => { m[p] = all.filter((r) => inTab(r, p)).length; });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = all.filter((r) => inTab(r, tab) && (!s ||
      r.code.toLowerCase().includes(s) || r.customer.toLowerCase().includes(s) ||
      r.requester.toLowerCase().includes(s) || topicLabel(r.topic).toLowerCase().includes(s)));
    return rows.sort((a, b) => (sortDesc ? b.savedAt - a.savedAt : a.savedAt - b.savedAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, tab, q, sortDesc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [tab, q, sortDesc]);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!session) {
    return (
      <div className="p-crm">
        <div className="topbar"><div className="app">{t("common.appName")}</div><div className="u-spacer" /><div className="me">A</div></div>
        <div className="crm-body">
          <div className="banner err"><Building size={15} />{t("customer.notLoggedIn")}</div>
          <button className="btn primary" onClick={() => nav("/login")}><ArrowLeft size={15} />{t("customer.goLogin")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{t("product.title")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <ProductSide active="requests" />

        <div className="crm-content">
          <div className="subbar">
            <div className="company-pick"><Building size={15} />{t("prodReq.title")}</div>
            <div className="u-spacer" />
            <div className="fields" onClick={() => nav("/product/requests/new")}><Plus size={16} />{t("custReq.list.new")}</div>
          </div>

          <div className="tabs">
            {REQ_PHASES.map((p) => (
              <div key={p} className={`tab${tab === p ? " active" : ""}`} onClick={() => setTab(p)}>
                {t(`custReq.list.tab.${p}`)}
                {countOf[p] > 0 && <span className="soon">{countOf[p]}</span>}
              </div>
            ))}
          </div>

          <div className="crm-body">
            <div className="card">
              <div className="ch">
                <div className="req-search">
                  <Search size={15} />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("custReq.list.searchPh")} />
                </div>
                <span className="muted">{t("custReq.list.count", { n: filtered.length })}</span>
              </div>
              <table className="data-grid">
                <thead><tr>
                  <th>{t("custReq.list.col.code")}</th>
                  <th>{t("custReq.list.col.topic")}</th>
                  <th>{t("prodReq.item")}</th>
                  <th>{t("custReq.list.col.requester")}</th>
                  <th className="sortable" onClick={() => setSortDesc((s) => !s)} title={t("custReq.list.sortDate")}>
                    {t("custReq.list.col.date")} <span className="sort-ar">{sortDesc ? "▼" : "▲"}</span>
                  </th>
                  <th>{t("custReq.list.col.status")}</th>
                </tr></thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr className="empty-row"><td colSpan={6}>{q ? t("custReq.list.noMatch") : t("custReq.list.empty")}</td></tr>
                  ) : pageRows.map((r) => (
                    <tr key={r.code} style={{ cursor: "pointer" }} onClick={() => nav(`/product/requests/${encodeURIComponent(r.code)}`)}>
                      <td className="docno">{r.code}</td>
                      <td>{topicLabel(r.topic)}</td>
                      <td>{r.customer}</td>
                      <td>{r.requester}</td>
                      <td>{fmtDate(r.savedAt)}</td>
                      <td>{tab === "EXPORT"
                        ? <span className={`chip ${r.received ? "green" : r.bounce ? "red" : "blue"}`}>{r.received ? t("custReq.list.recv.yes") : r.bounce ? t("custReq.list.recv.bounced") : t("custReq.list.recv.no")}</span>
                        : <span className={`chip ${TONE[r.phase]}`}>{t(`custReq.list.tab.${r.phase}`)}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filtered.length > PAGE_SIZE && (
                <div className="pager">
                  <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft size={16} /></button>
                  <span className="muted">{t("custReq.list.page", { page, total: totalPages })}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight size={16} /></button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
