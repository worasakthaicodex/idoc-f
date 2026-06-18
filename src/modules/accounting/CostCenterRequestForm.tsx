import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Save, Check, CheckCircle, FileText, ChevronLeft, Building, X } from "../../shared/icons";
import { getSession } from "../../shared/session";
import LangSwitcher from "../../shared/LangSwitcher";
import {
  fetchStages, fetchAuthorities, fetchModuleUsers, pickAuthorityFrame, memberAt, resolveCandidates,
  type Stage, type Authority,
} from "../workflow/workflowConfig";
import {
  CC_SECTIONS, CC_FIELDS, CC_TOPICS, getEnabledCCFields, ccFieldDesc, ccFieldLabel, ccSectionTitle,
  type CCTopic, type CCField, type CCRequest,
  loadCostCenters, getCCRequest, saveCCRequest, nextReqCode, applyCCRequest,
} from "./costCenterStore";
import "../sales/qt.css";
import "../customer/request.css";

const DT = "CC_REQUEST";   // ชนิดเอกสารใน workflow (ตั้งขั้น/สิทธิ์ได้ที่ /accounting/settings → Workflow)

/** ฟอร์มคำขอดำเนินการ Cost Center — เลย์เอาต์ + เส้นทางเดียวกับ /customer/requests (เสร็จสิ้น = ขึ้นทะเบียน) */
export default function CostCenterRequestForm() {
  const nav = useNavigate();
  const { code } = useParams();
  const [sp] = useSearchParams();
  const { t, i18n } = useTranslation();
  const thai = i18n.language.startsWith("th");
  const T = (a: string, b: string) => (thai ? a : b);
  const session = getSession();
  const me = session?.fullName || session?.email || session?.companyCode || "—";

  const existing = useMemo(() => (code ? getCCRequest(decodeURIComponent(code)) : null), [code]);

  const initVals = () => {
    const v: Record<string, string> = {};
    CC_FIELDS.forEach((f) => { if (f.def) v[f.key] = f.def; });
    return v;
  };
  const [topic, setTopic] = useState<CCTopic>(() => (existing?.topic ?? (sp.get("topic") as CCTopic) ?? "ADD"));
  const [vals, setVals] = useState<Record<string, string>>(() => existing?.values ?? initVals());
  const [pickCode, setPickCode] = useState(() => (existing && existing.topic !== "ADD" ? existing.ccCode : ""));
  const [collapsed, setCollapsed] = useState(false);
  const [err, setErr] = useState("");
  const [savedCode, setSavedCode] = useState<string | null>(existing?.code ?? null);
  const [saved, setSaved] = useState(!!existing);
  const [loadedPhase, setLoadedPhase] = useState(existing?.phase ?? null);
  const [received, setReceived] = useState(existing?.received);
  const bounce = existing?.bounce;
  const ccs = useMemo(() => loadCostCenters(), []);

  // ----- workflow runtime (ขั้น/สิทธิ์/ผู้ใช้โมดูล) -----
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
  // ถือเอกสารอยู่ไหม: รับแล้ว→ผู้รับล่าสุด · ส่งแล้วยังไม่รับ→ลอย · ยังไม่ส่ง→ผู้สร้าง/ทุกคน(ใบใหม่)
  const heldByMe = existing ? (existing.received ? existing.received.by === me : !existing.sent) : true;
  const canEditDoc = !atDone && !atApproveStage && heldByMe;
  const canReceive = loadedPhase === "RECEIVE" && !!existing?.sent && !received && !bounce;

  // ผู้รับขั้นถัดไปตามกรอบสิทธิ์ (เหมือนฟอร์มลูกค้า)
  const creator = { fullName: session?.fullName, email: session?.email, employeeCode: session?.employeeCode };
  const frame = curStage && stages[headIdx] ? pickAuthorityFrame(authorities, stages[headIdx].id, creator) : null;
  const candidates = frame && nextStage ? resolveCandidates(memberAt(frame, nextStage.id), moduleUsers) : moduleUsers;

  // ----- ส่ง FLOW -----
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowTo, setFlowTo] = useState("");
  // ----- รับเรื่อง -----
  const [recvOpen, setRecvOpen] = useState(false);
  const [recvMode, setRecvMode] = useState<"accept" | "decline">("accept");
  const [recvReason, setRecvReason] = useState("");

  const set = (k: string, v: string) => setVals((s) => ({ ...s, [k]: v }));
  const changeTopic = (tp: CCTopic) => { setTopic(tp); setPickCode(""); setVals(initVals()); setErr(""); setSaved(false); };
  const onPick = (cc: string) => {
    setPickCode(cc);
    const rec = ccs.find((c) => c.code === cc);
    if (rec) setVals({ ...rec.values });
    setSaved(false);
  };

  const enabledSet = useMemo(() => new Set(getEnabledCCFields()), []);

  const validate = (): boolean => {
    if (topic !== "ADD" && !pickCode) { setErr(T("เลือก Cost Center ที่จะดำเนินการก่อน", "Pick the Cost Center to act on first")); return false; }
    if (topic !== "CANCEL") {
      // ฟิลด์ REQUIRED ต้องกรอกทุกฟิลด์ มิฉะนั้นบันทึกไม่ได้
      const missing = CC_FIELDS.filter((f) => f.reqType === "REQUIRED" && enabledSet.has(f.key) && f.type !== "checkbox" && !(vals[f.key] || "").trim());
      if (missing.length) {
        const names = missing.map((m) => (thai ? m.th : m.label)).join(", ");
        setErr(T(`กรอกฟิลด์ที่จำเป็น (REQUIRED) ให้ครบ: ${names}`, `Fill all REQUIRED fields: ${names}`));
        return false;
      }
      const cc = (vals.costCenter || "").trim();
      if (cc.length < 1 || cc.length > 10) { setErr(T("รหัส Cost Center ต้องยาว 1-10 ตัวอักษร", "Cost Center code must be 1-10 characters")); return false; }
      // รหัสต้องไม่ซ้ำในระบบ (ขอแก้ไข = อนุญาตรหัสเดิมของตัวเอง)
      const dup = ccs.some((c) => (c.values.costCenter || c.code) === cc && (topic === "ADD" || c.code !== pickCode));
      if (dup) { setErr(T(`รหัส Cost Center "${cc}" มีอยู่แล้วในระบบ — ต้องไม่ซ้ำ`, `Cost Center code "${cc}" already exists — must be unique`)); return false; }
      if ((vals.name || "").trim().length > 50) { setErr(T("Name (ชื่อแผนก/หน่วยงาน) ยาวได้ไม่เกิน 50 ตัวอักษร", "Name must not exceed 50 characters")); return false; }
    }
    setErr("");
    return true;
  };

  const buildRec = (codeUse: string): CCRequest => {
    const prev = getCCRequest(codeUse);
    return {
      ...(prev ?? {}),
      code: codeUse, topic,
      ccCode: topic === "ADD" ? (vals.costCenter || "").trim() : pickCode,
      ccName: vals.name || "",
      requester: prev?.requester ?? me,
      phase: prev?.phase ?? "PROCESS",          // เราสร้างเอง = กล่อง "รอดำเนินการ"
      stageId: prev?.stageId ?? stages[headIdx]?.id,
      savedAt: Date.now(), values: { ...vals },
    } as CCRequest;
  };

  // บันทึกใบ (ต้องผ่านก่อนถึงส่งได้ — เหมือนคำขอลูกค้า)
  const onSave = () => {
    if (!validate()) return;
    const codeUse = savedCode ?? nextReqCode();
    saveCCRequest(buildRec(codeUse));
    setSavedCode(codeUse); setSaved(true); setLoadedPhase((p) => p ?? "PROCESS");
  };

  const onSend = () => {
    if (!saved || !savedCode) { setErr(T("บันทึกใบคำขอก่อนส่ง", "Save the request before sending")); return; }
    if (!validate()) return;
    setFlowTo(""); setFlowOpen(true);
  };

  // ยืนยันส่ง — ปลายทางเป็น "เสร็จสิ้น" → ขึ้นทะเบียน/แก้/ยกเลิกจริง แล้วปิดงาน
  const submitFlow = () => {
    if (!savedCode || !nextStage) { setFlowOpen(false); return; }
    const rec = getCCRequest(savedCode) ?? buildRec(savedCode);
    const at = Date.now();
    const fromName = curStage?.name, toName = nextStage.name;
    const toWho = flowTo || T("ทั้งกลุ่ม", "whole group");
    const recipients = flowTo ? [flowTo] : [];
    if (nextStage.kind === "DONE") {
      const ok = applyCCRequest({ ...rec, values: { ...vals } });
      if (!ok) { setErr(T("ลงทะเบียนไม่สำเร็จ — ไม่พบ Cost Center ที่อ้างถึง", "Registration failed — referenced Cost Center not found")); setFlowOpen(false); return; }
      saveCCRequest({ ...rec, values: { ...vals }, stageId: nextStage.id, phase: "DONE", sent: { by: me, to: toWho, at, fromStage: fromName, toStage: toName, recipients: [] } });
    } else {
      saveCCRequest({ ...rec, values: { ...vals }, stageId: nextStage.id, phase: "RECEIVE", received: undefined, bounce: undefined, sent: { by: me, to: toWho, at, fromStage: fromName, toStage: toName, recipients } });
    }
    setFlowOpen(false);
    nav("/accounting/cost-center/requests");
  };

  // รับเรื่อง / ไม่รับ (ตีกลับ)
  const confirmReceive = () => {
    if (!savedCode) return;
    const rec = getCCRequest(savedCode);
    if (!rec) return;
    if (recvMode === "accept") {
      const r = { by: me, at: Date.now() };
      saveCCRequest({ ...rec, received: r, phase: "PROCESS" });
      setReceived(r); setLoadedPhase("PROCESS");
    } else {
      if (!recvReason.trim()) return;
      const at = Date.now();
      const prevStage = stages[Math.max(0, curStageIdx - 1)];
      const sender = rec.sent?.by || rec.requester;
      saveCCRequest({
        ...rec, stageId: prevStage?.id ?? rec.stageId, phase: "RECEIVE", received: undefined,
        bounce: { by: me, at, reason: recvReason.trim() },
        sent: { by: me, to: sender, at, fromStage: curStage?.name, toStage: prevStage?.name, recipients: [sender] },
      });
      setRecvOpen(false);
      nav("/accounting/cost-center/requests");
      return;
    }
    setRecvOpen(false);
  };

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err"><Building size={15} />{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}><ArrowLeft size={15} />{t("custForm.goLogin")}</button></div></div>;
  }

  const picked = topic !== "ADD" ? ccs.find((c) => c.code === pickCode) : undefined;

  function renderField(f: CCField) {
    const v = vals[f.key] ?? "";
    const dis = !canEditDoc || f.reqType === "SYSTEM";   // SYSTEM = ระบบใส่ให้จาก config แก้ไม่ได้
    const desc = ccFieldDesc(f, thai);
    const hint = <div style={{ fontSize: 11, color: "var(--txt3)", marginTop: 3, lineHeight: 1.45 }}>{desc}</div>;
    let ctrl;
    if (f.type === "checkbox") {
      return (
        <div className="field" key={f.key} title={desc}>
          <label>{ccFieldLabel(f, thai)}</label>
          <div className="ctrl">
            <div style={{ display: "flex", alignItems: "center", minHeight: 30 }}>
              <input type="checkbox" checked={v === "1"} disabled={dis} onChange={(e) => { set(f.key, e.target.checked ? "1" : ""); setSaved(false); }} style={{ width: 16, height: 16 }} />
            </div>
            {hint}
          </div>
        </div>
      );
    }
    if (f.type === "select") ctrl = (
      <select value={v} disabled={dis} onChange={(e) => { set(f.key, e.target.value); setSaved(false); }}>
        <option value="">—</option>
        {(f.opts ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
    else if (f.type === "date") ctrl = <input type="date" value={v} disabled={dis} onChange={(e) => { set(f.key, e.target.value); setSaved(false); }} />;
    else ctrl = <input value={v} disabled={dis} placeholder={f.placeholder} maxLength={f.max} onChange={(e) => { set(f.key, e.target.value); setSaved(false); }} />;
    return (
      <div className="field" key={f.key} title={desc}>
        <label>{ccFieldLabel(f, thai)}{f.reqType === "REQUIRED" ? " *" : ""}</label>
        <div className="ctrl">{ctrl}{hint}</div>
      </div>
    );
  }

  return (
    <div className="p-qt p-req">
      <div className="topbar">
        <div className="qtag" style={{ background: "#5e5ce6" }}>REQ</div>
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="doctitle">{T("คำขอดำเนินการ Cost Center", "Cost Center action request")}</div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="main">
        {/* เมนูซ้าย: เอกสารของคำขอ + Cost Center ที่อ้างถึง */}
        <div className={`dtree${collapsed ? " collapsed" : ""}`}>
          <div className="th">
            <span>{T("เอกสาร", "Documents")}</span>
            <div className="collapse-btn" title={T("ยุบ/ขยาย", "Collapse/expand")} onClick={() => setCollapsed((c) => !c)}><ChevronLeft size={16} /></div>
          </div>
          <div className="tlist">
            <div className="titem qt sel"><FileText />{savedCode ?? T("ยังไม่ออกเลข", "No number yet")}</div>
            {picked && <div className="titem child"><FileText size={14} />{picked.values.costCenter || picked.code} · {picked.name}</div>}
          </div>
        </div>

        <div className="workzone">
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav("/accounting/cost-center/requests")}><ArrowLeft /><span>{T("กลับ", "Back")}</span></div>
            <div className="tbsep" />
            {canEditDoc && <div className="tbtn" onClick={onSave}><Save /><span>{T("บันทึก", "Save")}</span>{!saved && <span className="dot" />}</div>}
            {!atDone && heldByMe && (
              <div className="tbtn primary" onClick={onSend} style={{ opacity: saved ? 1 : 0.45 }} title={saved ? "" : T("บันทึกก่อนส่ง", "Save before sending")}>
                <CheckCircle /><span>{atApproveStage ? T("อนุมัติ", "Approve") : T("ส่ง", "Send")}</span>
              </div>
            )}
            {canReceive && <><div className="tbsep" /><div className="tbtn" onClick={() => { setRecvMode("accept"); setRecvReason(""); setRecvOpen(true); }} style={{ color: "var(--green)" }}><Check /><span>{T("รับเรื่อง", "Receive")}</span></div></>}
            {!saved && <span style={{ marginLeft: 10, fontSize: 12, color: "#b28600", whiteSpace: "nowrap" }}>● {T("ยังไม่บันทึก", "Unsaved")}</span>}
          </div>

          {/* ขั้นตอนจริงจาก workflow (CC_REQUEST) */}
          <div className="stepper">
            {stages.map((s, i) => (
              <Fragment key={s.id}>
                {i > 0 && <div className="stepline" />}
                <div className={`step${i === curStageIdx ? " cur" : i < curStageIdx ? " done" : ""}`}>
                  <span className="sn">{i < curStageIdx ? <Check size={13} /> : i + 1}</span>{s.name}
                </div>
              </Fragment>
            ))}
          </div>

          <div className="content">
            <div className="center" style={{ flex: 1, overflow: "auto" }}>
              {err && <div className="banner" style={{ background: "var(--red-bg, #fde8e8)", color: "var(--red, #da1e28)", padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 13 }}>{err}</div>}
              {atDone && (
                <div className="banner" style={{ background: "var(--green-bg, #e8f5ec)", color: "#0e6027", padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
                  ✓ {topic === "ADD" ? T("เสร็จสิ้น — ขึ้นทะเบียน Cost Center แล้ว", "Done — Cost Center registered")
                    : topic === "EDIT" ? T("เสร็จสิ้น — แก้ไขข้อมูลแล้ว", "Done — changes applied")
                    : T("เสร็จสิ้น — ยกเลิก Cost Center แล้ว", "Done — Cost Center cancelled")}
                </div>
              )}
              {received && !atDone && (
                <div className="banner" style={{ background: "var(--green-bg, #e8f5ec)", color: "#0e6027", padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
                  ✓ {T(`รับเรื่องแล้วโดย ${received.by}`, `Received by ${received.by}`)} · {new Date(received.at).toLocaleString()}
                </div>
              )}
              {bounce && (
                <div className="banner" style={{ background: "var(--red-bg, #fde8e8)", color: "var(--red, #da1e28)", padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
                  ↩ {T(`ตีกลับโดย ${bounce.by}`, `Bounced by ${bounce.by}`)}: <b>{bounce.reason}</b>
                </div>
              )}

              {/* รายละเอียดคำขอ — เรื่องเป็น Select เหมือนคำขอลูกค้า */}
              <div className="sect">
                <div className="sh">{T("รายละเอียดคำขอ", "Request detail")}</div>
                <div className="cols2">
                  <div className="field">
                    <label>{T("เรื่อง", "Topic")}</label>
                    <div className="ctrl">
                      <select value={topic} disabled={!canEditDoc || !!existing} onChange={(e) => changeTopic(e.target.value as CCTopic)}>
                        {CC_TOPICS.map((tp) => <option key={tp.code} value={tp.code}>{thai ? tp.th : tp.en}</option>)}
                      </select>
                    </div>
                  </div>

                  {topic !== "ADD" && (
                    <div className="field">
                      <label>Cost Center</label>
                      <div className="ctrl">
                        <select value={pickCode} disabled={!canEditDoc} onChange={(e) => onPick(e.target.value)}>
                          <option value="">{T("— เลือก Cost Center —", "— pick Cost Center —")}</option>
                          {ccs.map((c) => <option key={c.code} value={c.code}>{(c.values.costCenter || c.code)} · {c.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ฟิลด์ตามหมวด — เฉพาะฟิลด์ที่เปิดใช้ (ตั้งที่ /accounting/settings/cc-fields) · ขอยกเลิก = แค่เลือก CC */}
              {topic !== "CANCEL" && (topic === "ADD" || !!picked) && CC_SECTIONS.map((sec) => {
                const fields = sec.fields.filter((f) => enabledSet.has(f.key));
                if (fields.length === 0) return null;
                return (
                  <div className="sect" key={sec.title}>
                    <div className="sh">{ccSectionTitle(sec, thai)}</div>
                    <div className="cols2">{fields.map(renderField)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ส่ง FLOW — จากขั้นนี้ → ขั้นถัดไป เลือกผู้รับได้ (เหมือนคำขอลูกค้า) */}
      {flowOpen && nextStage && (
        <div className="wf-flow-ov" onClick={() => setFlowOpen(false)}>
          <div className="wf-flow-card" onClick={(e) => e.stopPropagation()}>
            <div className="wf-flow-h"><span>{nextStage.kind === "DONE" ? T("ปิดงาน (ขึ้นทะเบียน)", "Close (register)") : atApproveStage ? T("อนุมัติ", "Approve") : T("ส่งเอกสาร", "Send document")}</span><button className="x" onClick={() => setFlowOpen(false)}><X size={16} /></button></div>
            <div className="wf-flow-b">
              <div className="wf-flow-line">
                <div className="wf-flow-node"><span className="lbl">{T("จาก", "From")}</span><span className="who">{me}</span><span className="stg">{curStage?.name}</span></div>
                <span className="wf-flow-arrow" style={{ alignSelf: "center" }}><ArrowRight size={20} /></span>
                <div className="wf-flow-node to"><span className="lbl">{T("ไปยัง", "To")}</span><span className="who">{nextStage.kind === "DONE" ? T("เสร็จสิ้น", "Done") : flowTo || T("ทั้งกลุ่ม", "Whole group")}</span><span className="stg">{nextStage.name}</span></div>
              </div>
              {nextStage.kind !== "DONE" && (
                <div className="wf-flow-pick">
                  <label className="wf-lbl">{T("เลือกผู้รับ", "Recipient")}</label>
                  <select value={flowTo} onChange={(e) => setFlowTo(e.target.value)}>
                    <option value="">{T("ส่งทั้งกลุ่ม", "Send to whole group")}{candidates.length ? ` · ${candidates.length} ${T("คน", "people")}` : ""}</option>
                    {candidates.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <div className="wf-flow-pickhint">{flowTo ? T("ส่งเจาะจงคนเดียว", "Send to one person") : T("ส่งทั้งกลุ่ม ใครรับก่อนได้งาน", "Whole group — first to accept takes it")}</div>
                </div>
              )}
              {nextStage.kind === "DONE" && (
                <div className="muted" style={{ fontSize: 13, marginTop: 12 }}>
                  {topic === "ADD" ? T("ยืนยันแล้วระบบจะขึ้นทะเบียน Cost Center ใหม่ทันที", "On confirm, the new Cost Center is registered immediately")
                    : topic === "EDIT" ? T("ยืนยันแล้วระบบจะบันทึกการแก้ไขลงทะเบียนทันที", "On confirm, the changes are applied to the registry")
                    : T("ยืนยันแล้วระบบจะเปลี่ยนสถานะ Cost Center เป็น “ยกเลิก”", "On confirm, the Cost Center status becomes “Cancelled”")}
                </div>
              )}
            </div>
            <div className="wf-flow-f">
              <button className="btn" onClick={() => setFlowOpen(false)}>{T("ยกเลิก", "Cancel")}</button>
              <button className="btn primary" onClick={submitFlow}><CheckCircle size={15} />{T("ยืนยัน", "Confirm")}</button>
            </div>
          </div>
        </div>
      )}

      {/* รับเรื่อง / ไม่รับ (ตีกลับ) */}
      {recvOpen && (
        <div className="wf-flow-ov" onClick={() => setRecvOpen(false)}>
          <div className="wf-flow-card" onClick={(e) => e.stopPropagation()}>
            <div className="wf-flow-h"><span>{T("รับเอกสาร", "Receive document")}</span><button className="x" onClick={() => setRecvOpen(false)}><X size={16} /></button></div>
            <div className="wf-flow-b">
              <div className="wf-seg" style={{ marginBottom: 12 }}>
                <button className={recvMode === "accept" ? "on" : ""} onClick={() => setRecvMode("accept")}>{T("รับเรื่อง", "Accept")}</button>
                <button className={recvMode === "decline" ? "on" : ""} onClick={() => setRecvMode("decline")}>{T("ไม่รับ (ตีกลับ)", "Decline (bounce)")}</button>
              </div>
              {recvMode === "accept" ? (
                <div className="muted" style={{ fontSize: 13 }}>{T("กดรับแล้วเอกสารจะเข้ากล่อง “รอดำเนินการ” ของคุณ และถือว่าคุณเป็นผู้รับผิดชอบ", "After accepting, the document enters your “Processing” box and you become responsible")}</div>
              ) : (
                <div className="wf-flow-pick">
                  <label className="wf-lbl">{T("เหตุผลที่ไม่รับ (ตีกลับให้ผู้ส่ง)", "Reason for declining (bounced to sender)")}</label>
                  <textarea value={recvReason} onChange={(e) => setRecvReason(e.target.value)} placeholder={T("ระบุเหตุผล…", "State the reason…")} style={{ width: "100%", minHeight: 64, padding: "8px 10px", border: "1px solid var(--field-bd)", borderRadius: 8, fontSize: 13.5 }} />
                </div>
              )}
            </div>
            <div className="wf-flow-f">
              <button className="btn" onClick={() => setRecvOpen(false)}>{T("ยกเลิก", "Cancel")}</button>
              <button className="btn primary" disabled={recvMode === "decline" && !recvReason.trim()} onClick={confirmReceive}><CheckCircle size={15} />{recvMode === "accept" ? T("ยืนยันรับ", "Confirm receive") : T("ยืนยันตีกลับ", "Confirm bounce")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
