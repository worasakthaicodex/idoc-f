import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, Help, ArrowLeft, Search, Plus, X, Save } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import SalesSide from "./SalesSide";
import { fieldsOf, presetsOf, coreKeysOf, docGroupsOf } from "./salesFields";
import { getEnabledFields, setEnabledFields, getGroupOverrides, setGroupOverrides } from "./salesFieldConfig";
import "../customer/customer.css";

/** เลือก/จัดเรียงฟิลด์ของเอกสารงานขาย — เอกสารที่มีหลายกลุ่ม ลากฟิลด์ลงกลุ่มได้ · ?doc=XX */
export default function SalesFieldsSettings() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();
  const [sp] = useSearchParams();
  const doc = sp.get("doc") || "CL";

  const [used, setUsed] = useState<string[]>(() => getEnabledFields(doc));
  const [groups, setGroups] = useState<Record<string, string>>(() => getGroupOverrides(doc));
  const [initU] = useState<string>(() => JSON.stringify(getEnabledFields(doc)));
  const [initG] = useState<string>(() => JSON.stringify(getGroupOverrides(doc)));
  const [q, setQ] = useState("");
  const dragKey = useRef<string | null>(null);
  const [overGrp, setOverGrp] = useState<string | null>(null);
  const [overAvail, setOverAvail] = useState(false);

  const label = (k: string) => t(`salesFields.${k}`, { defaultValue: k });
  const catGroup = (k: string) => fieldsOf(doc).find((f) => f.key === k)?.group ?? "general";
  const grpLabel = (g: string) => t(`salesFields.group.${g}`, { defaultValue: g });
  const coreSet = new Set(coreKeysOf(doc));
  const isCore = (k: string) => coreSet.has(k);

  // กลุ่ม = อ้างอิงจาก workflow stages (DOC_STAGE_GROUPS) ผ่าน docGroupsOf · ว่าง = เอกสารไม่มีกลุ่ม (เรียงเดี่ยว)
  const sections = docGroupsOf(doc);
  const flat = sections.length === 0;
  // กลุ่มของฟิลด์: override ถ้ามี ไม่งั้นกลุ่มแคตตาล็อก — แต่ clamp ให้อยู่ในกลุ่มที่เอกสารนี้มีจริง
  const gOf = (k: string) => { const g = groups[k] ?? catGroup(k); return flat ? g : (sections.includes(g as never) ? g : sections[0]); };
  const usedInGroup = (g: string) => used.filter((k) => gOf(k) === g);

  const remove = (k: string) => { if (isCore(k)) return; setUsed((u) => u.filter((x) => x !== k)); setGroups((m) => { const n = { ...m }; delete n[k]; return n; }); };
  const addToGroup = (k: string, g: string) => { setUsed((u) => (u.includes(k) ? u : [...u, k])); if (!flat) setGroups((m) => ({ ...m, [k]: g })); };

  const save = () => {
    setEnabledFields(doc, used);
    // เก็บเฉพาะ override ที่ต่างจากแคตตาล็อก + เฉพาะฟิลด์ที่ใช้อยู่
    const diff: Record<string, string> = {};
    used.forEach((k) => { const g = gOf(k); if (g !== catGroup(k)) diff[k] = g; });
    setGroupOverrides(doc, diff);
    nav("/sales/settings");
  };
  const dirty = JSON.stringify(used) !== initU || JSON.stringify(groups) !== initG;

  const avail = fieldsOf(doc).map((f) => f.key).filter((k) => !used.includes(k))
    .filter((k) => label(k).toLowerCase().includes(q.toLowerCase()) || k.toLowerCase().includes(q.toLowerCase()));

  const start = (k: string) => () => { dragKey.current = k; };
  // วางบนฟิลด์ → แทรกก่อนฟิลด์นั้น + ย้ายเข้ากลุ่มเดียวกับมัน
  const dropOnField = (beforeKey: string) => (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setOverGrp(null);
    const k = dragKey.current; dragKey.current = null;
    if (!k || k === beforeKey) return;
    if (!flat) setGroups((m) => ({ ...m, [k]: gOf(beforeKey) }));
    setUsed((prev) => { const arr = prev.filter((x) => x !== k); const i = arr.indexOf(beforeKey); arr.splice(i < 0 ? arr.length : i, 0, k); return arr; });
  };
  // วางบนกลุ่ม (พื้นที่ว่าง) → ต่อท้ายกลุ่มนั้น
  const dropOnGroup = (g: string) => (e: React.DragEvent) => {
    e.preventDefault(); setOverGrp(null);
    const k = dragKey.current; dragKey.current = null;
    if (!k) return;
    if (!flat) setGroups((m) => ({ ...m, [k]: g }));
    setUsed((prev) => {
      const arr = prev.filter((x) => x !== k);
      let idx = arr.length;
      for (let i = arr.length - 1; i >= 0; i--) { if (gOf(arr[i]) === g) { idx = i + 1; break; } }
      arr.splice(idx, 0, k); return arr;
    });
  };
  const dropOnAvail = (e: React.DragEvent) => { e.preventDefault(); setOverAvail(false); const k = dragKey.current; dragKey.current = null; if (k) remove(k); };

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err">{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("custForm.goLogin")}</button></div></div>;
  }

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>iDoc ERP</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{t("salesFields.title")}</span><ChevronDown size={14} />
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
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12.5, color: "var(--txt2)" }}>{t("custFields.presets")}:</span>
              {presetsOf(doc).map((p) => (
                <div key={p.id} className="tbtn" style={{ fontSize: 12.5 }} onClick={() => setUsed(p.keys)}>{t(`custFields.preset.${p.id}`)}</div>
              ))}
            </div>
          </div>

          <div className="crm-body">
            <div className="set-head">{t("salesFields.title")} · {doc}</div>
            <div className="set-sub">{t("salesFields.groupDragHint", { defaultValue: "ลากฟิลด์ไปวางในกลุ่มที่ต้องการ · ลากออกขวาเพื่อเอาออก" })}</div>

            <div className="ff-cols">
              {/* ที่ใช้ — จัดเป็นกลุ่ม ลากฟิลด์ลงกลุ่มได้ */}
              <div className="ff-panel">
                <div className="ff-head">{t("custFields.used")} <span className="ff-count">{used.length}</span></div>
                <div className="ff-list">
                  {flat ? (
                    <div className={`ff-group${overGrp === "" ? " over" : ""}`}
                      onDragOver={(e) => { e.preventDefault(); setOverGrp(""); }}
                      onDragLeave={() => setOverGrp((cur) => (cur === "" ? null : cur))}
                      onDrop={dropOnGroup("")}>
                      {used.map((k) => (
                        <div key={k} className="ff-item used" draggable onDragStart={start(k)}
                          onDragOver={(e) => e.preventDefault()} onDrop={dropOnField(k)}>
                          <span className="ff-grip">⠿</span>
                          <span className="ff-label">{label(k)}</span>
                          {isCore(k)
                            ? <span className="ff-core">core</span>
                            : <button className="ff-act" title={t("common.cancel")} onClick={() => remove(k)}><X size={13} /></button>}
                        </div>
                      ))}
                      {used.length === 0 && <div className="ff-empty">{t("salesFields.dropHere", { defaultValue: "— ลากฟิลด์มาที่นี่ —" })}</div>}
                    </div>
                  ) : sections.map((g) => (
                    <div key={g} className={`ff-group${overGrp === g ? " over" : ""}`}
                      onDragOver={(e) => { e.preventDefault(); setOverGrp(g); }}
                      onDragLeave={() => setOverGrp((cur) => (cur === g ? null : cur))}
                      onDrop={dropOnGroup(g)}>
                      <div className="ff-group-h">{grpLabel(g)} <span className="ff-count">{usedInGroup(g).length}</span></div>
                      {usedInGroup(g).map((k) => (
                        <div key={k} className="ff-item used" draggable onDragStart={start(k)}
                          onDragOver={(e) => e.preventDefault()} onDrop={dropOnField(k)}>
                          <span className="ff-grip">⠿</span>
                          <span className="ff-label">{label(k)}</span>
                          {isCore(k)
                            ? <span className="ff-core">core</span>
                            : <button className="ff-act" title={t("common.cancel")} onClick={() => remove(k)}><X size={13} /></button>}
                        </div>
                      ))}
                      {usedInGroup(g).length === 0 && <div className="ff-empty">{t("salesFields.dropHere", { defaultValue: "— ลากฟิลด์มาที่นี่ —" })}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* คลังฟิลด์ */}
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
                      <span className="ff-tag">{grpLabel(catGroup(k))}</span>
                      <button className="ff-act add" title={t("custForm.save")} onClick={() => addToGroup(k, catGroup(k))}><Plus size={13} /></button>
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
