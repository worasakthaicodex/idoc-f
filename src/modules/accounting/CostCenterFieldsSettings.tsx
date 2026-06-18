import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Grid, ChevronDown, Help, ArrowLeft, Plus, X, Save } from "../../shared/icons";
import { useTranslation } from "react-i18next";
import LangSwitcher from "../../shared/LangSwitcher";
import { getSession } from "../../shared/session";
import AccountingSide from "./AccountingSide";
import { CC_FIELDS, CC_CORE_KEYS, getEnabledCCFields, setEnabledCCFields, ccFieldDesc, ccFieldLabel, ccReqTypeLabel } from "./costCenterStore";
import "../customer/customer.css";

/**
 * ฟิลด์ข้อมูล Cost Center — เลือก/จัดลำดับฟิลด์ที่ใช้ (แบบเดียวกับ /customer/settings/fields)
 * REQUIRED + SYSTEM = ล็อกไว้ฝั่งซ้าย เอาออกไม่ได้ · OPTIONAL ลาก เพิ่ม/เอาออก ได้
 */
export default function CostCenterFieldsSettings() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const thai = i18n.language.startsWith("th");
  const T = (a: string, b: string) => (thai ? a : b);
  const session = getSession();

  const [used, setUsed] = useState<string[]>(() => getEnabledCCFields());
  const [initial] = useState<string[]>(() => getEnabledCCFields());
  const dragKey = useRef<string | null>(null);
  const [overUsed, setOverUsed] = useState(false);
  const [overAvail, setOverAvail] = useState(false);

  const fieldOf = (k: string) => CC_FIELDS.find((f) => f.key === k);
  const label = (k: string) => { const f = fieldOf(k); return f ? ccFieldLabel(f, thai) : k; };
  const tag = (k: string) => { const f = fieldOf(k); return f ? ccReqTypeLabel(f.reqType, thai) : ""; };
  const descOf = (k: string) => { const f = fieldOf(k); return f ? ccFieldDesc(f, thai) : undefined; };
  const isCore = (k: string) => CC_CORE_KEYS.includes(k);

  const add = (k: string) => { if (!used.includes(k)) setUsed([...used, k]); };
  const remove = (k: string) => { if (!isCore(k)) setUsed(used.filter((x) => x !== k)); };
  const save = () => { setEnabledCCFields(used); nav("/accounting/settings"); };
  const dirty = used.length !== initial.length || used.some((k, i) => k !== initial[i]);

  const avail = CC_FIELDS.map((f) => f.key).filter((k) => !used.includes(k));

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

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{t("home.tiles.accounting.title")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <AccountingSide active="settings" />

        <div className="crm-content">
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav("/accounting/settings")}><ArrowLeft /><span>{t("custForm.back")}</span></div>
            <div className="tbsep" />
            <div className="tbtn primary" onClick={save}><Save /><span>{t("custForm.save")}</span></div>
            {dirty && <span style={{ marginLeft: 12, fontSize: 12, color: "#b28600", whiteSpace: "nowrap" }}>● {t("custFields.unsaved")}</span>}
            <div style={{ marginLeft: "auto" }}>
              <div className="tbtn" style={{ fontSize: 12.5 }} onClick={() => setUsed(CC_FIELDS.map((f) => f.key))}>{T("ค่าเริ่มต้น (ทั้งหมด)", "Defaults (all)")}</div>
            </div>
          </div>

          <div className="crm-body">
            <div className="set-head">{T("ฟิลด์ข้อมูล Cost Center", "Cost Center fields")}</div>
            <div className="set-sub">{T("เลือก/จัดลำดับฟิลด์ที่บริษัทใช้ — ฟิลด์ “จำเป็น” (REQUIRED) และ “ระบบ” (SYSTEM) ถูกล็อกไว้ เอาออกไม่ได้", "Choose and order the fields your company uses — REQUIRED and SYSTEM fields are locked and cannot be removed")}</div>

            <div className="ff-cols">
              <div className={`ff-panel${overUsed ? " over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setOverUsed(true); }} onDragLeave={() => setOverUsed(false)} onDrop={dropOnUsed()}>
                <div className="ff-head">{T("ที่เลือก", "Selected")} <span className="ff-count">{used.length}</span></div>
                <div className="ff-list">
                  {used.map((k, i) => (
                    <div key={k} className="ff-item used" title={descOf(k)} draggable onDragStart={start(k)} onDragOver={(e) => e.preventDefault()} onDrop={dropOnUsed(k)}>
                      <span className="ff-grip">⠿</span><span className="ff-no">{i + 1}</span>
                      <span className="ff-label">{label(k)}</span><span className="ff-tag">{tag(k)}</span>
                      {isCore(k) ? <span className="ff-core">{T("ล็อก", "locked")}</span> : <button className="ff-act" onClick={() => remove(k)}><X size={13} /></button>}
                    </div>
                  ))}
                </div>
              </div>

              <div className={`ff-panel${overAvail ? " over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setOverAvail(true); }} onDragLeave={() => setOverAvail(false)} onDrop={dropOnAvail}>
                <div className="ff-head">{T("เลือกเพิ่มได้", "Add more")} <span className="ff-count">{avail.length}</span></div>
                <div className="ff-list">
                  {avail.map((k) => (
                    <div key={k} className="ff-item" title={descOf(k)} draggable onDragStart={start(k)}>
                      <span className="ff-label">{label(k)}</span><span className="ff-tag">{tag(k)}</span>
                      <button className="ff-act add" onClick={() => add(k)}><Plus size={13} /></button>
                    </div>
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
