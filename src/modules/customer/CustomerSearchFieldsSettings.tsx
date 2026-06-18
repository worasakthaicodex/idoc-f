import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, ArrowLeft, Plus, X, Save } from "../../shared/icons";
import CrmHelpButton from "./CrmHelpButton";
import LangSwitcher from "../../shared/LangSwitcher";
import CustomerSide from "./CustomerSide";
import { canAccessCrmSettings } from "./crmAccess";
import { getSearchFields, setSearchFields, searchableUniverse, DEFAULT_SEARCH, SEARCH_SPECIAL } from "./customerSearchConfig";
import "./customer.css";

export default function CustomerSearchFieldsSettings() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();
  const [used, setUsed] = useState<string[]>(getSearchFields());
  const [initial] = useState<string[]>(() => getSearchFields());
  const dragKey = useRef<string | null>(null);
  const [overUsed, setOverUsed] = useState(false);
  const [overAvail, setOverAvail] = useState(false);

  const label = (k: string) => (k === "code" ? t("customer.col.code") : t(`custFields.${k}`, { defaultValue: k }));
  const tag = (k: string) => (SEARCH_SPECIAL.includes(k) ? t("custColumns.special") : t("custColumns.field"));

  const add = (k: string) => { if (!used.includes(k)) setUsed([...used, k]); };
  const remove = (k: string) => setUsed(used.filter((x) => x !== k));
  const save = () => { setSearchFields(used); nav("/customer/settings"); };
  const dirty = used.length !== initial.length || used.some((k, i) => k !== initial[i]);

  const avail = searchableUniverse().filter((k) => !used.includes(k));

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
              <div className="tbtn" style={{ fontSize: 12.5 }} onClick={() => setUsed([...DEFAULT_SEARCH])}>{t("custColumns.reset")}</div>
            </div>
          </div>

          <div className="crm-body">
            {!allowed ? (
              <div className="banner err">{t("crmSettings.noAccess")}</div>
            ) : (
              <>
                <div className="set-head">{t("custSearch.title")}</div>
                <div className="set-sub">{t("custSearch.dragHint")}</div>

                <div className="ff-cols">
                  <div className={`ff-panel${overUsed ? " over" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setOverUsed(true); }}
                    onDragLeave={() => setOverUsed(false)}
                    onDrop={dropOnUsed()}>
                    <div className="ff-head">{t("custSearch.searchable")} <span className="ff-count">{used.length}</span></div>
                    <div className="ff-list">
                      {used.length === 0 && <div className="set-hint" style={{ padding: 8 }}>{t("custSearch.emptyShown")}</div>}
                      {used.map((k, i) => (
                        <div key={k} className="ff-item used" draggable onDragStart={start(k)}
                          onDragOver={(e) => e.preventDefault()} onDrop={dropOnUsed(k)}>
                          <span className="ff-grip">⠿</span>
                          <span className="ff-no">{i + 1}</span>
                          <span className="ff-label">{label(k)}</span>
                          <span className="ff-tag">{tag(k)}</span>
                          <button className="ff-act" title={t("common.cancel")} onClick={() => remove(k)}><X size={13} /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`ff-panel${overAvail ? " over" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setOverAvail(true); }}
                    onDragLeave={() => setOverAvail(false)}
                    onDrop={dropOnAvail}>
                    <div className="ff-head">{t("custColumns.available")} <span className="ff-count">{avail.length}</span></div>
                    <div className="ff-list">
                      {avail.length === 0 && <div className="set-hint" style={{ padding: 8 }}>{t("custFields.emptyAvail")}</div>}
                      {avail.map((k) => (
                        <div key={k} className="ff-item" draggable onDragStart={start(k)}>
                          <span className="ff-label">{label(k)}</span>
                          <span className="ff-tag">{tag(k)}</span>
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
