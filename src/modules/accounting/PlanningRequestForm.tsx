import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Save, Check, CheckCircle, FileText, ChevronLeft, Building, X, Plus, Refresh } from "../../shared/icons";
import { getSession } from "../../shared/session";
import LangSwitcher from "../../shared/LangSwitcher";
import {
  fetchStages, fetchAuthorities, fetchModuleUsers, pickAuthorityFrame, memberAt, resolveCandidates,
  type Stage, type Authority,
} from "../workflow/workflowConfig";
import { loadCostCenters } from "./costCenterStore";
import {
  PLAN_TOPICS, PLAN_VERSIONS, planVersionLabel, planVersionDesc, planVersionReadonly, FY_OPTS, MONTHS, CE_MASTER,
  makeLine, lineTotal, planTotal, numOf, fmtNum, copyFromLastYear, isVersionLocked, commitApprovedPlan,
  DIST_METHODS, distWeights, spreadAnnual, type DistMethod,
  ACT_UNITS, ACT_PRESETS, actTotalRate, kspiRate, type PlanActivity,
  type PlanTopic, type PlanRequest, type PlanLine, type PlanPart,
  getPlanRequest, savePlanRequest, nextPlanReqCode,
} from "./planningStore";
import "../sales/qt.css";
import "../customer/request.css";
import "./planning.css";

const DT = "PLAN_REQUEST";

