import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Help, Shield, ArrowLeft, Users, Columns } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import { hrMenu } from "./hrMenu";
import { isHrEnforced, setHrEnforced, canAccessHrSettings, isHrAdmin } from "./hrAccess";
import { getEnabledFields } from "./employeeFieldConfig";
import "./empform.css";

export default function HrSettings() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();
  const [enforced, setEnforced] = useState(isHrEnforced());

  function toggle(on: boolean) {
    setHrEnforced(on);
    setEnforced(on);
  }

  if (!session) {
    return <div className="p-empform"><div className="ef-body"><div className="ef-banner err">{t("empForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("empForm.goLogin")}</button></div></div>;
  }

  const allowed = canAccessHrSettings(session);
  const fieldCount = getEnabledFields().length;

  return (
    <div className="p-empform">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="doctitle" style={{ paddingLeft: 14 }}>{t("hrSettings.crumb")}</div>
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
          <div className="side-item active">
            <Shield size={17} /><span>{t("hr.menu.settings")}</span>
          </div>
        </div>

        <div className="ef-content">
          <div className="ef-body">
            <div className="ios-body">
              {/* ส่วนหัว (large title สไตล์ iOS) */}
              <div className="ios-head">
                <div className="ios-title">{t("hrSettings.title")}</div>
                <div className="ios-sub">{t("hrSettings.subtitle")}</div>
              </div>

              {!allowed ? (
                <>
                  <div className="ios-group">
                    <div className="ios-row">
                      <div className="ios-ic gray"><Shield size={16} /></div>
                      <div className="ios-label" style={{ color: "var(--red)" }}>{t("hrSettings.noAccess")}</div>
                    </div>
                  </div>
                  <div style={{ padding: "14px 2px" }}>
                    <button className="btn" onClick={() => nav("/hr")}><ArrowLeft size={15} />{t("common.back")}</button>
                  </div>
                </>
              ) : (
                <>
                  {/* หมวด: ข้อมูล */}
                  <div className="ios-group-title">{t("hrSettings.sectionData")}</div>
                  <div className="ios-group">
                    <div className="ios-row link" onClick={() => nav("/hr/settings/fields")}>
                      <div className="ios-ic blue"><Users size={16} /></div>
                      <div className="ios-label">{t("empFields.title")}</div>
                      <div className="ios-value">{t("empFields.selected", { n: fieldCount })}</div>
                      <span className="chev">›</span>
                    </div>
                    <div className="ios-row link sub" onClick={() => nav("/hr/settings/field-options")}>
                      <div className="ios-ic blue"><Columns size={16} /></div>
                      <div className="ios-label">{t("empFields.optionsTitle")}</div>
                      <span className="chev">›</span>
                    </div>
                  </div>

                  {/* หมวด: ความปลอดภัย & สิทธิ์ */}
                  <div className="ios-group-title">{t("hrSettings.sectionSecurity")}</div>
                  <div className="ios-group">
                    <div className="ios-row">
                      <div className="ios-ic gray"><Shield size={16} /></div>
                      <div className="ios-label">{t("hrSettings.enforceLabel")}</div>
                      <label className="ios-switch">
                        <input type="checkbox" checked={enforced} onChange={(e) => toggle(e.target.checked)} />
                        <span />
                      </label>
                    </div>
                  </div>
                  <div className="ios-group-footer">{enforced ? t("hrSettings.enforceOnHint") : t("hrSettings.enforceOffHint")}</div>
                  {enforced && !isHrAdmin(session) && (
                    <div className="ios-group-footer err">{t("hrSettings.willLoseAccess")}</div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
