import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, ArrowLeft, Save, Search } from "../../shared/icons";
import CrmHelpButton from "./CrmHelpButton";
import LangSwitcher from "../../shared/LangSwitcher";
import CustomerSide from "./CustomerSide";
import { canAccessCrmSettings } from "./crmAccess";
import { TOOLS } from "../activity/tools";
import { getEnabledTools, setEnabledTools } from "../activity/toolConfig";
import "./customer.css";

const CTX = "customer"; // context ของเครื่องมือสำหรับโมดูลลูกค้า

export default function CustomerToolsSettings() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();

  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(getEnabledTools(CTX)));
  const [q, setQ] = useState("");
  const [dirty, setDirty] = useState(false);

  const toggle = (key: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setDirty(true);
  };
  const save = () => { setEnabledTools(CTX, [...enabled]); nav("/customer/settings"); };

  const label = (k: string) => t(`tools.${k}.title`, { defaultValue: k });
  const desc = (k: string) => t(`tools.${k}.desc`, { defaultValue: "" });
  const shown = TOOLS.filter((tool) =>
    label(tool.key).toLowerCase().includes(q.toLowerCase()) || desc(tool.key).toLowerCase().includes(q.toLowerCase()));

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err">{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("custForm.goLogin")}</button></div></div>;
  }
  const allowed = canAccessCrmSettings(session);

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
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav("/customer/settings")}><ArrowLeft /><span>{t("custForm.back")}</span></div>
            <div className="tbsep" />
            <div className="tbtn primary" onClick={save}><Save /><span>{t("custForm.save")}</span></div>
            {dirty && <span style={{ marginLeft: 12, fontSize: 12, color: "#b28600", whiteSpace: "nowrap" }}>● {t("custFields.unsaved")}</span>}
          </div>

          <div className="crm-body">
            {!allowed ? (
              <div className="banner err">{t("crmSettings.noAccess")}</div>
            ) : (
              <div className="ios-body">
                <div className="ios-head">
                  <div className="ios-title">{t("custTools.title")}</div>
                  <div className="ios-sub">{t("custTools.hint")}</div>
                </div>

                <div className="tool-search">
                  <Search size={15} />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("custTools.searchPh")} />
                </div>

                <div className="ios-group">
                  {shown.length === 0 && <div className="ios-row"><div className="ios-label muted">{t("custTools.empty")}</div></div>}
                  {shown.map((tool) => (
                    <div className="ios-row" key={tool.key}>
                      <div className="ios-ic gray"><tool.Icon size={16} /></div>
                      <div className="ios-label">
                        <div>{label(tool.key)}{tool.writesCalendar && <span className="ff-tag" style={{ marginLeft: 8 }}>{t("custTools.calendarTag")}</span>}</div>
                        <div className="tool-desc">{desc(tool.key)}</div>
                      </div>
                      <label className="ios-switch">
                        <input type="checkbox" checked={enabled.has(tool.key)} onChange={() => toggle(tool.key)} />
                        <span />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
