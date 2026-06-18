import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, ArrowLeft, Search, Plus, X, Save } from "../../shared/icons";
import CrmHelpButton from "./CrmHelpButton";
import LangSwitcher from "../../shared/LangSwitcher";
import CustomerSide from "./CustomerSide";
import { canAccessCrmSettings } from "./crmAccess";
import { CUST_FIELDS, PRESETS } from "./customerFields";
import { getEnabledFields, setEnabledFields } from "./customerFieldConfig";
import "./customer.css";

export default function CustomerFieldsSettings() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();
  const [used, setUsed] = useState<string[]>(getEnabledFields());
  const [initial] = useState<string[]>(() => getEnabledFields());
  const [q, setQ] = useState("");
  const dragKey = useRef<string | null>(null);
  const [overUsed, setOverUsed] = useState(false);
  const [overAvail, setOverAvail] = useState(false);

  const label = (k: string) => t(`custFields.${k}`, { defaultValue: k });
  const groupOf = (k: string) => CUST_FIELDS.find((f) => f.key === k)?.group ?? "";
  const isCore = (k: string) => !!CUST_FIELDS.find((f) => f.key === k)?.core;

  const add = (k: string) => { if (!used.includes(k)) setUsed([...used, k]); };
  const remove = (k: string) => { if (!isCore(k)) setUsed(used.filter((x) => x !== k)); };
  const save = () => { setEnabledFields(used); nav("/customer/settings"); };
  const dirty = used.length !== initial.length || used.some((k, i) => k !== initial[i]);

  const avail = CUST_FIELDS.map((f) => f.key).filter((k) => !used.includes(k))
    .filter((k) => label(k).toLowerCase().includes(q.toLowerCase()) || k.toLowerCase().includes(q.toLowerCase()));

  const start = (k: string) => () => { dragKey.current = k; };
  const dropOnUsed = (beforeKey?: string) => (e: React.DragEvent) => {
    e.preventDefault(); setOverUsed(false);
    const k = dragKey.current; dragKey.current = null;
    if (!k) return;
    const arr = used.filter((x) => x !== k);
    if (beforeKey && beforeKey !== k) { const i = arr.indexOf(beforeKey); arr.splice(i < 0 ? arr.length : i, 0, k); }
    else arr.push(k);
    setUsed(arr);
  };
  const dropOnAvail = (e: React.DragEvent) => {
    e.preventDefault(); setOverAvail(false);
    const k = dragKey.current; dragKey.current = null;
    if (k) remove(k);
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
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12.5, color: "var(--txt2)" }}>{t("custFields.presets")}:</span>
              {PRESETS.map((p) => (
                <div key={p.id} className="tbtn" style={{ fontSize: 12.5 }} onClick={() => setUsed(p.keys)}>{t(`custFields.preset.${p.id}`)}</div>
              ))}
            </div>
          </div>

          <div className="crm-body">
            {!allowed ? (
              <div className="banner err">{t("crmSettings.noAccess")}</div>
            ) : (
              <>
                <div className="set-head">{t("custFields.title")}</div>
                <div className="set-sub">{t("custFields.dragHint")}</div>

                <div className="ff-cols">
                  <div className={`ff-panel${overUsed ? " over" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setOverUsed(true); }}
                    onDragLeave={() => setOverUsed(false)}
                    onDrop={dropOnUsed()}>
                    <div className="ff-head">{t("custFields.used")} <span className="ff-count">{used.length}</span></div>
                    <div className="ff-list">
                      {used.map((k) => (
                        <div key={k} className="ff-item used" draggable onDragStart={start(k)}
                          onDragOver={(e) => e.preventDefault()} onDrop={dropOnUsed(k)}>
                          <span className="ff-grip">⠿</span>
                          <span className="ff-label">{label(k)}</span>
                          <span className="ff-tag">{t(`custFields.group.${groupOf(k)}`)}</span>
                          {isCore(k)
                            ? <span className="ff-core">core</span>
                            : <button className="ff-act" title={t("common.cancel")} onClick={() => remove(k)}><X size={13} /></button>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`ff-panel${overAvail ? " over" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setOverAvail(true); }}
                    onDragLeave={() => setOverAvail(false)}
                    onDrop={dropOnAvail}>
                    <div className="ff-head">{t("custFields.available")} <span className="ff-count">{avail.length}</span></div>
                    <div className="ff-search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("custFields.search")} /></div>
                    <div className="ff-list">
                      {avail.length === 0 && <div className="set-hint" style={{ padding: 8 }}>{t("custFields.emptyAvail")}</div>}
                      {avail.map((k) => (
                        <div key={k} className="ff-item" draggable onDragStart={start(k)}>
                          <span className="ff-label">{label(k)}</span>
                          <span className="ff-tag">{t(`custFields.group.${groupOf(k)}`)}</span>
                          <button className="ff-act add" title={t("custForm.save")} onClick={() => add(k)}><Plus size={13} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
