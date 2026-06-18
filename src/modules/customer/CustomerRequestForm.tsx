import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch, type Page } from "../../shared/api";
import { getSession } from "../../shared/session";
import AttachmentBox from "../../shared/AttachmentBox";
import { ArrowLeft, ArrowRight, CheckCircle, Check, X, Shield, Paperclip, FileText, Search, ChevronLeft, Save, Trash } from "../../shared/icons";
import CrmHelpButton from "./CrmHelpButton";
import LangSwitcher from "../../shared/LangSwitcher";
import CrossNavSelect from "../../shared/CrossNavSelect";
import ThaiAddressInput from "../hr/ThaiAddressInput";
import { CUST_FIELDS, GROUPS, COLUMN_KEYS, type CustField } from "./customerFields";
import { getEnabledFields } from "./customerFieldConfig";
import { getFieldOptions } from "./customerFieldOptions";
import { getEnabledStatuses, getStatusOverride } from "./customerStatusConfig";
import { saveRequest, deleteRequest, getRequest, appendLog, loadLog, relabelLog, saveReqTab } from "./customerRequests";
import { fetchStages, defaultStages, fetchAuthorities, pickAuthorityFrame, memberAt, memberIsEmpty, resolveCandidates, fetchModuleUsers, docTypesOf, loadUsedFrame, storeUsedFrame, getIssueEvent, type Stage, type Authority, type MemberRule, type UsedFrame } from "../workflow/workflowConfig";
import { getDoc } from "../workflow/docRegistry";
import "./registerDocs"; // ลงทะเบียนเอกสาร CRM (side-effect)
import "../sales/qt.css";
import "./request.css";

// เอกสารของโมดูล CRM เท่านั้น → ดึง stages/authorities เฉพาะ docType ของโมดูลนี้
const MODULE = "crm";
const REQ_DOCTYPE = docTypesOf(MODULE)[0]?.code ?? "REQUEST";

/** ระยะห่างแก้คำ (Levenshtein) → ใช้วัด "โอกาสซ้ำ" ของชื่อ */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[m];
}
/** ความเหมือน 0–100% */
function similarityPct(a: string, b: string): number {
  const x = a.trim().toLowerCase(), y = b.trim().toLowerCase();
  if (!x || !y) return 0;
  return Math.round((1 - levenshtein(x, y) / Math.max(x.length, y.length)) * 100);
}
const genReqCode = () => `REQ-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
const genDraft = () => `DRAFT-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
const isDraft = (c?: string | null) => !!c && c.startsWith("DRAFT-");

type Topic = "ADD" | "EDIT" | "STATUS";
type Customer = { id: string; code: string; name: string; status?: string; groupName?: string; attributes?: Record<string, string> };

const isColumn = (k: string) => COLUMN_KEYS.includes(k);
const FLOWTO_KEY = `idoc.req.flowTo.${REQ_DOCTYPE}`;   // จำผู้รับที่เลือกส่งล่าสุด (ต่อชนิดเอกสาร)

