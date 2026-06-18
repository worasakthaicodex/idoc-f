import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";
import {
  Grid, ChevronDown, Help, ArrowLeft, HomeIcon, Edit, Shield, Trash,
  User, Phone, Building, FileText, Dollar, Calendar, Clock, Paperclip,
} from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import { hrMenu } from "./hrMenu";
import { canAccessHrSettings } from "./hrAccess";
import { getEnabledFields } from "./employeeFieldConfig";
import { EMP_FIELDS, GROUPS, COLUMN_KEYS, type FieldGroup } from "./employeeFields";
import "./hr.css";
import "./empdetail.css";

type Pos = { id: string; name: string; modules: { module: string; level: string }[] };

const GROUP_ICON: Record<FieldGroup, typeof User> = {
  general: User,
  employment: Building,
  doc: FileText,
  contact: Phone,
  emergency: Shield,
  address: Building,
  statutory: FileText,
};

// แท็บของพนักงาน — profile เปิดใช้ได้, ที่เหลือเตรียมไว้สำหรับอนาคต
const EMP_TABS: { key: string; Icon: typeof User; ready?: boolean }[] = [
  { key: "profile", Icon: User, ready: true },
  { key: "payroll", Icon: Dollar },
  { key: "leave", Icon: Calendar },
  { key: "attendance", Icon: Clock },
  { key: "documents", Icon: Paperclip },
  { key: "history", Icon: FileText },
];

const isColumn = (k: string) => COLUMN_KEYS.includes(k);

