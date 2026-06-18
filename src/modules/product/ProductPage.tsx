import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch, type Page } from "../../shared/api";
import { getSession, clearSession } from "../../shared/session";
import { Grid, ChevronDown, Help, Refresh, Plus, Building, ArrowLeft, HomeIcon, Search, ChevronLeft, ChevronRight } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import ProductSide from "./ProductSide";
import { prodLabel, isSelectField } from "./productFields";
import { getColumns, getSearchFields, getFieldOptions, statusTone, statusText, getEnabledStatuses } from "./productConfig";
import { MODULE, isModuleAdmin } from "../../shared/access";
import { importLegacyProducts } from "./legacyImport";
import "../customer/customer.css";

type Product = { id: string; code: string; name: string; status: string; groupName?: string; attributes?: Record<string, string> };

export default function ProductPage() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const session = getSession();
  const tenant = session?.companyId ?? "";

  const [items, setItems] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"simple" | "adv">("simple");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const columns = getColumns();
  const searchFields = getSearchFields();
  const applied = useRef<{ q: string; filters: Record<string, string> }>({ q: "", filters: {} });
  // แท็บแยกตามสถานะ — อันแรก "ใช้งาน" (ACTIVE) · อื่นๆ ตามที่เปิดใช้ + ทั้งหมด
  const [statusTab, setStatusTab] = useState("ACTIVE");
  const statusRef = useRef("ACTIVE");
  const statusTabs = [...getEnabledStatuses(), "ALL"];

  const colLabel = (key: string) => prodLabel(key, lang);
  const cell = (c: Product, key: string) => {
    if (key === "status") return <span className={`chip ${statusTone(c.status || "ACTIVE")}`}>{statusText(c.status || "ACTIVE", lang)}</span>;
    if (key === "code") return c.code;
    if (key === "name") return c.name;
    if (key === "groupName") return c.groupName || "—";
    return c.attributes?.[key] || "—";
  };

  const hasApplied = !!applied.current.q.trim() || Object.values(applied.current.filters).some((v) => v && v.trim());

  // นำเข้าสินค้า/บริการจากระบบเก่า — โผล่บนหน้าว่าง กดได้เลย (ใช้ session ปัจจุบัน → tenant ถูก · กันซ้ำด้วย legacyId)
  const th = i18n.language.startsWith("th");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const runImport = async () => {
    if (importing) return;
    if (!window.confirm(th ? "นำเข้าสินค้า/บริการจากระบบเก่า (344 รายการ)? รายการที่นำเข้าแล้วจะถูกข้าม" : "Import 344 legacy products/services? Already-imported ones are skipped")) return;
    setImporting(true); setImportMsg(th ? "กำลังโหลด…" : "Loading…");
    try {
      const r = await importLegacyProducts(tenant, session?.fullName || session?.companyCode || "import",
        (done, x) => setImportMsg(`${th ? "กำลังนำเข้า" : "Importing"} ${done}/${x.total} · ${th ? "สำเร็จ" : "ok"} ${x.ok}${x.skip ? ` · ${th ? "ข้าม" : "skip"} ${x.skip}` : ""}`));
      setImportMsg(`${th ? "เสร็จสิ้น" : "Done"} · ${th ? "นำเข้า" : "imported"} ${r.ok} · ${th ? "ข้าม" : "skipped"} ${r.skip}${r.fail ? ` · ${th ? "ผิดพลาด" : "failed"} ${r.fail}` : ""}`);
      statusRef.current = "ACTIVE"; setStatusTab("ACTIVE"); fetchPage(1);
    } catch { setImportMsg(th ? "นำเข้าไม่สำเร็จ" : "Import failed"); }
    setImporting(false);
  };

  function fetchPage(p: number) {
    if (!tenant) return;
    setLoading(true); setError("");
    const usp = new URLSearchParams();
    usp.set("page", String(p - 1));
    usp.set("size", String(PAGE_SIZE));
    const a = applied.current;
    if (a.q.trim()) usp.set("q", a.q.trim());
    Object.entries(a.filters).forEach(([k, v]) => { if (v && v.trim()) usp.set(k, v.trim()); });
    if (statusRef.current && statusRef.current !== "ALL") usp.set("status", statusRef.current);
    apiFetch<Page<Product>>(`/products?${usp.toString()}`, { tenant })
      .then((res) => { setItems(res.content); setTotal(res.totalElements); setPage(p); })
      .catch((e) => setError(t("custForm.errLoad") + ": " + e.message))
      .finally(() => setLoading(false));
  }
  const runSearch = () => { applied.current = mode === "simple" ? { q, filters: {} } : { q: "", filters }; fetchPage(1); };
  const clearSearch = () => { setQ(""); setFilters({}); applied.current = { q: "", filters: {} }; fetchPage(1); };
  const setFilter = (k: string, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (tenant) { applied.current = { q: "", filters: {} }; fetchPage(1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);
  const refresh = () => fetchPage(page);
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
          <Grid size={16} /><span style={{ fontSize: 14 }}>{t("product.title")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <ProductSide active="core" />

        <div className="crm-content">
          <div className="subbar">
            <div className="company-pick"><Building size={15} />{t("customer.loggedInAs")} <b style={{ color: "var(--txt)" }}>{session.companyCode} · {session.companyName}</b></div>
            <div className="u-spacer" />
            <div className="tb" title={t("common.refresh")} onClick={refresh}><Refresh /></div>
            <div className="vsep" />
            <div className="fields" onClick={() => nav("/app")} title={t("common.backHome")}><HomeIcon size={16} />{t("customer.home")}</div>
            <div className="vsep" />
            <div className="fields" onClick={logout}><ArrowLeft size={16} />{t("common.logout")}</div>
          </div>

          <div className="tabs">
            {statusTabs.map((s) => (
              <div key={s} className={`tab${statusTab === s ? " active" : ""}`}
                onClick={() => { statusRef.current = s; setStatusTab(s); fetchPage(1); }}>
                {s === "ALL" ? (lang.startsWith("th") ? "ทั้งหมด" : "All") : statusText(s, lang)}
              </div>
            ))}
          </div>

          <div className="crm-body">
            {error && <div className="banner err"><Building size={15} />{error}</div>}

            <div className="card">
              <div className="ch">
                <span>{t("product.count", { n: total })} <span className="muted">{t("customer.clickToView")}</span></span>
                {isModuleAdmin(MODULE.PRODUCT) && <button className="btn primary" style={{ padding: "6px 12px" }} onClick={() => nav("/product/new")}><Plus size={15} />{t("product.add")}</button>}
              </div>

              <div className="cust-search">
                <div className="cust-seg">
                  <button className={mode === "simple" ? "on" : ""} onClick={() => setMode("simple")}>{t("customer.search.simple")}</button>
                  <button className={mode === "adv" ? "on" : ""} onClick={() => setMode("adv")}>{t("customer.search.advanced")}</button>
                </div>
                {mode === "simple" && (
                  <div className="req-search" style={{ flex: 1, maxWidth: 440 }}>
                    <Search size={15} />
                    <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }} placeholder={t("product.searchPh")} />
                  </div>
                )}
                <button className="btn primary" style={{ padding: "6px 14px" }} disabled={loading} onClick={runSearch}><Search size={15} />{t("customer.search.go")}</button>
                {hasApplied && <button className="btn" style={{ padding: "6px 12px" }} onClick={clearSearch}>{t("customer.search.clear")}</button>}
              </div>

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
                <thead><tr>{columns.map((key) => <th key={key}>{colLabel(key)}</th>)}</tr></thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr className="empty-row"><td colSpan={columns.length}>
                      {loading ? t("common.loading", { defaultValue: "กำลังโหลด…" }) : hasApplied ? t("product.noMatch") : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", padding: "16px 0" }}>
                          <div>{t("product.empty")}</div>
                          <button className="btn primary" disabled={importing} onClick={runImport} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <Plus size={14} />{importing ? (importMsg || (th ? "กำลังนำเข้า…" : "Importing…")) : (th ? "นำเข้าสินค้า/บริการจากระบบเก่า (344)" : "Import from old system (344)")}
                          </button>
                          {importMsg && !importing && <div style={{ fontSize: 12.5, color: "var(--txt2)" }}>{importMsg}</div>}
                        </div>
                      )}
                    </td></tr>
                  ) : items.map((c) => (
                    <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => nav(`/product/${c.id}`)}>
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