export default function PlanningRequestForm() {
  const nav = useNavigate();
  const { code } = useParams();
  const [sp] = useSearchParams();
  const { t, i18n } = useTranslation();
  const thai = i18n.language.startsWith("th");
  const T = (a: string, b: string) => (thai ? a : b);
  const session = getSession();
  const me = session?.fullName || session?.email || session?.companyCode || "—";

  const existing = useMemo(() => (code ? getPlanRequest(decodeURIComponent(code)) : null), [code]);

  const [tab, setTab] = useState<"info" | "grid" | "activity">("info");
  const [topic, setTopic] = useState<PlanTopic>(() => (existing?.topic ?? (sp.get("topic") as PlanTopic) ?? "PLAN"));
  const [pickCode, setPickCode] = useState(() => existing?.ccCode ?? "");
  const [planVersion, setPlanVersion] = useState(() => existing?.planVersion ?? "V1");
  const [fy, setFy] = useState(() => existing?.fy ?? "2026");
  const [mode, setMode] = useState<"DIRECT" | "ASSEMBLE">(() => existing?.mode ?? "DIRECT");
  const [note, setNote] = useState(() => existing?.values?.note ?? "");
  const [lines, setLines] = useState<PlanLine[]>(() => existing?.lines ?? CE_MASTER.map((c) => makeLine(c.code)));
  const [parts, setParts] = useState<PlanPart[]>(() => existing?.parts ?? []);
  const [activities, setActivities] = useState<PlanActivity[]>(() => existing?.activities ?? []);
  const [activePart, setActivePart] = useState("");   // โหมดแยก: ใบย่อยที่กำลังกรอก ("" = ดูภาพรวมประกอบ)
  const [compare, setCompare] = useState(true);       // โชว์อ้างอิงปีก่อน
  const [addCe, setAddCe] = useState("");
  const [distOpen, setDistOpen] = useState(false);    // popup เลือกวิธีปันส่วน

  const [collapsed, setCollapsed] = useState(false);
  const [err, setErr] = useState("");
  const [savedCode, setSavedCode] = useState<string | null>(existing?.code ?? null);
  const [saved, setSaved] = useState(!!existing);
  const [loadedPhase, setLoadedPhase] = useState(existing?.phase ?? null);
  const [received, setReceived] = useState(existing?.received);
  const bounce = existing?.bounce;
  const ccs = useMemo(() => loadCostCenters(), []);

  // ----- workflow runtime -----
  const [stages, setStages] = useState<Stage[]>([]);
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [moduleUsers, setModuleUsers] = useState<string[]>([]);
  const stageId = existing?.stageId;
  useEffect(() => {
    fetchStages(DT).then(setStages).catch(() => {});
    fetchAuthorities(DT).then(setAuthorities).catch(() => {});
    fetchModuleUsers("accounting").then(setModuleUsers).catch(() => {});
  }, []);

  const headIdx = Math.max(0, stages.findIndex((s) => s.pinned === "head"));
  const curStageIdx = stageId ? Math.max(0, stages.findIndex((s) => s.id === stageId)) : headIdx;
  const curStage: Stage | undefined = stages[curStageIdx];
  const nextStage: Stage | undefined = stages[curStageIdx + 1];
  const atApproveStage = curStage?.kind === "APPROVE";
  const atDone = curStage?.kind === "DONE" || loadedPhase === "DONE";
  const heldByMe = existing ? (existing.received ? existing.received.by === me : !existing.sent) : true;
  const canEditDoc = !atDone && !atApproveStage && heldByMe;
  const canReceive = loadedPhase === "RECEIVE" && !!existing?.sent && !received && !bounce;

  const lockedV0 = !!pickCode && isVersionLocked(pickCode, fy, planVersion);   // V0 อนุมัติแล้ว = ล็อกถาวร
  const isPY = planVersionReadonly(planVersion);                               // PY = ปีก่อน (อ่านอย่างเดียว)
  const locked = lockedV0 || isPY;
  const gridBaseEditable = canEditDoc && !locked;
  const activePartObj = parts.find((p) => p.id === activePart);
  const rowEditable = (l: PlanLine) => {
    if (!gridBaseEditable) return false;
    if (mode === "DIRECT") return true;
    return !!activePartObj && activePartObj.ceCodes.includes(l.ceCode);   // โหมดแยก: แก้ได้เฉพาะ CE ของใบย่อยที่เลือก
  };
  const visibleLines = mode === "ASSEMBLE" && activePartObj ? lines.filter((l) => activePartObj.ceCodes.includes(l.ceCode)) : lines;

  const creator = { fullName: session?.fullName, email: session?.email, employeeCode: session?.employeeCode };
  const frame = curStage && stages[headIdx] ? pickAuthorityFrame(authorities, stages[headIdx].id, creator) : null;
  const candidates = frame && nextStage ? resolveCandidates(memberAt(frame, nextStage.id), moduleUsers) : moduleUsers;

  const [flowOpen, setFlowOpen] = useState(false);
  const [flowTo, setFlowTo] = useState("");
  const [recvOpen, setRecvOpen] = useState(false);
  const [recvMode, setRecvMode] = useState<"accept" | "decline">("accept");
  const [recvReason, setRecvReason] = useState("");

  // ----- grid edit -----
  const dirty = () => setSaved(false);
  const setCell = (ceCode: string, m: number, v: string) => {
    setLines((ls) => ls.map((l) => l.ceCode === ceCode ? { ...l, cells: l.cells.map((c, i) => i === m ? { ...c, ty: v } : c) } : l));
    dirty();
  };
  const blurCell = (ceCode: string, m: number, v: string) => setCell(ceCode, m, v.trim() ? fmtNum(numOf(v)) : "");
  // กรอกยอดทั้งปีในช่อง TOTAL เอง → เก็บเป็น annual (รอกดปันส่วนกระจายลงเดือน)
  const setAnnual = (ceCode: string, v: string) => { setLines((ls) => ls.map((l) => l.ceCode === ceCode ? { ...l, annual: v } : l)); dirty(); };
  // เก็บ annual เฉพาะตอนค่าต่างจากผลรวมเดือน — focus/blur เฉยๆ ไม่ล็อกยอด (TOTAL ยังวิ่งตามเดือน)
  const blurAnnual = (ceCode: string, v: string) => {
    setLines((ls) => ls.map((l) => {
      if (l.ceCode !== ceCode) return l;
      const n = numOf(v);
      const sumMonths = l.cells.reduce((a, c) => a + numOf(c.ty), 0);
      return { ...l, annual: !v.trim() || n === sumMonths ? "" : fmtNum(n) };
    }));
    dirty();
  };
  const applyDistribute = (method: DistMethod) => {
    setDistOpen(false);
    if (method === "MANUAL") return;   // กรอกเอง — ไม่กระจาย
    const targets = mode === "ASSEMBLE" && activePartObj ? activePartObj.ceCodes : lines.map((l) => l.ceCode);
    const weights = distWeights(method, Number(fy));
    setLines((ls) => ls.map((l) => {
      if (!targets.includes(l.ceCode)) return l;
      const annual = lineTotal(l);   // ใช้ยอดที่กรอกใน TOTAL (annual) ถ้ามี · ไม่มีก็รวมจากเดือน
      if (annual <= 0) return l;
      const months = spreadAnnual(annual, weights);
      return { ...l, annual: "", cells: l.cells.map((c, i) => ({ ...c, ty: months[i] ? fmtNum(months[i]) : "" })) };
    }));
    dirty();
  };
  const doCopy = () => {
    if (!pickCode) { setErr(T("เลือก Cost Center ก่อน Copy", "Pick a Cost Center before copying")); setTab("info"); return; }
    if (!window.confirm(T(`ดึงแผนปี ${Number(fy) - 1} มาตั้งต้น? (ทับค่าที่กรอกไว้)`, `Copy plan from FY ${Number(fy) - 1}? (overwrites current)`))) return;
    const filter = mode === "ASSEMBLE" && activePartObj ? activePartObj.ceCodes : undefined;
    const copied = copyFromLastYear(pickCode, fy, filter);
    setLines((ls) => {
      if (!filter) return copied;
      const byCode = new Map(copied.map((l) => [l.ceCode, l]));
      return ls.map((l) => byCode.get(l.ceCode) ?? l);
    });
    dirty();
  };
  const addLine = (ceCode: string) => {
    if (!ceCode || lines.some((l) => l.ceCode === ceCode)) return;
    setLines((ls) => [...ls, makeLine(ceCode)]); setAddCe(""); dirty();
  };
  const removeLine = (ceCode: string) => { setLines((ls) => ls.filter((l) => l.ceCode !== ceCode)); dirty(); };

  // ----- ใบย่อย (โหมดแยกกรอกตามกลุ่ม CE) -----
  const addPart = () => {
    const owner = window.prompt(T("ผู้กรอก (ชื่อ/แผนก) ของใบย่อยนี้:", "Owner (name/dept) of this part:"))?.trim();
    if (!owner) return;
    setParts((ps) => [...ps, { id: crypto.randomUUID(), owner, ceCodes: [], done: false }]);
  };
  const togglePartCe = (pid: string, ce: string) => setParts((ps) => ps.map((p) => p.id === pid ? { ...p, ceCodes: p.ceCodes.includes(ce) ? p.ceCodes.filter((x) => x !== ce) : [...p.ceCodes, ce] } : p));
  const togglePartDone = (pid: string) => setParts((ps) => ps.map((p) => p.id === pid ? { ...p, done: !p.done } : p));
  const removePart = (pid: string) => { setParts((ps) => ps.filter((p) => p.id !== pid)); if (activePart === pid) setActivePart(""); };

  // ----- Activity Types (KSPI) -----
  const addActivity = () => { setActivities((a) => [...a, { code: "", unit: "H (Hours)", planQty: "", fixedRate: "", variableRate: "" }]); dirty(); };
  const setAct = (i: number, k: keyof PlanActivity, v: string) => { setActivities((a) => a.map((x, j) => j === i ? { ...x, [k]: v } : x)); dirty(); };
  const removeAct = (i: number) => { setActivities((a) => a.filter((_, j) => j !== i)); dirty(); };
  // KSPI: เกลี่ยต้นทุนรวมของแผน ÷ ปริมาณกิจกรรมรวม → เติม "Variable Rate" ที่ยังว่างให้อัตโนมัติ (Fixed คงไว้)
  const calcKspi = () => {
    const totalCost = planTotal(lines);
    const totalQty = activities.reduce((a, x) => a + numOf(x.planQty), 0);
    const rate = kspiRate(totalCost, totalQty);
    setActivities((a) => a.map((x) => ({ ...x, variableRate: x.variableRate.trim() ? x.variableRate : (rate ? fmtNum(rate) : "") })));
    dirty();
  };

  // ----- save / send -----
  const validate = (): boolean => {
    if (!pickCode) { setErr(T("เลือก Cost Center ก่อน", "Pick a Cost Center first")); setTab("info"); return false; }
    setErr("");
    return true;
  };
  const buildRec = (codeUse: string): PlanRequest => {
    const prev = getPlanRequest(codeUse);
    const cc = ccs.find((c) => c.code === pickCode);
    return {
      ...(prev ?? {}),
      code: codeUse, topic, ccCode: pickCode, ccName: cc?.name ?? "",
      requester: prev?.requester ?? me, phase: prev?.phase ?? "PROCESS",
      stageId: prev?.stageId ?? stages[headIdx]?.id, savedAt: Date.now(),
      planVersion, fy, mode, lines, parts, activities, values: { ...(prev?.values ?? {}), note },
    } as PlanRequest;
  };
  const onSave = () => { if (!validate()) return; const c = savedCode ?? nextPlanReqCode(); savePlanRequest(buildRec(c)); setSavedCode(c); setSaved(true); setLoadedPhase((p) => p ?? "PROCESS"); };
  const onSend = () => { if (!saved || !savedCode) { setErr(T("บันทึกใบคำขอก่อนส่ง", "Save before sending")); return; } if (!validate()) return; setFlowTo(""); setFlowOpen(true); };

  const submitFlow = () => {
    if (!savedCode || !nextStage) { setFlowOpen(false); return; }
    const rec = getPlanRequest(savedCode) ?? buildRec(savedCode);
    const at = Date.now(); const fromName = curStage?.name, toName = nextStage.name;
    const toWho = flowTo || T("ทั้งกลุ่ม", "whole group");
    const recipients = flowTo ? [flowTo] : [];
    if (nextStage.kind === "DONE") {
      commitApprovedPlan(pickCode, fy, planVersion, lines);   // เสร็จสิ้น → บันทึกเป็นแผนอนุมัติ (V0 = ล็อก)
      savePlanRequest({ ...rec, lines, parts, stageId: nextStage.id, phase: "DONE", sent: { by: me, to: toWho, at, fromStage: fromName, toStage: toName, recipients: [] } });
    } else {
      savePlanRequest({ ...rec, lines, parts, stageId: nextStage.id, phase: "RECEIVE", received: undefined, bounce: undefined, sent: { by: me, to: toWho, at, fromStage: fromName, toStage: toName, recipients } });
    }
    setFlowOpen(false); nav("/accounting/cost-center/planning/requests");
  };

  const confirmReceive = () => {
    if (!savedCode) return;
    const rec = getPlanRequest(savedCode); if (!rec) return;
    if (recvMode === "accept") {
      const r = { by: me, at: Date.now() }; savePlanRequest({ ...rec, received: r, phase: "PROCESS" }); setReceived(r); setLoadedPhase("PROCESS");
    } else {
      if (!recvReason.trim()) return;
      const at = Date.now(); const prevStage = stages[Math.max(0, curStageIdx - 1)]; const sender = rec.sent?.by || rec.requester;
      savePlanRequest({ ...rec, stageId: prevStage?.id ?? rec.stageId, phase: "RECEIVE", received: undefined, bounce: { by: me, at, reason: recvReason.trim() }, sent: { by: me, to: sender, at, fromStage: curStage?.name, toStage: prevStage?.name, recipients: [sender] } });
      setRecvOpen(false); nav("/accounting/cost-center/planning/requests"); return;
    }
    setRecvOpen(false);
  };

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err"><Building size={15} />{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}><ArrowLeft size={15} />{t("custForm.goLogin")}</button></div></div>;
  }

  const picked = ccs.find((c) => c.code === pickCode);
  const shownTotal = planTotal(visibleLines);
  const monthGrand = (m: number) => visibleLines.reduce((a, l) => a + numOf(l.cells[m].ty), 0);
  // เทียบกับ "แผนปีก่อน": ปีนี้น้อยกว่า = เขียว (under) · มากกว่า = แดง (over) · เท่ากัน/ว่าง = ปกติ
  const cmpNum = (ty: number, base: number) => (!compare || !base || !ty ? "" : ty > base ? " over" : ty < base ? " under" : "");
  const cmpCell = (c: { ty: string; lyPlan: string }) => cmpNum(numOf(c.ty), numOf(c.lyPlan));
  const lyPlanGrand = (m: number) => visibleLines.reduce((a, l) => a + numOf(l.cells[m].lyPlan), 0);
  const lyPlanGrandTotal = visibleLines.reduce((a, l) => a + l.cells.reduce((x, c) => x + numOf(c.lyPlan), 0), 0);
  const availCe = CE_MASTER.filter((c) => !lines.some((l) => l.ceCode === c.code));

  return (
    <div className="p-qt p-req p-plan">
      <div className="topbar">
        <div className="qtag" style={{ background: "#5e5ce6" }}>REQ</div>
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="doctitle">{T("คำขอดำเนินการ (Planning)", "Planning action request")}</div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="main">
        <div className={`dtree${collapsed ? " collapsed" : ""}`}>
          <div className="th"><span>{T("เอกสาร", "Documents")}</span><div className="collapse-btn" onClick={() => setCollapsed((c) => !c)}><ChevronLeft size={16} /></div></div>
          <div className="tlist">
            <div className="titem qt sel"><FileText />{savedCode ?? T("ยังไม่ออกเลข", "No number yet")}</div>
            {picked && <div className="titem child"><FileText size={14} />{picked.values.costCenter || picked.code} · {picked.name}</div>}
          </div>
        </div>

        <div className="workzone">
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav("/accounting/cost-center/planning/requests")}><ArrowLeft /><span>{T("กลับ", "Back")}</span></div>
            <div className="tbsep" />
            {canEditDoc && <div className="tbtn" onClick={onSave}><Save /><span>{T("บันทึก", "Save")}</span>{!saved && <span className="dot" />}</div>}
            {!atDone && heldByMe && <div className="tbtn primary" onClick={onSend} style={{ opacity: saved ? 1 : 0.45 }}><CheckCircle /><span>{atApproveStage ? T("อนุมัติ", "Approve") : T("ส่ง", "Send")}</span></div>}
            {canReceive && <><div className="tbsep" /><div className="tbtn" onClick={() => { setRecvMode("accept"); setRecvReason(""); setRecvOpen(true); }} style={{ color: "var(--green)" }}><Check /><span>{T("รับเรื่อง", "Receive")}</span></div></>}
            {locked && <span style={{ marginLeft: 10, fontSize: 12, color: "var(--red)" }}>🔒 {T("เวอร์ชันนี้ถูกล็อก (อ่านอย่างเดียว)", "This version is locked (read-only)")}</span>}
            {!saved && !locked && <span style={{ marginLeft: 10, fontSize: 12, color: "#b28600" }}>● {T("ยังไม่บันทึก", "Unsaved")}</span>}
          </div>

          <div className="stepper">
            {stages.map((s, i) => (
              <Fragment key={s.id}>{i > 0 && <div className="stepline" />}
                <div className={`step${i === curStageIdx ? " cur" : i < curStageIdx ? " done" : ""}`}><span className="sn">{i < curStageIdx ? <Check size={13} /> : i + 1}</span>{s.name}</div>
              </Fragment>
            ))}
          </div>

          {/* แทป */}
          <div className="pl-tabs">
            <div className={`pl-tab${tab === "info" ? " on" : ""}`} onClick={() => setTab("info")}>{T("1 · ข้อมูลการขอ", "1 · Request info")}</div>
            <div className={`pl-tab${tab === "grid" ? " on" : ""}`} onClick={() => setTab("grid")}>{T("2 · ตารางงบ (CE × เดือน)", "2 · Budget (CE × month)")}</div>
            <div className={`pl-tab${tab === "activity" ? " on" : ""}`} onClick={() => setTab("activity")}>{T("3 · Activity Types", "3 · Activity Types")}</div>
          </div>

          {err && <div className="banner" style={{ background: "var(--red-bg, #fde8e8)", color: "var(--red, #da1e28)", padding: "8px 14px", fontSize: 13 }}>{err}</div>}

          {tab === "info" ? (
            <div className="content"><div className="center" style={{ flex: 1, overflow: "auto" }}>
              {atDone && <div className="banner" style={{ background: "var(--green-bg, #e8f5ec)", color: "#0e6027", padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 13 }}>✓ {T("เสร็จสิ้น — บันทึกเป็นแผนอนุมัติแล้ว", "Done — saved as approved plan")}{planVersion === "V0" ? T(" · V0 ถูกล็อกถาวร", " · V0 locked") : ""}</div>}
              {received && !atDone && <div className="banner" style={{ background: "var(--green-bg, #e8f5ec)", color: "#0e6027", padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 13 }}>✓ {T(`รับเรื่องแล้วโดย ${received.by}`, `Received by ${received.by}`)}</div>}
              {bounce && <div className="banner" style={{ background: "var(--red-bg, #fde8e8)", color: "var(--red, #da1e28)", padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 13 }}>↩ {T(`ตีกลับโดย ${bounce.by}`, `Bounced by ${bounce.by}`)}: <b>{bounce.reason}</b></div>}

              <div className="sect">
                <div className="sh">{T("ข้อมูลการขอ", "Request info")}</div>
                <div className="cols2">
                  <div className="field"><label>{T("เรื่อง", "Topic")}</label><div className="ctrl"><select value={topic} disabled={!canEditDoc || !!existing} onChange={(e) => { setTopic(e.target.value as PlanTopic); dirty(); }}>{PLAN_TOPICS.map((tp) => <option key={tp.code} value={tp.code}>{thai ? tp.th : tp.en}</option>)}</select></div></div>
                  <div className="field"><label>Cost Center</label><div className="ctrl"><select value={pickCode} disabled={!canEditDoc} onChange={(e) => { setPickCode(e.target.value); dirty(); }}><option value="">{T("— เลือก —", "— pick —")}</option>{ccs.map((c) => <option key={c.code} value={c.code}>{(c.values.costCenter || c.code)} · {c.name}</option>)}</select></div></div>
                  <div className="field"><label>Plan Version</label><div className="ctrl"><select value={planVersion} disabled={!canEditDoc} onChange={(e) => { setPlanVersion(e.target.value); dirty(); }}>{PLAN_VERSIONS.map((v) => <option key={v.code} value={v.code}>{planVersionLabel(v.code, thai)}</option>)}</select><div style={{ fontSize: 11, color: isPY || lockedV0 ? "var(--red)" : "var(--txt3)", marginTop: 3, lineHeight: 1.45 }}>{planVersionDesc(planVersion, thai)}{lockedV0 ? T(" · ล็อกแล้ว", " · locked") : ""}</div></div></div>
                  <div className="field"><label>FY</label><div className="ctrl"><select value={fy} disabled={!canEditDoc} onChange={(e) => { setFy(e.target.value); dirty(); }}>{FY_OPTS.map((y) => <option key={y} value={y}>{y}</option>)}</select></div></div>
                  <div className="field"><label>{T("โหมดการกรอก", "Entry mode")}</label><div className="ctrl"><select value={mode} disabled={!canEditDoc} onChange={(e) => { setMode(e.target.value as "DIRECT" | "ASSEMBLE"); setActivePart(""); dirty(); }}>
                    <option value="DIRECT">{T("กรอกโดยตรง (คนเดียว)", "Direct (single)")}</option>
                    <option value="ASSEMBLE">{T("แยกกันกรอกมาประกอบ (ตามกลุ่ม CE)", "Split & assemble (by CE group)")}</option>
                  </select></div></div>
                </div>
                <div className="field top"><label>{T("หมายเหตุ", "Note")}</label><div className="ctrl"><textarea value={note} disabled={!canEditDoc} onChange={(e) => { setNote(e.target.value); dirty(); }} placeholder={T("เหตุผล/รายละเอียดการวางแผน…", "Reason / planning detail…")} /></div></div>
              </div>

              {/* โหมดแยก: จัดใบย่อยตามกลุ่ม CE + ผู้กรอก */}
              {mode === "ASSEMBLE" && (
                <div className="sect">
                  <div className="sh">{T("ใบย่อย — แยกกรอกตามกลุ่ม CE / แผนก", "Parts — split by CE group / department")}</div>
                  <div className="pl-parts" style={{ padding: 0 }}>
                    {parts.length === 0 && <div style={{ color: "var(--txt3)", fontSize: 13, marginBottom: 8 }}>{T("ยังไม่มีใบย่อย — กดเพิ่มเพื่อแบ่งกลุ่ม CE ให้แต่ละแผนกกรอก", "No parts yet — add to split CE groups per department")}</div>}
                    {parts.map((p) => (
                      <div className="pl-part" key={p.id}>
                        <span className="who">{p.owner}</span>
                        <span className="ces">{CE_MASTER.map((c) => (
                          <label key={c.code} style={{ marginRight: 10, fontSize: 11, whiteSpace: "nowrap", cursor: canEditDoc ? "pointer" : "default" }}>
                            <input type="checkbox" disabled={!canEditDoc} checked={p.ceCodes.includes(c.code)} onChange={() => togglePartCe(p.id, c.code)} /> {c.code}
                          </label>
                        ))}</span>
                        <span className={`st ${p.done ? "done" : "wait"}`} onClick={() => canEditDoc && togglePartDone(p.id)} style={{ cursor: canEditDoc ? "pointer" : "default" }}>{p.done ? T("กรอกครบ", "Done") : T("รอกรอก", "Pending")}</span>
                        <button className="pl-tb-btn" onClick={() => { setActivePart(p.id); setTab("grid"); }}>{T("เลือกกรอก", "Fill")}</button>
                        {canEditDoc && <button className="pl-tb-btn" onClick={() => removePart(p.id)}><X size={12} /></button>}
                      </div>
                    ))}
                    {canEditDoc && <button className="pl-tb-btn" style={{ marginTop: 4 }} onClick={addPart}><Plus size={13} />{T("เพิ่มใบย่อย", "Add part")}</button>}
                  </div>
                </div>
              )}
            </div></div>
          ) : tab === "grid" ? (
            <div className="pl-wrap"><div className="pl-card">
              <div className="pl-toolbar">
                <span className="lbl">{T("เวอร์ชัน", "Version")}:</span><b style={{ fontSize: 11.5 }}>{planVersionLabel(planVersion, thai)}</b>
                <span className="lbl">FY:</span><b style={{ fontSize: 11.5 }}>{fy}</b>
                {mode === "ASSEMBLE" && (<>
                  <span className="sep" /><span className="lbl">{T("ใบย่อย", "Part")}:</span>
                  <select value={activePart} onChange={(e) => setActivePart(e.target.value)}>
                    <option value="">{T("ภาพรวม (ประกอบ)", "Assembled (all)")}</option>
                    {parts.map((p) => <option key={p.id} value={p.id}>{p.owner} · {p.ceCodes.length} CE</option>)}
                  </select>
                </>)}
                <div className="sep" />
                <button className={`pl-tb-btn${compare ? " on" : ""}`} onClick={() => setCompare((c) => !c)}>{compare ? T("เทียบปีก่อน", "Compare LY") : T("กรอกอย่างเดียว", "Entry only")}</button>
                <button className="pl-tb-btn" disabled={!gridBaseEditable} onClick={() => setDistOpen(true)} title={T("ปันส่วนงบทั้งปี → รายเดือน", "Distribute annual → monthly")}><Refresh size={12} />{T("ปันส่วน (Distribute)", "Distribute")}</button>
                <button className="pl-tb-btn" disabled={!gridBaseEditable} onClick={doCopy}><FileText size={12} />{T("Copy ปีก่อน", "Copy LY")}</button>
                {availCe.length > 0 && gridBaseEditable && (
                  <select value={addCe} onChange={(e) => addLine(e.target.value)} title={T("เพิ่มแถว CE", "Add CE row")}>
                    <option value="">+ CE…</option>
                    {availCe.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
                  </select>
                )}
                <span className="pl-total">Plan Total: <b>฿ {fmtNum(shownTotal)}</b> / {T("ปี", "Year")}</span>
              </div>

              <div className="pl-gridwrap">
                {mode === "ASSEMBLE" && !activePartObj && parts.length > 0 && (
                  <div style={{ padding: "8px 14px", fontSize: 11.5, color: "var(--txt3)", background: "#fffaf0" }}>{T("กำลังดูภาพรวมประกอบจากทุกใบย่อย (อ่านอย่างเดียว) — เลือกใบย่อยด้านบนเพื่อกรอกเฉพาะส่วน", "Viewing assembled result (read-only) — pick a part above to edit its rows")}</div>
                )}
                <table className="pl-grid">
                  <thead><tr>
                    <th className="ce">CE</th><th className="dsc">Description</th>
                    {MONTHS.map((m) => <th key={m}>{m}</th>)}
                    <th className="tot">TOTAL</th>
                  </tr></thead>
                  <tbody>
                    {visibleLines.length === 0 ? (
                      <tr><td className="ce">—</td><td className="dsc" colSpan={14} style={{ color: "var(--txt3)" }}>{T("ยังไม่มีแถว CE", "No CE rows")}</td></tr>
                    ) : visibleLines.map((l) => {
                      const ed = rowEditable(l);
                      const ly = String(Number(fy) - 1).slice(2);
                      const lyPlanSum = l.cells.reduce((a, c) => a + numOf(c.lyPlan), 0);
                      const lyActSum = l.cells.reduce((a, c) => a + numOf(c.lyActual), 0);
                      return (
                        <Fragment key={l.ceCode}>
                          {/* แถวหลัก = ช่องกรอกปีนี้ · ค่าอ้างอิงปีก่อนแยกเป็นแถวย่อยใต้กัน (ไม่ประกบในช่อง) */}
                          <tr className={compare ? "main3" : undefined}>
                            <td className="ce" rowSpan={compare ? 3 : 1}>{l.ceCode}</td>
                            <td className="dsc">{l.ceName}{ed && mode === "DIRECT" && <button onClick={() => removeLine(l.ceCode)} style={{ float: "right", border: "none", background: "none", color: "var(--red)", cursor: "pointer" }}><X size={11} /></button>}</td>
                            {l.cells.map((c, m) => (
                              <td className="num" key={m}>
                                <input className={`pl-in${cmpCell(c)}`} value={c.ty} disabled={!ed} onFocus={(e) => e.target.select()} onChange={(e) => setCell(l.ceCode, m, e.target.value)} onBlur={(e) => blurCell(l.ceCode, m, e.target.value)} />
                              </td>
                            ))}
                            <td className={`tot${cmpNum(lineTotal(l), lyPlanSum)}`}>
                              {ed
                                ? <input className={`pl-in${cmpNum(lineTotal(l), lyPlanSum)}`} value={l.annual?.trim() ? l.annual : (lineTotal(l) ? fmtNum(lineTotal(l)) : "")}
                                    title={T("กรอกยอดทั้งปีแล้วกด “ปันส่วน” เพื่อกระจายลงรายเดือน", "Type the annual total, then press Distribute")}
                                    placeholder={T("ยอด/ปี", "Annual")}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => setAnnual(l.ceCode, e.target.value)}
                                    onBlur={(e) => blurAnnual(l.ceCode, e.target.value)} />
                                : fmtNum(lineTotal(l))}
                            </td>
                          </tr>
                          {compare && (
                            <>
                              <tr className="refrow">
                                <td className="dsc">'{ly} {T("แผน", "plan")}</td>
                                {l.cells.map((c, m) => <td className="num" key={m}>{c.lyPlan ? fmtNum(numOf(c.lyPlan)) : "—"}</td>)}
                                <td className="tot">{lyPlanSum ? fmtNum(lyPlanSum) : "—"}</td>
                              </tr>
                              <tr className="refrow last">
                                <td className="dsc">'{ly} {T("จริง", "actual")}</td>
                                {l.cells.map((c, m) => <td className="num" key={m}>{c.lyActual ? fmtNum(numOf(c.lyActual)) : "—"}</td>)}
                                <td className="tot">{lyActSum ? fmtNum(lyActSum) : "—"}</td>
                              </tr>
                            </>
                          )}
                        </Fragment>
                      );
                    })}
                    <tr className="grand">
                      <td className="ce" colSpan={2} style={{ left: 0 }}>GRAND TOTAL</td>
                      {MONTHS.map((_, m) => <td className={`num${cmpNum(monthGrand(m), lyPlanGrand(m))}`} key={m}>{fmtNum(monthGrand(m))}</td>)}
                      <td className={`tot${cmpNum(shownTotal, lyPlanGrandTotal)}`}>{fmtNum(shownTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div></div>
          ) : (
            /* แท็บ 3 · Activity Types (KSPI) */
            <div className="content"><div className="center" style={{ flex: 1, overflow: "auto" }}>
              <div className="sect">
                <div className="sh">{T("Activity Types — กำหนดกิจกรรม + Plan Rate", "Activity Types — define activity + plan rate")}</div>
                {gridBaseEditable && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <button className="pl-tb-btn" onClick={addActivity}><Plus size={13} />{T("เพิ่ม Activity Type", "Add activity type")}</button>
                    <button className="pl-tb-btn on" onClick={calcKspi}><Refresh size={12} />{T("คำนวณ Rate (KSPI)", "Calculate Activity Rate (KSPI)")}</button>
                    <span className="muted" style={{ fontSize: 11.5 }}>{T("ต้นทุนรวมแผน: ", "Plan total cost: ")}<b>฿ {fmtNum(planTotal(lines))}</b></span>
                  </div>
                )}

                <div style={{ overflowX: "auto" }}>
                  <table className="data-grid" style={{ fontSize: 12, minWidth: 760 }}>
                    <thead><tr>
                      <th>{T("รหัสกิจกรรม", "Activity Type")}</th><th>{T("หน่วย", "Unit")}</th>
                      <th className="num">{T("ปริมาณวางแผน/ปี", "Plan Quantity")}</th>
                      <th className="num">Fixed Rate</th><th className="num">Variable Rate</th>
                      <th className="num" style={{ background: "#e8f4ff" }}>Total Rate</th><th></th>
                    </tr></thead>
                    <tbody>
                      {activities.length === 0 ? (
                        <tr className="empty-row"><td colSpan={7}>{T("ยังไม่มี Activity Type — กดเพิ่มด้านล่าง", "No activity types — add below")}</td></tr>
                      ) : activities.map((a, i) => (
                        <tr key={i}>
                          <td><input list="act-presets" value={a.code} disabled={!gridBaseEditable} placeholder="LAB01" onChange={(e) => setAct(i, "code", e.target.value)} style={{ width: 90 }} /></td>
                          <td><select value={a.unit} disabled={!gridBaseEditable} onChange={(e) => setAct(i, "unit", e.target.value)}>{ACT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select></td>
                          <td className="num"><input value={a.planQty} disabled={!gridBaseEditable} placeholder="8,400" style={{ width: 90, textAlign: "right" }} onChange={(e) => setAct(i, "planQty", e.target.value)} onBlur={(e) => setAct(i, "planQty", e.target.value.trim() ? fmtNum(numOf(e.target.value)) : "")} /></td>
                          <td className="num"><input value={a.fixedRate} disabled={!gridBaseEditable} placeholder="240" style={{ width: 80, textAlign: "right" }} onChange={(e) => setAct(i, "fixedRate", e.target.value)} onBlur={(e) => setAct(i, "fixedRate", e.target.value.trim() ? fmtNum(numOf(e.target.value)) : "")} /></td>
                          <td className="num"><input value={a.variableRate} disabled={!gridBaseEditable} placeholder="245" style={{ width: 80, textAlign: "right" }} onChange={(e) => setAct(i, "variableRate", e.target.value)} onBlur={(e) => setAct(i, "variableRate", e.target.value.trim() ? fmtNum(numOf(e.target.value)) : "")} /></td>
                          <td className="num" style={{ background: "#e8f4ff", fontWeight: 700, color: "var(--blue)" }}>฿ {fmtNum(actTotalRate(a))}{a.unit ? `/${a.unit.split(" ")[0]}` : ""}</td>
                          <td>{gridBaseEditable && <button onClick={() => removeAct(i)} style={{ border: "none", background: "none", color: "var(--red)", cursor: "pointer" }}><X size={13} /></button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <datalist id="act-presets">{ACT_PRESETS.map((p) => <option key={p.code} value={p.code} />)}</datalist>
                </div>

                {/* คำอธิบาย — ย้ายลงล่างใต้ตาราง เว้นระยะ + สีจาง (ปุ่มย้ายขึ้นบนแทน) */}
                <div style={{ fontSize: 11, marginTop: 18, lineHeight: 1.6, color: "#aeb6c0" }}>
                  {T("Activity Type = หน่วยกิจกรรมที่ Cost Center นี้ให้บริการ (เช่น ชั่วโมงแรงงาน LAB01 / ชั่วโมงเครื่องจักร MCH01) · Total Rate = Fixed + Variable · KSPI: Rate = ต้นทุนรวม ÷ ปริมาณกิจกรรม",
                     "Activity Type = activity unit this Cost Center provides (e.g. labor hours LAB01 / machine hours MCH01) · Total Rate = Fixed + Variable · KSPI: Rate = total cost ÷ activity quantity")}
                </div>
                <div style={{ fontSize: 11, marginTop: 6, lineHeight: 1.6, color: "#aeb6c0" }}>
                  {T("กรอก Plan Quantity แล้วกด “คำนวณ Rate (KSPI)” → ระบบเกลี่ยต้นทุนรวมแผน ÷ ปริมาณรวม ใส่เป็น Variable Rate ที่ยังว่างให้อัตโนมัติ (Fixed Rate คงเดิม)",
                     "Enter Plan Quantity then press “Calculate Activity Rate (KSPI)” → total plan cost ÷ total quantity fills empty Variable Rate (Fixed Rate kept)")}
                </div>
              </div>
            </div></div>
          )}
        </div>
      </div>

      {distOpen && (
        <div className="wf-flow-ov" onClick={() => setDistOpen(false)}>
          <div className="wf-flow-card" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
            <div className="wf-flow-h"><span>{T("ปันส่วนงบ (Distribute)", "Distribute budget")}</span><button className="x" onClick={() => setDistOpen(false)}><X size={16} /></button></div>
            <div className="wf-flow-b">
              <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
                {T("ใช้ยอดรวมทั้งปี (TOTAL) ของแต่ละแถวมากระจายรายเดือน — เลือกวิธี", "Spreads each row's annual TOTAL across months — pick a method")}
                {mode === "ASSEMBLE" && activePartObj ? T(` · เฉพาะใบย่อย: ${activePartObj.owner}`, ` · part: ${activePartObj.owner}`) : ""}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {DIST_METHODS.map((d) => (
                  <button key={d.code} className="pl-tb-btn" style={{ height: "auto", flexDirection: "column", alignItems: "flex-start", padding: "12px 14px", textAlign: "left", gap: 4 }} onClick={() => applyDistribute(d.code)}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "var(--txt)" }}>{thai ? d.th : d.en}</span>
                    <span style={{ fontSize: 11, color: "var(--txt3)" }}>{thai ? d.descTh : d.descEn}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="wf-flow-f"><button className="btn" onClick={() => setDistOpen(false)}>{T("ปิด", "Close")}</button></div>
          </div>
        </div>
      )}

      {flowOpen && nextStage && (
        <div className="wf-flow-ov" onClick={() => setFlowOpen(false)}>
          <div className="wf-flow-card" onClick={(e) => e.stopPropagation()}>
            <div className="wf-flow-h"><span>{nextStage.kind === "DONE" ? T("ปิดงาน (บันทึกแผนอนุมัติ)", "Close (save approved plan)") : atApproveStage ? T("อนุมัติ", "Approve") : T("ส่งเอกสาร", "Send document")}</span><button className="x" onClick={() => setFlowOpen(false)}><X size={16} /></button></div>
            <div className="wf-flow-b">
              <div className="wf-flow-line">
                <div className="wf-flow-node"><span className="lbl">{T("จาก", "From")}</span><span className="who">{me}</span><span className="stg">{curStage?.name}</span></div>
                <span className="wf-flow-arrow" style={{ alignSelf: "center" }}><ArrowRight size={20} /></span>
                <div className="wf-flow-node to"><span className="lbl">{T("ไปยัง", "To")}</span><span className="who">{nextStage.kind === "DONE" ? T("เสร็จสิ้น", "Done") : flowTo || T("ทั้งกลุ่ม", "Group")}</span><span className="stg">{nextStage.name}</span></div>
              </div>
              {nextStage.kind !== "DONE" ? (
                <div className="wf-flow-pick">
                  <label className="wf-lbl">{T("เลือกผู้รับ", "Recipient")}</label>
                  <select value={flowTo} onChange={(e) => setFlowTo(e.target.value)}><option value="">{T("ส่งทั้งกลุ่ม", "Whole group")}{candidates.length ? ` · ${candidates.length}` : ""}</option>{candidates.map((u) => <option key={u} value={u}>{u}</option>)}</select>
                </div>
              ) : <div className="muted" style={{ fontSize: 13, marginTop: 12 }}>{planVersion === "V0" ? T("ยืนยันแล้ว V0 (งบตั้งต้น) จะถูกล็อกถาวร แก้ไม่ได้อีก", "On confirm, V0 (original budget) is locked permanently") : T("ยืนยันแล้วบันทึกเป็นแผนอนุมัติของเวอร์ชันนี้", "On confirm, saved as approved plan for this version")}</div>}
            </div>
            <div className="wf-flow-f"><button className="btn" onClick={() => setFlowOpen(false)}>{T("ยกเลิก", "Cancel")}</button><button className="btn primary" onClick={submitFlow}><CheckCircle size={15} />{T("ยืนยัน", "Confirm")}</button></div>
          </div>
        </div>
      )}

      {recvOpen && (
        <div className="wf-flow-ov" onClick={() => setRecvOpen(false)}>
          <div className="wf-flow-card" onClick={(e) => e.stopPropagation()}>
            <div className="wf-flow-h"><span>{T("รับเอกสาร", "Receive")}</span><button className="x" onClick={() => setRecvOpen(false)}><X size={16} /></button></div>
            <div className="wf-flow-b">
              <div className="wf-seg" style={{ marginBottom: 12 }}><button className={recvMode === "accept" ? "on" : ""} onClick={() => setRecvMode("accept")}>{T("รับเรื่อง", "Accept")}</button><button className={recvMode === "decline" ? "on" : ""} onClick={() => setRecvMode("decline")}>{T("ไม่รับ (ตีกลับ)", "Decline")}</button></div>
              {recvMode === "accept" ? <div className="muted" style={{ fontSize: 13 }}>{T("กดรับแล้วเข้ากล่อง “รอดำเนินการ” ของคุณ", "After accepting, enters your Processing box")}</div> : (
                <div className="wf-flow-pick"><label className="wf-lbl">{T("เหตุผลที่ไม่รับ", "Reason")}</label><textarea value={recvReason} onChange={(e) => setRecvReason(e.target.value)} style={{ width: "100%", minHeight: 64, padding: "8px 10px", border: "1px solid var(--field-bd)", borderRadius: 8, fontSize: 13.5 }} /></div>
              )}
            </div>
            <div className="wf-flow-f"><button className="btn" onClick={() => setRecvOpen(false)}>{T("ยกเลิก", "Cancel")}</button><button className="btn primary" disabled={recvMode === "decline" && !recvReason.trim()} onClick={confirmReceive}><CheckCircle size={15} />{recvMode === "accept" ? T("ยืนยันรับ", "Confirm") : T("ยืนยันตีกลับ", "Confirm")}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