export default function EmployeeDetail() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { id } = useParams();
  const session = getSession();
  const tenant = session?.companyId ?? "";

  const [emp, setEmp] = useState<Record<string, unknown> | null>(null);
  const [positions, setPositions] = useState<Pos[]>([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("profile");

  const moduleLabel = (m: string) => t(`hr.modules.${m}`, { defaultValue: m });

  useEffect(() => {
    if (tenant) apiFetch<Pos[]>("/admin/positions", { tenant }).then(setPositions).catch(() => {});
    if (tenant && id) {
      apiFetch<Record<string, unknown>>(`/admin/employees/${id}`, { tenant })
        .then(setEmp)
        .catch((err) => setError(t("empForm.errLoad") + ": " + err.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tenant]);

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

  const code = String(emp?.code ?? "");
  const name = String(emp?.fullName ?? "");
  const attrs = (emp?.attributes as Record<string, string>) ?? {};
  const enabledSet = new Set(getEnabledFields());

  const value = (key: string): string => {
    const raw = isColumn(key) ? emp?.[key] : attrs[key];
    return raw == null || raw === "" ? "" : String(raw);
  };

  const position = value("position");
  const role = String(emp?.role ?? "STAFF");
  const status = String(emp?.status ?? "");
  const initial = (name || code || "?").charAt(0).toUpperCase();

  const groups = GROUPS
    .map((g) => ({ g, fields: EMP_FIELDS.filter((f) => f.group === g && enabledSet.has(f.key) && f.key !== "fullName") }))
    .filter((x) => x.fields.length > 0);

  const goEdit = () => nav(`/hr/employee/${id}/edit`);
  const doDelete = async () => {
    if (!window.confirm(t("empDetail.confirmDelete", { defaultValue: "ลบพนักงานนี้ถาวร? กู้คืนไม่ได้" }))) return;
    try { await apiFetch(`/admin/employees/${id}`, { method: "DELETE", tenant }); nav("/hr"); }
    catch (e) { alert((e as Error).message || t("empForm.errLoad")); }
  };

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
        {/* เมนู HR ด้านซ้าย — ชุดเดียวกับหน้า /hr */}
        <div className="hr-side">
          <div className="side-title">{t("hr.title")}</div>
          {hrMenu.map((m) => (
            <div
              key={m.key}
              className={`side-item${m.key === "core" ? " active" : ""}${m.enabled ? "" : " disabled"}`}
              onClick={() => { if (m.key === "core") nav("/hr"); }}
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
          {/* subbar — เหมือน /hr */}
          <div className="subbar">
            <div className="fields" onClick={() => nav("/hr")} title={t("empForm.backList")}><ArrowLeft size={16} />{t("empForm.backList")}</div>
            <div className="vsep" />
            <div className="company-pick"><User size={15} /><b style={{ color: "var(--txt)" }}>{name || code}</b> · {code}</div>
            <div className="u-spacer" />
            <div className="fields" onClick={() => nav("/app")} title={t("common.backHome")}><HomeIcon size={16} />{t("hr.home")}</div>
          </div>

          {/* แท็บแนวนอนของพนักงาน — ตำแหน่งเดียวกับแท็บ /hr */}
          <div className="tabs">
            {EMP_TABS.map((tb) => (
              <div
                key={tb.key}
                className={`tab${tab === tb.key ? " active" : ""}${tb.ready ? "" : " disabled"}`}
                onClick={() => tb.ready && setTab(tb.key)}
              >
                {t(`empDetail.tabs.${tb.key}`)}
                {!tb.ready && <span className="soon">{t("common.soon")}</span>}
              </div>
            ))}
          </div>

          <div className="hr-body">
            {error && <div className="banner err"><Building size={15} />{error}</div>}

            {/* หัวโปรไฟล์ */}
            {emp && (
              <div className="ed-hero">
                <div className="ed-avatar">{initial}</div>
                <div className="ed-id">
                  <div className="ed-name">{name || t("empForm.noValue")}</div>
                  <div className="ed-meta">
                    <span className="mi"><FileText size={14} />{code}</span>
                    <span className="mi"><Building size={14} />{position || t("empDetail.noPosition")}</span>
                    {value("email") && <span className="mi"><Phone size={14} />{value("email")}</span>}
                  </div>
                  <div className="ed-chips">
                    <span className={`chip ${status === "ACTIVE" ? "green" : "red"}`}>{status === "ACTIVE" ? t("hr.status.active") : t("hr.status.disabled")}</span>
                    <span className="chip gray">{t(`empDetail.role.${role}`, { defaultValue: role })}</span>
                    {Boolean(emp?.googleEnabled) && <span className="chip blue">{t("empDetail.gmail")}</span>}
                  </div>
                </div>
                <div className="ed-hero-act">
                  <button className="btn primary" onClick={goEdit}><Edit size={16} />{t("empForm.editBtn")}</button>
                  {role !== "COMPANY_OWNER" && (
                    <button className="btn" style={{ color: "var(--red)", borderColor: "var(--red)" }} onClick={doDelete}>
                      <Trash size={16} />{t("empDetail.delete", { defaultValue: "ลบผู้ใช้" })}
                    </button>
                  )}
                </div>
              </div>
            )}

            {tab === "profile" && emp && (
              <>
                {groups.map(({ g, fields }) => {
                  const Icon = GROUP_ICON[g];
                  return (
                    <div className="card" key={g}>
                      <div className="ch"><span style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon size={15} />{t(`empFields.group.${g}`, { defaultValue: g })}</span></div>
                      <div className="ed-dl">
                        {g === "employment" && (
                          <div className="ed-row">
                            <div className="dt">{t("empFields.position")}</div>
                            <div className="dd">
                              {position || <span className="muted">{t("empDetail.noPosition")}</span>}
                              {(() => {
                                const sp = positions.find((p) => p.name === position);
                                return sp && sp.modules.length > 0 ? (
                                  <div className="chips-sm" style={{ marginTop: 8 }}>
                                    {sp.modules.map((mp) => <span key={mp.module} className="chip blue">{moduleLabel(mp.module)} · {t(`hr.access.${mp.level}`, { defaultValue: mp.level })}</span>)}
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        )}
                        {fields.map((f) => {
                          const v = value(f.key);
                          return (
                            <div className="ed-row" key={f.key}>
                              <div className="dt">{t(`empFields.${f.key}`, { defaultValue: f.key })}</div>
                              <div className={`dd${v ? "" : " muted"}`}>{v || t("empForm.noValue")}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* การเข้าสู่ระบบ */}
                <div className="card">
                  <div className="ch"><span style={{ display: "flex", alignItems: "center", gap: 8 }}><Shield size={15} />{t("empForm.sec.login")}</span></div>
                  <div className="ed-dl">
                    <div className="ed-row">
                      <div className="dt">{t("empDetail.loginEmail")}</div>
                      <div className={`dd${value("email") ? "" : " muted"}`}>{value("email") || t("empForm.noValue")}</div>
                    </div>
                    <div className="ed-row">
                      <div className="dt">{t("empDetail.canLogin")}</div>
                      <div className="dd"><span className={`chip ${emp?.canLogin ? "green" : "red"}`}>{emp?.canLogin ? t("empDetail.yes") : t("empDetail.no")}</span></div>
                    </div>
                    <div className="ed-row">
                      <div className="dt">{t("empDetail.gmail")}</div>
                      <div className="dd"><span className={`chip ${emp?.googleEnabled ? "green" : "red"}`}>{emp?.googleEnabled ? t("empDetail.yes") : t("empDetail.no")}</span></div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab !== "profile" && (
              <div className="ed-soon-box">
                {(() => { const Tb = EMP_TABS.find((x) => x.key === tab); return Tb ? <Tb.Icon size={34} /> : null; })()}
                <div className="t">{t(`empDetail.tabs.${tab}`)}</div>
                <div className="s">{t("empDetail.soonSub")}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
