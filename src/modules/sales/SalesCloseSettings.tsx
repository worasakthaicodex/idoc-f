import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, Help, ArrowLeft, Save } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import SalesSide from "./SalesSide";
import {
  getCloseStrategies, setCloseStrategies, getLostReasons, setLostReasons,
  getAttachFileTypes, setAttachFileTypes, getRequiredCloseFiles, setRequiredCloseFiles,
} from "./salesCloseConfig";
import "../customer/customer.css";

/** ตั้งค่า "การปิดการขาย" (QT) — กลยุทธ / สาเหตุปิดไม่สำเร็จ / ชนิดไฟล์แนบ / ไฟล์บังคับก่อนปิด */
export default function SalesCloseSettings() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();

  const [strategies, setStrategies] = useState<string[]>(() => getCloseStrategies());
  const [lost, setLost] = useState<string[]>(() => getLostReasons());
  const [fileTypes, setFileTypes] = useState<string[]>(() => getAttachFileTypes());
  const [reqFiles, setReqFiles] = useState<string[]>(() => getRequiredCloseFiles());
  const [add, setAdd] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const addTo = (list: string[], setList: (v: string[]) => void, key: string) => {
    const v = (add[key] || "").trim();
    if (!v || list.includes(v)) return;
    setList([...list, v]); setAdd((a) => ({ ...a, [key]: "" })); setDirty(true);
  };
  const removeFrom = (list: string[], setList: (v: string[]) => void, v: string) => { setList(list.filter((x) => x !== v)); setDirty(true); };
  const toggleReq = (v: string) => { setReqFiles((r) => r.includes(v) ? r.filter((x) => x !== v) : [...r, v]); setDirty(true); };

  const save = () => {
    setCloseStrategies(strategies);
    setLostReasons(lost);
    setAttachFileTypes(fileTypes);
    setRequiredCloseFiles(reqFiles.filter((r) => fileTypes.includes(r)));
    nav("/sales/settings");
  };

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err">{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("custForm.goLogin")}</button></div></div>;
  }

  const chipCard = (title: string, list: string[], setList: (v: string[]) => void, key: string) => (
    <div className="card">
      <div className="sh">{title} <span className="ff-count" style={{ marginLeft: 6 }}>{list.length}</span></div>
      <div style={{ padding: "14px 16px" }}>
        <div className="opt-chips">
          {list.map((v) => (
            <span key={v} className="opt-chip">{v}<button type="button" onClick={() => removeFrom(list, setList, v)}>×</button></span>
          ))}
          <input className="opt-add" value={add[key] || ""} placeholder={t("salesDoc.addOption")}
            onChange={(e) => setAdd((a) => ({ ...a, [key]: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTo(list, setList, key); } }} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>iDoc ERP</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{t("salesDoc.closeSettings")}</span><ChevronDown size={14} />
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
            <div className="set-head">{t("salesDoc.closeSettings")}</div>
            <div className="set-sub">{t("salesDoc.closeSettingsHint")}</div>

            {chipCard(t("salesDoc.cfgStrategies"), strategies, setStrategies, "strat")}
            {chipCard(t("salesDoc.cfgLostReasons"), lost, setLost, "lost")}
            {chipCard(t("salesDoc.cfgFileTypes"), fileTypes, setFileTypes, "ftype")}

            <div className="card">
              <div className="sh">{t("salesDoc.cfgRequiredFiles")} <span className="ff-count" style={{ marginLeft: 6 }}>{reqFiles.length}</span></div>
              <div style={{ padding: "14px 16px" }}>
                <div className="set-hint" style={{ marginBottom: 10 }}>{t("salesDoc.cfgRequiredFilesHint")}</div>
                <div className="opt-chips">
                  {fileTypes.map((v) => (
                    <span key={v} className={`opt-chip${reqFiles.includes(v) ? " on" : ""}`} style={{ cursor: "pointer", ...(reqFiles.includes(v) ? { background: "#e7f0ff", borderColor: "var(--blue)", color: "var(--blue-d)" } : {}) }} onClick={() => toggleReq(v)}>
                      {reqFiles.includes(v) ? "✓ " : ""}{v}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
