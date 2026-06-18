import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, Help, BarChart, Shield, Box, Workflow, User } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import { getEnabledCCFields } from "./costCenterStore";
import "../customer/customer.css";

/** ตั้งค่าโมดูลบัญชี — สไตล์เดียวกับ /customer/settings · ส่วน "ระบบงาน & อัตโนมัติ" ชี้เข้า workflow ของบัญชี */
export default function AccountingSettings() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const session = getSession();
  const title = t("home.tiles.accounting.title");

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err">{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("custForm.goLogin")}</button></div></div>;
  }

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{title}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <div className="crm-side">
          <div className="side-title">{title}</div>
          <div className="side-item" onClick={() => nav("/accounting/cost-center")}>
            <Box size={17} /><span>Cost center</span>
          </div>
          <div className="side-item" onClick={() => nav("/accounting")}>
            <BarChart size={17} /><span>{th ? "รายงาน" : "Reports"}</span>
          </div>
          <div className="side-divider" />
          <div className="side-item active">
            <Shield size={17} /><span>{th ? "ตั้งค่า" : "Settings"}</span>
          </div>
        </div>

        <div className="crm-content">
          <div className="crm-body">
            <div className="ios-body">
              <div className="ios-head">
                <div className="ios-title">{th ? "ตั้งค่าโมดูลบัญชี" : "Accounting settings"}</div>
                <div className="ios-sub">{th ? "กำหนดระบบงานและการอนุมัติของเอกสารบัญชี" : "Configure accounting workflows and approvals"}</div>
              </div>

              <div className="ios-group-title">{th ? "ข้อมูล Cost Center" : "Cost Center data"}</div>
              <div className="ios-group">
                <div className="ios-row link" onClick={() => nav("/accounting/settings/cc-fields")}>
                  <div className="ios-ic blue"><User size={16} /></div>
                  <div className="ios-label">{th ? "ฟิลด์ข้อมูล Cost Center" : "Cost Center fields"}</div>
                  <div className="ios-value">{th ? `เปิดใช้ ${getEnabledCCFields().length} ฟิลด์` : `${getEnabledCCFields().length} enabled`}</div>
                  <span className="chev">›</span>
                </div>
              </div>

              <div className="ios-group-title">{t("crmSettings.sectionWorkflow")}</div>
              <div className="ios-group">
                <div className="ios-row link" onClick={() => nav("/workflow?module=accounting")}>
                  <div className="ios-ic" style={{ background: "#5e5ce6" }}><Workflow size={16} /></div>
                  <div className="ios-label">{t("crmSettings.workflowRow")}</div>
                  <span className="chev">›</span>
                </div>
              </div>
              <div className="ios-group-footer">{th ? "ขั้นตอน/สิทธิ์/การออกเลข ของคำขอดำเนินการ Cost Center (CC_REQUEST) ตั้งได้ที่นี่ — ฟอร์มคำขอจะเดินตามที่ตั้งไว้" : "Stages, authorities and numbering for Cost Center requests."}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
