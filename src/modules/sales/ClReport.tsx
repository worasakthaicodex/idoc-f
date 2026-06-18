import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { ArrowLeft, ArrowRight, Refresh, Help, ChevronLeft, Check, CheckCircle, FileText, Save, Lock, Trash, X, Shield } from "../../shared/icons";
import ClLeadBox, { type ClLeadBoxHandle } from "./ClLeadBox";
import ClWorklist from "./ClWorklist";
import CrossNavSelect from "../../shared/CrossNavSelect";
import { setMain as setCrossNavMain } from "../../shared/crossNav";
import { completeClLeads, fetchClWorklist, fetchClSummary, fetchClOps, type WorkLead, type ClSummary, type ClOps } from "./clLeads";
import AgeBadge from "./AgeBadge";
import { loadRequests } from "../customer/customerRequests";
import ModuleDeps from "../../shared/ModuleDeps";
import { fetchUnavailableDeps, depsFor, type ModuleDep } from "../../shared/moduleRegistry";
import { SALES_GROUPS, fieldsOf, coreKeysOf, type SalesField } from "./salesFields";
import { getEnabledFields, getGroupOverrides, groupOf } from "./salesFieldConfig";
import { getFieldOptions } from "./salesFieldOptions";
import { getClDoc, saveClDoc, deleteClDoc, issueClCode, syncSalesDocs, SALES_DOCS_EVENT, appendFlowLog, loadFlowLog, type ClDoc, type FlowLogEntry } from "./clRequests";
import { fetchModuleUsers, fetchStages, getIssueEvent, type Stage } from "../workflow/workflowConfig";
import "./cl.css";

const tabs = [
  { key: "form", label: "ข้อมูล" },        // ฟอร์มข้อมูลชุด CL (ก่อน "รายชื่อ")
  { key: "list", label: "รายชื่อ" },
  { key: "overview", label: "สรุปภาพรวม" },
];

const baht = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

const DOC = "CL";
const REVIEW_KEY = "idoc.sales.cl.reviewOpen";   // จำว่าแผงตรวจทานเปิด/ปิด
const INP: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid var(--field-bd)", borderRadius: 8, fontSize: 13.5, background: "#fff" };

