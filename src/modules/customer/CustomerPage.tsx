import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch, type Page } from "../../shared/api";
import { getSession, clearSession } from "../../shared/session";
import { Grid, ChevronDown, Refresh, Plus, Building, ArrowLeft, HomeIcon, Search, ChevronLeft, ChevronRight } from "../../shared/icons";
import CrmHelpButton from "./CrmHelpButton";
import LangSwitcher from "../../shared/LangSwitcher";
import NotifBell from "../../shared/NotifBell";
import CustomerSide from "./CustomerSide";
import { getStatusOverride, getEnabledStatuses } from "./customerStatusConfig";
import { statusTone } from "./customerStatus";
import { getColumns } from "./customerColumnConfig";
import { getSearchFields } from "./customerSearchConfig";
import { isSelectField } from "./customerFields";
import { getFieldOptions } from "./customerFieldOptions";
import { isCrmAdmin } from "./crmAccess";
import "./customer.css";

type Customer = {
  id: string; code: string; name: string; status: string;
  groupName?: string; attributes?: Record<string, string>;
};

/** หน้าข้อมูลลูกค้า (Customer data) — ตารางลูกค้าอย่างเดียว ไม่มีแท็บ · รับ filter จาก URL (?field=value) */
export default function CustomerPage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();
  const tenant = session?.companyId ?? "";
  const [sp] = useSearchParams();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");                                   // ค้นหาแบบง่าย (1 ช่อง) — ค่าในกล่อง
  const [mode, setMode] = useState<"simple" | "adv">("simple");
  const [filters, setFilters] = useState<Record<string, string>>({}); // ค้นหาเต็มพิกัด (รายฟิลด์)
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusTab, setStatusTab] = useState<"active" | "others">("active");   // แท็บตามสถานะ: ใช้งาน / ที่เหลือ
  const othersCsv = getEnabledStatuses().filter((c) => c !== "ACTIVE").join(","); // ชุดสถานะ "ที่เหลือ"
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const searchFields = getSearchFields();                           // ฟิลด์ที่ค้นเต็มพิกัดได้ (ตั้งค่าไว้)
  const applied = useRef<{ q: string; filters: Record<string, string> }>({ q: "", filters: {} }); // คำค้นที่ "กดค้นหา" แล้ว

  const statusLabel = (code: string) => getStatusOverride(code) || t(`custStatus.${code}`, { defaultValue: code });

  // มุมมองตาราง (คอลัมน์ที่จะโชว์ ตามที่ตั้งค่าไว้)
  const columns = getColumns();
  const colLabel = (key: string) =>
    key === "code" ? t("customer.col.code") : key === "status" ? t("customer.col.status") : t(`custFields.${key}`, { defaultValue: key });
  const cell = (c: Customer, key: string) => {
    if (key === "status") return <span className={`chip ${statusTone(c.status || "ACTIVE")}`}>{statusLabel(c.status || "ACTIVE")}</span>;
    if (key === "code") return c.code;
    if (key === "name") return c.name;
    if (key === "groupName") return c.groupName || "—";
    if (key === "phone") return c.attributes?.phone || c.attributes?.mobile || "—";
    return c.attributes?.[key] || "—";
  };

  // ===== ค้นหา "จริงที่ DB" + แบ่งหน้าฝั่ง server (กดค้นหาก่อน ไม่ค้นทุกตัวอักษร) =====
  const hasApplied = !!applied.current.q.trim() || Object.values(applied.current.filters).some((v) => v && v.trim());

  function fetchPage(p: number, tab: "active" | "others" = statusTab) {
    if (!tenant) return;
    setLoading(true); setError("");
    const usp = new URLSearchParams();
    usp.set("page", String(p - 1));
    usp.set("size", String(PAGE_SIZE));
    usp.set("statusIn", tab === "others" ? othersCsv : "ACTIVE");   // กรองสถานะตามแท็บ (จริงที่ DB)
    const a = applied.current;
    if (a.q.trim()) usp.set("q", a.q.trim());
    Object.entries(a.filters).forEach(([k, v]) => { if (v && v.trim()) usp.set(k, v.trim()); });
    apiFetch<Page<Customer>>(`/customers?${usp.toString()}`, { tenant })
      .then((res) => { setCustomers(res.content); setTotal(res.totalElements); setPage(p); })
      .catch((e) => setError(t("customer.errLoad") + ": " + e.message))
      .finally(() => setLoading(false));
  }

  // สลับแท็บสถานะ — คงคำค้นเดิม แต่ค้นใหม่ในขอบเขตสถานะของแท็บ (จริงที่ DB)
  const switchTab = (tab: "active" | "others") => { if (tab === statusTab) return; setStatusTab(tab); fetchPage(1, tab); };

  const runSearch = () => {
    applied.current = mode === "simple" ? { q, filters: {} } : { q: "", filters };
    fetchPage(1);
  };
  const clearSearch = () => {
    setQ(""); setFilters({});
    applied.current = { q: "", filters: {} };
    nav("/customer");
    fetchPage(1);
  };

  // โหลดครั้งแรก/เมื่อ URL filter เปลี่ยน (กดมาจากหน้ากลุ่มลูกค้า → ?groupName=...)
  useEffect(() => {
    if (!tenant) return;
    const qp: Record<string, string> = {};
    sp.forEach((v, k) => { if (k !== "page" && k !== "size" && k !== "sort" && v) qp[k] = v; });
    if (Object.keys(qp).length) { setMode("adv"); setFilters(qp); applied.current = { q: "", filters: qp }; }
    else { applied.current = { q: "", filters: {} }; }
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, sp]);

  function loadCustomers() { fetchPage(page); } // รีเฟรชหน้าปัจจุบัน
  const setFilter = (k: string, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const logout = () => { clearSession(); nav("/login"); };

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
          <Grid size={16} /><span style={{ fontSize: 14 }}>{t("customer.title")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <NotifBell />
        <CrmHelpButton />
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <CustomerSide active="core" />

        <div className="crm-content">
          <div className="subbar">
            <div className="company-pick"><Building size={15} />{t("customer.loggedInAs")} <b style={{ color: "var(--txt)" }}>{session.companyCode} · {session.companyName}</b></div>
            <div className="u-spacer" />
            <div className="tb" title={t("common.refresh")} onClick={loadCustomers}><Refresh /></div>
            <div className="vsep" />
            <div className="fields" onClick={() => nav("/app")} title={t("common.backHome")}><HomeIcon size={16} />{t("customer.home")}</div>
            <div className="vsep" />
            <div className="fields" onClick={logout}><ArrowLeft size={16} />{t("common.logout")}</div>
          </div>

          <div className="crm-body">
            {error && <div className="banner err"><Building size={15} />{error}</div>}

            {/* แท็บตามสถานะ: ใช้งาน / ที่เหลือรวมกัน — กรองจริงที่ DB (statusIn) */}
            <div className="tabs" style={{ marginBottom: 14 }}>
              <div className={`tab${statusTab === "active" ? " active" : ""}`} onClick={() => switchTab("active")}>
                {statusLabel("ACTIVE")}
              </div>
              <div className={`tab${statusTab === "others" ? " active" : ""}`} onClick={() => switchTab("others")}>
                {t("customer.statusTab.others", { defaultValue: "สถานะอื่น ๆ" })}
              </div>
            </div>

            <div className="card">
              <div className="ch">
                <span>{t("customer.count", { n: total })} <span className="muted">{t("customer.clickToView")}</span></span>
                {isCrmAdmin() && <button className="btn primary" style={{ padding: "6px 12px" }} onClick={() => nav("/customer/new")}><Plus size={15} />{t("customer.add")}</button>}
              </div>

              {/* แถบค้นหา: สลับ ง่าย / เต็มพิกัด — ค้นจริงที่ DB ต้องกด "ค้นหา" */}
              <div className="cust-search">
                <div className="cust-seg">
                  <button className={mode === "simple" ? "on" : ""} onClick={() => setMode("simple")}>{t("customer.search.simple")}</button>
                  <button className={mode === "adv" ? "on" : ""} onClick={() => setMode("adv")}>{t("customer.search.advanced")}</button>
                </div>
                {mode === "simple" && (
                  <div className="req-search" style={{ flex: 1, maxWidth: 440 }}>
                    <Search size={15} />
                    <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }} placeholder={t("customer.search.simplePh")} />
                  </div>
                )}
                <button className="btn primary" style={{ padding: "6px 14px" }} disabled={loading} onClick={runSearch}><Search size={15} />{t("customer.search.go")}</button>
                {hasApplied && <button className="btn" style={{ padding: "6px 12px" }} onClick={clearSearch}>{t("customer.search.clear")}</button>}
              </div>

              {/* ค้นหาเต็มพิกัด: ช่องแยกรายฟิลด์ (select ถ้าฟิลด์มีตัวเลือก) */}
              {mode === "adv" && (
                <div className="adv-search">
                  {searchFields.map((k) => (
                    <div className="adv-fld" key={k}>
                      <label>{colLabel(k)}</label>
                      {isSelectField(k) ? (
                        <select value={filters[k] ?? ""} onChange={(e) => setFilter(k, e.target.value)}>
                          <option value="">{t("customer.search.anyOpt")}</option>
                          {getFieldOptions(k).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input value={filters[k] ?? ""} onChange={(e) => setFilter(k, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }} placeholder={t("customer.search.any")} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <table className="data-grid">
                <thead><tr>
                  {columns.map((key) => <th key={key}>{colLabel(key)}</th>)}
                </tr></thead>
                <tbody>
                  {customers.length === 0 ? (
                    <tr className="empty-row"><td colSpan={columns.length}>{loading ? t("common.loading", { defaultValue: "กำลังโหลด…" }) : hasApplied ? t("customer.noMatch") : t("customer.empty")}</td></tr>
                  ) : customers.map((c) => (
                    <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => nav(`/customer/${c.id}`)}>
                      {columns.map((key) => <td key={key} className={key === "code" ? "docno" : undefined}>{cell(c, key)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>

              {total > PAGE_SIZE && (
                <div className="pager">
                  <button disabled={page <= 1 || loading} onClick={() => fetchPage(page - 1)}><ChevronLeft size={16} /></button>
                  <span className="muted">{t("customer.page", { page, total: totalPages })}</span>
                  <button disabled={page >= totalPages || loading} onClick={() => fetchPage(page + 1)}><ChevronRight size={16} /></button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
