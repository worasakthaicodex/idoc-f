import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch, type Page } from "../../shared/api";
import { getSession, clearSession } from "../../shared/session";
import { Grid, ChevronDown, Help, Refresh, Plus, Building, ArrowLeft, HomeIcon, Shield } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import { hrMenu } from "./hrMenu";
import { listDepartments, listDivisions, type OrgDepartment, type OrgDivision } from "./orgStore";
import { canAccessHrSettings, isHrAdmin } from "./hrAccess";
import "./hr.css";

type Employee = { id: string; code: string; fullName: string; email?: string; position?: string; mobile?: string; department?: string; division?: string; role: "COMPANY_OWNER" | "STAFF"; status: string };
type Position = { id: string; code: string; name: string; description?: string; modules: { module: string; level: string }[]; department?: string; division?: string };

const tabs = ["emp", "position", "dept", "division"];

export default function HrPage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();
  const tenant = session?.companyId ?? "";

  const [tab, setTab] = useState("emp");
  const [section, setSection] = useState("core");
  const [error, setError] = useState("");

  const [employees, setEmployees] = useState<Employee[]>([]);

  const [positions, setPositions] = useState<Position[]>([]);
  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [divisions, setDivisions] = useState<OrgDivision[]>([]);

  const moduleLabel = (m: string) => t(`hr.modules.${m}`, { defaultValue: m });

  useEffect(() => {
    if (tenant) { loadEmployees(); loadPositions(); loadOrg(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  function loadOrg() {
    listDivisions().then(setDivisions).catch(() => {});
    listDepartments().then(setDepartments).catch(() => {});
  }

  function loadEmployees() {
    setError("");
    apiFetch<Page<Employee>>("/admin/employees?size=100", { tenant })
      .then((p) => setEmployees(p.content))
      .catch((e) => setError(t("hr.err.loadEmp") + ": " + e.message));
  }

  function loadPositions() {
    apiFetch<Position[]>("/admin/positions", { tenant })
      .then(setPositions)
      .catch((e) => setError(t("hr.err.loadPos") + ": " + e.message));
  }

  const logout = () => { clearSession(); nav("/login"); };

  // ยังไม่ได้ login เป็นบริษัทใด
  if (!session) {
    return (
      <div className="p-hr">
        <div className="topbar"><div className="app">{t("common.appName")}</div><div className="u-spacer" /><div className="me">A</div></div>
        <div className="hr-body">
          <div className="banner err"><Building size={15} />{t("hr.notLoggedIn")}</div>
          <button className="btn primary" onClick={() => nav("/login")}><ArrowLeft size={15} />{t("hr.goLogin")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-hr">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{t("hr.title")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="hr-main">
        <div className="hr-side">
          <div className="side-title">{t("hr.title")}</div>
          {hrMenu.map((m) => (
            <div
              key={m.key}
              className={`side-item${section === m.key ? " active" : ""}${m.enabled ? "" : " disabled"}`}
              onClick={() => m.enabled && setSection(m.key)}
            >
              <m.Icon size={17} />
              <span>{t(`hr.menu.${m.key}`)}</span>
              {!m.enabled && <span className="soon">{t("common.soon")}</span>}
            </div>
          ))}
          {canAccessHrSettings(session) && (
            <>
              <div className="side-divider" />
              <div className="side-item" onClick={() => nav("/hr/settings")}>
                <Shield size={17} /><span>{t("hr.menu.settings")}</span>
              </div>
            </>
          )}
        </div>

        <div className="hr-content">

      <div className="subbar">
        <div className="company-pick"><Building size={15} />{t("hr.loggedInAs")} <b style={{ color: "var(--txt)" }}>{session.companyCode} · {session.companyName}</b></div>
        <div className="u-spacer" />
        <div className="tb" title={t("common.refresh")} onClick={loadEmployees}><Refresh /></div>
        <div className="vsep" />
        <div className="fields" onClick={() => nav("/app")} title={t("common.backHome")}><HomeIcon size={16} />{t("hr.home")}</div>
        <div className="vsep" />
        <div className="fields" onClick={logout}><ArrowLeft size={16} />{t("common.logout")}</div>
      </div>

      <div className="tabs">
        {tabs.map((key) => (
          <div key={key} className={`tab${tab === key ? " active" : ""}`} onClick={() => setTab(key)}>{t(`hr.tabs.${key}`)}</div>
        ))}
      </div>

      <div className="hr-body">
        {error && <div className="banner err">{error}</div>}

        {tab === "emp" && (
          <div className="card">
            <div className="ch">
              <span>{t("hr.emp.count", { n: employees.length })} <span className="muted">{t("hr.emp.clickToView")}</span></span>
              {isHrAdmin() && <button className="btn primary" style={{ padding: "6px 12px" }} onClick={() => nav("/hr/employee/new")}><Plus size={15} />{t("hr.emp.add")}</button>}
            </div>
            <table className="data-grid">
              <thead><tr><th>{t("hr.emp.col.code")}</th><th>{t("hr.emp.col.name")}</th><th>{t("hr.emp.col.position")}</th><th>{t("hr.emp.col.dept")}</th><th>{t("hr.emp.col.division")}</th><th>{t("hr.emp.col.status")}</th></tr></thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr className="empty-row"><td colSpan={6}>{t("hr.emp.empty")}</td></tr>
                ) : employees.map((e) => (
                  <tr key={e.id} style={{ cursor: "pointer" }} onClick={() => nav(`/hr/employee/${e.id}`)}>
                    <td className="docno">{e.code}</td>
                    <td>{e.fullName}</td>
                    <td>{e.position || "—"}</td>
                    <td>{e.department || "—"}</td>
                    <td>{e.division || "—"}</td>
                    <td><span className={`chip ${e.status === "ACTIVE" ? "green" : "red"}`}>{e.status === "ACTIVE" ? t("hr.status.active") : t("hr.status.disabled")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "position" && (
          <div className="card">
            <div className="ch">
              <span>{t("hr.position.count", { n: positions.length })} <span className="muted">{t("hr.emp.clickToEdit")}</span></span>
              {isHrAdmin() && <button className="btn primary" style={{ padding: "6px 12px" }} onClick={() => nav("/hr/position/new")}><Plus size={15} />{t("hr.position.add")}</button>}
            </div>
            <table className="data-grid">
              <thead><tr>
                <th>{t("hr.position.colCode")}</th>
                <th>{t("hr.position.colName")}</th>
                <th>{t("hr.position.colModules")}</th>
                <th>{t("hr.position.colUsers")}</th>
                <th>{t("hr.position.colDept")}</th>
                <th>{t("hr.position.colDivision")}</th>
              </tr></thead>
              <tbody>
                {positions.length === 0 ? (
                  <tr className="empty-row"><td colSpan={6}>{t("hr.position.none")}</td></tr>
                ) : positions.map((p) => (
                  <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => nav(`/hr/position/${p.id}`)}>
                    <td className="docno">{p.code}</td>
                    <td>{p.name}</td>
                    <td><div className="chips-sm">{p.modules.length ? p.modules.map((mp) => <span key={mp.module} className="chip blue">{moduleLabel(mp.module)} · {t(`hr.access.${mp.level}`, { defaultValue: mp.level })}</span>) : <span className="muted">{t("hr.position.none")}</span>}</div></td>
                    <td>{employees.filter((e) => e.position === p.name).length}</td>
                    <td>{p.department || "—"}</td>
                    <td>{p.division || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "dept" && (
          <div className="card">
            <div className="ch">
              <span>{t("hr.dept.count", { n: departments.length })} <span className="muted">{t("hr.emp.clickToEdit")}</span></span>
              {isHrAdmin() && <button className="btn primary" style={{ padding: "6px 12px" }} onClick={() => nav("/hr/department/new")}><Plus size={15} />{t("hr.dept.add")}</button>}
            </div>
            <table className="data-grid">
              <thead><tr><th>{t("hr.position.colCode")}</th><th>{t("hr.dept.colName")}</th><th>{t("hr.dept.colDivision")}</th></tr></thead>
              <tbody>
                {departments.length === 0 ? (
                  <tr className="empty-row"><td colSpan={3}>{t("hr.dept.count", { n: 0 })}</td></tr>
                ) : departments.map((d) => (
                  <tr key={d.id} style={{ cursor: "pointer" }} onClick={() => nav(`/hr/department/${d.id}`)}>
                    <td className="docno">{d.code}</td>
                    <td>{d.name}</td>
                    <td className="muted">{d.division || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "division" && (
          <div className="card">
            <div className="ch">
              <span>{t("hr.division.count", { n: divisions.length })} <span className="muted">{t("hr.emp.clickToEdit")}</span></span>
              {isHrAdmin() && <button className="btn primary" style={{ padding: "6px 12px" }} onClick={() => nav("/hr/division/new")}><Plus size={15} />{t("hr.division.add")}</button>}
            </div>
            <table className="data-grid">
              <thead><tr><th>{t("hr.position.colCode")}</th><th>{t("hr.division.colName")}</th></tr></thead>
              <tbody>
                {divisions.length === 0 ? (
                  <tr className="empty-row"><td colSpan={2}>{t("hr.division.count", { n: 0 })}</td></tr>
                ) : divisions.map((v) => (
                  <tr key={v.id} style={{ cursor: "pointer" }} onClick={() => nav(`/hr/division/${v.id}`)}>
                    <td className="docno">{v.code}</td>
                    <td>{v.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </div>
      </div>
    </div>
  );
}
