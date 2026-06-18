import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { apiFetch } from "../../shared/api";
import { ChevronDown, ChevronLeft, ChevronRight, Help, ArrowLeft, Grid, Save, Plus, X, Shield, Edit, CheckCircle, Workflow } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import WorkflowSide from "./WorkflowSide";
import { listDepartments, listDivisions } from "../hr/orgStore";
import {
  docTypesOf, docTypeName, fetchStages, fetchAuthorities, saveAuthoritiesApi, newAuthority, emptyAssign, memberIsEmpty, fetchModuleUsers,
  type Authority, type MemberMode, type MemberRule, type Stage, type StageKind, type StageAssign,
} from "./workflowConfig";

import "./workflow.css";

const KIND_COLOR: Record<StageKind, string> = { WORK: "#0a84ff", REVIEW: "#ff9500", APPROVE: "#34c759", DONE: "#8e8e93" };
const KindIcon = ({ kind }: { kind: StageKind }) =>
  kind === "APPROVE" ? <Shield size={13} /> : kind === "REVIEW" ? <Edit size={13} /> : kind === "DONE" ? <CheckCircle size={13} /> : <Workflow size={13} />;

const MODES: MemberMode[] = ["ALL", "USERS", "ORG"];

type Options = { users: string[]; positions: string[]; departments: string[]; divisions: string[] };