export default function CustomerRequestForm() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();
  const tenant = session?.companyId ?? "";
  const { code: routeCode } = useParams(); // มี = เปิดเอกสารเดิมมาแก้ · ไม่มี = สร้างใหม่
  const [sp] = useSearchParams();          // ทางลัด: ?topic=EDIT&customer=REGxxx (มาจากกล่อง CL ฯลฯ)

  const [topic, setTopic] = useState<Topic>("ADD");
  const [all, setAll] = useState<Customer[]>([]);
  const [lookup, setLookup] = useState<Customer[]>([]); // ผลค้นจาก DB (prefix)
  const [picked, setPicked] = useState<Customer | null>(null);
  const [origin, setOrigin] = useState<{ type: string; code: string } | null>(null); // ที่มาคำขอ (เช่นมาจาก CL) ไว้สืบย้อน
  const lockTopic = !routeCode && !!sp.get("customer"); // มาทางลัด (เช่นจากกล่อง CL) → ล็อกเรื่องไว้ ห้ามสลับไป "เพิ่ม"
  const [q, setQ] = useState("");
  const [openPick, setOpenPick] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("ACTIVE");
  const [pane, setPane] = useState<"review" | "files">("review");
  const [panelOpen, setPanelOpen] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [saved, setSaved] = useState(false);          // บันทึกใบเอกสารจริงแล้วหรือยัง
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [original, setOriginal] = useState<string>(""); // snapshot ตอนเลือกลูกค้า (ใช้ตรวจว่ามีการแก้ไข)

  // กดเมนูฝั่งขวา: กดซ้ำที่แผงเดิม = ปิด
  const pickPane = (key: "review" | "files") => {
    if (pane === key && panelOpen) { setPanelOpen(false); return; }
    setPane(key); setPanelOpen(true);
  };

  const enabled = getEnabledFields();
  const enabledSet = new Set(enabled);

  // กฎออกเลข (numbering) ของเอกสารนี้ — ออกเลขจริงเมื่อถึงเหตุการณ์ที่ตั้งไว้เท่านั้น
  const issueEvent = getIssueEvent(REQ_DOCTYPE);                 // CREATE | RECEIVE | APPROVE
  const issued = !!savedCode && !isDraft(savedCode);            // ออกเลขจริงแล้วหรือยัง
  const ruleLabel = t(issueEvent === "CREATE" ? "custReq.ruleCreate" : issueEvent === "RECEIVE" ? "custReq.ruleReceive" : "custReq.ruleApprove");

  // ดึงขั้นจริงจาก workflow (จัดทำ → ดำเนินการ → ตรวจสอบ → อนุมัติ → เสร็จสิ้น) — สร้างใหม่ = อยู่ขั้นแรก
  const [stages, setStages] = useState<Stage[]>(() => defaultStages());
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowMode, setFlowMode] = useState<"approve" | "reject">("approve"); // เฉพาะขั้นอนุมัติ
  const [flowReason, setFlowReason] = useState("");
  const [flowBusy, setFlowBusy] = useState(false);
  const [flowErr, setFlowErr] = useState("");
  const [flowTo, setFlowTo] = useState("");        // ผู้รับที่เลือก ("" = ส่งทั้งกลุ่ม/เหมา ใครรับก่อนได้งาน)
  const [moduleUsers, setModuleUsers] = useState<string[]>([]); // คนที่มีสิทธิ์โมดูลนี้ (สำหรับ mode ALL)
  const [confirmDel, setConfirmDel] = useState(false);
  // รับเรื่อง (acknowledge / ตีกลับ)
  const [loadedPhase, setLoadedPhase] = useState<string | null>(null);
  const [received, setReceived] = useState<{ by: string; at: number } | null>(null);
  const [bounce, setBounce] = useState<{ by: string; at: number; reason: string } | null>(null);
  const [recvOpen, setRecvOpen] = useState(false);
  const [recvMode, setRecvMode] = useState<"accept" | "decline">("accept");
  const [recvReason, setRecvReason] = useState("");
  const [usedFrame, setUsedFrame] = useState<UsedFrame | null>(() => loadUsedFrame(REQ_DOCTYPE)); // กรอบสิทธิ์ที่บันทึกไว้
  const [stageId, setStageId] = useState<string | undefined>(undefined); // ขั้นปัจจุบัน (เลื่อนเมื่อส่ง)
  const [log, setLog] = useState<ReturnType<typeof loadLog>>([]);
  useEffect(() => { fetchStages(REQ_DOCTYPE).then(setStages).catch(() => {}); }, []);
  useEffect(() => { fetchAuthorities(REQ_DOCTYPE).then(setAuthorities).catch(() => {}); }, []);
  useEffect(() => { fetchModuleUsers(MODULE).then(setModuleUsers).catch(() => {}); }, []);
  // เพิ่งเปิดมาสร้าง = อยู่ขั้น "จัดทำ" (head) ยังไม่ขยับ · ขั้นจะขยับต่อเมื่อ "ส่ง (FLOW)" เท่านั้น
  const headIdx = Math.max(0, stages.findIndex((s) => s.pinned === "head"));
  const curStageIdx = (() => {
    if (stageId) { const i = stages.findIndex((s) => s.id === stageId); if (i >= 0) return i; }
    return headIdx;
  })();

  const describeMember = (m?: MemberRule): string => {
    if (!m) return "—";
    if (m.mode === "ALL") return t("custReq.flow.modeAll");
    if (m.mode === "USERS") return m.users.length ? m.users.join(", ") : "—";
    const parts = [...m.positions, ...m.departments, ...m.divisions];
    return parts.length ? parts.join(" · ") : "—";
  };

  // โหลดชุดเล็ก (ล่าสุด) ไว้โชว์ตอนยังไม่พิมพ์ + ใช้ตรวจชื่อซ้ำคร่าว ๆ ตอน ADD
  useEffect(() => {
    if (tenant) apiFetch<Page<Customer>>("/customers?size=300", { tenant }).then((p) => setAll(p.content)).catch(() => {});
  }, [tenant]);

  // ค้นหาลูกค้า "จริงที่ DB" แบบ prefix (ส่วนหน้า) — เร็วแม้ลูกค้าหลักหมื่น (debounce 250ms)
  useEffect(() => {
    const s = q.trim();
    if (!s || !tenant) { setLookup([]); return; }
    const h = setTimeout(() => {
      apiFetch<Customer[]>(`/customers/lookup?q=${encodeURIComponent(s)}&limit=30`, { tenant })
        .then(setLookup).catch(() => setLookup([]));
    }, 250);
    return () => clearTimeout(h);
  }, [q, tenant]);

  // เปิดเอกสารเดิม → โหลดข้อมูลใบนั้นเข้าฟอร์ม
  useEffect(() => {
    if (!routeCode) return;
    const rec = getRequest(routeCode);
    if (!rec) return;
    setTopic(rec.topic as Topic);
    setValues(rec.values ?? {});
    setOriginal(JSON.stringify(rec.origValues ?? rec.values ?? {})); // เทียบกับค่าเดิมตอนเริ่มแก้
    setStatus(rec.status);
    setSavedCode(rec.code);
    setSaved(true);
    setLoadedPhase(rec.phase);
    setReceived(rec.received ?? null);
    setBounce(rec.bounce ?? null);
    setStageId(rec.stageId);
    setOrigin(rec.origin ?? null);
    setLog(loadLog(rec.code));
    // กู้ลูกค้าที่เลือก (EDIT/STATUS) — มี rec.picked หรือถอดจากสตริง "รหัส · ชื่อ"
    let p: Customer | null = null;
    if (rec.picked) p = { id: rec.picked.id, code: rec.picked.code, name: rec.picked.name, status: rec.picked.status } as Customer;
    else if (rec.topic !== "ADD" && rec.customer) {
      const i = rec.customer.indexOf(" · ");
      const cCode = i >= 0 ? rec.customer.slice(0, i) : rec.customer;
      const cName = i >= 0 ? rec.customer.slice(i + 3) : "";
      p = { id: cCode, code: cCode, name: cName, status: rec.status } as Customer;
    }
    setPicked(p);
  }, [routeCode]);

  // เปลี่ยนเรื่อง = เริ่มใหม่
  const changeTopic = (tp: Topic) => { setTopic(tp); setPicked(null); setValues({}); setStatus("ACTIVE"); setSubmitted(false); setSaved(false); setSavedCode(null); setOriginal(""); };

  // เลือกลูกค้า (EDIT/STATUS) → ดึงค่ามาให้แก้ + เก็บ snapshot ไว้เทียบการแก้ไข
  const choose = (c: Customer) => {
    setPicked(c); setQ(""); setOpenPick(false); setSubmitted(false); setSaved(false);
    setStatus(c.status || "ACTIVE");
    const attrs = c.attributes ?? {};
    const next: Record<string, string> = {};
    CUST_FIELDS.forEach((f) => { next[f.key] = isColumn(f.key) ? String((c as Record<string, unknown>)[f.key] ?? "") : String(attrs[f.key] ?? ""); });
    setValues(next);
    setOriginal(JSON.stringify(next));
  };

  // ทางลัด: เปิดมาพร้อม ?customer=CODE (เช่นจากกล่อง CL ปุ่ม "ขอแก้ไข") → ตั้งเรื่องตาม ?topic (ปริยาย EDIT) + เลือกลูกค้าให้อัตโนมัติ
  const prefillCustomer = sp.get("customer");
  useEffect(() => {
    if (routeCode || !prefillCustomer || !tenant) return;
    const tp = (sp.get("topic") || "EDIT").toUpperCase();
    if (tp === "EDIT" || tp === "STATUS") setTopic(tp as Topic);
    const srcType = sp.get("srcType"); const srcCode = sp.get("srcCode");
    if (srcType && srcCode) setOrigin({ type: srcType, code: srcCode });
    apiFetch<Customer[]>(`/customers/lookup?q=${encodeURIComponent(prefillCustomer)}&limit=10`, { tenant })
      .then((rows) => { const c = rows.find((x) => x.code === prefillCustomer) || rows[0]; if (c) choose(c); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillCustomer, routeCode, tenant]);

  const set = (k: string, v: string) => { setValues((s) => ({ ...s, [k]: v })); setSaved(false); };
  const changeStatus = (v: string) => { setStatus(v); setSaved(false); };
  const val = (k: string) => values[k] ?? "";

  // ยังไม่พิมพ์ = โชว์ล่าสุด · พิมพ์แล้ว = ผลค้นจาก DB (prefix ส่วนหน้า)
  const matches = useMemo(() => (q.trim() ? lookup : all.slice(0, 30)), [q, all, lookup]);

  // ===== ตรวจทาน (ต้องผ่านครบก่อนส่งจริง) =====
  const nameVal = val("name").trim();
  const nameFilled = !!nameVal;
  // โอกาสซ้ำ = ความเหมือนสูงสุดกับชื่อลูกค้าที่มีอยู่ (ADD ต้อง < 50%)
  const maxSim = topic === "ADD" && nameFilled ? all.reduce((mx, c) => Math.max(mx, similarityPct(nameVal, c.name)), 0) : 0;
  const simOk = maxSim < 50;
  const changed = !!picked && JSON.stringify(values) !== original;                 // EDIT: เห็นการแก้ไข
  const statusChanged = !!picked && status !== (picked.status || "ACTIVE");          // STATUS: เปลี่ยนสถานะแล้ว

  // diff สำหรับคนตรวจ/อนุมัติ — แก้ฟิลด์ไหน จากอะไร → เป็นอะไร (EDIT)
  const origObj: Record<string, string> = (() => { try { return original ? JSON.parse(original) : {}; } catch { return {}; } })();
  const diffRows = topic === "EDIT" && picked
    ? Array.from(new Set([...Object.keys(origObj), ...Object.keys(values)]))
        .filter((k) => String(origObj[k] ?? "") !== String(values[k] ?? ""))
        .map((k) => ({ key: k, before: origObj[k] ?? "", after: values[k] ?? "" }))
    : [];

  // ข้อมูลสำคัญครบ = ฟิลด์ที่บริษัทกำหนดไว้ใน /customer/settings/fields ถูกกรอกครบ (ไดนามิก)
  const fieldKeys = enabled.filter((k) => k !== "name"); // name เช็คแยกด้านบน
  const missingFields = fieldKeys.filter((k) => !val(k).trim());
  const fieldsOk = missingFields.length === 0;
  const missNames = missingFields.slice(0, 4).map((k) => t(`custFields.${k}`, { defaultValue: k })).join(", ") + (missingFields.length > 4 ? " …" : "");

  const checks: { ok: boolean; label: string }[] = [
    ...(topic === "ADD"
      ? [
          { ok: nameFilled, label: nameFilled ? t("custReq.ckName") : t("custReq.ckNameMiss") },
          { ok: simOk, label: simOk ? t("custReq.ckSim", { pct: maxSim }) : t("custReq.ckSimMiss", { pct: maxSim }) },
          { ok: fieldsOk, label: fieldsOk ? t("custReq.ckFields", { n: fieldKeys.length }) : t("custReq.ckFieldsMiss", { n: missingFields.length, names: missNames }) },
        ]
      : [
          { ok: !!picked, label: picked ? t("custReq.ckCustomer") : t("custReq.ckCustomerMiss") },
          ...(topic === "EDIT" ? [{ ok: changed, label: changed ? t("custReq.ckEdited") : t("custReq.ckEditedMiss") }] : []),
          ...(topic === "STATUS" ? [{ ok: statusChanged, label: statusChanged ? t("custReq.ckStatusChg") : t("custReq.ckStatusChgMiss") }] : []),
        ]),
    { ok: saved, label: saved ? t("custReq.ckSaved") : t("custReq.ckSavedMiss") },
  ];
  const allOk = checks.every((c) => c.ok);
  const dataValid = topic === "ADD" ? nameFilled : topic === "EDIT" ? (!!picked && changed) : (!!picked && statusChanged);
  // มีของให้บันทึกแต่ยังไม่ได้บันทึก → โชว์จุด/ป้าย "ยังไม่บันทึก"
  const hasContent = nameFilled || !!picked || Object.values(values).some((v) => !!v && v.trim());
  const dirty = !saved && (topic === "ADD" ? hasContent : dataValid);

  // บันทึกใบเอกสารจริง (ต่อบริษัท) — ต้องผ่านก่อนถึงจะส่งได้
  const onSave = () => {
    if (!dataValid) { setPane("review"); setPanelOpen(true); return; }
    // กฎ numbering: ออกเลขจริงตอนสร้างเฉพาะเมื่อกฎ = CREATE · กฎอื่นเก็บเป็น DRAFT จนถึงเหตุการณ์นั้น
    const code = savedCode ?? (issueEvent === "CREATE" ? genReqCode() : genDraft());
    saveRequest({
      code, topic,
      customer: picked ? `${picked.code} · ${picked.name}` : nameVal,
      requester: session?.fullName || session?.email || session?.companyCode || "—",
      status, values, phase: "PROCESS", savedAt: Date.now(), // เราสร้างเอง = งานกล่อง "รอดำเนินการ"
      picked: picked ? { id: picked.id, code: picked.code, name: picked.name, status: picked.status } : undefined,
      origValues: original ? JSON.parse(original) : undefined,
      origin: origin ?? undefined,
    });
    setSavedCode(code); setSaved(true); setPane("review"); setPanelOpen(true);
  };

  // ส่งจริง — ต้องตรวจทานผ่านครบก่อน (ไม่ผ่าน → เปิดแผงตรวจทานให้ดูว่าติดอะไร)
  const onSend = () => {
    if (!allOk) { setPane("review"); setPanelOpen(true); return; }
    setFlowMode("approve"); setFlowReason(""); setFlowErr("");
    // จำผู้รับที่เลือกล่าสุด — ถ้ายังเป็นตัวเลือกที่ส่งได้ในขั้นนี้ ใช้เป็นค่าเริ่ม (ไม่งั้น = ส่งทั้งกลุ่ม)
    const last = localStorage.getItem(FLOWTO_KEY) || "";
    setFlowTo(last && candidates.includes(last) ? last : "");
    setFlowOpen(true);
  };

  /** ปลายทางเสร็จสิ้น = ทำตาม "ทะเบียนเอกสาร" ของชนิดนั้น (ไม่ฮาร์ดโค้ดในฟอร์ม) */
  async function applyRequest(rec: ReturnType<typeof getRequest>): Promise<boolean> {
    if (!rec) return false;
    const desc = getDoc(REQ_DOCTYPE);
    if (!desc?.complete) return false;
    return desc.complete(rec as unknown as Record<string, unknown>, { tenant, changedBy: meName });
  }

  // ลบได้เฉพาะตอนยังอยู่ขั้น "สร้าง/จัดทำ" (ยังไม่ส่ง) — ทิ้งฉบับร่าง
  const atCreateStage = curStageIdx === headIdx;
  const onDelete = () => {
    if (savedCode) deleteRequest(savedCode);
    nav("/customer/requests");
  };

  // "รับเรื่อง" — โชว์เมื่อเป็นเอกสารที่ถูกส่งมา (รอรับ) และยังไม่ได้รับ/ตีกลับ
  const canReceive = loadedPhase === "RECEIVE" && !received && !bounce;
  const meName = session?.fullName || session?.email || session?.companyCode || "—";
  const openReceive = () => { setRecvMode("accept"); setRecvReason(""); setRecvOpen(true); };
  const confirmReceive = () => {
    if (!savedCode) return;
    const rec = getRequest(savedCode);
    if (!rec) return;
    if (recvMode === "accept") {
      const r = { by: meName, at: Date.now() };
      // กฎ numbering = RECEIVE → ออกเลขจริงตอนนี้ (แทน DRAFT)
      let code = rec.code;
      if (issueEvent === "RECEIVE" && isDraft(code)) { const real = genReqCode(); relabelLog(code, real); deleteRequest(code); code = real; }
      saveRequest({ ...rec, code, received: r, phase: "PROCESS" }); // รับแล้ว → เข้ากล่องดำเนินการ
      appendLog({ code, action: "RECEIVE", by: meName, at: r.at, toStage: stages[curStageIdx]?.name });
      setSavedCode(code); setReceived(r); setLoadedPhase("PROCESS"); setLog(loadLog(code));
      if (code !== rec.code) nav(`/customer/requests/${code}`, { replace: true });
    } else {
      if (!recvReason.trim()) return; // ไม่รับ ต้องมีเหตุผล
      // ไม่รับ = ตีกลับเหมือน "ไม่อนุมัติ" → ถอย 1 ขั้น ส่งคืนกล่อง "รับเข้า" ของผู้ส่ง พร้อมเหตุผล
      const at = Date.now();
      const prevStage = stages[curStageIdx - 1];
      const prevSender = rec.sent?.by || creatorName;
      const b = { by: meName, at, reason: recvReason.trim() };
      saveRequest({
        ...rec,
        stageId: prevStage?.id ?? rec.stageId,
        phase: "RECEIVE",
        received: undefined,
        bounce: b,
        sent: { by: meName, to: prevSender, at, fromStage: stages[curStageIdx]?.name, toStage: prevStage?.name, recipients: [prevSender] },
      });
      appendLog({ code: rec.code, action: "DECLINE", by: meName, at, fromStage: stages[curStageIdx]?.name, toStage: prevStage?.name, to: prevSender, reason: b.reason });
      setRecvOpen(false);
      saveReqTab("EXPORT");
      nav("/customer/requests");
      return;
    }
    setRecvOpen(false);
  };

  const submit = async () => {
    if (!savedCode) { setFlowOpen(false); return; }
    const rec = getRequest(savedCode);
    if (!rec) { setFlowOpen(false); return; }
    const isApproveStage = curStage?.kind === "APPROVE";
    const at = Date.now();
    const fromName = curStage?.name;
    const toName = nextStage?.name;
    // ผู้รับ: เลือกเจาะจง = คนเดียว · ไม่เลือก = ทั้งกลุ่ม (candidates) · ไม่มี candidate = ทุกคน ([])
    const recipients: string[] = flowTo ? [flowTo] : candidates;
    const toWho = nextStage ? (flowTo || (candidates.length ? candidates.join(", ") : describeMember(toMember))) : "—";

    // ขั้นอนุมัติ + เลือก "ไม่อนุมัติ" → ถอยกลับ 1 ขั้น ส่งคืน "กล่องรับเข้า" ของผู้ที่ส่งมาให้อนุมัติ พร้อมเหตุผล
    if (isApproveStage && flowMode === "reject") {
      if (!flowReason.trim()) { setFlowErr(t("custReq.flow.reasonReq")); return; }
      const prevStage = stages[curStageIdx - 1];
      const prevSender = rec.sent?.by || creatorName;     // คนที่ส่งใบมาให้อนุมัติ = ปลายทางที่ถอยกลับไป
      const b = { by: meName, at, reason: flowReason.trim() };
      saveRequest({
        ...rec,
        stageId: prevStage?.id ?? rec.stageId,            // ถอยไปขั้นก่อนหน้า
        phase: "RECEIVE",                                  // → เข้ากล่อง "รอรับ" ของผู้ส่ง
        received: undefined,                               // ให้กดรับใหม่
        bounce: b,                                         // เหตุผลที่ไม่อนุมัติ (โชว์แบนเนอร์ + ป้าย "ตีกลับ")
        sent: { by: meName, to: prevSender, at, fromStage: curStage?.name, toStage: prevStage?.name, recipients: [prevSender] },
      });
      appendLog({ code: savedCode, action: "REJECT", by: meName, at, fromStage: fromName, toStage: prevStage?.name, to: prevSender, reason: b.reason });
      setFlowOpen(false);
      saveReqTab("EXPORT");
      nav("/customer/requests");
      return;
    }

    if (frame) { const f: UsedFrame = { id: frame.id, name: frame.name || frame.note || "" }; storeUsedFrame(REQ_DOCTYPE, f); setUsedFrame(f); }
    const action = isApproveStage ? "APPROVE" : "SEND";

    // กฎ numbering = APPROVE → ออกเลขจริงเมื่ออนุมัติ (แทน DRAFT) พร้อมย้าย log เดิมตามไป
    // เรียกตอน "ลงมือบันทึกจริง" เท่านั้น เพื่อกันกรณี applyRequest ล้มแล้วเลขหลุดไปก่อน
    const issueIfNeeded = (): string => {
      let c = savedCode!;
      if (issueEvent === "APPROVE" && isApproveStage && isDraft(c)) {
        const real = genReqCode();
        relabelLog(c, real);
        deleteRequest(c);
        c = real;
      }
      return c;
    };
    const afterIssue = (code: string) => {
      if (code !== savedCode) { setSavedCode(code); nav(`/customer/requests/${code}`, { replace: true }); }
    };

    // ปลายทางเป็น "เสร็จสิ้น" → ทำงานจริงตามชนิดเอกสาร (เพิ่ม/แก้ลูกค้า) แล้วปิดงาน
    if (nextStage && nextStage.kind === "DONE") {
      setFlowBusy(true); setFlowErr("");
      const ok = await applyRequest(rec);
      setFlowBusy(false);
      if (!ok) { setFlowErr(t("custReq.flow.applyErr")); return; }
      const code = issueIfNeeded();
      saveRequest({ ...rec, code, stageId: nextStage.id, phase: "DONE", sent: { by: creatorName, to: toWho, at, fromStage: fromName, toStage: toName } });
      appendLog({ code, action, by: creatorName, to: toWho, at, fromStage: fromName, toStage: toName });
      appendLog({ code, action: "COMPLETE", by: creatorName, at: Date.now(), toStage: toName });
      setStageId(nextStage.id); setLoadedPhase("DONE"); setLog(loadLog(code));
      setFlowOpen(false); setPane("review"); setPanelOpen(true); setSubmitted(true);
      afterIssue(code);
      return;
    }

    // เลื่อนไปขั้นถัดไป (ส่งให้ผู้รับคนถัดไป) → เด้งไปหน้ารายการคำขอ
    // ผู้ส่งเห็นในกล่อง "ส่งออก" · ผู้รับ (คนละคน) เห็นในกล่อง "รอรับ" ของหน้านั้น
    const code = issueIfNeeded();
    const sent = { by: creatorName, to: toWho, at, fromStage: fromName, toStage: toName, recipients };
    saveRequest({ ...rec, code, stageId: nextStage?.id ?? rec.stageId, phase: "RECEIVE", received: undefined, bounce: undefined, sent });
    appendLog({ code, action, fromStage: fromName, toStage: toName, by: creatorName, to: toWho, at });
    setFlowOpen(false);
    saveReqTab("EXPORT");
    nav("/customer/requests");
  };

  function renderField(f: CustField) {
    if (f.key === "name") return null; // โชว์แยกด้านบนสุดของฟอร์ม add/edit
    const type = f.type ?? "text";
    let ctrl;
    if (type === "address") ctrl = <ThaiAddressInput value={val(f.key)} onChange={(v) => set(f.key, v)} placeholder="" />;
    else if (type === "textarea") ctrl = <textarea value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} />;
    else if (type === "date") ctrl = <input type="date" value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} />;
    else if (type === "select") ctrl = (
      <select value={val(f.key)} onChange={(e) => set(f.key, e.target.value)}>
        <option value="">—</option>
        {getFieldOptions(f.key).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
    else ctrl = <input value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} />;
    return (
      <div className={`field${type === "textarea" || type === "address" ? " top" : ""}`} key={f.key}>
        <label>{t(`custFields.${f.key}`, { defaultValue: f.key })}</label>
        <div className="ctrl">{ctrl}</div>
      </div>
    );
  }

  const groups = GROUPS
    .map((g) => ({ g, fields: CUST_FIELDS.filter((f) => f.group === g && enabledSet.has(f.key) && f.key !== "name") }))
    .filter((x) => x.fields.length > 0);

  const statusLabel = (code: string) => getStatusOverride(code) || t(`custStatus.${code}`, { defaultValue: code });

  // FLOW: ผู้สร้างอยู่ขั้น "จัดทำ" (curStage) → ส่งต่อขั้นถัดไป · กรอบสิทธิ์ยึดที่หัวขั้น (ผู้สร้าง)
  const creator = { fullName: session?.fullName, email: session?.email, employeeCode: session?.employeeCode };
  const creatorName = session?.fullName || session?.email || session?.companyCode || "—";
  const curStage: Stage | undefined = stages[curStageIdx];
  const nextStage: Stage | undefined = stages[curStageIdx + 1];
  const frame = curStage ? pickAuthorityFrame(authorities, curStage.id, creator) : null;
  const toMember: MemberRule | undefined = frame && nextStage ? memberAt(frame, nextStage.id) : undefined;
  // ผู้รับที่เป็นไปได้ของขั้นถัดไป — มีหลายคนต้องให้ "เลือก" (เจาะจง 1 คน หรือส่งทั้งกลุ่ม/เหมา)
  const candidates = resolveCandidates(toMember, moduleUsers);

  // ขั้นอนุมัติ/เสร็จสิ้น = แก้/บันทึกไม่ได้แล้ว → ซ่อนปุ่ม Save (เสร็จสิ้นซ่อนปุ่มส่งด้วย)
  const atApproveStage = curStage?.kind === "APPROVE";
  const atDone = curStage?.kind === "DONE" || loadedPhase === "DONE";
  const canSaveDoc = !atApproveStage && !atDone;

  return (
    <div className="p-qt p-req">
      <div className="topbar">
        <div className="qtag" style={{ background: "#5e5ce6" }}>REQ</div>
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <CrossNavSelect fallback={<div className="doctitle">{t("custReq.title")}</div>} />
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <CrmHelpButton />
        <div className="me">{session?.companyCode.charAt(0) ?? "A"}</div>
      </div>

      <div className="main">
        {/* เมนูซ้าย: เอกสารของคำขอ + เอกสารที่เกี่ยวข้อง (รหัสลูกค้า) */}
        <div className={`dtree${collapsed ? " collapsed" : ""}`}>
          <div className="th">
            <span>{t("custReq.docs", { defaultValue: "เอกสาร" })}</span>
            <div className="collapse-btn" title="ยุบ/ขยาย" onClick={() => setCollapsed((c) => !c)}><ChevronLeft size={16} /></div>
          </div>
          <div className="tlist">
            {/* แม่ = ใบคำขอ (รหัสเอกสาร — ออกตามกฎ numbering) */}
            <div className="titem qt sel"><FileText />{issued ? savedCode : t("custReq.codePending")}</div>
            {/* ลูก = เอกสารที่เกี่ยวข้อง (ลูกค้าที่อ้างถึง) */}
            {picked && <div className="titem child"><FileText size={14} />{picked.code} · {picked.name}</div>}
          </div>
          <div className="dnote">{t("custReq.numberingRule")}: <b>{ruleLabel}</b></div>
        </div>

        <div className="workzone">
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav("/customer/requests")}><ArrowLeft /><span>{t("custReq.back")}</span></div>
            <div className="tbsep" />
            {canSaveDoc && <div className="tbtn" onClick={onSave}><Save /><span>{t("custReq.saveDoc")}</span>{dirty && <span className="dot" />}</div>}
            {atCreateStage && <div className="tbtn" onClick={() => setConfirmDel(true)} style={{ color: "var(--red)" }} title={t("custReq.deleteHint")}><Trash /><span>{t("custReq.deleteDoc")}</span></div>}
            {!atDone && <div className="tbtn primary" onClick={onSend} style={{ opacity: allOk ? 1 : 0.45 }} title={allOk ? "" : t("custReq.sendHint")}><CheckCircle /><span>{atApproveStage ? t("custReq.flow.approve") : t("custReq.send")}</span></div>}
            {canReceive && <><div className="tbsep" /><div className="tbtn" onClick={openReceive} style={{ color: "var(--green)" }} title={t("custReq.recv.btnHint")}><Check /><span>{t("custReq.recv.btn")}</span></div></>}
            {dirty && <span style={{ marginLeft: 10, fontSize: 12, color: "#b28600", whiteSpace: "nowrap" }}>● {t("custReq.unsaved")}</span>}
          </div>

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
            <div className="center">
              {submitted && (
                <div className="banner" style={{ background: "var(--green-bg)", color: "#0e6027", padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
                  {t("custReq.submitted")}
                  {usedFrame && <div style={{ marginTop: 4 }}>{t("custReq.flow.used")}: <b>{usedFrame.name || "—"}</b></div>}
                </div>
              )}
              {received && (
                <div className="banner" style={{ background: "var(--green-bg)", color: "#0e6027", padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
                  ✓ {t("custReq.recv.receivedBy", { by: received.by })} · {new Date(received.at).toLocaleString()}
                </div>
              )}
              {bounce && (
                <div className="banner" style={{ background: "var(--red-bg)", color: "var(--red)", padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
                  ↩ {t("custReq.recv.bouncedBy", { by: bounce.by })}: <b>{bounce.reason}</b>
                </div>
              )}

              <div className="sect">
                <div className="sh">{t("custReq.secDetail")}</div>
                <div className="cols2">
                  <div className="field">
                    <label>{t("custReq.topic")}</label>
                    <div className="ctrl">
                      <select value={topic} onChange={(e) => changeTopic(e.target.value as Topic)} disabled={lockTopic} title={lockTopic ? t("salesDoc.lockedTopic") : undefined}>
                        {!lockTopic && <option value="ADD">{t("custReq.topicAdd")}</option>}
                        <option value="EDIT">{t("custReq.topicEdit")}</option>
                        <option value="STATUS">{t("custReq.topicStatus")}</option>
                      </select>
                      {origin && <span className="chip blue" style={{ marginTop: 6, display: "inline-block", fontSize: 11 }}>{t("salesDoc.originFrom", { type: origin.type, code: origin.code })}</span>}
                    </div>
                  </div>

                  {topic !== "ADD" && (
                    <div className="field">
                      <label>{t("custReq.customer")}</label>
                      <div className="ctrl" style={{ position: "relative" }}>
                        <input
                          value={picked ? `${picked.code} · ${picked.name}` : q}
                          onChange={(e) => { if (lockTopic) return; setQ(e.target.value); setPicked(null); setOpenPick(true); }}
                          onFocus={() => { if (!lockTopic) setOpenPick(true); }}
                          onBlur={() => setTimeout(() => setOpenPick(false), 150)}
                          placeholder={t("custReq.searchCustomer")}
                          readOnly={lockTopic}
                          title={lockTopic ? t("salesDoc.lockedCustomer") : undefined}
                        />
                        <span className="pick"><Search size={16} /></span>
                        {openPick && !picked && !lockTopic && (
                          <div className="ta-menu" style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 30, background: "#fff", border: "1px solid var(--line)", borderRadius: 8, maxHeight: 240, overflow: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.12)" }}>
                            {matches.length === 0 && <div style={{ padding: 10, color: "var(--txt3)", fontSize: 13 }}>—</div>}
                            {matches.map((c) => (
                              <div key={c.id} style={{ padding: "9px 12px", fontSize: 13, cursor: "pointer" }} onMouseDown={(e) => { e.preventDefault(); choose(c); }}>
                                <b>{c.code}</b> · {c.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* สรุปการเปลี่ยนแปลง — ให้คนตรวจ/อนุมัติเห็นว่าแก้ฟิลด์ไหน จากอะไร → เป็นอะไร */}
              {topic === "EDIT" && picked && (
                <div className="sect">
                  <div className="sh">{t("custReq.diff.changes")}</div>
                  {diffRows.length === 0 ? (
                    <div style={{ color: "var(--txt3)", fontSize: 13 }}>{t("custReq.diff.noChange")}</div>
                  ) : (
                    <table className="data-grid">
                      <thead><tr>
                        <th>{t("custReq.diff.colField")}</th>
                        <th>{t("custReq.diff.colBefore")}</th>
                        <th>{t("custReq.diff.colAfter")}</th>
                      </tr></thead>
                      <tbody>
                        {diffRows.map((r) => (
                          <tr key={r.key}>
                            <td>{t(`custFields.${r.key}`, { defaultValue: r.key })}</td>
                            <td style={{ color: "var(--txt3)", textDecoration: "line-through" }}>{r.before || t("custReq.diff.empty")}</td>
                            <td style={{ color: "#0e6027", fontWeight: 500 }}>{r.after || t("custReq.diff.empty")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ADD / EDIT: ฟอร์มข้อมูลลูกค้า */}
              {(topic === "ADD" || (topic === "EDIT" && picked)) && (
                <>
                  <div className="sect">
                    <div className="sh">{topic === "ADD" ? t("custReq.newCustomer") : t("custReq.editCustomer")}</div>
                    <div className="field">
                      <label>{t("custFields.name")} *</label>
                      <div className="ctrl"><input value={val("name")} onChange={(e) => set("name", e.target.value)} /></div>
                    </div>
                    {enabledSet.has("groupName") && (
                      <div className="field">
                        <label>{t("custFields.groupName")}</label>
                        <div className="ctrl">
                          <select value={val("groupName")} onChange={(e) => set("groupName", e.target.value)}>
                            <option value="">—</option>
                            {getFieldOptions("groupName").map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                  {groups.map(({ g, fields }) => (
                    <div className="sect" key={g}>
                      <div className="sh">{t(`custFields.group.${g}`, { defaultValue: g })}</div>
                      <div className="cols2">{fields.filter((f) => f.key !== "groupName").map(renderField)}</div>
                    </div>
                  ))}
                </>
              )}

              {/* STATUS: ปรับสถานะ */}
              {topic === "STATUS" && picked && (
                <div className="sect">
                  <div className="sh">{t("custReq.statusEdit")}</div>
                  <div className="field">
                    <label>{t("custReq.currentStatus")}</label>
                    <div className="ctrl" style={{ display: "flex", alignItems: "center", paddingLeft: 2 }}>
                      <span className="chip gray">{statusLabel(picked.status || "ACTIVE")}</span>
                    </div>
                  </div>
                  <div className="field">
                    <label>{t("custReq.newStatus")}</label>
                    <div className="ctrl">
                      <select value={status} onChange={(e) => changeStatus(e.target.value)}>
                        {[...new Set([status, ...getEnabledStatuses()])].map((code) => <option key={code} value={code}>{statusLabel(code)}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* right rail: ตรวจทาน + ไฟล์แนบ เท่านั้น */}
            <div className="rightwrap">
              <div className={`hpanel${panelOpen ? "" : " closed"}`}>
                <div className="hh">
                  <span>{pane === "review" ? t("custReq.review") : t("custReq.files")}</span>
                  <div className="x" title={t("common.close", { defaultValue: "ปิด" })} onClick={() => setPanelOpen(false)}><X size={16} /></div>
                </div>
                <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
                  {pane === "review" ? (
                    <>
                      <div className="review">
                        {checks.map((c, i) => (
                          <div className="rcheck" key={i}><span className={c.ok ? "ok" : "miss"}>{c.ok ? <Check /> : <X />}</span>{c.label}</div>
                        ))}
                      </div>
                      {log.length > 0 && (
                        <div style={{ marginTop: 18 }}>
                          <div style={{ fontSize: 11, color: "var(--txt3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>{t("custReq.flowLog")}</div>
                          {log.map((e, i) => (
                            <div key={i} style={{ fontSize: 12, padding: "7px 0", borderBottom: "1px solid var(--line-soft)" }}>
                              <div style={{ color: "var(--txt)", fontWeight: 500 }}>{t(`custReq.log.${e.action}`)}{e.toStage ? ` → ${e.toStage}` : ""}</div>
                              <div style={{ color: "var(--txt3)", fontSize: 11, marginTop: 2 }}>{e.by}{e.to ? ` → ${e.to}` : ""} · {new Date(e.at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</div>
                              {e.reason && <div style={{ color: "var(--red)", fontSize: 11, marginTop: 2 }}>{e.reason}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <AttachmentBox ownerType="REQ" ownerId={savedCode || ""} disabledReason={savedCode ? "" : t("custReq.saveFirstFiles", { defaultValue: "บันทึกคำขอก่อนจึงแนบไฟล์ได้" })} />
                  )}
                </div>
              </div>
              <div className="rail">
                <div className={`ritem${pane === "review" && panelOpen ? " active" : ""}`} onClick={() => pickPane("review")}>
                  <Shield /><span>{t("custReq.review")}</span>
                  {!allOk && <span className="ribadge">{checks.filter((c) => !c.ok).length}</span>}
                </div>
                <div className={`ritem${pane === "files" && panelOpen ? " active" : ""}`} onClick={() => pickPane("files")}>
                  <Paperclip /><span>{t("custReq.files")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== FLOW popup: ใคร → ไปหาใคร → ขั้นไหน ===== */}
      {flowOpen && (
        <div className="wf-flow-ov" onClick={() => setFlowOpen(false)}>
          <div className="wf-flow-card" onClick={(e) => e.stopPropagation()}>
            <div className="wf-flow-h">
              <span>{t("custReq.flow.title")}</span>
              <button className="x" onClick={() => setFlowOpen(false)}><X size={16} /></button>
            </div>

            <div className="wf-flow-b">
              {/* ขั้นอนุมัติ: เลือกอนุมัติ / ไม่อนุมัติ (ใส่เหตุผล) */}
              {curStage?.kind === "APPROVE" && (
                <div style={{ marginBottom: 14 }}>
                  <div className="wf-seg" style={{ marginBottom: flowMode === "reject" ? 10 : 0 }}>
                    <button className={flowMode === "approve" ? "on" : ""} onClick={() => { setFlowMode("approve"); setFlowErr(""); }}>{t("custReq.flow.approve")}</button>
                    <button className={flowMode === "reject" ? "on" : ""} onClick={() => setFlowMode("reject")}>{t("custReq.flow.reject")}</button>
                  </div>
                  {flowMode === "reject" && (
                    <div>
                      <label className="wf-lbl">{t("custReq.flow.reasonLabel")}</label>
                      <textarea value={flowReason} onChange={(e) => setFlowReason(e.target.value)} placeholder={t("custReq.flow.reasonPh")} style={{ width: "100%", minHeight: 70, border: "1px solid var(--field-bd)", borderRadius: 8, padding: "8px 10px", fontSize: 13, resize: "vertical" }} />
                    </div>
                  )}
                </div>
              )}

              {!frame && <div className="wf-flow-warn">⚠ {t("custReq.flow.noFrame")}</div>}

              <div className="wf-flow-line">
                <div className="wf-flow-node">
                  <span className="lbl">{t("custReq.flow.from")}</span>
                  <span className="who">{creatorName}</span>
                  <span className="stg">{curStage?.name}</span>
                </div>
                <span className="wf-flow-arrow"><ArrowRight size={20} /></span>
                <div className="wf-flow-node to">
                  <span className="lbl">{t("custReq.flow.to")}</span>
                  <span className="who">{nextStage ? (flowTo || (candidates.length > 1 ? t("custReq.flow.chooseBelow") : candidates[0] || describeMember(toMember))) : "—"}</span>
                  <span className="stg">{nextStage ? nextStage.name : t("custReq.flow.noNext")}</span>
                </div>
              </div>

              {/* ผู้รับขั้นถัดไปมีหลายคน → เลือกได้ว่าส่งเจาะจง หรือส่งทั้งกลุ่ม (เหมา) ใครรับก่อนได้งาน */}
              {nextStage && nextStage.kind !== "DONE" && candidates.length > 1 && !(curStage?.kind === "APPROVE" && flowMode === "reject") && (
                <div className="wf-flow-pick">
                  <label className="wf-lbl">{t("custReq.flow.chooseRecipient")}</label>
                  <select value={flowTo} onChange={(e) => { setFlowTo(e.target.value); localStorage.setItem(FLOWTO_KEY, e.target.value); }}>
                    <option value="">{t("custReq.flow.toGroup", { n: candidates.length })}</option>
                    {candidates.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="wf-flow-pickhint">{flowTo ? t("custReq.flow.toOneHint") : t("custReq.flow.toGroupHint")}</div>
                </div>
              )}

              {frame && <div className="wf-flow-meta">{t("custReq.flow.frame")}: <b>{frame.name || frame.note || "—"}</b></div>}
              {nextStage?.kind === "DONE" && getDoc(REQ_DOCTYPE)?.completeLabel && (
                <div className="wf-flow-meta">{t("custReq.flow.destination")}: <b>{getDoc(REQ_DOCTYPE)?.completeLabel}</b></div>
              )}
              {frame && nextStage && toMember && memberIsEmpty(toMember) && <div className="wf-flow-warn">⚠ {t("custReq.flow.noReceiver")}</div>}
              {flowErr && <div className="wf-flow-warn">⚠ {flowErr}</div>}
            </div>

            <div className="wf-flow-f">
              <button className="btn" onClick={() => setFlowOpen(false)}>{t("custReq.flow.cancel")}</button>
              {curStage?.kind === "APPROVE" && flowMode === "reject"
                ? <button className="btn" style={{ background: "var(--red)", color: "#fff", borderColor: "var(--red)", opacity: flowReason.trim() ? 1 : 0.5 }} onClick={submit} disabled={flowBusy}><ArrowLeft size={15} />{t("custReq.flow.confirmReject")}</button>
                : <button className="btn primary" onClick={submit} disabled={flowBusy}><CheckCircle size={15} />{flowBusy ? t("custReq.flow.applying") : curStage?.kind === "APPROVE" ? t("custReq.flow.confirmApprove") : t("custReq.flow.confirm")}</button>}
            </div>
          </div>
        </div>
      )}

      {/* รับเรื่อง / ไม่รับ (ตีกลับ) */}
      {recvOpen && (
        <div className="wf-flow-ov" onClick={() => setRecvOpen(false)}>
          <div className="wf-flow-card" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="wf-flow-h">
              <span>{t("custReq.recv.title")}</span>
              <button className="x" onClick={() => setRecvOpen(false)}><X size={16} /></button>
            </div>
            <div className="wf-flow-b">
              <div className="wf-seg" style={{ marginBottom: 12 }}>
                <button className={recvMode === "accept" ? "on" : ""} onClick={() => setRecvMode("accept")}>{t("custReq.recv.accept")}</button>
                <button className={recvMode === "decline" ? "on" : ""} onClick={() => setRecvMode("decline")}>{t("custReq.recv.decline")}</button>
              </div>
              {recvMode === "accept" ? (
                <div style={{ fontSize: 13, color: "var(--txt2)", lineHeight: 1.6 }}>{t("custReq.recv.acceptHint")}</div>
              ) : (
                <div>
                  <div style={{ fontSize: 13, color: "var(--txt2)", lineHeight: 1.6, marginBottom: 8 }}>{t("custReq.recv.declineHint")}</div>
                  <label className="wf-lbl" style={{ display: "block", fontSize: 12, color: "var(--txt2)", marginBottom: 5 }}>{t("custReq.recv.reasonLabel")}</label>
                  <textarea value={recvReason} onChange={(e) => setRecvReason(e.target.value)} placeholder={t("custReq.recv.reasonPh")} style={{ width: "100%", minHeight: 70, border: "1px solid var(--field-bd)", borderRadius: 8, padding: "8px 10px", fontSize: 13, resize: "vertical" }} />
                </div>
              )}
            </div>
            <div className="wf-flow-f">
              <button className="btn" onClick={() => setRecvOpen(false)}>{t("custReq.flow.cancel")}</button>
              {recvMode === "accept"
                ? <button className="btn primary" onClick={confirmReceive}><Check size={15} />{t("custReq.recv.confirmAccept")}</button>
                : <button className="btn" style={{ background: "var(--red)", color: "#fff", borderColor: "var(--red)", opacity: recvReason.trim() ? 1 : 0.5 }} onClick={confirmReceive}><ArrowLeft size={15} />{t("custReq.recv.confirmDecline")}</button>}
            </div>
          </div>
        </div>
      )}

      {/* ยืนยันก่อนลบ */}
      {confirmDel && (
        <div className="wf-flow-ov" onClick={() => setConfirmDel(false)}>
          <div className="wf-flow-card" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="wf-flow-h">
              <span>{t("custReq.deleteConfirmTitle")}</span>
              <button className="x" onClick={() => setConfirmDel(false)}><X size={16} /></button>
            </div>
            <div className="wf-flow-b">
              <div style={{ fontSize: 13.5, color: "var(--txt2)", lineHeight: 1.6 }}>{t("custReq.deleteConfirmBody", { code: savedCode || "—" })}</div>
            </div>
            <div className="wf-flow-f">
              <button className="btn" onClick={() => setConfirmDel(false)}>{t("custReq.flow.cancel")}</button>
              <button className="btn" style={{ background: "var(--red)", color: "#fff", borderColor: "var(--red)" }} onClick={onDelete}><Trash size={15} />{t("custReq.deleteDoc")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