export default function ClReport() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { id } = useParams();
  const code = id ?? "CL202605-088";
  // จำแท็บที่เปิด + สถานะยุบ/ขยาย Documents ไว้ (รีเฟรชแล้วอยู่ที่เดิม)
  const [tab, setTabState] = useState(() => localStorage.getItem("idoc.cl.full.tab") || "form");
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("idoc.cl.full.collapsed") === "1");

  // บังคับ dependency: แท็บ "รายชื่อ" ต้องมีโมดูล CRM · ไม่มี = ล็อก ใช้ไม่ได้
  const [missingDeps, setMissingDeps] = useState<ModuleDep[]>([]);
  useEffect(() => { fetchUnavailableDeps("sales").then(setMissingDeps).catch(() => {}); }, []);
  const tabNeeds: Record<string, string> = { list: "crm" }; // แท็บไหนต้องพึ่งโมดูลไหน
  const lockedTab = (key: string) => { const need = tabNeeds[key]; return !!need && missingDeps.some((d) => d.key === need); };
  const crmDep = depsFor("sales").find((d) => d.key === "crm");
  const setTab = (k: string) => { setTabState(k); localStorage.setItem("idoc.cl.full.tab", k); };
  const toggleTree = () => setCollapsed((c) => { const n = !c; localStorage.setItem("idoc.cl.full.collapsed", n ? "1" : "0"); return n; });

  // ความคืบหน้าการโทร (ย้ายมาจากแท็บรายชื่อ) — โชว์ในแท็บสรุปภาพรวม
  const [wl, setWl] = useState<WorkLead[]>([]);
  // โหลดความคืบหน้าการโทรใหม่ทุกครั้งที่เข้าแท็บ "สรุปภาพรวม" (กันค้างหลังเพิ่งโทรในแท็บรายชื่อ)
  useEffect(() => { if (tab === "overview") fetchClWorklist(code).then(setWl).catch(() => {}); }, [code, tab]);
  const [summary, setSummary] = useState<ClSummary | null>(null);
  const [ovSec, setOvSec] = useState<"sales" | "ops">("sales");
  useEffect(() => { fetchClSummary(code).then(setSummary).catch(() => {}); }, [code]);
  // สายงานเอกสาร CL→FO→QT→SO (แม่-ลูก) ในเมนูซ้าย
  // CL = ชุดรายชื่อ ไม่โชว์สายเอกสารลูก (FO/QT/SO) ใน Documents — ไม่ต้องดึง chain
  const [ops, setOps] = useState<ClOps | null>(null);
  // โหลดเสมอ — ใช้ทั้งแท็บ "ผลลัพธ์" และหักออกจาก "ปัจจัยในการเลือก" (ปัจจัย = ก่อนแคมเปญ)
  useEffect(() => { fetchClOps(code).then(setOps).catch(() => {}); }, [code]);
  // คำขอที่อ้างอิง CL นี้ (localStorage) — #6 ข้อมูลผิด (EDIT) · #7 ปรับสถานะ (STATUS)
  const clReqs = useMemo(() => loadRequests().filter((r) => r.origin?.type === "CL" && r.origin?.code === code), [code, ovSec]);
  const reqEditCount = clReqs.filter((r) => (r.topic || "").toUpperCase() === "EDIT").length;
  const reqStatusCount = clReqs.filter((r) => (r.topic || "").toUpperCase() === "STATUS").length;
  const tgt = (k: string) => Number(existing?.values?.[k] || 0);
  const wlTotal = wl.length;
  // โทรแล้ว = จำนวนรายที่ได้โทร — ใช้ค่าจาก ops (CALL_RESULT, ตัวเดียวกับการ์ด "ติดตามไม่ซ้ำราย") ให้ตรงกัน
  //   (worklist status อ่านจาก cl_call_log คนละแหล่ง จึงอาจขึ้น NEW ทั้งที่โทรแล้ว)
  const wlCalled = Math.min(wlTotal, ops?.callDistinct ?? wl.filter((l) => l.status !== "NEW").length);
  const wlPct = wlTotal ? Math.round((wlCalled / wlTotal) * 100) : 0;

  // ฟอร์มข้อมูล CL — ใช้ฟิลด์ที่เปิดใน /sales/settings (คุมชุดฟิลด์ + กลุ่มที่ลากจัดไว้)
  const enabledKeys = getEnabledFields(DOC);
  const grpOv = getGroupOverrides(DOC);
  const [fv, setFv] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<ClDoc | null>(null);
  const [saving, setSaving] = useState(false);
  // ปัจจัยที่ถูกล็อกไว้ตอนเริ่มดำเนินการ (ถาวร) — ถ้ามี ใช้แทนการคำนวณเรียลไทม์
  const factorSnap = useMemo(() => {
    try { const s = existing?.values?.factorSnap; return s ? (JSON.parse(s) as { salesTotal: number; qtCount: number; foCount: number; soCount: number; at?: number }) : null; }
    catch { return null; }
  }, [existing?.values?.factorSnap]);
  const leadRef = useRef<ClLeadBoxHandle>(null);   // ปุ่มบันทึกใน toolbar เรียกบันทึกชุดรายชื่อ
  const [leadsDirty, setLeadsDirty] = useState(false);
  const me = getSession()?.fullName || getSession()?.email || getSession()?.companyCode || "";
  const [stages, setStages] = useState<Stage[]>([]);   // ขั้นจริงจาก workflow (CL)
  const [sendOpen, setSendOpen] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [recvOpen, setRecvOpen] = useState(false);
  const [recvMode, setRecvMode] = useState<"accept" | "decline">("accept");
  const [recvReason, setRecvReason] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeRes, setCloseRes] = useState<"met" | "missed" | "">("");
  const [closeNote, setCloseNote] = useState("");
  // ให้คะแนนคุณภาพรายชื่อ (จากผู้ส่ง) ระหว่างดำเนินการ
  const [rateVal, setRateVal] = useState(0);
  const [rateNote, setRateNote] = useState("");
  const [rateMsg, setRateMsg] = useState("");
  const [rateSaving, setRateSaving] = useState(false);
  useEffect(() => { setRateVal(Number(existing?.values?.dataRating || 0)); setRateNote(existing?.values?.dataRatingNote || ""); }, [existing?.values?.dataRating, existing?.values?.dataRatingNote]);
  const [flowLog, setFlowLog] = useState<FlowLogEntry[]>([]);
  // แผง "ตรวจทาน/Log" ด้านขวา — ปิดเป็นค่าเริ่มต้น + จำสถานะที่ผู้ใช้เลือกไว้
  const [reviewOpen, setReviewOpen] = useState<boolean>(() => localStorage.getItem(REVIEW_KEY) === "1");
  const setReview = (open: boolean) => { setReviewOpen(open); localStorage.setItem(REVIEW_KEY, open ? "1" : "0"); };
  useEffect(() => { fetchStages(DOC).then(setStages).catch(() => {}); }, []);
  useEffect(() => { setFlowLog(loadFlowLog(code)); }, [code]);
  // ตั้ง CL นี้เป็น "ทางหลัก" ของเส้นทางชั่วคราว — เปิด CL ใหม่จะล้างทางรองเก่าทิ้งเอง
  useEffect(() => { setCrossNavMain(`/sales/cl/${code}/full`, `${code}${existing?.title ? ` · ${existing.title}` : ""}`); }, [code, existing?.title]);
  const [users, setUsers] = useState<string[]>([]);
  useEffect(() => { fetchModuleUsers("sales").then(setUsers).catch(() => {}); }, []);

  // โหลดเอกสารที่บันทึกไว้ (จาก localStorage + sync จาก backend) เข้าฟอร์ม
  useEffect(() => {
    const reload = () => { const rec = getClDoc(code, DOC); if (rec) { setExisting(rec); setFv(rec.values ?? {}); } };
    reload();
    syncSalesDocs(DOC).then(reload).catch(() => {});
    const h = (e: Event) => { if ((e as CustomEvent).detail === DOC) reload(); };
    window.addEventListener(SALES_DOCS_EVENT, h);
    return () => window.removeEventListener(SALES_DOCS_EVENT, h);
  }, [code]);

  // มีเรื่องสำคัญ (เอกสารถูกตีกลับ) → เปิดแผงตรวจทานให้เห็นเองโดยไม่แตะค่าที่จำไว้
  useEffect(() => { if (existing?.bounce) setReviewOpen(true); }, [existing?.bounce]);

  const onSave = async () => {
    const titleKey = coreKeysOf(DOC)[0] ?? "campaignName";
    setSaving(true);
    const ok = await saveClDoc({
      code,
      title: (fv[titleKey] ?? existing?.title ?? "").trim() || code,
      telesale: (fv.telesale ?? fv.salesperson ?? existing?.telesale ?? "").trim(),
      phase: existing?.phase ?? "PROCESS",
      savedAt: Date.now(),
      values: fv,
      stageId: existing?.stageId,
      received: existing?.received, bounce: existing?.bounce, sent: existing?.sent,
    }, DOC);
    setSaving(false);
    alert(ok ? "บันทึกแล้ว" : "บันทึกขึ้นเซิร์ฟเวอร์ไม่สำเร็จ — โปรดลองอีกครั้ง");
  };

  // ขั้นตอนปัจจุบันจาก stage จริง
  const headIdx = Math.max(0, stages.findIndex((s) => s.pinned === "head"));
  const curIdx = existing?.stageId ? Math.max(0, stages.findIndex((s) => s.id === existing!.stageId)) : headIdx;
  const curStage = stages[curIdx];
  const nextStage = curIdx >= 0 ? stages[curIdx + 1] : undefined;
  const atCreateStage = stages.length > 0 && curIdx === headIdx;   // ขั้น "จัดทำ" (หัว)
  // เอกสารอยู่กับตัวเองไหม: รับแล้ว→ผู้รับล่าสุดถือ · ส่งแล้วยังไม่รับ→ลอย (ไม่ใช่ของเรา) · ยังไม่ส่ง→ของผู้ทำ
  const heldByMe = existing ? (existing.received ? existing.received.by === me : !existing.sent) : true;
  // ส่งมาให้ฉัน (อยู่กล่องรับเข้า) ยังไม่กดรับ → กดรับได้ · ใช้งานรายชื่อได้ต่อเมื่อ "ถืออยู่" (กดรับแล้ว) เท่านั้น
  const iAmRecipient = !!existing?.sent && !existing?.received && (() => { const rc = existing!.sent!.recipients; return !rc || rc.length === 0 || rc.includes(me); })();
  const canReceive = iAmRecipient && existing?.phase !== "DONE";
  const canWorkLeads = heldByMe;
  // แก้ไข/เพิ่ม-ลบรายชื่อ: ขั้น WORK/REVIEW + ต้องถืออยู่ · ลบเอกสาร: เฉพาะขั้นจัดทำ + ถืออยู่ · ส่ง: ต้องถืออยู่
  const editable = (!curStage || curStage.kind === "WORK" || curStage.kind === "REVIEW");
  const canEdit = editable && heldByMe;
  const canSend = !!existing && !!nextStage && heldByMe;
  const canDelete = !!existing && atCreateStage && heldByMe;
  // คะแนนรายชื่อ: ให้/ส่งได้เฉพาะ "ขั้นดำเนินการ" (WORK ที่ไม่ใช่ขั้นจัดทำ) + ถืออยู่ · ส่งแล้ว = ล็อก แก้ไม่ได้
  const ratingSent = !!existing?.values?.dataRatedBy;
  const atWorkStage = !atCreateStage && curStage?.kind === "WORK";
  const canRate = heldByMe && atWorkStage && !ratingSent;

  // รับ/ไม่รับ เอกสารที่ส่งมา (เหมือนใบคำขอ) — รับ = ถือเอกสาร · ไม่รับ = ตีกลับเข้ากล่องรับเข้าของผู้ส่ง พร้อมเหตุผล
  const openReceive = () => { setRecvMode("accept"); setRecvReason(""); setRecvOpen(true); };
  const confirmReceive = async () => {
    if (!existing) return;
    if (recvMode === "accept") {
      const ok = await saveClDoc({ ...existing, received: { by: me, at: Date.now() }, bounce: undefined, phase: "PROCESS", savedAt: Date.now() }, DOC);
      if (!ok) { alert("รับไม่สำเร็จ"); return; }
      appendFlowLog({ code, action: "RECEIVE", by: me, at: Date.now(), toStage: curStage?.name });
    } else {
      if (!recvReason.trim()) return;
      const prev = stages[Math.max(0, curIdx - 1)];
      const sender = existing.sent?.by || existing.telesale || "";
      const ok = await saveClDoc({
        ...existing,
        stageId: prev?.id ?? existing.stageId,
        phase: "RECEIVE",
        received: undefined,
        bounce: { by: me, at: Date.now(), reason: recvReason.trim() },
        sent: { by: me, to: sender, at: Date.now(), fromStage: curStage?.name, toStage: prev?.name, recipients: sender ? [sender] : [] },
        savedAt: Date.now(),
      }, DOC);
      if (!ok) { alert("ตีกลับไม่สำเร็จ"); return; }
      appendFlowLog({ code, action: "DECLINE", by: me, at: Date.now(), fromStage: curStage?.name, toStage: prev?.name, to: sender });
    }
    setRecvOpen(false);
    await syncSalesDocs(DOC);
  };
  // ปิดงาน CL (ไปขั้นเสร็จสิ้น) — ระบุผล ตามเป้า/ไม่ตามเป้า + บันทึก
  // เลือกเริ่มต้นให้อัตโนมัติจากการเทียบ "เป้า vs ทำได้" (ทำได้ครบทุกเป้า = ตามเป้า)
  const closeMetByData = (() => {
    const tF = tgt("targetFO"), tQ = tgt("targetQT"), tS = tgt("targetSO");
    const f = ops?.foCount ?? 0, q = ops?.qtCount ?? 0, s = ops?.soCount ?? 0;
    return (tF <= 0 || f >= tF) && (tQ <= 0 || q >= tQ) && (tS <= 0 || s >= tS);
  })();
  const openClose = () => { setCloseRes(closeMetByData ? "met" : "missed"); setCloseNote(""); setCloseOpen(true); };
  const doClose = async () => {
    if (!existing || !nextStage || !closeRes) return;
    const outVals = { ...(existing.values ?? {}), closeResult: closeRes, closeNote: closeNote.trim(), closeDate: new Date().toISOString().slice(0, 10) };
    const sent = { by: me, to: "—", at: Date.now(), fromStage: stages[curIdx]?.name, toStage: nextStage.name, recipients: [] as string[] };
    const ok = await saveClDoc({ ...existing, values: outVals, stageId: nextStage.id, received: undefined, phase: "DONE", sent, savedAt: Date.now() }, DOC);
    if (!ok) { alert("ปิดงานไม่สำเร็จ"); return; }
    appendFlowLog({ code, action: "DONE", by: me, to: closeRes === "met" ? "ตามเป้า" : "ไม่ตามเป้า", at: Date.now(), fromStage: stages[curIdx]?.name, toStage: nextStage.name });
    try { await completeClLeads(code); } catch { /* ignore */ }
    setCloseOpen(false);
    await syncSalesDocs(DOC);
    nav("/sales/cl?box=DONE");
  };
  // กดดาว/พิมพ์ความเห็นไว้ก่อน แล้วค่อยกด "ส่ง" ถึงจะบันทึกขึ้นเอกสาร
  const submitRating = async () => {
    if (!existing || !rateVal) return;
    setRateSaving(true);
    const outVals = { ...(existing.values ?? {}), dataRating: String(rateVal), dataRatingNote: rateNote.trim(), dataRatedBy: me };
    const ok = await saveClDoc({ ...existing, values: outVals, savedAt: Date.now() }, DOC);
    setRateSaving(false);
    if (ok) { setExisting({ ...existing, values: outVals }); setRateMsg("ส่งคะแนนแล้ว"); window.setTimeout(() => setRateMsg(""), 2500); }
    else alert("ส่งคะแนนไม่สำเร็จ — โปรดลองอีกครั้ง");
  };
  const doSend = async () => {
    if (!existing || !nextStage) return;
    const sent = { by: me, to: sendTo || "—", at: Date.now(), fromStage: stages[curIdx]?.name, toStage: nextStage.name, recipients: sendTo ? [sendTo] : [] };
    // ส่งแล้ว → เข้ากล่อง "รับเข้า" ของผู้รับ (phase=RECEIVE) · ผู้ส่งยังเห็นในกล่องส่งออก (จาก sent.by)
    const phase = nextStage.kind === "DONE" ? "DONE" as const : "RECEIVE" as const;
    // ออกจากขั้น "จัดทำ" ครั้งแรก → ล็อก "ปัจจัยในการเลือก" เก็บถาวร (ตรวจย้อนได้ว่าเลือกจากอะไร)
    let outVals = existing.values ?? {};
    if (atCreateStage && !outVals.factorSnap) {
      try {
        const sm = await fetchClSummary(code);
        outVals = { ...outVals, factorSnap: JSON.stringify({ salesTotal: sm.salesTotal, qtCount: sm.qtCount, foCount: sm.foCount, soCount: sm.soCount, at: Date.now() }) };
      } catch { /* ดึงสรุปไม่ได้ → ไม่ล็อก (ยังโชว์เรียลไทม์) */ }
    }
    const ok = await saveClDoc({ ...existing, values: outVals, stageId: nextStage.id, sent, received: undefined, phase, savedAt: Date.now() }, DOC);
    if (!ok) { alert("ส่งไม่สำเร็จ"); return; }
    setSendOpen(false);
    appendFlowLog({ code, action: nextStage.kind === "DONE" ? "DONE" : "SEND", by: me, to: sendTo || "ทั้งกลุ่ม", at: Date.now(), fromStage: stages[curIdx]?.name, toStage: nextStage.name });
    // ส่งจนจบ (DONE) → บันทึกว่าลูกค้าในชุดถูกใช้ +1 รอบ
    if (nextStage.kind === "DONE") { try { await completeClLeads(code); } catch { /* ignore */ } }
    // กฎ numbering = APPROVE → ออกเลขจริงเมื่อ "อนุมัติ" (ส่งจากขั้นอนุมัติ) ถ้ายังเป็น DRAFT
    if (getIssueEvent(DOC) === "APPROVE" && code.startsWith("DRAFT-") && curStage?.kind === "APPROVE") {
      await issueClCode(code, DOC);
    }
    // เด้งไปกล่อง CL แล้วเปิดกล่อง "ส่งออก" (เสร็จสิ้น = กล่อง DONE) — เหมือนใบคำขอ
    await syncSalesDocs(DOC);
    nav(`/sales/cl?box=${phase === "DONE" ? "DONE" : "EXPORT"}`);
  };
  const doDelete = async () => {
    if (!existing) return;
    if (!window.confirm("ลบเอกสารนี้? (ลบถาวร)")) return;
    await deleteClDoc(code, DOC);
    nav("/sales/cl");
  };
  // ดึงกลับ: เราเป็นคนส่ง และอีกฝ่ายยังไม่กดรับ → คืนเอกสารมาที่เรา (ย้อนขั้น + ล้าง sent)
  const canRecall = !!existing && !!existing.sent && existing.sent.by === me && !existing.received;
  const doRecall = async () => {
    if (!existing || !canRecall) return;
    if (!window.confirm("ดึงเอกสารกลับ? (อีกฝ่ายยังไม่ได้กดรับ)")) return;
    const prev = stages[Math.max(0, curIdx - 1)];
    const upd: ClDoc = { ...existing, sent: undefined, stageId: prev?.id ?? existing.stageId, phase: "PROCESS", savedAt: Date.now() };
    const ok = await saveClDoc(upd, DOC);
    if (!ok) { alert("ดึงกลับไม่สำเร็จ"); return; }
    appendFlowLog({ code, action: "RECALL", by: me, at: Date.now(), fromStage: curStage?.name, toStage: prev?.name });
    setExisting(upd); setFlowLog(loadFlowLog(code)); await syncSalesDocs(DOC);
    alert("ดึงเอกสารกลับแล้ว");
  };

  const actLabel = (a: FlowLogEntry["action"]) => ({ SEND: "ส่ง", RECEIVE: "รับเรื่อง", RECALL: "ดึงกลับ", DONE: "เสร็จสิ้น", DECLINE: "ไม่รับ / ตีกลับ" } as Record<string, string>)[a] ?? a;
  const flabel = (k: string) => t(`salesFields.${k}`, { defaultValue: k });
  const fset = (k: string, v: string) => setFv((s) => ({ ...s, [k]: v }));
  const fgroups = SALES_GROUPS
    .map((g) => ({ g, fields: enabledKeys.filter((k) => groupOf(DOC, k, grpOv) === g).map((k) => fieldsOf(DOC).find((f) => f.key === k)).filter(Boolean) as SalesField[] }))
    .filter((x) => x.fields.length > 0);

  const fctrl = (f: SalesField) => {
    const type = f.type ?? "text";
    const v = fv[f.key] ?? "";
    if (type === "textarea") return <textarea value={v} onChange={(e) => fset(f.key, e.target.value)} style={INP} />;
    if (type === "number") return <input type="number" value={v} onChange={(e) => fset(f.key, e.target.value)} style={INP} />;
    if (type === "date") return <input type="date" value={v} onChange={(e) => fset(f.key, e.target.value)} style={INP} />;
    if (type === "member") return (
      <select value={v} onChange={(e) => fset(f.key, e.target.value)} style={INP}><option value="">—</option>{users.map((u) => <option key={u} value={u}>{u}</option>)}</select>
    );
    if (type === "select") return (
      <select value={v} onChange={(e) => fset(f.key, e.target.value)} style={INP}><option value="">—</option>{getFieldOptions(DOC, f.key).map((o) => <option key={o} value={o}>{o}</option>)}</select>
    );
    if (type === "multiselect") {
      const sel = v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const toggle = (o: string) => fset(f.key, (sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o]).join(", "));
      return (
        <div className="ms-chips">
          {getFieldOptions(DOC, f.key).map((o) => (
            <button type="button" key={o} className={`ms-chip${sel.includes(o) ? " on" : ""}`} onClick={() => toggle(o)}>{o}</button>
          ))}
        </div>
      );
    }
    return <input value={v} onChange={(e) => fset(f.key, e.target.value)} style={INP} />;
  };

  return (
    <div className="p-clreport">
      {/* top bar */}
      <div className="topbar">
        <div className="qtag" style={{ background: "var(--purple)" }}>CL</div>
        <div className="app" style={{ cursor: "pointer" }} title="กลับหน้าหลัก" onClick={() => nav("/app")}>iDoc ERP</div>
        <CrossNavSelect fallback={<div className="doctitle">{code}{existing?.title ? ` · ${existing.title}` : ""}</div>} />
        <div className="u-spacer" />
        <div className="ic"><Help /></div>
        <div className="me">A</div>
      </div>

      {/* main: Documents tree + workzone · CL = ชุดรายชื่อ ไม่ใช่ต้นสายเอกสาร → โชว์แค่ตัวมันเอง ไม่โชว์เอกสารลูก (FO/QT/SO) */}
      <div className="layout">
        <div className={`dtree${collapsed ? " collapsed" : ""}`}>
          <div className="th">
            <span>Documents</span>
            <div className="collapse-btn" title="ยุบ/ขยาย" onClick={toggleTree}>
              <ChevronLeft size={16} />
            </div>
          </div>
          <div className="tlist">
            <div className="titem cl sel"><FileText />{code}</div>
          </div>

          <ModuleDeps moduleKey="sales" />
        </div>

        <div className="workzone">
          {/* toolbar — เมนูเฉพาะ CL (อยู่ในคอลัมน์ขวา) */}
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav("/sales/cl")}><ArrowLeft /><span>กลับกล่อง CL</span></div>
            {tab === "form" && canEdit && <div className="tbtn primary" onClick={() => { if (!saving) onSave(); }}><Save /><span>{saving ? "…" : "บันทึก"}</span></div>}
            {tab === "list" && !lockedTab("list") && canEdit && atCreateStage && (
              <div className={`tbtn primary${leadsDirty ? "" : " tbtn-off"}`} onClick={() => { if (leadsDirty) leadRef.current?.save(); }} title={leadsDirty ? "บันทึกชุดรายชื่อ" : "ไม่มีการแก้ไข"}>
                <Save /><span>บันทึกรายชื่อ{leadsDirty ? " *" : ""}</span>
              </div>
            )}
            {canReceive && <div className="tbtn primary" onClick={openReceive}><CheckCircle /><span>รับ</span></div>}
            {canDelete && <div className="tbtn" style={{ color: "var(--red)" }} onClick={doDelete}><Trash size={15} /><span>ลบ</span></div>}
            {canSend && nextStage?.kind === "DONE" && <div className="tbtn primary" onClick={openClose}><CheckCircle /><span>ปิดงาน</span></div>}
            {canSend && nextStage?.kind !== "DONE" && <div className="tbtn primary" onClick={() => { setSendTo(""); setSendOpen(true); }}><CheckCircle /><span>ส่ง</span></div>}
            {canRecall && <div className="tbtn" style={{ color: "var(--amber, #b28600)" }} onClick={doRecall} title="ดึงเอกสารกลับ (อีกฝ่ายยังไม่รับ)"><Refresh style={{ transform: "scaleX(-1)" }} /><span>ดึงกลับ</span></div>}
          </div>

          {/* Flow — ขั้นตอนจริงจาก workflow (CL) */}
          <div className="stepper">
            {stages.length === 0 ? <span className="muted" style={{ fontSize: 12.5 }}>—</span> : stages.map((s, i) => (
              <Fragment key={s.id}>
                {i > 0 && <div className="stepline" />}
                <div className={`step${i < curIdx ? " done" : i === curIdx ? " cur" : ""}`}>
                  <span className="sn">{i < curIdx ? <Check size={13} /> : i + 1}</span>{s.name}
                </div>
              </Fragment>
            ))}
          </div>

          {/* doc tabs */}
          <div className="tabs">
            {tabs.map((tk) => {
              const lk = lockedTab(tk.key);
              return (
                <div key={tk.key} className={`tab${tab === tk.key ? " active" : ""}${lk ? " locked" : ""}`} onClick={() => setTab(tk.key)} title={lk ? "ต้องเปิดโมดูลลูกค้า (CRM) ก่อน" : undefined}>
                  {tk.label}{lk && <Lock size={12} style={{ marginLeft: 5, verticalAlign: "-1px" }} />}
                </div>
              );
            })}
          </div>

          {tab === "form" ? (
            <fieldset className="rpt cl-form" disabled={!canEdit} style={{ border: 0, margin: 0, padding: "22px 26px", minInlineSize: "auto" }}>
              <div className="rpt-head">ข้อมูลชุด CL — {code}</div>
              <div className="rpt-sub">กรอกข้อมูลชุดรายชื่อสำหรับโทรเสนอ</div>
              {!canEdit && <div className="cl-readonly-note"><Lock size={13} />{!heldByMe ? "เอกสารนี้ไม่ได้อยู่กับคุณ — แก้ไข/ลบ/ส่งไม่ได้" : `ขั้น “${curStage?.name}” แก้ไขไม่ได้ — แก้ได้เฉพาะขั้นสร้าง/ตรวจ`}</div>}
              {fgroups.map(({ g, fields }) => (
                <div className="rpt-card" key={g} style={{ marginBottom: 18 }}>
                  <div className="st">{t(`salesFields.group.${g}`, { defaultValue: g })}</div>
                  <div className="cl-form-grid">
                    {g === "general" && (
                      <div className="cl-fld">
                        <label>รหัสเอกสาร</label>
                        <input value={code} readOnly style={{ ...INP, background: "var(--bg)" }} />
                      </div>
                    )}
                    {fields.map((f) => (
                      <div className="cl-fld" key={f.key} style={{ gridColumn: f.type === "textarea" ? "1 / -1" : undefined }}>
                        <label>{flabel(f.key)}{f.core ? " *" : ""}</label>
                        {fctrl(f)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
          ) : tab === "list" ? (
            lockedTab("list") ? (
              <div className="rpt">
                <div className="rpt-card dep-lock">
                  <div className="dep-lock-icon"><Lock size={26} /></div>
                  <div className="dep-lock-t">ใช้แท็บ “รายชื่อ” ไม่ได้</div>
                  <div className="dep-lock-d">ต้องเปิดโมดูล <b>{crmDep?.label ?? "ลูกค้า (CRM)"}</b> ของบริษัทก่อน จึงจะเพิ่ม/เรียกข้อมูลรายชื่อจากโมดูลลูกค้าได้</div>
                </div>
              </div>
            ) : atCreateStage ? (
              /* ขั้น "จัดทำ" → สร้าง/ดึงรายชื่อเข้าชุด (ตะกร้าซื้อจริง) */
              <ClLeadBox ref={leadRef} code={code} onDirty={setLeadsDirty} readOnly={!canEdit} />
            ) : (
              /* ขั้น "ดำเนินการ" เป็นต้นไป → สรุปการโทร + เครื่องมือทำงานรายคน */
              <ClWorklist code={code} owner={existing?.telesale} readOnly={!canWorkLeads} />
            )
          ) : (
          <div className="rpt">
            <div className="rpt-head">สรุปภาพรวม — {code}</div>

            <div className="ov-subtabs">
              <button className={ovSec === "sales" ? "on" : ""} onClick={() => setOvSec("sales")}>ปัจจัยในการเลือกและเป้าหมายการโทร</button>
              <button className={ovSec === "ops" ? "on" : ""} onClick={() => setOvSec("ops")}>ผลลัพธ์</button>
            </div>

            {ovSec === "ops" ? (
              <>
                {/* ความคืบหน้าการโทร */}
                <div className="rpt-card" style={{ marginBottom: 14 }}>
                  <div className="cl-doc-meta" style={{ marginBottom: 10 }}>
                    <div>โทรแล้ว (รายชื่อ) <b>{wlCalled}/{wlTotal}</b></div>
                    <div>คืบหน้า <b>{wlPct}%</b></div>
                  </div>
                  <div className="cl-progress"><span style={{ width: `${wlPct}%` }} /></div>
                </div>

                {!ops ? <div className="ph-note">กำลังโหลดผลลัพธ์…</div> : (
                <>
                <div className="kpis">
                  <div className="kpi"><div className="kl">โทรติดตาม (ครั้ง)</div><div className="kv2">{ops.callCount}</div><div className="ks">รวมโทรซ้ำ</div></div>
                  <div className="kpi"><div className="kl">ติดตามไม่ซ้ำราย</div><div className="kv2">{ops.callDistinct}</div><div className="ks">ลูกค้าที่ได้โทร</div></div>
                  <div className="kpi"><div className="kl">ยอดขายประมาณการ (฿)</div><div className="kv2">{baht(ops.qtEstimate)}</div><div className="ks">ราคาเสนอใน QT</div></div>
                  <div className="kpi"><div className="kl">ยอดขายจริง (฿)</div><div className="kv2">{baht(ops.soSales)}</div><div className="ks">จาก SO ของชุดนี้</div></div>
                  {/* คะแนนรายชื่อ — ใบที่ 5 ต่อท้ายในแถว KPI เดียวกัน */}
                  <div className="rpt-card cl-rate-mini" style={{ margin: 0 }}>
                    <div className="cl-rate-title">คะแนนรายชื่อ (จากผู้ส่ง)</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} onClick={() => { if (canRate) setRateVal(n); }} title={canRate ? `ให้ ${n} ดาว` : undefined}
                          style={{ cursor: canRate ? "pointer" : "default", fontSize: 17, lineHeight: 1, color: n <= rateVal ? "#f5b301" : "#d2d8e0" }}>★</span>
                      ))}
                      <span className="muted" style={{ fontSize: 11.5, marginLeft: 6 }}>{rateVal ? `${rateVal}/5` : "ยังไม่ให้คะแนน"}{existing?.values?.dataRatedBy ? ` · ${existing.values.dataRatedBy}` : ""}</span>
                      {ratingSent && <span style={{ fontSize: 11.5, marginLeft: 4, color: "var(--txt3)" }}>· ส่งแล้ว</span>}
                      {rateMsg && <span style={{ fontSize: 11.5, marginLeft: 4, color: "var(--green, #1f7a44)" }}>{rateMsg}</span>}
                    </div>
                    {canRate ? (
                      <>
                        <input value={rateNote} onChange={(e) => setRateNote(e.target.value)}
                          placeholder="ความเห็น (เช่น เบอร์ผิดเยอะ / ตรงกลุ่มดี)"
                          style={{ width: "100%", marginTop: 6, padding: "6px 8px", border: "1px solid var(--field-bd)", borderRadius: 7, fontSize: 12 }} />
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                          <button className="btn primary" style={{ padding: "5px 12px", fontSize: 12.5 }} disabled={!rateVal || rateSaving} onClick={submitRating}>
                            <Check size={13} />{rateSaving ? "กำลังส่ง…" : "ส่ง"}
                          </button>
                        </div>
                      </>
                    ) : (existing?.values?.dataRatingNote && <div className="muted" style={{ fontSize: 11.5, marginTop: 5 }}>“{existing.values.dataRatingNote}”</div>)}
                    <div className="muted" style={{ fontSize: 10.5, marginTop: 5 }}>{
                      canRate ? "ให้คะแนนแล้วกด “ส่ง” — ส่งได้ครั้งเดียว แก้ไม่ได้"
                      : ratingSent ? "ส่งคะแนนแล้ว — แก้ไม่ได้"
                      : !heldByMe ? "ดูอย่างเดียว (ไม่ได้ถือเอกสาร)"
                      : "ให้คะแนนได้เฉพาะขั้นดำเนินการ"
                    }</div>
                  </div>
                </div>

                <div className="grid2">
                  <div className="rpt-card">
                    <div className="st">เปิดเอกสารเทียบเป้า (อ้างอิง CL นี้)</div>
                    <div className="funnel">
                      {([["เปิด FO", ops.foCount, tgt("targetFO")], ["เปิด QT", ops.qtCount, tgt("targetQT")], ["เปิด SO", ops.soCount, tgt("targetSO")]] as [string, number, number][]).map(([lb, val, t2]) => {
                        const pct = t2 > 0 ? Math.min(100, Math.round((val / t2) * 100)) : 0;
                        return (
                          <div className="fbar" key={lb}>
                            <div className="fl"><span>{lb}</span><span className="num">{val}/{t2 || "—"}{t2 ? ` (${pct}%)` : ""}</span></div>
                            <div className="ft"><span style={{ width: `${pct}%` }} /></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rpt-card">
                    <div className="st">คำขอที่อ้างอิง CL นี้</div>
                    <div className="sbar">
                      <div className="srow"><span className="dot" style={{ background: "#da1e28" }} /><span className="sn2">ข้อมูลผิด (ขอแก้ไข)</span><span className="sv2 num">{reqEditCount}</span></div>
                      <div className="srow"><span className="dot" style={{ background: "#b28600" }} /><span className="sn2">ขอปรับสถานะ</span><span className="sv2 num">{reqStatusCount}</span></div>
                    </div>
                  </div>
                </div>
                </>
                )}
              </>
            ) : !summary ? (
              <div className="ph-note">กำลังโหลดสรุป…</div>
            ) : (
              <>
                <div className="rpt-sub" style={{ marginBottom: 14 }}>{factorSnap
                  ? `ค่าที่ล็อกไว้ตอนเริ่มดำเนินการ (ถาวร — ตรวจย้อนได้ว่าเลือกจากอะไร)${factorSnap.at ? ` · ${new Date(factorSnap.at).toLocaleDateString("th-TH")}` : ""}`
                  : "เรียลไทม์ (ยังไม่ล็อก) — จะถูกล็อกถาวรเมื่อส่งออกจากขั้นจัดทำ"}</div>
                <div className="kpis">
                  <div className="kpi"><div className="kl">ยอดขายย้อนหลัง (฿)</div><div className="kv2">{baht(factorSnap ? factorSnap.salesTotal : Math.max(0, summary.salesTotal - (ops?.soSales ?? 0)))}</div><div className="ks">SO เดิม (ไม่รวมของชุดนี้)</div></div>
                  <div className="kpi"><div className="kl">ใบเสนอราคา (QT)</div><div className="kv2">{factorSnap ? factorSnap.qtCount : Math.max(0, summary.qtCount - (ops?.qtCount ?? 0))}</div><div className="ks">เดิม ไม่รวมของชุดนี้</div></div>
                  <div className="kpi"><div className="kl">เปิดใบเสนอ/ติดตาม (FO)</div><div className="kv2">{factorSnap ? factorSnap.foCount : Math.max(0, summary.foCount - (ops?.foCount ?? 0))}</div><div className="ks">เดิม ไม่รวมของชุดนี้</div></div>
                  <div className="kpi"><div className="kl">ปิดการขาย (SO)</div><div className="kv2">{factorSnap ? factorSnap.soCount : Math.max(0, summary.soCount - (ops?.soCount ?? 0))}</div><div className="ks">เดิม ไม่รวมของชุดนี้</div></div>
                </div>

                <div className="grid2">
                  <div className="rpt-card">
                    <div className="st">กลุ่มผลิตภัณฑ์ / ขอบข่าย</div>
                    {summary.groups.length === 0 ? <div className="ph-note">—</div>
                      : <div className="ov-chips">{summary.groups.map((g) => <span className="chip" key={g.name}>{g.name} · {g.count}</span>)}</div>}
                  </div>
                  <div className="rpt-card">
                    <div className="st">เกรดลูกค้า</div>
                    {summary.grades.length === 0 ? <div className="ph-note">—</div>
                      : <div className="ov-chips">{summary.grades.map((g) => <span className="chip" key={g.name}>เกรด {g.name} · {g.count}</span>)}</div>}
                  </div>
                  <div className="rpt-card">
                    <div className="st">ระบบ / การรับรองที่ลูกค้ามี</div>
                    {summary.systems.length === 0 ? <div className="ph-note">— ยังไม่มีข้อมูลระบบ</div>
                      : <div className="ov-chips">{summary.systems.map((s) => <span className="chip blue" key={s}>{s}</span>)}</div>}
                  </div>
                  <div className="rpt-card">
                    <div className="st">เทคนิคในการขายที่นำเสนอ</div>
                    {summary.techniques.length === 0 ? <div className="ph-note">— ยังไม่มีข้อมูล</div>
                      : <div className="ov-chips">{summary.techniques.map((s) => <span className="chip" key={s}>{s}</span>)}</div>}
                  </div>
                  <div className="rpt-card">
                    <div className="st">ปิดบริการอะไร</div>
                    {summary.services.length === 0 ? <div className="ph-note">— ยังไม่มีข้อมูล</div>
                      : <div className="ov-chips">{summary.services.map((s) => <span className="chip green" key={s}>{s}</span>)}</div>}
                  </div>
                </div>
              </>
            )}
          </div>
          )}
        </div>

        {/* เมนูขวา: การตรวจทาน — แสดง Log การส่ง/ดึงกลับ */}
        <div className="fo-rightwrap">
          {reviewOpen && (
            <div className="fo-hpanel">
              <div className="fo-hh"><span>การตรวจทาน</span><div className="x" title="ปิดแผง" onClick={() => setReview(false)}><X size={16} /></div></div>
              <div className="fo-hbody">
                <AgeBadge doc="CL" startMs={existing?.received?.at || existing?.sent?.at || existing?.savedAt} overrideDays={Number(fv.timeframeCL) || undefined} />
                {flowLog.length === 0 ? (
                  <div className="muted" style={{ fontSize: 12.5 }}>ยังไม่มีประวัติการส่ง</div>
                ) : (
                  <div className="cl-review">
                    {flowLog.map((e, i) => (
                      <div className="cl-review-item" key={i}>
                        <div className="cl-review-top"><span className={`cl-review-act ${e.action.toLowerCase()}`}>{actLabel(e.action)}</span>
                          <span className="cl-review-time">{new Date(e.at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</span></div>
                        <div className="cl-review-meta">{e.by}{e.to ? ` → ${e.to}` : ""}</div>
                        {(e.fromStage || e.toStage) && <div className="cl-review-stage">{e.fromStage || "—"} → {e.toStage || "—"}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="fo-rail">
            <div className={`fo-ritem${reviewOpen ? " active" : ""}`} onClick={() => setReview(!reviewOpen)}><Shield size={20} /><span>ตรวจทาน</span></div>
          </div>
        </div>
      </div>

      {sendOpen && nextStage && (
        <div className="wf-flow-ov" onClick={() => setSendOpen(false)}>
          <div className="wf-flow-card" onClick={(e) => e.stopPropagation()}>
            <div className="wf-flow-h"><span>ส่งเอกสาร</span><button className="x" onClick={() => setSendOpen(false)}><X size={16} /></button></div>
            <div className="wf-flow-b">
              <div className="wf-flow-line">
                <div className="wf-flow-node"><span className="lbl">จาก</span><span className="who">{me || "—"}</span><span className="stg">{stages[curIdx]?.name}</span></div>
                <span className="wf-flow-arrow"><ArrowRight size={20} /></span>
                <div className="wf-flow-node to"><span className="lbl">ไปยัง</span><span className="who">{sendTo || (users.length > 1 ? "เลือกด้านล่าง" : users[0] || "ทั้งกลุ่ม")}</span><span className="stg">{nextStage.name}</span></div>
              </div>
              {users.length > 1 && (
                <div className="wf-flow-pick">
                  <label className="wf-lbl">เลือกผู้รับ</label>
                  <select value={sendTo} onChange={(e) => setSendTo(e.target.value)}>
                    <option value="">ส่งทั้งกลุ่ม (เหมา) · {users.length} คน</option>
                    {users.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <div className="wf-flow-pickhint">{sendTo ? "ส่งเจาะจงคนเดียว" : "ส่งทั้งกลุ่ม ใครรับก่อนได้งาน"}</div>
                </div>
              )}
            </div>
            <div className="wf-flow-f">
              <button className="btn" onClick={() => setSendOpen(false)}>ยกเลิก</button>
              <button className="btn primary" onClick={doSend}><CheckCircle size={15} />ยืนยันส่ง</button>
            </div>
          </div>
        </div>
      )}

      {recvOpen && (
        <div className="wf-flow-ov" onClick={() => setRecvOpen(false)}>
          <div className="wf-flow-card" onClick={(e) => e.stopPropagation()}>
            <div className="wf-flow-h"><span>รับเอกสาร</span><button className="x" onClick={() => setRecvOpen(false)}><X size={16} /></button></div>
            <div className="wf-flow-b">
              <div className="wf-seg" style={{ marginBottom: 12 }}>
                <button className={recvMode === "accept" ? "on" : ""} onClick={() => setRecvMode("accept")}>รับเรื่อง</button>
                <button className={recvMode === "decline" ? "on" : ""} onClick={() => setRecvMode("decline")}>ไม่รับ (ตีกลับ)</button>
              </div>
              {recvMode === "accept" ? (
                <div className="muted" style={{ fontSize: 13 }}>กดรับแล้วเอกสารจะเข้ากล่อง “ดำเนินการ” ของคุณ และถือว่าคุณเป็นผู้รับผิดชอบ</div>
              ) : (
                <div className="wf-flow-pick">
                  <label className="wf-lbl">เหตุผลที่ไม่รับ (ตีกลับให้ผู้ส่ง)</label>
                  <textarea value={recvReason} onChange={(e) => setRecvReason(e.target.value)} placeholder="ระบุเหตุผล…" style={{ width: "100%", minHeight: 64, padding: "8px 10px", border: "1px solid var(--field-bd)", borderRadius: 8, fontSize: 13.5 }} />
                </div>
              )}
            </div>
            <div className="wf-flow-f">
              <button className="btn" onClick={() => setRecvOpen(false)}>ยกเลิก</button>
              <button className="btn primary" disabled={recvMode === "decline" && !recvReason.trim()} onClick={confirmReceive}><CheckCircle size={15} />{recvMode === "accept" ? "ยืนยันรับ" : "ยืนยันตีกลับ"}</button>
            </div>
          </div>
        </div>
      )}

      {closeOpen && nextStage && (
        <div className="wf-flow-ov" onClick={() => setCloseOpen(false)}>
          <div className="wf-flow-card" onClick={(e) => e.stopPropagation()}>
            <div className="wf-flow-h"><span>ปิดงาน CL — {code}</span><button className="x" onClick={() => setCloseOpen(false)}><X size={16} /></button></div>
            <div className="wf-flow-b">
              <div className="wf-lbl" style={{ marginBottom: 6 }}>เป้าหมาย vs ทำได้</div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 12, fontSize: 13 }}>
                {([["FO", "targetFO", ops?.foCount ?? 0], ["QT", "targetQT", ops?.qtCount ?? 0], ["SO", "targetSO", ops?.soCount ?? 0]] as [string, string, number][]).map(([lb, tk, act]) => {
                  const tv = tgt(tk); const ok = tv <= 0 || act >= tv;
                  return <div key={lb}><span className="muted">{lb}</span> <b>{act}</b><span className="muted"> / {tv || "—"}</span> <span style={{ color: ok ? "var(--green,#1f7a44)" : "var(--red,#c0392b)" }}>{tv > 0 ? (ok ? "✓" : "✗") : ""}</span></div>;
                })}
              </div>
              <div className="wf-lbl" style={{ marginBottom: 8 }}>ผลของชุดรายชื่อนี้ <span className="muted" style={{ fontWeight: 400 }}>(เลือกให้ตามข้อมูล แก้ได้)</span></div>
              <div className="wf-seg" style={{ marginBottom: 12 }}>
                <button className={closeRes === "met" ? "on won" : ""} onClick={() => setCloseRes("met")}>ตามเป้า (สำเร็จ)</button>
                <button className={closeRes === "missed" ? "on lost" : ""} onClick={() => setCloseRes("missed")}>ไม่ตามเป้า</button>
              </div>
              <div className="wf-flow-pick">
                <label className="wf-lbl">บันทึก / เหตุผล</label>
                <textarea value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="สรุปผลการโทรของชุดนี้…" style={{ width: "100%", minHeight: 64, padding: "8px 10px", border: "1px solid var(--field-bd)", borderRadius: 8, fontSize: 13.5 }} />
              </div>
            </div>
            <div className="wf-flow-f">
              <button className="btn" onClick={() => setCloseOpen(false)}>ยกเลิก</button>
              <button className="btn primary" disabled={!closeRes} onClick={doClose}><CheckCircle size={15} />ยืนยันปิดงาน</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
