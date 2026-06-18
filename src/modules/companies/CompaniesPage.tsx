import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Grid, ChevronDown, Help, Refresh, Filter, Columns, Plus, X, Building, Users, Dollar, FileText, Check2,
} from "../../shared/icons";
import { apiFetch, ApiError, type Page } from "../../shared/api";
import { getSession } from "../../shared/session";
import LangSwitcher from "../../shared/LangSwitcher";
import "./companies.css";

type Status = "TRIAL" | "ACTIVE" | "SUSPENDED" | "EXPIRED";
type Plan = "FREE" | "STANDARD" | "PRO" | "ENTERPRISE";

/** ตรงกับ CompanyResponse ฝั่ง backend */
type Company = {
  id: string;
  code: string;
  name: string;
  status: Status;
  plan: Plan;
  contactEmail: string | null;
  expiresAt: string | null;
  createdAt: string;
};

const statusCls: Record<Status, string> = {
  TRIAL: "chip blue", ACTIVE: "chip green", SUSPENDED: "chip red", EXPIRED: "chip amber",
};
const planLabel: Record<Plan, string> = { FREE: "Free", STANDARD: "Standard", PRO: "Pro", ENTERPRISE: "Enterprise" };

/** เมนูซ้ายของผู้ดูแลระบบ — เพิ่มรายการใหม่ได้ที่นี่ (label มาจาก i18n: companies.menu.<key>) */
const menu = [
  { key: "companies", Icon: Building, enabled: true },
  { key: "users", Icon: Users, enabled: false },
  { key: "billing", Icon: Dollar, enabled: false },
  { key: "reports", Icon: FileText, enabled: false },
];

const DEFAULT_PASSWORD = "idoc1234";

