import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { ChevronDown, Help, ArrowLeft, Workflow, Grid, Save, Plus, X, ChevronLeft, ChevronRight, CheckCircle, Edit, Shield } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import WorkflowSide from "./WorkflowSide";
import { docTypesOf, docTypeName, fetchStages, saveStagesApi, newStage, ADDABLE_KINDS, type Stage, type StageKind } from "./workflowConfig";
import { DOC_STAGE_GROUPS } from "../sales/salesFields";

import "./workflow.css";

const KIND_COLOR: Record<StageKind, string> = { WORK: "#0a84ff", REVIEW: "#ff9500", APPROVE: "#34c759", DONE: "#8e8e93" };

export default function WorkflowStagesPage() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const session = getSession();
  const [sp] = useSearchParams();
  const MODULE = sp.get("module") || "crm"; // workflow เข้าจากโมดูลไหน → โชว์เฉพาะเอกสารของโมดูลนั้น
  const docTypes = docTypesOf(MODULE);
  const [docType, setDocType] = useState(docTypes[0].code);
  const [stages, setStagesState] = useState<Stage[]>([]);
  const [initial, setInitial] = useState<string>("[]");

  const dirty = JSON.stringify(stages) !== initial;
  const lastIdx = stages.length - 1;

  // ตัวเลือก "กลุ่มข้อมูล (ตามบทบาท)" ของ WORK stage — มีเฉพาะเอกสารที่แบ่งกลุ่ม (เช่น FO) · CL ไม่มี
  const groupOpts = useMemo<{ key: string; label: string }[]>(() => {
    if (MODULE !== "sales") return [];
    return (DOC_STAGE_GROUPS[docType] ?? []).map((g) => ({ key: g, label: t(`salesFields.group.${g}`) }));
  }, [MODULE, docType, t]);
  const toggleGroup = (i: number, key: string) => {
    const cur = stages[i].groups ?? [];
    patch(i, { groups: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key] });
  };

  useEffect(() => {
    let alive = true;
    fetchStages(docType).then((s) => { if (alive) { setStagesState(s); setInitial(JSON.stringify(s)); } });
    return () => { alive = false; };
  }, [docType]);

  const pickDocType = (dt: string) => setDocType(dt);
  const update = (next: Stage[]) => setStagesState(next);
  const patch = (i: number, p: Partial<Stage>) => update(stages.map((s, idx) => (idx === i ? { ...s, ...p } : s)));

  const canMoveUp = (i: number) => i > 1 && !stages[i].pinned;            // เหนือสุดของ "ตรงกลาง" คือ index 1
  const canMoveDown = (i: number) => i < lastIdx - 1 && !stages[i].pinned; // ใต้สุดคือ index lastIdx-1
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    const next = [...stages];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };
  const remove = (i: number) => { if (!stages[i].pinned) update(stages.filter((_, idx) => idx !== i)); };
  const add = (kind: StageKind) => {
    const name = t(`workflow.stages.kind.${kind}`);
    update([...stages.slice(0, lastIdx), newStage(kind, name), stages[lastIdx]]); // แทรกก่อนท้าย
  };
  const save = async () => { await saveStagesApi(docType, stages); setInitial(JSON.stringify(stages)); };

  if (!session) {
    return <div className="p-workflow"><div className="wf-body"><div className="banner err">{t("workflow.notLoggedIn", { defaultValue: "ยังไม่ได้เข้าสู่ระบบ" })}</div><button className="btn primary" onClick={() => nav("/login")}>{t("common.backHome")}</button></div></div>;
  }

  return (
    <div className="p-workflow">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex" }}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{MODULE === "product" ? t("product.title") : MODULE === "sales" ? t("home.tiles.sales.title") : t("customer.title")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="wf-main">
        <WorkflowSide module={MODULE} />
        <div className="wf-content">
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav(`/workflow?module=${MODULE}`)}><ArrowLeft /><span>{t("common.back")}</span></div>
            <div className="tbsep" />
            <div className="tbtn primary" onClick={save}><Save /><span>{t("common.save")}</span></div>
            {dirty && <span style={{ marginLeft: 12, fontSize: 12, color: "#b28600", whiteSpace: "nowrap" }}>● {t("empFields.unsaved")}</span>}
          </div>

      <div className="wf-body">
        <div className="wf-inner">
          <div className="wf-toprow">
            <div>
              <div className="set-head">{t("workflow.stages.title")}</div>
              <div className="set-sub">{t("workflow.stages.sub")}</div>
            </div>
            <div className="wf-docbar">
              <span style={{ fontSize: 13, color: "var(--txt2)" }}>{t("workflow.stages.docType")}:</span>
              <select value={docType} onChange={(e) => pickDocType(e.target.value)} className="wf-dt-select">
                {docTypes.map((d) => <option key={d.code} value={d.code}>{docTypeName(d.code, lang)}</option>)}
              </select>
            </div>
          </div>

          {/* stage list */}
          <div className="wf-stages">
            {stages.map((s, i) => {
              const showGroups = s.kind === "WORK" && groupOpts.length > 0;
              return (
              <div className="wf-st-wrap" key={s.id}>
                <div className="wf-st">
                  <div className="wf-st-kind" style={{ background: KIND_COLOR[s.kind] }}>
                    {s.kind === "APPROVE" ? <Shield size={14} /> : s.kind === "REVIEW" ? <Edit size={14} /> : s.kind === "DONE" ? <CheckCircle size={14} /> : <Workflow size={14} />}
                  </div>
                  <input className="wf-st-name" value={s.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder={t("workflow.stages.namePh")} />

                  {/* ป้ายตรึง หัว/ท้าย (คอลัมน์คงที่ — ว่างได้) */}
                  <div className="wf-st-pincell">
                    {s.pinned === "head" && <span className="wf-pin">{t("workflow.stages.head")}</span>}
                    {s.pinned === "tail" && <span className="wf-pin">{t("workflow.stages.tail")}</span>}
                  </div>

                  {/* kind select (ตรึงสำหรับหัว/ท้าย) */}
                  <select className="wf-st-kindsel" value={s.kind} disabled={!!s.pinned} onChange={(e) => patch(i, { kind: e.target.value as StageKind })}>
                    {(s.pinned ? [s.kind] : ADDABLE_KINDS).map((k) => <option key={k} value={k}>{t(`workflow.stages.kind.${k}`)}</option>)}
                  </select>

                  {/* per-kind rule (คอลัมน์ยืด) — กลุ่มข้อมูลย้ายไปแถวล่าง ให้แถวบนสะอาด */}
                  <div className="wf-st-mid">
                    {s.kind === "DONE" && (
                      <label className="wf-st-rule" title={t("workflow.stages.outcomeHint")}>
                        <input type="checkbox" checked={!!s.outcome} onChange={(e) => patch(i, { outcome: e.target.checked })} /><CheckCircle size={12} />{t("workflow.stages.outcome")}
                      </label>
                    )}
                  </div>

                  {/* move / remove */}
                  <div className="wf-st-act">
                    {!s.pinned && <>
                      <button className="wf-ibtn" disabled={!canMoveUp(i)} onClick={() => move(i, -1)} title="↑"><ChevronLeft size={14} style={{ transform: "rotate(90deg)" }} /></button>
                      <button className="wf-ibtn" disabled={!canMoveDown(i)} onClick={() => move(i, 1)} title="↓"><ChevronRight size={14} style={{ transform: "rotate(90deg)" }} /></button>
                      <button className="wf-ibtn danger" onClick={() => remove(i)} title={t("common.cancel")}><X size={14} /></button>
                    </>}
                  </div>
                </div>

                {/* แถวล่าง: เลือกกลุ่มข้อมูลที่ขั้นนี้รับผิดชอบ (เฉพาะ WORK ที่เอกสารแบ่งกลุ่ม) */}
                {showGroups && (
                  <div className="wf-st-groups" title={t("workflow.stages.groupHint", { defaultValue: "เลือกกลุ่มข้อมูลที่ขั้นนี้รับผิดชอบ (เลือกได้หลายกลุ่ม)" })}>
                    <span className="wf-grp-label">{t("workflow.stages.group", { defaultValue: "กลุ่มข้อมูล" })}</span>
                    <div className="wf-grp-chips">
                      {groupOpts.map((g) => {
                        const on = (s.groups ?? []).includes(g.key);
                        return <button key={g.key} type="button" className={"wf-grp-chip" + (on ? " on" : "")} onClick={() => toggleGroup(i, g.key)}>{g.label}</button>;
                      })}
                      {(s.groups ?? []).length === 0 && <span className="wf-grp-all">{t("workflow.stages.groupAll", { defaultValue: "— ทุกกลุ่ม —" })}</span>}
                    </div>
                  </div>
                )}
              </div>
              );
            })}
          </div>

          {/* add */}
          <div className="wf-add">
            <span style={{ fontSize: 12.5, color: "var(--txt2)" }}>{t("workflow.stages.addStage")}:</span>
            {ADDABLE_KINDS.map((k) => (
              <button key={k} className="btn" style={{ padding: "5px 12px" }} onClick={() => add(k)}><Plus size={14} />{t(`workflow.stages.kind.${k}`)}</button>
            ))}
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
