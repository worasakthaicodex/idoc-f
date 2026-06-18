import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Help, Shield, ArrowLeft, Search, Plus, X, Save } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import { hrMenu } from "./hrMenu";
import { canAccessHrSettings } from "./hrAccess";
import { EMP_FIELDS, PRESETS } from "./employeeFields";
import { getEnabledFields, setEnabledFields } from "./employeeFieldConfig";
import "./empform.css";

export default function EmployeeFieldsSettings() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();
  const [used, setUsed] = useState<string[]>(getEnabledFields());
  const [initial] = useState<string[]>(() => getEnabledFields());
  const [q, setQ] = useState("");
  const dragKey = useRef<string | null>(null);
  const [overUsed, setOverUsed] = useState(false);
  const [overAvail, setOverAvail] = useState(false);

  const label = (k: string) => t(`empFields.${k}`);
  const groupOf = (k: string) => EMP_FIELDS.find((f) => f.key === k)?.group ?? "";
  const isCore = (k: string) => !!EMP_FIELDS.find((f) => f.key === k)?.core;

  // แก้แบบ draft — บันทึกจริงตอนกดปุ่ม Save เท่านั้น
  const add = (k: string) => { if (!used.includes(k)) setUsed([...used, k]); };
  const remove = (k: string) => { if (!isCore(k)) setUsed(used.filter((x) => x !== k)); };
  const save = () => {
    setEnabledFields(used);
    nav("/hr/settings");
  };
  const dirty = used.length !== initial.length || used.some((k, i) => k !== initial[i]);

  const avail = EMP_FIELDS.map((f) => f.key).filter((k) => !used.includes(k))
    .filter((k) => label(k).toLowerCase().includes(q.toLowerCase()) || k.toLowerCase().includes(q.toLowerCase()));

  // drag & drop
  const start = (k: string) => () => { dragKey.current = k; };
  const dropOnUsed = (beforeKey?: string) => (e: React.DragEvent) => {
    e.preventDefault(); setOverUsed(false);
    const k = dragKey.current; dragKey.current = null;
    if (!k) return;
    let arr = used.filter((x) => x !== k);
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
    return <div className="p-empform"><div className="ef-body"><div className="ef-banner err">{t("empForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("empForm.goLogin")}</button></div></div>;
  }
  const allowed = canAccessHrSettings(session);

  return (
    <div className="p-empform">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="doctitle" style={{ paddingLeft: 14 }}>{t("empFields.crumb")}</div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="ef-main">
        <div className="ef-side">
          <div className="side-title">{t("hr.title")}</div>
          {hrMenu.map((m) => (
            <div key={m.key} className={`side-item${m.enabled ? "" : " disabled"}`} onClick={() => { if (m.key === "core") nav("/hr"); }}>
              <m.Icon size={17} /><span>{t(`hr.menu.${m.key}`)}</span>{!m.enabled && <span className="soon">{t("common.soon")}</span>}
            </div>
          ))}
          <div className="side-divider" />
          <div className="side-item active" onClick={() => nav("/hr/settings")}>
            <Shield size={17} /><span>{t("hr.menu.settings")}</span>
          </div>
        </div>

        <div className="ef-content">
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav("/hr/settings")}><ArrowLeft /><span>{t("common.back")}</span></div>
            <div className="tbsep" />
            <div className="tbtn primary" onClick={save}><Save /><span>{t("common.save")}</span></div>
            {dirty && <span style={{ marginLeft: 12, fontSize: 12, color: "#b28600", whiteSpace: "nowrap" }}>● {t("empFields.unsaved")}</span>}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12.5, color: "var(--txt2)" }}>{t("empFields.presets")}:</span>
              {PRESETS.map((p) => (
                <div key={p.id} className="tbtn" style={{ fontSize: 12.5 }} onClick={() => setUsed(p.keys)}>{t(`empFields.preset.${p.id}`)}</div>
              ))}
            </div>
          </div>

          <div className="ef-body">
            {!allowed ? (
              <div className="ef-banner err">{t("hrSettings.noAccess")}</div>
            ) : (
              <>
                <div className="ef-head">{t("empFields.title")}</div>
                <div className="ef-sub">{t("empFields.dragHint")}</div>

                <div className="ff-cols">
                  {/* ฟิลด์ที่ใช้ */}
                  <div className={`ff-panel${overUsed ? " over" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setOverUsed(true); }}
                    onDragLeave={() => setOverUsed(false)}
                    onDrop={dropOnUsed()}>
                    <div className="ff-head">{t("empFields.used")} <span className="ff-count">{used.length}</span></div>
                    <div className="ff-list">
                      {used.map((k) => (
                        <div key={k} className="ff-item used" draggable onDragStart={start(k)}
                          onDragOver={(e) => e.preventDefault()} onDrop={dropOnUsed(k)}>
                          <span className="ff-grip">⠿</span>
                          <span className="ff-label">{label(k)}</span>
                          <span className="ff-tag">{t(`empFields.group.${groupOf(k)}`)}</span>
                          {isCore(k)
                            ? <span className="ff-core">core</span>
                            : <button className="ff-act" title={t("common.cancel")} onClick={() => remove(k)}><X size={13} /></button>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ฟิลด์ที่มี */}
                  <div className={`ff-panel${overAvail ? " over" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setOverAvail(true); }}
                    onDragLeave={() => setOverAvail(false)}
                    onDrop={dropOnAvail}>
                    <div className="ff-head">{t("empFields.available")} <span className="ff-count">{avail.length}</span></div>
                    <div className="ff-search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("empFields.search")} /></div>
                    <div className="ff-list">
                      {avail.length === 0 && <div className="ef-hint" style={{ padding: 8 }}>{t("empFields.emptyAvail")}</div>}
                      {avail.map((k) => (
                        <div key={k} className="ff-item" draggable onDragStart={start(k)}>
                          <span className="ff-label">{label(k)}</span>
                          <span className="ff-tag">{t(`empFields.group.${groupOf(k)}`)}</span>
                          <button className="ff-act add" title={t("common.save")} onClick={() => add(k)}><Plus size={13} /></button>
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