export default function CompaniesPage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [active, setActive] = useState("companies");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", email: "", plan: "FREE" as Plan });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Company | null>(null);

  // แปล error จาก backend: code → คำแปล, ไม่มีก็ fallback เป็น message
  const errMsg = (e: unknown) => {
    const a = e as ApiError;
    return a?.code ? t(`errors.${a.code}`, { defaultValue: a.message }) : (a?.message || t("errors.generic"));
  };

  function load() {
    setLoading(true);
    setError("");
    apiFetch<Page<Company>>("/admin/companies?size=200")
      .then((p) => setCompanies(p.content))
      .catch((e) => setError(t("companies.err.load") + ": " + errMsg(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpi = useMemo(() => ({
    total: companies.length,
    active: companies.filter((c) => c.status === "ACTIVE").length,
    trial: companies.filter((c) => c.status === "TRIAL").length,
    suspended: companies.filter((c) => c.status === "SUSPENDED" || c.status === "EXPIRED").length,
  }), [companies]);

  async function save() {
    if (!form.code.trim() || !form.name.trim()) { setError(t("companies.err.requireCodeName")); return; }
    setBusy(true); setError("");
    try {
      const c = await apiFetch<Company>("/admin/companies", {
        method: "POST",
        body: {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          contactEmail: form.email.trim() || null,
          plan: form.plan,
        },
      });
      setForm({ code: "", name: "", email: "", plan: "FREE" });
      setOpen(false);
      setCreated(c);
      load();
    } catch (e) {
      setError(t("companies.err.create") + ": " + errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(id: string, action: "activate" | "suspend") {
    setError("");
    try {
      await apiFetch(`/admin/companies/${id}/${action}`, { method: "POST" });
      load();
    } catch (e) {
      setError(t("companies.err.status") + ": " + errMsg(e));
    }
  }

  return (
    <div className="p-companies">
      {/* top bar */}
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{t("companies.adminMenu")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{(session?.fullName || "A").charAt(0)}</div>
      </div>

      <div className="cmp-main">
        {/* left sidebar */}
        <div className="cmp-side">
          <div className="side-title">{t("companies.adminMenu")}</div>
          {menu.map((m) => (
            <div
              key={m.key}
              className={`side-item${active === m.key ? " active" : ""}${m.enabled ? "" : " disabled"}`}
              onClick={() => m.enabled && setActive(m.key)}
            >
              <m.Icon size={17} />
              <span>{t(`companies.menu.${m.key}`)}</span>
              {!m.enabled && <span className="soon">{t("companies.soon")}</span>}
            </div>
          ))}
        </div>

        {/* content */}
        <div className="cmp-content">
          {/* sub toolbar */}
          <div className="subbar">
            <div className="tb" title={t("common.refresh")} onClick={load}><Refresh /></div>
            <div className="tb" title={t("home.filter")}><Filter /></div>
            <div className="u-spacer" />
            <div className="fields" onClick={() => nav("/admin/modules")}><Grid size={16} />ทะเบียนโมดูล</div>
            <div className="vsep" />
            <button className="btn primary" style={{ marginRight: 8 }} onClick={() => setOpen(true)}>
              <Plus size={16} />{t("companies.addCompany")}
            </button>
            <div className="fields"><Columns size={16} />{t("companies.columns")}</div>
          </div>

          <div className="cmp-body">
            {created && (
              <div className="cmp-banner">
                <Check2 size={16} />
                <div>
                  {t("companies.createdSuccess", { code: created.code, name: created.name })}
                  {created.contactEmail
                    ? " · " + t("companies.createdAccount", { email: created.contactEmail, password: DEFAULT_PASSWORD })
                    : " · " + t("companies.createdNoEmail")}
                </div>
                <span className="x" onClick={() => setCreated(null)}><X size={15} /></span>
              </div>
            )}
            {error && (
              <div className="cmp-banner err">
                {error}
                <span className="x" onClick={() => setError("")}><X size={15} /></span>
              </div>
            )}

            {/* KPIs */}
            <div className="kpis">
              <div className="kpi"><div className="kl">{t("companies.kpi.total")}</div><div className="kv">{kpi.total}</div></div>
              <div className="kpi"><div className="kl"><span className="d" style={{ background: "#24a148" }} />{t("companies.kpi.active")}</div><div className="kv">{kpi.active}</div></div>
              <div className="kpi"><div className="kl"><span className="d" style={{ background: "#4589ff" }} />{t("companies.kpi.trial")}</div><div className="kv">{kpi.trial}</div></div>
              <div className="kpi"><div className="kl"><span className="d" style={{ background: "#da1e28" }} />{t("companies.kpi.suspended")}</div><div className="kv">{kpi.suspended}</div></div>
            </div>

            {/* table */}
            <div className="card">
              <div className="ch">
                <span>{t("companies.listTitle", { count: companies.length })}</span>
                {loading && <span className="muted" style={{ fontWeight: 400 }}>{t("common.loading")}</span>}
              </div>
              <table className="data-grid">
                <thead>
                  <tr>
                    <th>{t("companies.col.code")}</th>
                    <th>{t("companies.col.company")}</th>
                    <th>{t("companies.col.plan")}</th>
                    <th>{t("companies.col.status")}</th>
                    <th>{t("companies.col.expires")}</th>
                    <th>{t("companies.col.manage")}</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.length === 0 ? (
                    <tr className="empty-row"><td colSpan={6}>{loading ? t("common.loading") : t("companies.empty")}</td></tr>
                  ) : companies.map((c) => (
                    <tr key={c.id}>
                      <td className="docno">{c.code}</td>
                      <td>
                        <div className="cmp-name">{c.name}</div>
                        <div className="cmp-email">{c.contactEmail || "—"}</div>
                      </td>
                      <td>{planLabel[c.plan]}</td>
                      <td><span className={statusCls[c.status]}>{t(`companies.status.${c.status}`)}</span></td>
                      <td className="num">{c.expiresAt || "—"}</td>
                      <td>
                        <div className="acts-cell">
                          {c.status === "SUSPENDED" || c.status === "EXPIRED" ? (
                            <button className="lbtn ok" onClick={() => changeStatus(c.id, "activate")}>{t("companies.actions.activate")}</button>
                          ) : (
                            <button className="lbtn danger" onClick={() => changeStatus(c.id, "suspend")}>{t("companies.actions.suspend")}</button>
                          )}
                          <button className="lbtn">{t("companies.actions.details")}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* drawer: add company */}
      {open && (
        <>
          <div className="drawer-overlay" onClick={() => setOpen(false)} />
          <div className="drawer">
            <div className="dh">
              <span>{t("companies.drawer.title")}</span>
              <div className="x" onClick={() => setOpen(false)}><X size={16} /></div>
            </div>
            <div className="db">
              <div className="field-sm">
                <label>{t("companies.drawer.code")}</label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder={t("companies.drawer.codePh")} />
              </div>
              <div className="field-sm">
                <label>{t("companies.drawer.name")}</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("companies.drawer.namePh")} />
              </div>
              <div className="field-sm">
                <label>{t("companies.drawer.email")}</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t("companies.drawer.emailPh")} />
              </div>
              <div className="field-sm">
                <label>{t("companies.drawer.plan")}</label>
                <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value as Plan })}>
                  <option value="FREE">Free</option>
                  <option value="STANDARD">Standard</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
              <div style={{ fontSize: 12, color: "var(--txt3)", display: "flex", gap: 8, marginTop: 4 }}>
                <Building size={14} />
                <span>{t("companies.drawer.note", { password: DEFAULT_PASSWORD })}</span>
              </div>
            </div>
            <div className="df">
              <button className="btn" onClick={() => setOpen(false)} disabled={busy}>{t("common.cancel")}</button>
              <button className="btn primary" onClick={save} disabled={busy}>{busy ? t("companies.drawer.saving") : t("common.save")}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
