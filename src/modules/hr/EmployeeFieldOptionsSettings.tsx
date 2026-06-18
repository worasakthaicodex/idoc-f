import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Help, Shield, ArrowLeft, Save } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import { hrMenu } from "./hrMenu";
import { canAccessHrSettings } from "./hrAccess";
import { isSelectField } from "./employeeFields";
import { getEnabledFields } from "./employeeFieldConfig";
import { getFieldOptions, setFieldOptions } from "./fieldOptions";
import "./empform.css";

export default function EmployeeFieldOptionsSettings() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();

  // เฉพาะฟิลด์ select ที่เปิดใช้งานอยู่
  const selectFields = getEnabledFields().filter(isSelectField);
  const [opts, setOpts] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(selectFields.map((k) => [k, getFieldOptions(k)])));
  const [newOpt, setNewOpt] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const label = (k: string) => t(`empFields.${k}`);
  const addOpt = (k: string, v: string) => {
    const val = v.trim();
    if (!val || (opts[k] || []).includes(val)) return;
    setOpts((o) => ({ ...o, [k]: [...(o[k] || []), val] })); setDirty(true);
  };
  const removeOpt = (k: string, v: string) => {
    setOpts((o) => ({ ...o, [k]: (o[k] || []).filter((x) => x !== v) })); setDirty(true);
  };
  const save = () => {
    selectFields.forEach((k) => setFieldOptions(k, opts[k] || []));
    nav("/hr/settings");
  };

  if (!session) {
    return <div className="p-empform"><div className="ef-body"><div className="ef-banner err">{t("empForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("empForm.goLogin")}</button></div></div>;
  }
  const allowed = canAccessHrSettings(session);

  return (
    <div className="p-empform">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="doctitle" style={{ paddingLeft: 14 }}>{t("empFields.optionsTitle")}</div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="ef-main">
        <div className="ef-side">
          <div className="side-title">{t("hr.title")}</div>
          {hrMenu.map((m) => (
            <div key={m.key} className={`side-item${m.enabled ? "" : " disabled"}`} onClick={() => { if (m.key === "core") nav("/hr"); }}>
              <m.Icon size={17} /><span>{t(`hr.menu.${m.key}`)}</span>{!m.enabled && <span className="soon">{t("common.soon")}</span>}
            </div>
          ))}
          <div className="side-divider" />
          <div className="side-item active" onClick={() => nav("/hr/settings")}>
            <Shield size={17} /><span>{t("hr.menu.settings")}</span>
          </div>
        </div>

        <div className="ef-content">
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav("/hr/settings")}><ArrowLeft /><span>{t("common.back")}</span></div>
            <div className="tbsep" />
            <div className="tbtn primary" onClick={save}><Save /><span>{t("common.save")}</span></div>
            {dirty && <span style={{ marginLeft: 12, fontSize: 12, color: "#b28600", whiteSpace: "nowrap" }}>● {t("empFields.unsaved")}</span>}
          </div>

          <div className="ef-body">
            {!allowed ? (
              <div className="ef-banner err">{t("hrSettings.noAccess")}</div>
            ) : (
              <>
                <div className="ef-head">{t("empFields.optionsTitle")}</div>
                <div className="ef-sub">{t("empFields.optionsHint")}</div>

                {selectFields.length === 0 ? (
                  <div className="ef-card"><div style={{ padding: 16 }}><div className="ef-hint">{t("empFields.noSelectField", { defaultValue: "ยังไม่มีฟิลด์แบบเลือก (select) ที่เปิดใช้งาน — เปิดที่หน้า Employee fields ก่อน" })}</div></div></div>
                ) : (
                  selectFields.map((k) => (
                    <div key={k} className="ef-card">
                      <div className="sh">{label(k)} <span className="ff-count" style={{ marginLeft: 6 }}>{(opts[k] || []).length}</span></div>
                      <div style={{ padding: "14px 16px" }}>
                        <div className="opt-chips">
                          {(opts[k] || []).map((v) => (
                            <span key={v} className="opt-chip">{v}<button type="button" onClick={() => removeOpt(k, v)}>×</button></span>
                          ))}
                          <input className="opt-add" value={newOpt[k] || ""} placeholder={t("empFields.addOption")}
                            onChange={(e) => setNewOpt((n) => ({ ...n, [k]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOpt(k, newOpt[k] || ""); setNewOpt((n) => ({ ...n, [k]: "" })); } }} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