/** ค้นหา + เลือกได้หลายอัน (จากรายการจริง) — กันพิมพ์เองผิด */
function PickList({ values, options, onChange, ph }: { values: string[]; options: string[]; onChange: (v: string[]) => void; ph: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const avail = options.filter((o) => !values.includes(o) && o.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="wf-pick">
      <div className="wf-chips" onClick={() => setOpen(true)}>
        {values.map((v) => (
          <span className="wf-chip" key={v}>{v}<button onClick={(e) => { e.stopPropagation(); onChange(values.filter((x) => x !== v)); }}><X size={11} /></button></span>
        ))}
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={values.length ? "" : ph}
        />
      </div>
      {open && avail.length > 0 && (
        <div className="wf-pick-menu">
          {avail.slice(0, 50).map((o) => (
            <div className="wf-pick-item" key={o} onMouseDown={(e) => { e.preventDefault(); onChange([...values, o]); setQ(""); }}>{o}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkflowAuthorityPage() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const session = getSession();
  const tenant = session?.companyId ?? "";
  const [sp] = useSearchParams();
  const MODULE = sp.get("module") || "crm";
  const docTypes = docTypesOf(MODULE);
  const [docType, setDocType] = useState(docTypes[0].code);
  const [stages, setStages] = useState<Stage[]>([]);
  const [list, setList] = useState<Authority[]>([]);
  const [initial, setInitial] = useState<string>("[]");
  const [opts, setOpts] = useState<Options>({ users: [], positions: [], departments: [], divisions: [] });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    fetchStages(docType).then((s) => { if (alive) setStages(s); });
    fetchAuthorities(docType).then((a) => { if (alive) { setList(a); setInitial(JSON.stringify(a)); } });
    return () => { alive = false; };
  }, [docType]);

  // โหลดรายการจริงให้เลือก (คน/ตำแหน่ง/แผนก/ฝ่าย)
  useEffect(() => {
    if (!tenant) return;
    // People = เฉพาะคนที่มีสิทธิ์อย่างน้อย user ของโมดูลนี้ (ตามตำแหน่ง) — คนอื่นเข้าใช้ไม่ได้อยู่แล้ว
    fetchModuleUsers(MODULE)
      .then((users) => setOpts((o) => ({ ...o, users })))
      .catch(() => {});
    apiFetch<{ name: string }[]>("/admin/positions", { tenant })
      .then((ps) => setOpts((o) => ({ ...o, positions: ps.map((x) => x.name).filter(Boolean) })))
      .catch(() => {});
    listDepartments().then((d) => setOpts((o) => ({ ...o, departments: d.map((x) => x.name).filter(Boolean) }))).catch(() => {});
    listDivisions().then((d) => setOpts((o) => ({ ...o, divisions: d.map((x) => x.name).filter(Boolean) }))).catch(() => {});
  }, [tenant]);

  const dirty = JSON.stringify(list) !== initial;

  const pickDoc = (dt: string) => setDocType(dt);
  const patch = (i: number, p: Partial<Authority>) => setList(list.map((a, idx) => (idx === i ? { ...a, ...p } : a)));
  const assignOf = (a: Authority, sid: string): StageAssign => a.assigns[sid] ?? emptyAssign();
  const patchAssign = (ai: number, sid: string, p: Partial<StageAssign>) =>
    setList(list.map((a, idx) => (idx === ai ? { ...a, assigns: { ...a.assigns, [sid]: { ...assignOf(a, sid), ...p } } } : a)));
  const patchMember = (ai: number, sid: string, p: Partial<MemberRule>) =>
    patchAssign(ai, sid, { member: { ...assignOf(list[ai], sid).member, ...p } });

  const addAuth = () => setList([...list, newAuthority()]);
  const removeAuth = (i: number) => setList(list.filter((_, idx) => idx !== i));
  const moveAuth = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
  };
  const save = async () => { await saveAuthoritiesApi(docType, list); setInitial(JSON.stringify(list)); };

  const toggle = (k: string) => setExpanded((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const summary = (m: MemberRule) =>
    m.mode === "ALL" ? t("workflow.auth.mode.ALL")
      : m.mode === "USERS" ? `${t("workflow.auth.mode.USERS")} (${m.users.length})`
        : `${t("workflow.auth.mode.ORG")} (${m.positions.length + m.departments.length + m.divisions.length})`;

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
                  <div className="set-head">{t("workflow.auth.title")}</div>
                  <div className="set-sub">{t("workflow.auth.sub")}</div>
                </div>
                <div className="wf-docbar">
                  <span style={{ fontSize: 13, color: "var(--txt2)" }}>{t("workflow.stages.docType")}:</span>
                  <select value={docType} onChange={(e) => pickDoc(e.target.value)} className="wf-dt-select">
                    {docTypes.map((d) => <option key={d.code} value={d.code}>{docTypeName(d.code, lang)}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ fontSize: 12, color: "var(--txt3)", margin: "4px 0 10px" }}>{t("workflow.auth.orderHint")}</div>

              {stages.length === 0 && <div className="banner err" style={{ marginBottom: 12 }}>{t("workflow.auth.noStages", { defaultValue: "ยังไม่ได้ตั้งขั้นตอน — ไปตั้งที่หน้า ขั้นตอน ก่อน" })}</div>}

              <div className="wf-auth-list">
                {list.length === 0 && <div style={{ fontSize: 13, color: "var(--txt3)", padding: "8px 0" }}>{t("workflow.auth.empty")}</div>}
                {list.map((a, i) => (
                  <div className="wf-auth" key={a.id}>
                    <div className="wf-auth-head">
                      <div className="wf-st-kind" style={{ background: "#5e5ce6" }}><Shield size={14} /></div>
                      <input className="wf-auth-name" value={a.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder={t("workflow.auth.namePh")} />
                      <input className="wf-auth-note" value={a.note ?? ""} onChange={(e) => patch(i, { note: e.target.value })} placeholder={t("workflow.auth.notePh", { defaultValue: "หมายเหตุ — เช่น สำหรับทีม B" })} />
                      <div style={{ display: "flex", gap: 3, marginLeft: "auto" }}>
                        <button className="wf-ibtn" disabled={i === 0} onClick={() => moveAuth(i, -1)} title="↑"><ChevronLeft size={14} style={{ transform: "rotate(90deg)" }} /></button>
                        <button className="wf-ibtn" disabled={i === list.length - 1} onClick={() => moveAuth(i, 1)} title="↓"><ChevronRight size={14} style={{ transform: "rotate(90deg)" }} /></button>
                        <button className="wf-ibtn danger" onClick={() => removeAuth(i)}><X size={14} /></button>
                      </div>
                    </div>

                    {/* กล่องย่อย = 1 ต่อ stage (ยุบได้) ระบุว่าใครนั่งทำ */}
                    <div className="wf-auth-body">
                      <div className="wf-levels">
                        {stages.map((s) => {
                          const as = assignOf(a, s.id);
                          const ek = a.id + ":" + s.id;
                          const open = expanded.has(ek);
                          return (
                            <div className="wf-level" key={s.id}>
                              <div className="wf-level-head wf-collapsible" onClick={() => toggle(ek)}>
                                <span className="wf-level-no" style={{ background: KIND_COLOR[s.kind] }}><KindIcon kind={s.kind} /></span>
                                <span className="wf-level-title">{s.name}</span>
                                <span className="wf-level-kind">{t(`workflow.stages.kind.${s.kind}`)}</span>
                                {!open && <span className="wf-level-sum">{summary(as.member)}</span>}
                                <ChevronDown size={16} style={{ transform: open ? "rotate(180deg)" : "none", color: "var(--txt3)" }} />
                              </div>

                              {open && (
                                <div className="wf-level-body">
                                  <div className="wf-seg">
                                    {MODES.map((m) => (
                                      <button key={m} className={as.member.mode === m ? "on" : ""} onClick={() => patchMember(i, s.id, { mode: m })}>{t(`workflow.auth.mode.${m}`)}</button>
                                    ))}
                                  </div>

                                  {as.member.mode === "ALL" && <div style={{ fontSize: 12, color: "var(--txt3)", marginTop: 6 }}>{t("workflow.auth.allHint")}</div>}
                                  {as.member.mode === "USERS" && (
                                    <div style={{ marginTop: 8 }}>
                                      <label className="wf-lbl">{t("workflow.auth.users")}</label>
                                      <PickList values={as.member.users} options={opts.users} onChange={(v) => patchMember(i, s.id, { users: v })} ph={t("workflow.auth.searchPh", { defaultValue: "ค้นหาเพื่อเลือก…" })} />
                                    </div>
                                  )}
                                  {as.member.mode === "ORG" && (
                                    <div className="wf-org">
                                      <div><label className="wf-lbl">{t("workflow.auth.positions")}</label><PickList values={as.member.positions} options={opts.positions} onChange={(v) => patchMember(i, s.id, { positions: v })} ph={t("workflow.auth.searchPh", { defaultValue: "ค้นหาเพื่อเลือก…" })} /></div>
                                      <div><label className="wf-lbl">{t("workflow.auth.departments")}</label><PickList values={as.member.departments} options={opts.departments} onChange={(v) => patchMember(i, s.id, { departments: v })} ph={t("workflow.auth.searchPh", { defaultValue: "ค้นหาเพื่อเลือก…" })} /></div>
                                      <div><label className="wf-lbl">{t("workflow.auth.divisions")}</label><PickList values={as.member.divisions} options={opts.divisions} onChange={(v) => patchMember(i, s.id, { divisions: v })} ph={t("workflow.auth.searchPh", { defaultValue: "ค้นหาเพื่อเลือก…" })} /></div>
                                    </div>
                                  )}

                                  {memberIsEmpty(as.member) && <div className="wf-warn">⚠ {t("workflow.auth.warnEmpty")}</div>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="wf-add">
                <button className="btn" onClick={addAuth}><Plus size={14} />{t("workflow.auth.add")}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
