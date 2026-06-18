import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, ArrowLeft, Save } from "../../shared/icons";
import CrmHelpButton from "./CrmHelpButton";
import LangSwitcher from "../../shared/LangSwitcher";
import CustomerSide from "./CustomerSide";
import { canAccessCrmSettings } from "./crmAccess";
import { getReadiness, saveReadiness, type ReadinessConfig } from "./customerReadinessConfig";
import "./customer.css";

const NUM: React.CSSProperties = { width: 120, padding: "7px 10px", border: "1px solid var(--field-bd)", borderRadius: 8, fontSize: 13.5 };

/** ตั้งค่า "การพร้อมใช้" — เลือกเปิดรูปแบบไหนบ้าง + พารามิเตอร์ */
export default function CustomerReadinessSettings() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();
  const [cfg, setCfg] = useState<ReadinessConfig>(() => getReadiness());
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const upd = (patch: Partial<ReadinessConfig>) => { setCfg((c) => ({ ...c, ...patch })); setDirty(true); setErr(""); };
  const save = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    const ok = await saveReadiness(cfg);
    setBusy(false);
    if (ok) { setDirty(false); nav("/customer/settings"); }
    else setErr(t("custReadiness.saveErr"));
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
            <div className={"tbtn primary" + (busy ? " disabled" : "")} onClick={save}><Save /><span>{busy ? t("custReadiness.saving") : t("custForm.save")}</span></div>
            {dirty && !busy && <span style={{ marginLeft: 12, fontSize: 12, color: "#b28600", whiteSpace: "nowrap" }}>● {t("custFields.unsaved")}</span>}
            {err && <span style={{ marginLeft: 12, fontSize: 12, color: "var(--red)", whiteSpace: "nowrap" }}>{err}</span>}
          </div>

          <div className="crm-body">
            {!allowed ? (
              <div className="banner err">{t("crmSettings.noAccess")}</div>
            ) : (
              <>
                <div className="set-head">{t("custReadiness.title")}</div>
                <div className="set-sub">{t("custReadiness.hint")}</div>

                {/* 1) ปิดการขาย/บริการเสร็จ */}
                <div className="card">
                  <div className="rd-row">
                    <div className="rd-txt"><div className="rd-t">{t("custReadiness.saleLabel")}</div><div className="rd-d">{t("custReadiness.saleDesc")}</div></div>
                    <label className="ios-switch"><input type="checkbox" checked={cfg.afterSaleDone.on} onChange={(e) => upd({ afterSaleDone: { ...cfg.afterSaleDone, on: e.target.checked } })} /><span /></label>
                  </div>
                  {cfg.afterSaleDone.on && (
                    <div className="rd-param"><label>{t("custReadiness.saleDays")}</label>
                      <input type="number" min={0} style={NUM} value={cfg.afterSaleDone.days} onChange={(e) => upd({ afterSaleDone: { ...cfg.afterSaleDone, days: Math.max(0, Number(e.target.value) || 0) } })} />
                    </div>
                  )}
                </div>

                {/* 2) ไม่ได้ติดต่อมานาน */}
                <div className="card">
                  <div className="rd-row">
                    <div className="rd-txt"><div className="rd-t">{t("custReadiness.contactLabel")}</div><div className="rd-d">{t("custReadiness.contactDesc")}</div></div>
                    <label className="ios-switch"><input type="checkbox" checked={cfg.sinceContact.on} onChange={(e) => upd({ sinceContact: { ...cfg.sinceContact, on: e.target.checked } })} /><span /></label>
                  </div>
                  {cfg.sinceContact.on && (
                    <div className="rd-param"><label>{t("custReadiness.contactMonths")}</label>
                      <input type="number" min={1} style={NUM} value={cfg.sinceContact.months} onChange={(e) => upd({ sinceContact: { ...cfg.sinceContact, months: Math.max(1, Number(e.target.value) || 1) } })} />
                    </div>
                  )}
                </div>

                {/* 3) ถึงกำหนดใน calendar */}
                <div className="card">
                  <div className="rd-row">
                    <div className="rd-txt"><div className="rd-t">{t("custReadiness.calLabel")}</div><div className="rd-d">{t("custReadiness.calDesc")}</div></div>
                    <label className="ios-switch"><input type="checkbox" checked={cfg.calendarDue.on} onChange={(e) => upd({ calendarDue: { ...cfg.calendarDue, on: e.target.checked } })} /><span /></label>
                  </div>
                  {cfg.calendarDue.on && (
                    <div className="rd-param"><label>{t("custReadiness.calDays")}</label>
                      <input type="number" min={1} style={NUM} value={cfg.calendarDue.days} onChange={(e) => upd({ calendarDue: { ...cfg.calendarDue, days: Math.max(1, Number(e.target.value) || 1) } })} />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
