import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, ArrowLeft, Save } from "../../shared/icons";
import CrmHelpButton from "./CrmHelpButton";
import LangSwitcher from "../../shared/LangSwitcher";
import CustomerSide from "./CustomerSide";
import { canAccessCrmSettings } from "./crmAccess";
import { STATUSES } from "./customerStatus";
import { getEnabledStatuses, setEnabledStatuses, getStatusLabelOverrides, setStatusLabelOverrides } from "./customerStatusConfig";
import "./customer.css";

export default function CustomerStatusSettings() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();

  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(getEnabledStatuses()));
  const [labels, setLabels] = useState<Record<string, string>>(() => getStatusLabelOverrides());
  const [dirty, setDirty] = useState(false);

  const toggle = (code: string, locked?: boolean) => {
    if (locked) return;
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
    setDirty(true);
  };
  const rename = (code: string, v: string) => { setLabels((l) => ({ ...l, [code]: v })); setDirty(true); };

  const save = () => {
    setEnabledStatuses([...enabled]);
    const clean: Record<string, string> = {};
    Object.entries(labels).forEach(([k, v]) => { if (v && v.trim()) clean[k] = v.trim(); });
    setStatusLabelOverrides(clean);
    nav("/customer/settings");
  };

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
              <>
                <div className="set-head">{t("custStatus.title")}</div>
                <div className="set-sub">{t("custStatus.hint")}</div>

                <div className="card">
                  <table className="data-grid">
                    <thead><tr>
                      <th style={{ width: 80 }}>{t("custStatus.colEnabled")}</th>
                      <th>{t("custStatus.colLabel")}</th>
                      <th>{t("custStatus.colCode")}</th>
                    </tr></thead>
                    <tbody>
                      {STATUSES.map((s) => (
                        <tr key={s.code}>
                          <td>
                            <input type="checkbox" checked={s.locked || enabled.has(s.code)} disabled={s.locked}
                              onChange={() => toggle(s.code, s.locked)} />
                          </td>
                          <td>
                            <input type="text" className="opt-add" style={{ minWidth: 200, borderRadius: 6 }}
                              value={labels[s.code] ?? ""} placeholder={t(`custStatus.${s.code}`)}
                              onChange={(e) => rename(s.code, e.target.value)} />
                            {s.retentionYears && <span className="ff-tag" style={{ marginLeft: 8 }}>{t("custStatus.retentionNote")}</span>}
                          </td>
                          <td className="muted">{s.code}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
