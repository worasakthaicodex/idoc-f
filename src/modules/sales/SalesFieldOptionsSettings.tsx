import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, Help, ArrowLeft, Save } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import SalesSide from "./SalesSide";
import { hasOptionList } from "./salesFields";
import { getEnabledFields } from "./salesFieldConfig";
import { getFieldOptions, setFieldOptions } from "./salesFieldOptions";
import "../customer/customer.css";

/** จัดการตัวเลือกของฟิลด์ select ในเอกสารงานขาย (เริ่มที่ CL) — ?doc=CL */
export default function SalesFieldOptionsSettings() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();
  const [sp] = useSearchParams();
  const doc = sp.get("doc") || "CL";

  const selectFields = getEnabledFields(doc).filter((k) => hasOptionList(doc, k));
  const [opts, setOpts] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(selectFields.map((k) => [k, getFieldOptions(doc, k)])));
  const [newOpt, setNewOpt] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const label = (k: string) => t(`salesFields.${k}`, { defaultValue: k });
  const addOpt = (k: string, v: string) => {
    const val = v.trim();
    if (!val || (opts[k] || []).includes(val)) return;
    setOpts((o) => ({ ...o, [k]: [...(o[k] || []), val] })); setDirty(true);
  };
  const removeOpt = (k: string, v: string) => {
    setOpts((o) => ({ ...o, [k]: (o[k] || []).filter((x) => x !== v) })); setDirty(true);
  };
  const save = () => {
    selectFields.forEach((k) => setFieldOptions(doc, k, opts[k] || []));
    nav("/sales/settings");
  };

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err">{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("custForm.goLogin")}</button></div></div>;
  }

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>iDoc ERP</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{t("custFields.optionsTitle")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <SalesSide active="settings" />

        <div className="crm-content">
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav("/sales/settings")}><ArrowLeft /><span>{t("custForm.back")}</span></div>
            <div className="tbsep" />
            <div className="tbtn primary" onClick={save}><Save /><span>{t("custForm.save")}</span></div>
            {dirty && <span style={{ marginLeft: 12, fontSize: 12, color: "#b28600", whiteSpace: "nowrap" }}>● {t("custFields.unsaved")}</span>}
          </div>

          <div className="crm-body">
            <div className="set-head">{t("custFields.optionsTitle")} · {doc}</div>
            <div className="set-sub">{t("custFields.optionsHint")}</div>

            {selectFields.length === 0 ? (
              <div className="card"><div style={{ padding: 16 }}><div className="set-hint">{t("custFields.noSelectField")}</div></div></div>
            ) : (
              selectFields.map((k) => (
                <div key={k} className="card">
                  <div className="sh">{label(k)} <span className="ff-count" style={{ marginLeft: 6 }}>{(opts[k] || []).length}</span></div>
                  <div style={{ padding: "14px 16px" }}>
                    <div className="opt-chips">
                      {(opts[k] || []).map((v) => (
                        <span key={v} className="opt-chip">{v}<button type="button" onClick={() => removeOpt(k, v)}>×</button></span>
                      ))}
                      <input className="opt-add" value={newOpt[k] || ""} placeholder={t("custFields.addOption")}
                        onChange={(e) => setNewOpt((n) => ({ ...n, [k]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOpt(k, newOpt[k] || ""); setNewOpt((n) => ({ ...n, [k]: "" })); } }} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
