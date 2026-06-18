import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, Shield, ArrowLeft, User, Columns, CheckCircle, Box, Workflow, Search, Clock, Hexagon, FileText } from "../../shared/icons";
import CrmHelpButton from "./CrmHelpButton";
import LangSwitcher from "../../shared/LangSwitcher";
import CustomerSide from "./CustomerSide";
import { isCrmEnforced, setCrmEnforced, canAccessCrmSettings, isCrmAdmin } from "./crmAccess";
import { getEnabledFields } from "./customerFieldConfig";
import { getColumns } from "./customerColumnConfig";
import { getSearchFields } from "./customerSearchConfig";
import { getEnabledTools } from "../activity/toolConfig";
import { readinessCount } from "./customerReadinessConfig";
import "./customer.css";

export default function CrmSettings() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const session = getSession();
  const [enforced, setEnforced] = useState(isCrmEnforced());

  function toggle(on: boolean) {
    setCrmEnforced(on);
    setEnforced(on);
  }

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err">{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("custForm.goLogin")}</button></div></div>;
  }

  const allowed = canAccessCrmSettings(session);
  const fieldCount = getEnabledFields().length;

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
        <CrmHelpButton />
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <CustomerSide active="settings" />

        <div className="crm-content">
          <div className="crm-body">
            <div className="ios-body">
              <div className="ios-head">
                <div className="ios-title">{t("crmSettings.title")}</div>
                <div className="ios-sub">{t("crmSettings.subtitle")}</div>
              </div>

              {!allowed ? (
                <>
                  <div className="ios-group">
                    <div className="ios-row">
                      <div className="ios-ic gray"><Shield size={16} /></div>
                      <div className="ios-label" style={{ color: "var(--red)" }}>{t("crmSettings.noAccess")}</div>
                    </div>
                  </div>
                  <div style={{ padding: "14px 2px" }}>
                    <button className="btn" onClick={() => nav("/customer")}><ArrowLeft size={15} />{t("common.back")}</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="ios-group-title">{t("crmSettings.sectionData")}</div>
                  <div className="ios-group">
                    <div className="ios-row link" onClick={() => nav("/customer/settings/fields")}>
                      <div className="ios-ic blue"><User size={16} /></div>
                      <div className="ios-label">{t("custFields.title")}</div>
                      <div className="ios-value">{t("custFields.selected", { n: fieldCount })}</div>
                      <span className="chev">›</span>
                    </div>
                    <div className="ios-row link" onClick={() => nav("/customer/settings/field-options")}>
                      <div className="ios-ic blue"><Columns size={16} /></div>
                      <div className="ios-label">{t("custFields.optionsTitle")}</div>
                      <span className="chev">›</span>
                    </div>
                    <div className="ios-row link" onClick={() => nav("/customer/settings/statuses")}>
                      <div className="ios-ic green"><CheckCircle size={16} /></div>
                      <div className="ios-label">{t("custStatus.title")}</div>
                      <span className="chev">›</span>
                    </div>
                    <div className="ios-row link" onClick={() => nav("/customer/settings/columns")}>
                      <div className="ios-ic" style={{ background: "#ff9500" }}><Columns size={16} /></div>
                      <div className="ios-label">{t("custColumns.title")}</div>
                      <div className="ios-value">{t("custColumns.shownN", { n: getColumns().length })}</div>
                      <span className="chev">›</span>
                    </div>
                    <div className="ios-row link" onClick={() => nav("/customer/settings/search")}>
                      <div className="ios-ic" style={{ background: "#0a84ff" }}><Search size={16} /></div>
                      <div className="ios-label">{t("custSearch.title")}</div>
                      <div className="ios-value">{t("custColumns.shownN", { n: getSearchFields().length })}</div>
                      <span className="chev">›</span>
                    </div>
                  </div>

                  <div className="ios-group-title">{t("custReadiness.section")}</div>
                  <div className="ios-group">
                    <div className="ios-row link" onClick={() => nav("/customer/settings/readiness")}>
                      <div className="ios-ic" style={{ background: "#ff9500" }}><Clock size={16} /></div>
                      <div className="ios-label">{t("custReadiness.row")}</div>
                      <div className="ios-value">{t("custReadiness.enabledN", { n: readinessCount() })}</div>
                      <span className="chev">›</span>
                    </div>
                    <div className="ios-row link" onClick={() => nav("/customer/settings/grade")}>
                      <div className="ios-ic" style={{ background: "#34c759" }}><Hexagon size={16} /></div>
                      <div className="ios-label">{th ? "การตัดเกรดลูกค้า" : "Customer grading"}</div>
                      <div className="ios-value">{th ? "ตามยอดซื้อ" : "By purchases"}</div>
                      <span className="chev">›</span>
                    </div>
                    <div className="ios-row link" onClick={() => nav("/customer/settings/filetypes")}>
                      <div className="ios-ic" style={{ background: "#0a84ff" }}><FileText size={16} /></div>
                      <div className="ios-label">{th ? "ชนิดไฟล์แนบ" : "Attachment file types"}</div>
                      <span className="chev">›</span>
                    </div>
                  </div>

                  <div className="ios-group-title">{t("custTools.section")}</div>
                  <div className="ios-group">
                    <div className="ios-row link" onClick={() => nav("/customer/settings/tools")}>
                      <div className="ios-ic blue"><Box size={16} /></div>
                      <div className="ios-label">{t("custTools.title")}</div>
                      <div className="ios-value">{t("custTools.enabledN", { n: getEnabledTools("customer").length })}</div>
                      <span className="chev">›</span>
                    </div>
                  </div>

                  <div className="ios-group-title">{t("crmSettings.sectionWorkflow")}</div>
                  <div className="ios-group">
                    <div className="ios-row link" onClick={() => nav("/workflow")}>
                      <div className="ios-ic" style={{ background: "#5e5ce6" }}><Workflow size={16} /></div>
                      <div className="ios-label">{t("crmSettings.workflowRow")}</div>
                      <span className="chev">›</span>
                    </div>
                  </div>

                  <div className="ios-group-title">{t("crmSettings.sectionSecurity")}</div>
                  <div className="ios-group">
                    <div className="ios-row">
                      <div className="ios-ic gray"><Shield size={16} /></div>
                      <div className="ios-label">{t("crmSettings.enforceLabel")}</div>
                      <label className="ios-switch">
                        <input type="checkbox" checked={enforced} onChange={(e) => toggle(e.target.checked)} />
                        <span />
                      </label>
                    </div>
                  </div>
                  <div className="ios-group-footer">{enforced ? t("crmSettings.enforceOnHint") : t("crmSettings.enforceOffHint")}</div>
                  {enforced && !isCrmAdmin(session) && (
                    <div className="ios-group-footer err">{t("crmSettings.willLoseAccess")}</div>
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
