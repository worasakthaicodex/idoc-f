import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import {
  Help, ArrowLeft, ArrowRight, Save, Trash, Check, CheckCircle, Refresh, ChevronLeft, FileText, X, Shield, User, Print,
} from "../../shared/icons";
import CustomerWorkPanel from "./CustomerWorkPanel";
import CustomerPicker from "./CustomerPicker";
import AddToBasketButton from "../customer/AddToBasketButton";
import FloatingPanel from "../../shared/FloatingPanel";
import { isFormDetachable } from "./SalesSettings";
import AgeBadge from "./AgeBadge";
import LangSwitcher from "../../shared/LangSwitcher";
import CrossNavSelect from "../../shared/CrossNavSelect";
import ModuleDeps from "../../shared/ModuleDeps";
import { fetchModuleUsers, getIssueEvent, fetchStages, defaultStages, docTypeName, fetchDocCreators, type Stage } from "../workflow/workflowConfig";
import { SALES_GROUPS, fieldsOf, coreKeysOf, type SalesField } from "./salesFields";
import { getEnabledFields, getGroupOverrides, groupOf } from "./salesFieldConfig";
import { getFieldOptions } from "./salesFieldOptions";
import { getClDoc, fetchClDoc, fetchDocsByCustomer, saveClDoc, deleteClDoc, genClCode, issueClCode, syncSalesDocs, SALES_DOCS_EVENT, appendFlowLog, loadFlowLog, type ClDoc, type FlowLogEntry } from "./clRequests";
import { fetchClChain, type ChainDoc } from "./clLeads";
import { getLostReasons } from "./salesCloseConfig";
import "./qt.css";

const MODULE = "sales";
const DOC_TONE: Record<string, string> = { FO: "#0a84ff", SO: "#ff9500", QT: "var(--green)", CL: "var(--purple)" };

type PaneKey = "review" | "customer";
const paneTitles: Record<PaneKey, string> = { review: "salesDoc.reviewTitle", customer: "salesDoc.customerTab" };
const railItems: { key: PaneKey; label: string; Icon: (p: { size?: number }) => React.JSX.Element; badge?: number }[] = [
  { key: "review", label: "salesDoc.review", Icon: Shield },
  { key: "customer", label: "salesDoc.customerTab", Icon: User },
];

// เติมข้อมูล SO จาก QT (additionalInfo/quoteItemsNote) — ย้ายไปทำที่ backend เป็น migration (V54)
// แทนการอ่าน SO+QT ทั้งตารางมาเขียนกลับฝั่ง client (เปลือง egress) · ใบใหม่ตั้งค่าตอนปิดการขายอยู่แล้ว

/** สร้าง/แก้เอกสารงานขายที่ไม่มีตารางย่อย (FO/SO) — โครงเดียวกับ QT (stepper + เมนูขวา) */
export default function SalesFoForm({ doc = "FO" }: { doc?: string }) {
  const DOC = doc;
  const base = `/sales/${DOC.toLowerCase()}`;
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const session = getSession();
  const { code: routeCode } = useParams();
  const [sp] = useSearchParams();

  const [values, setValues] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<ClDoc | null>(null);
  const [users, setUsers] = useState<string[]>([]);
  const me = session?.fullName || session?.email || session?.companyCode || "";
  const [sendOpen, setSendOpen] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [recvOpen, setRecvOpen] = useState(false);
  const [recvMode, setRecvMode] = useState<"accept" | "decline">("accept");
  const [recvReason, setRecvReason] = useState("");
  const [flowLog, setFlowLog] = useState<FlowLogEntry[]>([]);
  const [chain, setChain] = useState<ChainDoc[]>([]);
  const [saving, setSaving] = useState(false);
  const [dupDocs, setDupDocs] = useState<{ docType: string; code: string; title: string }[]>([]); // เอกสารขายของลูกค้ารายนี้ที่ยังไม่ปิด
  const [custLocked, setCustLocked] = useState(false); // ลูกค้าถูกเลือกมาจากทางลัด (CL) → ล็อกไว้ก่อน
  const savedSnap = useRef<string>(""); // สแนปช็อตค่าที่บันทึกล่าสุด — ใช้เช็ค dirty (จุดเขียวที่ปุ่ม Save)
  const loadedCode = useRef<string>(""); // โค้ดเอกสารที่โหลดอยู่ — เปลี่ยน = นำทางมาใบใหม่ ต้อง apply ทับ (ข้าม dirty-guard)
  // สรุปผล FO (2 ทาง: เสนอราคา → QT / ปิดการขายไม่ได้)
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeResult, setCloseResult] = useState<"quote" | "lost" | "production" | "project" | "done" | "">("");
  const [closeForm, setCloseForm] = useState<Record<string, string>>({});
  const [closeErr, setCloseErr] = useState("");
  const [closing, setClosing] = useState(false);
  const today = () => new Date().toISOString().slice(0, 10);
  const [nextCreators, setNextCreators] = useState<string[]>([]); // ผู้มีสิทธิ์สร้างเอกสารถัดไป (FO→QT)
  useEffect(() => { if (DOC === "FO") fetchDocCreators("QT").then(setNextCreators).catch(() => {}); }, [DOC]);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(`idoc.${DOC.toLowerCase()}.collapsed`) === "1");
  const toggleTree = () => setCollapsed((c) => { const n = !c; localStorage.setItem(`idoc.${DOC.toLowerCase()}.collapsed`, n ? "1" : "0"); return n; });
  const [stages, setStages] = useState<Stage[]>(() => defaultStages());
  useEffect(() => { fetchStages(DOC).then(setStages).catch(() => {}); }, []);
  const [pane, setPane] = useState<PaneKey>("review");
  const [panelOpen, setPanelOpen] = useState(true);
  const pickPane = (k: PaneKey) => { if (pane === k && panelOpen) { setPanelOpen(false); return; } setPane(k); setPanelOpen(true); };

  const enabledKeys = useMemo(() => getEnabledFields(DOC), []);
  const grpOv = useMemo(() => getGroupOverrides(DOC), []);
  const groups = useMemo(() => SALES_GROUPS
    .map((g) => ({ g, fields: enabledKeys.filter((k) => groupOf(DOC, k, grpOv) === g).map((k) => fieldsOf(DOC).find((f) => f.key === k)).filter(Boolean) as SalesField[] }))
    .filter((x) => x.fields.length > 0), [enabledKeys, grpOv]);
  const [tab, setTab] = useState<string>("general");
  useEffect(() => { if (groups.length && !groups.some((x) => x.g === tab)) setTab(groups[0].g); }, [groups, tab]);
  const detachable = isFormDetachable();
  const [floating, setFloating] = useState<string[]>([]);
  const popOut = (g: string) => setFloating((f) => (f.includes(g) ? f : [...f, g]));
  const closeFloat = (g: string) => setFloating((f) => f.filter((x) => x !== g));

  useEffect(() => { fetchModuleUsers(MODULE).then(setUsers).catch(() => {}); }, []);
  // โหลดเอกสาร (local + sync backend) + flow log + re-render เมื่อ sync เสร็จ
  useEffect(() => {
    if (!routeCode) return;
    const apply = (rec: ClDoc | null) => {
      if (!rec) return;
      setExisting(rec);
      const fresh = loadedCode.current !== rec.code;   // เอกสารคนละใบ (เพิ่งนำทางมา) → ต้อง apply ทับ
      loadedCode.current = rec.code;
      // อย่าทับค่าที่ผู้ใช้กำลังแก้ (dirty) — กัน sync/event มาล้างที่เพิ่งกรอก · แต่ถ้าเป็นใบใหม่ ต้องทับเสมอ
      setValues((cur) => {
        const dirtyNow = !fresh && Object.keys(cur).length > 0 && JSON.stringify(cur) !== savedSnap.current;
        if (dirtyNow) return cur;
        savedSnap.current = JSON.stringify(rec.values ?? {});
        return rec.values ?? {};
      });
    };
    const reload = () => apply(getClDoc(routeCode, DOC));
    reload();                                   // ทันทีถ้ามีใน cache
    setFlowLog(loadFlowLog(routeCode));
    // โหลด "ใบนี้" ตรง ๆ ใบเดียว (เบา) — ไม่ดึงรายการเต็มทั้งหมด (หน้า detail ไม่ต้องใช้ทั้ง list = ลด egress)
    fetchClDoc(routeCode, DOC).then(apply);
    const h = (e: Event) => { if ((e as CustomEvent).detail === DOC) reload(); };
    window.addEventListener(SALES_DOCS_EVENT, h);
    return () => window.removeEventListener(SALES_DOCS_EVENT, h);
  }, [routeCode, DOC]);


  // สายเอกสารอ้างอิง (เมนูซ้าย) — ปกติดึงจาก CL ต้นทาง (srcCl). เอกสารที่ย้ายจากระบบเก่าไม่มี CL
  // (CL ไม่ได้ย้ายมาเป็นเอกสาร) → fallback: สร้าง chain จากเอกสาร FO/QT/SO ของลูกค้ารายนี้
  // แล้ว chainRows จะ nest ตาม srcFo/srcQt ให้เอง (SO อยู่ใต้ QT ใต้ FO)
  const srcCl = values.srcCl || "";
  const custRefForChain = values.customerRef || "";
  useEffect(() => {
    if (srcCl) { fetchClChain(srcCl).then(setChain).catch(() => setChain([])); return; }
    if (!custRefForChain) { setChain([]); return; }
    let alive = true;
    // ดึงเฉพาะเอกสารของลูกค้ารายนี้ (กรองที่ backend) — ไม่ดึงทั้งตาราง 3 ชนิด
    Promise.all((["FO", "QT", "SO"] as const).map((d) =>
      fetchDocsByCustomer(d, custRefForChain)
        .then((list) => (list || [])
          .map((x) => ({ docType: d, code: x.code, title: x.title || x.values?.customerName || x.code, srcFo: x.values?.srcFo || "", srcQt: x.values?.srcQt || "" } as ChainDoc)))
        .catch(() => [] as ChainDoc[]),
    )).then((arr) => {
      if (!alive) return;
      const pool = arr.flat();
      const byCode = new Map(pool.map((d) => [d.code, d]));
      const meCode = routeCode ?? "";
      const me: ChainDoc = byCode.get(meCode) || { docType: DOC, code: meCode, title: meCode, srcFo: "", srcQt: "" };
      const keep = new Set<string>([meCode]);
      // เดินขึ้นหาต้นทาง (SO→QT→FO) เฉพาะสายของเอกสารนี้
      let node: ChainDoc | undefined = me;
      while (node) {
        const parent = node.docType === "SO" ? node.srcQt : node.docType === "QT" ? node.srcFo : "";
        if (!parent || keep.has(parent)) break;
        keep.add(parent); node = byCode.get(parent);
      }
      // เดินลงหาเอกสารที่ออกจากเอกสารนี้ (FO→QT→SO)
      const addDesc = (code: string) => pool.forEach((d) => {
        if (!keep.has(d.code) && ((d.docType === "QT" && d.srcFo === code) || (d.docType === "SO" && d.srcQt === code))) { keep.add(d.code); addDesc(d.code); }
      });
      addDesc(meCode);
      const lineage = pool.filter((d) => keep.has(d.code));
      setChain(byCode.has(meCode) ? lineage : [...lineage, me]);
    });
    return () => { alive = false; };
  }, [srcCl, custRefForChain, routeCode, DOC]);

  // แจ้งเตือน: ลูกค้ารายเดียวกันมี "FO" ที่ยังไม่ปิด — เฉพาะ FO เท่านั้นที่ไม่ควรเปิดซ้ำ (โชว์เฉพาะหน้า FO)
  const custRef = values.customerRef || "";
  useEffect(() => {
    if (DOC !== "FO" || !custRef) { setDupDocs([]); return; }
    let alive = true;
    fetchDocsByCustomer("FO", custRef).then((fos) => {   // เฉพาะ FO ของลูกค้ารายนี้ — ไม่ดึงทั้งตาราง
      if (!alive) return;
      const mine = existing?.code;
      setDupDocs(fos
        .filter((d) => d.phase !== "DONE" && d.code !== mine)
        .map((d) => ({ docType: "FO", code: d.code, title: d.title })));
    }).catch(() => {});
    return () => { alive = false; };
  }, [custRef, existing?.code, DOC]);
  const dupTo = (_dt: string, code: string) => `/sales/fo/d/${code}`;

  // เปิดเอกสารใหม่จากทางลัด (เช่นกล่อง CL) → เติมรหัสลูกค้า/อ้างอิง CL ให้อัตโนมัติ
  useEffect(() => {
    if (routeCode) return;
    const seed: Record<string, string> = {};
    ["srcCl", "srcFo", "srcQt", "customerRef", "customerName", "customerCode", "clRef", "quotationRef", "closedService", "saleAmount", "salesperson"].forEach((k) => { const v = sp.get(k); if (v) seed[k] = v; });
    if (seed.srcCl && !seed.clRef) seed.clRef = seed.srcCl;   // มาจาก CL → เติมช่อง "เอกสาร CL ที่มา" ให้เห็นชัด
    if (Object.keys(seed).length) setValues((s) => ({ ...seed, ...s }));
    // มาจาก CL พร้อมลูกค้า → ล็อกลูกค้าที่เลือกให้ (กดเปลี่ยนได้)
    if (sp.get("srcCl") && sp.get("customerRef")) setCustLocked(true);
  }, [routeCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = (k: string) => t(`salesFields.${k}`, { defaultValue: k });
  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));
  const val = (k: string) => values[k] ?? "";
  const docNo = existing?.code ?? t("salesDoc.docNew");
  const dirty = JSON.stringify(values) !== savedSnap.current; // มีการแก้ไขที่ยังไม่บันทึก → จุดเขียวที่ปุ่ม Save
  const active = groups.find((x) => x.g === tab) ?? groups[0];

  // ===== ขั้นตอน + ส่ง/รับ (ใช้จริง เหมือนกล่อง CL) =====
  const headIdx = Math.max(0, stages.findIndex((s) => s.pinned === "head"));
  const curIdx = existing?.stageId ? Math.max(0, stages.findIndex((s) => s.id === existing.stageId)) : headIdx;
  const curStage = stages[curIdx];
  const nextStage = curIdx >= 0 ? stages[curIdx + 1] : undefined;
  const atCreateStage = stages.length > 0 && curIdx === headIdx;
  // ถืออยู่กับเรา: รับแล้ว→ผู้รับล่าสุดถือ · ส่งแล้วยังไม่รับ→ลอย · ยังไม่ส่ง→ผู้ทำถือ
  const heldByMe = existing ? (existing.received ? existing.received.by === me : !existing.sent) : true;
  const canSend = !!existing && !!nextStage && heldByMe;
  const canDelete = !!existing && atCreateStage && heldByMe;
  const canRecall = !!existing && !!existing.sent && existing.sent.by === me && !existing.received && !atCreateStage;
  // รับเรื่อง: เอกสารถูกส่งมา ยังไม่รับ และเราเป็นผู้รับ (หรือส่งแบบทั้งกลุ่ม)
  const recipients = existing?.sent?.recipients;
  const forMe = !recipients || recipients.length === 0 || recipients.includes(me);
  // รับเรื่องได้เมื่อ: ถูกส่งมา ยังไม่รับ เป็นผู้รับ และยังไม่เสร็จ (รองรับทั้ง phase RECEIVE/EXPORT)
  const canReceive = !!existing && !!existing.sent && !existing.received && forMe && existing.phase !== "DONE";

  // สายเอกสารอ้างอิง CL→FO→QT→SO (ไฮไลต์เอกสารนี้)
  const chainRows = useMemo(() => {
    const fos = chain.filter((d) => d.docType === "FO");
    const qts = chain.filter((d) => d.docType === "QT");
    const sos = chain.filter((d) => d.docType === "SO");
    const to = (d: ChainDoc) => d.docType === "FO" ? `/sales/fo/d/${d.code}` : d.docType === "QT" ? `/sales/qt/${d.code}` : `/sales/so/d/${d.code}`;
    const rows: { docType: string; code: string; title: string; depth: number; to: string }[] = [];
    const sosOf = (qtCode: string, depth: number) => sos.filter((s) => s.srcQt === qtCode).forEach((s) => rows.push({ docType: "SO", code: s.code, title: s.title, depth, to: to(s) }));
    const qtsOf = (foCode: string, depth: number) => qts.filter((q) => q.srcFo === foCode).forEach((q) => { rows.push({ docType: "QT", code: q.code, title: q.title, depth, to: to(q) }); sosOf(q.code, depth + 1); });
    fos.forEach((f) => { rows.push({ docType: "FO", code: f.code, title: f.title, depth: 1, to: to(f) }); qtsOf(f.code, 2); });
    qts.filter((q) => !q.srcFo).forEach((q) => { rows.push({ docType: "QT", code: q.code, title: q.title, depth: 1, to: to(q) }); sosOf(q.code, 2); });
    const seen = new Set(rows.map((r) => r.code));
    sos.filter((s) => !s.srcQt && !seen.has(s.code)).forEach((s) => rows.push({ docType: "SO", code: s.code, title: s.title, depth: 1, to: to(s) }));
    return rows;
  }, [chain]);

  const save = async () => {
    if (existing && !heldByMe) { alert(t("salesDoc.notHeldErr")); return; }
    const titleKey = coreKeysOf(DOC)[0] ?? "customerName";
    const title = (values[titleKey] ?? "").trim();
    if (!title) { alert(t("salesDoc.reqField")); setTab(groups[0]?.g ?? "general"); return; }
    const issueEvent = getIssueEvent(DOC);
    const genDraft = () => `DRAFT-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    // SO ดราฟ (จากการปิด QT) → บันทึกครั้งแรก = ออกเลขจริง "SO เกิด" (เฉพาะ doc ที่ออกเลขตอนสร้าง)
    const reborn = !!existing && existing.code.startsWith("DRAFT-") && issueEvent === "CREATE";
    const code = existing?.code ?? (issueEvent === "CREATE" ? genClCode(DOC) : genDraft());
    const finalCode = reborn ? genClCode(DOC) : code;
    const saveVals = { ...(reborn ? { ...values, soDraft: "" } : values), createdBy: values.createdBy || me };
    setSaving(true);
    const ok = await saveClDoc({
      code: finalCode, title,
      telesale: (values.salesperson ?? values.telesale ?? "").trim(),
      phase: existing?.phase ?? "PROCESS",
      savedAt: Date.now(), values: saveVals,
      stageId: existing?.stageId, received: existing?.received, bounce: existing?.bounce, sent: existing?.sent,
    }, DOC);
    setSaving(false);
    if (!ok) { alert(t("salesDoc.saveErr")); return; }
    if (reborn && existing) deleteClDoc(existing.code, DOC); // ลบดราฟเดิม (กลายเป็นเลขจริงแล้ว)
    // SO ถูกสร้างจริงแล้ว (มีเลขจริง ไม่ใช่ดราฟ) → QT ต้นทางถึงจะ "เสร็จสิ้น" ได้ (ออกจากกล่องส่งออก ไปเสร็จสิ้น)
    if (DOC === "SO" && values.srcQt && !finalCode.startsWith("DRAFT-")) {
      const q = getClDoc(values.srcQt, "QT");
      if (q) await saveClDoc({ ...q, phase: "DONE", values: { ...(q.values ?? {}), handoffConsumed: "1" }, savedAt: Date.now() }, "QT");
    }
    await syncSalesDocs(DOC);
    const rec = getClDoc(finalCode, DOC);
    if (rec) { setExisting(rec); setValues(rec.values ?? {}); }
    savedSnap.current = JSON.stringify(rec?.values ?? saveVals);
    if (!routeCode || reborn) nav(`${base}/d/${finalCode}`, { replace: true });
  };
  const onDelete = async () => {
    if (!existing) return;
    if (!heldByMe) { alert(t("salesDoc.notHeldErr")); return; }
    // SO ที่เกิดจากการปิด QT → ลบแล้ว "คืน QT ต้นทางกลับมาเป็นใบเสนอราคา" (ยกเลิกการปิด, เปิดให้แก้ต่อได้)
    if (DOC === "SO" && values.srcQt) {
      if (!window.confirm(t("salesDoc.confirmDelToQt", { defaultValue: "ลบใบสั่งขายนี้ แล้วคืนกลับเป็นใบเสนอราคา (QT) เพื่อแก้ไขใหม่?" }))) return;
      const q = getClDoc(values.srcQt, "QT");
      if (q) {
        const qStages = await fetchStages("QT");
        const qIdx = q.stageId ? Math.max(0, qStages.findIndex((s) => s.id === q.stageId)) : qStages.length - 1;
        const qPrev = qStages[Math.max(0, qIdx - 1)];
        await saveClDoc({
          ...q,
          stageId: qPrev?.id ?? q.stageId, phase: "PROCESS",
          received: { by: me, at: Date.now() }, sent: undefined, bounce: undefined,
          values: { ...(q.values ?? {}), closeResult: "", closeDate: "", closeNote: "", handoffConsumed: "", handoffType: "", handoffTo: "" },
          savedAt: Date.now(),
        }, "QT");
      }
      deleteClDoc(existing.code, DOC);
      await syncSalesDocs("SO"); await syncSalesDocs("QT");
      nav(`/sales/qt/${encodeURIComponent(values.srcQt)}`); return;
    }
    if (!window.confirm(t("salesDoc.confirmDelete"))) return;
    deleteClDoc(existing.code, DOC); nav(base);
  };

  // ส่งเอกสารไปขั้นถัดไป (เลื่อนขั้นจริง + log)
  const doSend = async () => {
    if (!existing || !nextStage) return;
    const sent = { by: me, to: sendTo || "—", at: Date.now(), fromStage: stages[curIdx]?.name, toStage: nextStage.name, recipients: sendTo ? [sendTo] : [] };
    const phase = nextStage.kind === "DONE" ? "DONE" as const : "RECEIVE" as const;
    const ok = await saveClDoc({ ...existing, stageId: nextStage.id, sent, received: undefined, phase, savedAt: Date.now() }, DOC);
    if (!ok) { alert(t("salesDoc.sendFail")); return; }
    appendFlowLog({ code: existing.code, action: nextStage.kind === "DONE" ? "DONE" : "SEND", by: me, to: sendTo || t("salesDoc.wholeGroup"), at: Date.now(), fromStage: stages[curIdx]?.name, toStage: nextStage.name });
    if (getIssueEvent(DOC) === "APPROVE" && existing.code.startsWith("DRAFT-") && curStage?.kind === "APPROVE") {
      await issueClCode(existing.code, DOC);
    }
    setSendOpen(false); await syncSalesDocs(DOC); nav(base);
  };
  // ดึงกลับ (อีกฝ่ายยังไม่รับ) — ย้อนขั้น + ล้าง sent
  const doRecall = async () => {
    if (!existing || !existing.sent) return;
    if (!window.confirm(t("salesDoc.confirmRecall"))) return;
    const prev = stages[Math.max(0, curIdx - 1)];
    const upd: ClDoc = { ...existing, sent: undefined, stageId: prev?.id ?? existing.stageId, phase: "PROCESS", savedAt: Date.now() };
    const ok = await saveClDoc(upd, DOC);
    if (!ok) { alert(t("salesDoc.recallFail")); return; }
    appendFlowLog({ code: existing.code, action: "RECALL", by: me, at: Date.now(), fromStage: curStage?.name, toStage: prev?.name });
    setExisting(upd); setFlowLog(loadFlowLog(existing.code)); await syncSalesDocs(DOC);
    alert(t("salesDoc.recalled"));
  };
  // รับเรื่อง / ไม่รับ (ตีกลับ) — แบบใบคำขอ
  const openReceive = () => { setRecvMode("accept"); setRecvReason(""); setRecvOpen(true); };
  const confirmReceive = async () => {
    if (!existing) return;
    if (recvMode === "accept") {
      const upd: ClDoc = { ...existing, received: { by: me, at: Date.now() }, bounce: undefined, phase: "PROCESS", savedAt: Date.now() };
      const ok = await saveClDoc(upd, DOC);
      if (!ok) { alert(t("salesDoc.receiveFail")); return; }
      appendFlowLog({ code: existing.code, action: "RECEIVE", by: me, at: Date.now(), toStage: curStage?.name });
      setExisting(upd);
    } else {
      if (!recvReason.trim()) return;
      // SO ที่มาจากการปิด QT (ดราฟ) → ไม่รับ = ตีกลับไป "QT ต้นทาง" ถอย 1 ขั้น เข้ากล่องรับเข้าเจ้าของ QT แล้วทิ้งดราฟ SO
      if (DOC === "SO" && values.srcQt) {
        const q = getClDoc(values.srcQt, "QT");
        if (q) {
          const qStages = await fetchStages("QT");
          const qIdx = q.stageId ? Math.max(0, qStages.findIndex((s) => s.id === q.stageId)) : qStages.length - 1;
          const qPrev = qStages[Math.max(0, qIdx - 1)];
          const owner = q.sent?.by || q.values?.salesperson || q.telesale || "";
          await saveClDoc({
            ...q,
            stageId: qPrev?.id ?? q.stageId, phase: "RECEIVE", received: undefined,
            bounce: { by: me, at: Date.now(), reason: recvReason.trim() },
            sent: { by: me, to: owner, at: Date.now(), fromStage: qStages[qIdx]?.name, toStage: qPrev?.name, recipients: owner ? [owner] : [] },
            values: { ...(q.values ?? {}), closeResult: "", handoffConsumed: "", handoffType: "" },
            savedAt: Date.now(),
          }, "QT");
        }
        deleteClDoc(existing.code, DOC); // ทิ้งดราฟ SO (ยังไม่เกิด)
        appendFlowLog({ code: existing.code, action: "DECLINE", by: me, at: Date.now(), toStage: values.srcQt });
        setRecvOpen(false); await syncSalesDocs("SO"); await syncSalesDocs("QT"); nav(base); return;
      }
      // ไม่รับ → ตีกลับเข้า "กล่องรับเข้า" ของผู้ที่ส่งมา (ถอย 1 ขั้น) ไม่ใช่กองในดำเนินการ
      const prev = stages[Math.max(0, curIdx - 1)];
      const sender = existing.sent?.by || existing.telesale || values.salesperson || "";
      const upd: ClDoc = {
        ...existing,
        sent: { by: me, to: sender, at: Date.now(), fromStage: curStage?.name, toStage: prev?.name, recipients: sender ? [sender] : [] },
        received: undefined,
        bounce: { by: me, at: Date.now(), reason: recvReason.trim() },
        stageId: prev?.id ?? existing.stageId, phase: "RECEIVE", savedAt: Date.now(),
      };
      const ok = await saveClDoc(upd, DOC);
      if (!ok) { alert(t("salesDoc.declineFail")); return; }
      appendFlowLog({ code: existing.code, action: "DECLINE", by: me, at: Date.now(), fromStage: curStage?.name, toStage: prev?.name });
      setRecvOpen(false); await syncSalesDocs(DOC); nav(base); return;
    }
    setRecvOpen(false); setFlowLog(loadFlowLog(existing.code)); await syncSalesDocs(DOC);
  };
  const actLabel = (a: FlowLogEntry["action"]) => t(`salesDoc.act${a}`, { defaultValue: a });

  // ===== สรุปผล FO (ส่งไปขั้นเสร็จสิ้น) =====
  // จำผู้รับช่วงต่อ (handoff) ล่าสุดของผู้ใช้คนนี้ไว้ที่เครื่อง → ครั้งหน้าเลือกให้เลย (ไม่ต้องเลือกใหม่ทุกครั้ง)
  const HANDOFF_KEY = `idoc.sales.handoffTo:${me}`;
  const rememberedHandoff = (): string => { try { const v = localStorage.getItem(HANDOFF_KEY) || ""; return nextCreators.includes(v) ? v : ""; } catch { return ""; } };
  const openClose = () => { setCloseResult(""); setCloseErr(""); setCloseForm({ closeDate: today(), closeNote: "", lostReason: "", handoffTo: rememberedHandoff() || nextCreators[0] || values.salesperson || "" }); setCloseOpen(true); };
  const setCf = (k: string, v: string) => setCloseForm((s) => ({ ...s, [k]: v }));
  const doClose = async () => {
    if (!existing || !nextStage) return;
    if (!heldByMe) { setCloseErr(t("salesDoc.notHeldErr")); return; }
    if (!closeResult) { setCloseErr(t("salesDoc.closePickResult")); return; }
    setClosing(true); setCloseErr("");
    const closeVals: Record<string, string> = {
      ...values,
      closeDate: closeForm.closeDate || today(),
      closeNote: closeForm.closeNote || "",
      closeResult,
      lostReason: closeResult === "lost" ? (closeForm.lostReason || "") : "",
    };
    const isQuote = closeResult === "quote";
    if (isQuote) { closeVals.handoffType = "QT"; closeVals.handoffTo = closeForm.handoffTo || ""; closeVals.handoffConsumed = "1"; } // ระบบสร้าง QT ดราฟให้อัตโนมัติ
    if (isQuote && closeForm.handoffTo) { try { localStorage.setItem(HANDOFF_KEY, closeForm.handoffTo); } catch { /* ignore */ } } // จำคนที่เลือกไว้ใช้ครั้งหน้า
    // เสนอราคา = เหมือน "ส่ง" → FO ไปกล่องส่งออกก่อน (ยังไม่เสร็จสิ้น) จะเสร็จสิ้นได้เมื่อ QT ถูกสร้างจริง · แพ้ = เสร็จสิ้นเลย
    // ผู้รับ QT = คนที่เลือกตอนปิด (handoffTo) ไม่ใช่ salesperson — กันไปโผล่ผิดคน/ทุกคน
    const handoffRecip = (closeForm.handoffTo || values.salesperson || "").trim();
    const foRecips = isQuote && handoffRecip ? [handoffRecip] : [];
    const sent = { by: me, to: isQuote ? (handoffRecip || "—") : "—", at: Date.now(), fromStage: stages[curIdx]?.name, toStage: nextStage.name, recipients: foRecips };
    const titleKey = coreKeysOf(DOC)[0] ?? "customerName";
    const ok = await saveClDoc({
      code: existing.code, title: (closeVals[titleKey] ?? existing.title ?? "").trim() || existing.code,
      telesale: (closeVals.salesperson ?? existing.telesale ?? "").trim(),
      phase: isQuote ? "EXPORT" : "DONE", savedAt: Date.now(), values: closeVals,
      stageId: nextStage.id, received: existing.received, bounce: existing.bounce, sent,
    }, DOC);
    // FO เสนอราคา → ระบบสร้าง "ใบเสนอราคา (QT) ดราฟ" เข้ากล่องรับเข้าของผู้ขาย (กดรับ → บันทึก = QT เกิดจริง)
    if (ok && DOC === "FO" && isQuote) {
      const qtVals: Record<string, string> = {
        customerCode: values.customerName || values.customerCode || "", customerName: values.customerName || "",
        customerRef: values.customerRef || "", srcFo: existing.code, documentRef: existing.code,
        srcCl: values.srcCl || "", salesperson: values.salesperson || "", saleDocStatus: values.saleDocStatus || "",
        qtOrigin: "open",   // ระบบสร้างให้จากการปิด FO = "ขอเปิดใบเสนอราคา"
        qtDraft: "1",       // ยังเป็นดราฟ — QT จะเกิดจริง (ออกเลข) เมื่อผู้ขายกดรับแล้วบันทึก
      };
      const qtCode = `DRAFT-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
      const recips = handoffRecip ? [handoffRecip] : [];
      await saveClDoc({ code: qtCode, title: qtVals.customerName || qtCode, telesale: qtVals.salesperson, phase: "RECEIVE", savedAt: Date.now(), values: qtVals, sent: { by: me, to: handoffRecip || "—", at: Date.now(), fromStage: existing.code, toStage: "จัดทำ", recipients: recips } }, "QT");
    }
    setClosing(false);
    if (!ok) { setCloseErr(t("salesDoc.saveErr")); return; }
    appendFlowLog({ code: existing.code, action: "DONE", by: me, to: t(`salesDoc.outcome_${closeResult}`, { defaultValue: closeResult }), at: Date.now(), fromStage: stages[curIdx]?.name, toStage: nextStage.name });
    setCloseOpen(false);
    await syncSalesDocs(DOC);
    nav(base); // ปิดแล้วย้อนกลับกล่องเลย (เหมือนการส่ง)
  };
  const ctrl = (f: SalesField) => {
    const type = f.type ?? "text";
    // ลูกค้า/บริษัท → เลือกจาก DB จริง (prefix) ไม่ดึงทั้งหมดมากรองหน้า · เซ็ตทั้งชื่อ + รหัส (customerRef)
    if (f.key === "customerName") return (
      <CustomerPicker
        value={val("customerName")}
        code={val("customerRef")}
        locked={custLocked}
        onUnlock={() => setCustLocked(false)}
        onPick={(c) => setValues((s) => ({ ...s, customerName: c.name, customerRef: c.code }))}
        placeholder={t("salesDoc.searchCust")}
      />
    );
    if (type === "textarea") return <textarea value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} />;
    if (type === "number") return <input type="number" value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} />;
    if (type === "date") return <input type="date" value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} />;
    // โชว์ค่าที่เก็บไว้แม้ไม่อยู่ใน option list (เช่นค่าที่ย้ายมา) — เติมหน้าสุด
    if (type === "member") { const cur = val(f.key); const us = cur && !users.includes(cur) ? [cur, ...users] : users; return (
      <select value={cur} onChange={(e) => set(f.key, e.target.value)}><option value="">—</option>{us.map((u) => <option key={u} value={u}>{u}</option>)}</select>
    ); }
    if (type === "select") { const cur = val(f.key); const opts = getFieldOptions(DOC, f.key); const all = cur && !opts.includes(cur) ? [cur, ...opts] : opts; return (
      <select value={cur} onChange={(e) => set(f.key, e.target.value)}><option value="">—</option>{all.map((o) => <option key={o} value={o}>{o}</option>)}</select>
    ); }
    if (type === "multiselect") {
      const sel = val(f.key) ? val(f.key).split(",").map((s) => s.trim()).filter(Boolean) : [];
      const toggle = (o: string) => set(f.key, (sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o]).join(", "));
      return <div className="ms-chips">{getFieldOptions(DOC, f.key).map((o) => <button type="button" key={o} className={`ms-chip${sel.includes(o) ? " on" : ""}`} onClick={() => toggle(o)}>{o}</button>)}</div>;
    }
    return <input value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} />;
  };

  function renderPane(p: PaneKey) {
    if (p === "review") {
      const checks = [
        { ok: !!(values.customerName ?? "").trim(), t: t("salesDoc.chkCustomer") },
        { ok: !!(values.salesperson ?? "").trim(), t: t("salesDoc.chkResp") },
        { ok: !!(values.servicesWanted ?? "").trim(), t: t("salesDoc.chkServices") },
        { ok: !!(values.customerNeed ?? "").trim(), t: t("salesDoc.chkNeed") },
      ];
      return (
        <div className="review">
          {existing?.phase === "DONE" && values.outcome && (() => {
            const o = values.outcome;
            const lost = o.includes("ไม่ได้"); const won = !lost && (o.startsWith("ปิดการขายได้") || o.startsWith("ยืนยัน"));
            const c = lost ? "#c23030" : won ? "#1f7a44" : o === "เปิดใบเสนอราคา" ? "#0a6ed1" : "#5a6470";
            const bgc = lost ? "#fdeaea" : won ? "#e7f5ec" : o === "เปิดใบเสนอราคา" ? "#e8f1fc" : "#eef1f4";
            return <div style={{ background: bgc, color: c, border: `1px solid ${c}40`, borderRadius: 8, padding: "9px 11px", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{won ? "ชนะ · " : lost ? "แพ้ · " : ""}{o}{values.closeDate ? ` · ${values.closeDate}` : ""}</div>;
          })()}
          <AgeBadge doc={DOC} startMs={existing?.received?.at || existing?.sent?.at || (values.startDate ? new Date(values.startDate).getTime() : undefined)} endMs={existing?.phase === "DONE" ? ((values.closeDate ? new Date(values.closeDate).getTime() : 0) || existing?.savedAt) : undefined} />
          {checks.map((c, i) => <div className="rcheck" key={i}><span className={c.ok ? "ok" : "miss"}>{c.ok ? <Check /> : <X />}</span>{c.t}</div>)}
          {existing?.bounce && (
            <div className="banner err" style={{ marginTop: 12, fontSize: 12.5 }}>{t("salesDoc.bouncedBy", { by: existing.bounce.by, reason: existing.bounce.reason })}</div>
          )}
          <div style={{ fontSize: 11.5, color: "var(--txt3)", margin: "16px 0 6px", fontWeight: 600 }}>{t("salesDoc.sendRecvHistory")}</div>
          {flowLog.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--txt3)" }}>{t("salesDoc.noSendRecv")}</div>
          ) : (
            <div className="loglist">
              {flowLog.map((e, i) => (
                <div className="logitem" key={i}>
                  <div className="lt"><span>{actLabel(e.action)}</span><span>{new Date(e.at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</span></div>
                  <div className="lb">{e.by}{e.to ? ` → ${e.to}` : ""}{(e.fromStage || e.toStage) ? ` · ${e.fromStage || "—"} → ${e.toStage || "—"}` : ""}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    // ลูกค้า → แผงเดียวกับกล่อง CL (ข้อมูลติดต่อ/ทั่วไป/Sales history/เครื่องมือ/นัดหมาย) อ้างอิงเอกสารนี้
    return (
      <CustomerWorkPanel
        customerCode={values.customerRef || ""}
        customerName={values.customerName}
        refType={DOC}
        refCode={existing?.code ?? ""}
      />
    );
  }

  if (!session) {
    return <div className="p-qt"><div className="main"><div className="banner err">{t("customer.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("customer.goLogin")}</button></div></div>;
  }

  return (
    <div className="p-qt">
      {/* top bar */}
      <div className="topbar">
        <div className="qtag" style={{ background: DOC_TONE[DOC] ?? "var(--blue)" }}>{DOC}</div>
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>iDoc ERP</div>
        <CrossNavSelect fallback={<div className="doctitle">{docNo}{values.customerName ? ` · ${values.customerName}` : ` · ${docTypeName(DOC, i18n.language)}`}</div>} />
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="main">
        {/* Documents (ซ้าย) */}
        <div className={`dtree${collapsed ? " collapsed" : ""}`}>
          <div className="th"><span>Documents</span><div className="collapse-btn" title="ยุบ/ขยาย" onClick={toggleTree}><ChevronLeft size={16} /></div></div>
          <div className="tlist">
            {(() => {
              // ต้นไม้ "แม่ → ลูก": CL (ต้นทาง) → FO → QT → SO · เส้น └ + ป้ายชนิด
              const tLabel = (dt: string) => dt === "CL" ? t("salesDoc.docTypeCL", { defaultValue: "ลูกค้ามุ่งหวัง" }) : dt === "FO" ? t("salesDoc.docTypeFO", { defaultValue: "ใบเปิดโอกาส" }) : dt === "QT" ? t("salesDoc.docTypeQT", { defaultValue: "ใบเสนอราคา" }) : t("salesDoc.docTypeSO", { defaultValue: "ใบสั่งขาย" });
              const row = (key: string, cls: string, depth: number, label: string, dt: string, sel: boolean, onClick?: () => void) => (
                <div key={key} className={`titem ${cls}${sel ? " sel" : ""}`} style={{ paddingLeft: 14 + depth * 16, cursor: sel ? "default" : onClick ? "pointer" : "default" }} title={label} onClick={() => { if (!sel && onClick) onClick(); }}>
                  {depth > 0 && <span style={{ color: "var(--txt3)", marginLeft: -12, marginRight: -2, fontSize: 12 }}>└</span>}
                  <FileText size={14} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}<span style={{ color: "var(--txt3)", marginLeft: 6, fontSize: 11 }}>{tLabel(dt)}</span></span>
                </div>
              );
              const out: ReactNode[] = [];
              if (srcCl) out.push(row("cl", "cl", 0, srcCl, "CL", false, () => window.open(`/sales/cl/${srcCl}/full`, "_blank", "noopener")));
              if (chainRows.length === 0) {
                out.push(row("self", DOC.toLowerCase(), srcCl ? 1 : 0, docNo, DOC, true));
              } else {
                chainRows.forEach((r) => {
                  const isMe = r.code === existing?.code;
                  const depth = srcCl ? r.depth : Math.max(0, r.depth - 1);
                  out.push(row(r.code, r.docType.toLowerCase(), depth, r.code, r.docType, isMe, isMe ? undefined : () => window.open(r.to, "_blank", "noopener")));
                });
              }
              return out;
            })()}
          </div>
          <ModuleDeps moduleKey="sales" />
        </div>

        <div className="workzone">
          <div className="toolbar">
            <div className="tbtn" onClick={() => (window.history.length > 1 ? nav(-1) : nav(base))}><ArrowLeft /><span>{t("custForm.back")}</span></div>
            {heldByMe && <div className="tbtn primary" onClick={() => { if (!saving) save(); }}><Save /><span>{saving ? "…" : t("custForm.save")}</span>{dirty && <span className="dot" />}</div>}
            {canReceive && <div className="tbtn primary" onClick={openReceive}><CheckCircle /><span>{t("salesDoc.receive")}</span></div>}
            {canDelete && <div className="tbtn" style={{ color: "var(--red)" }} onClick={onDelete}><Trash size={15} /><span>{t("salesDoc.delete")}</span></div>}
            {canSend && nextStage?.kind === "DONE" && (DOC === "FO" || DOC === "SO") && <div className="tbtn primary" onClick={openClose}><CheckCircle /><span>{DOC === "SO" ? t("salesDoc.closeSoBtn") : t("salesDoc.closeFoBtn")}</span></div>}
            {canSend && !(nextStage?.kind === "DONE" && (DOC === "FO" || DOC === "SO")) && <div className="tbtn primary" onClick={() => { setSendTo(""); setSendOpen(true); }}><CheckCircle /><span>{t("salesDoc.send")}</span></div>}
            {canRecall && <div className="tbtn" style={{ color: "#b28600" }} onClick={doRecall} title={t("salesDoc.recallTitle")}><Refresh style={{ transform: "scaleX(-1)" }} /><span>{t("salesDoc.recall")}</span></div>}
            {existing && (DOC === "SO" || DOC === "FO") && <div className="tbtn" onClick={() => window.open(`/sales/print/${DOC.toLowerCase()}/${encodeURIComponent(existing.code)}`, "_blank", "noopener")} title={t("salesDoc.printBtn")}><Print /><span>{t("salesDoc.printBtn")}</span></div>}
            <AddToBasketButton code={custRef} name={values.customerName || values.customerCode || ""} variant="tbtn" disabled={!custRef} />
          </div>

          {/* stepper จาก workflow FO */}
          <div className="stepper">
            {stages.map((s, i) => (
              <Fragment key={s.id}>
                <div className={`step${i === curIdx ? " cur" : i < curIdx ? " done" : ""}`}><span className="sn">{i < curIdx ? <Check size={13} /> : i + 1}</span>{s.name}</div>
                {i < stages.length - 1 && <div className="stepline" />}
              </Fragment>
            ))}
          </div>

          {/* แท็บตามกลุ่มบทบาท */}
          <div className="tabs">
            {groups.map(({ g }) => (
              <div key={g} className={`tab${tab === g ? " active" : ""}`} onClick={() => setTab(g)}>
                {t(`salesFields.group.${g}`, { defaultValue: g })}
                {detachable && <span className="tab-pop" title={t("salesDoc.popOut", { defaultValue: "ดึงออกมาดูเทียบ" })} onClick={(e) => { e.stopPropagation(); popOut(g); }}>⧉</span>}
              </div>
            ))}
          </div>

          {detachable && floating.map((g, i) => {
            const grp = groups.find((x) => x.g === g);
            if (!grp) return null;
            return (
              <FloatingPanel key={g} title={t(`salesFields.group.${g}`, { defaultValue: g })} onClose={() => closeFloat(g)} initial={{ x: 40 + i * 28, y: i * 28 }}>
                {grp.fields.map((f) => (
                  <div className="fp-row" key={f.key}>
                    <span className="fp-k">{label(f.key)}</span>
                    <span className={`fp-v${val(f.key) ? "" : " muted"}`}>{val(f.key) || "—"}</span>
                  </div>
                ))}
              </FloatingPanel>
            );
          })}

          <div className="content">
            {/* center: ฟอร์มฟิลด์-กรุ๊ป (ไม่มีตารางย่อย) */}
            <div className="center">
              {values.closeResult && (
                <div className="dup-warn" style={{ background: "#e7f5ec", borderColor: "#b7e0c5" }}>
                  <div className="dw-h" style={{ color: "#1f7a44" }}>✓ {t("salesDoc.soOutcomeBanner", { outcome: t(`salesDoc.outcome_${values.closeResult}`, { defaultValue: values.closeResult }) })}{values.closeDate ? ` · ${values.closeDate}` : ""}</div>
                  {(values.closeResult === "production" || values.closeResult === "project") && <div style={{ fontSize: 11.5, color: "#1f7a44", marginTop: 4 }}>{t("salesDoc.soHandoffReady")}</div>}
                </div>
              )}
              {dupDocs.length > 0 && (
                <div className="dup-warn">
                  <div className="dw-h">⚠ {t("salesDoc.dupTitle", { count: dupDocs.length })}</div>
                  <div className="dw-list">
                    {dupDocs.map((d) => (
                      <button type="button" key={d.code} className="dw-chip" title={d.title || d.code} onClick={() => window.open(dupTo(d.docType, d.code), "_blank", "noopener")}>
                        {d.docType} {d.code}{d.title ? ` · ${d.title}` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {active && (
                <div className="sect">
                  <div className="sh">{t(`salesFields.group.${active.g}`, { defaultValue: active.g })}</div>
                  {active.g === "general" && (
                    <div className="field"><label>{t("salesDoc.docCode")}</label><div className="ctrl"><input value={docNo} readOnly /></div></div>
                  )}
                  {active.fields.map((f) => (
                    <div className={`field${f.type === "textarea" ? " top" : ""}`} key={f.key}>
                      <label>{label(f.key)}{f.core ? " *" : ""}</label>
                      <div className="ctrl" style={f.key === "customerName" ? { position: "relative" } : undefined}>{ctrl(f)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* เมนูขวา + แผงช่วย — เต็มความสูงข้าง workzone (ดึงขึ้นบนเหมือน CL) */}
        <div className="rightwrap">
          <div className={`hpanel${panelOpen ? "" : " closed"}${pane === "customer" && panelOpen ? " wide" : ""}`}>
            <div className="hh"><span>{t(paneTitles[pane])}</span><div className="x" title={t("salesDoc.closePanel")} onClick={() => setPanelOpen(false)}><X size={16} /></div></div>
            <div className="hbody">{renderPane(pane)}</div>
          </div>
          <div className="rail">
            {railItems.map((r) => (
              <div key={r.key} className={`ritem${pane === r.key && panelOpen ? " active" : ""}`} onClick={() => pickPane(r.key)}>
                <r.Icon size={20} /><span>{t(r.label)}</span>
                {r.badge ? <span className="ribadge">{r.badge}</span> : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {sendOpen && nextStage && (
        <div className="wf-flow-ov" onClick={() => setSendOpen(false)}>
          <div className="wf-flow-card" onClick={(e) => e.stopPropagation()}>
            <div className="wf-flow-h"><span>{t("salesDoc.sendDoc")}</span><button className="x" onClick={() => setSendOpen(false)}><X size={16} /></button></div>
            <div className="wf-flow-b">
              <div className="wf-flow-line">
                <div className="wf-flow-node"><span className="lbl">{t("salesDoc.from")}</span><span className="who">{me || "—"}</span><span className="stg">{stages[curIdx]?.name}</span></div>
                <span className="wf-flow-arrow"><ArrowRight size={20} /></span>
                <div className="wf-flow-node to"><span className="lbl">{t("salesDoc.toward")}</span><span className="who">{sendTo || (users.length > 1 ? t("salesDoc.pickBelow") : users[0] || t("salesDoc.wholeGroup"))}</span><span className="stg">{nextStage.name}</span></div>
              </div>
              {users.length > 1 && (
                <div className="wf-flow-pick">
                  <label className="wf-lbl">{t("salesDoc.pickRecipient")}</label>
                  <select value={sendTo} onChange={(e) => setSendTo(e.target.value)}>
                    <option value="">{t("salesDoc.sendWholeGroup", { count: users.length })}</option>
                    {users.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <div className="wf-flow-pickhint">{sendTo ? t("salesDoc.sendSpecific") : t("salesDoc.sendWholeHint")}</div>
                </div>
              )}
            </div>
            <div className="wf-flow-f">
              <button className="btn" onClick={() => setSendOpen(false)}>{t("salesDoc.cancel")}</button>
              <button className="btn primary" onClick={doSend}><CheckCircle size={15} />{t("salesDoc.confirmSend")}</button>
            </div>
          </div>
        </div>
      )}

      {closeOpen && nextStage && (
        <div className="wf-flow-ov" onClick={() => setCloseOpen(false)}>
          <div className="wf-flow-card" onClick={(e) => e.stopPropagation()} style={{ width: 520 }}>
            <div className="wf-flow-h"><span>{DOC === "SO" ? t("salesDoc.closeSoTitle") : t("salesDoc.closeFoTitle")}</span><button className="x" onClick={() => setCloseOpen(false)}><X size={16} /></button></div>
            <div className="wf-flow-b">
              {DOC === "SO" ? (
                <div className="close-seg so3">
                  <button type="button" className={closeResult === "production" ? "on won" : ""} onClick={() => { setCloseResult("production"); setCloseErr(""); }}>{t("salesDoc.soToProduction")}</button>
                  <button type="button" className={closeResult === "project" ? "on won" : ""} onClick={() => { setCloseResult("project"); setCloseErr(""); }}>{t("salesDoc.soToProject")}</button>
                  <button type="button" className={closeResult === "done" ? "on won" : ""} onClick={() => { setCloseResult("done"); setCloseErr(""); }}>✓ {t("salesDoc.soClose")}</button>
                </div>
              ) : (
                <div className="close-seg">
                  <button type="button" className={closeResult === "quote" ? "on won" : ""} onClick={() => { setCloseResult("quote"); setCloseErr(""); }}>{t("salesDoc.toQuote")}</button>
                  <button type="button" className={closeResult === "lost" ? "on lost" : ""} onClick={() => { setCloseResult("lost"); setCloseErr(""); }}>✕ {t("salesDoc.closeLost")}</button>
                </div>
              )}

              <div className="field-sm"><label>{t("salesDoc.closeDate")}</label><input type="date" value={closeForm.closeDate || ""} onChange={(e) => setCf("closeDate", e.target.value)} /></div>

              {/* SO: ส่งไปผลิต / เปิดโครงการ — เตรียม handoff (ดึงลูกค้า/บริการ/ยอด) */}
              {DOC === "SO" && (closeResult === "production" || closeResult === "project") && (
                <div className="cwp" style={{ marginTop: 4 }}>
                  <div className="ct-h">{closeResult === "production" ? t("salesDoc.soProductionSummary") : t("salesDoc.soProjectSummary")}</div>
                  <div className="kv">
                    <div className="r"><span className="k">{t("salesDoc.companyName")}</span><span className="v">{values.customerName || values.customerRef || "—"}</span></div>
                    <div className="r"><span className="k">{t("salesDoc.closedService")}</span><span className="v">{values.closedService || values.servicesOffered || "—"}</span></div>
                    <div className="r"><span className="k">{t("salesDoc.saleAmount")}</span><span className="v">{values.saleAmount || "—"}</span></div>
                  </div>
                  <div className="close-note">{t("salesDoc.soHandoffNote")}</div>
                </div>
              )}
              {DOC === "SO" && closeResult === "done" && <div className="close-note">{t("salesDoc.soCloseHint")}</div>}

              {DOC === "FO" && closeResult === "quote" && (
                <div className="cwp" style={{ marginTop: 4 }}>
                  <div className="ct-h">{t("salesDoc.quoteSummary")}</div>
                  <div className="kv">
                    <div className="r"><span className="k">{t("salesDoc.foServicesWanted")}</span><span className="v">{values.servicesWanted || "—"}</span></div>
                    <div className="r"><span className="k">{t("salesDoc.foCustomerNeed")}</span><span className="v">{values.customerNeed || "—"}</span></div>
                    <div className="r"><span className="k">{t("salesDoc.foUrgency")}</span><span className="v">{values.saleUrgency || values.teleUrgency || "—"}</span></div>
                    <div className="r"><span className="k">{t("salesDoc.foWinProb")}</span><span className="v">{values.winProbability || "—"}</span></div>
                    <div className="r"><span className="k">{t("salesDoc.foExpectedPrice")}</span><span className="v">{values.expectedPrice || "—"}</span></div>
                    <div className="r"><span className="k">{t("salesDoc.foSuggestedPrice")}</span><span className="v">{values.suggestedPrice || "—"}</span></div>
                  </div>
                  <div className="field-sm" style={{ marginTop: 10 }}><label>{t("salesDoc.handoffTo", { doc: "QT" })}</label>
                    <select value={closeForm.handoffTo || ""} onChange={(e) => setCf("handoffTo", e.target.value)}>
                      {nextCreators.map((u) => <option key={u} value={u}>{u}</option>)}
                      <option value="">{t("salesDoc.handoffWhole")}</option>
                    </select>
                  </div>
                  <div className="close-note">{t("salesDoc.toQuoteNote")}</div>
                </div>
              )}
              {closeResult === "lost" && (
                <div className="field-sm"><label>{t("salesDoc.lostReason")}</label>
                  <select value={closeForm.lostReason || ""} onChange={(e) => setCf("lostReason", e.target.value)}>
                    <option value="">—</option>{getLostReasons().map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              )}

              <div className="field-sm"><label>{t("salesDoc.closeNote")}</label><textarea value={closeForm.closeNote || ""} onChange={(e) => setCf("closeNote", e.target.value)} style={{ minHeight: 56 }} /></div>
              {closeErr && <div className="close-err">{closeErr}</div>}
            </div>
            <div className="wf-flow-f">
              <button className="btn" onClick={() => setCloseOpen(false)}>{t("salesDoc.cancel")}</button>
              <button className="btn primary" onClick={doClose} disabled={closing}><CheckCircle size={15} />{closing ? "…" : t("salesDoc.confirmClose")}</button>
            </div>
          </div>
        </div>
      )}

      {recvOpen && (
        <div className="wf-flow-ov" onClick={() => setRecvOpen(false)}>
          <div className="wf-flow-card" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
            <div className="wf-flow-h"><span>{t("salesDoc.recvTitle")}</span><button className="x" onClick={() => setRecvOpen(false)}><X size={16} /></button></div>
            <div className="wf-flow-b">
              <div className="close-seg">
                <button type="button" className={recvMode === "accept" ? "on won" : ""} onClick={() => setRecvMode("accept")}>✓ {t("salesDoc.recvAccept")}</button>
                <button type="button" className={recvMode === "decline" ? "on lost" : ""} onClick={() => setRecvMode("decline")}>↩ {t("salesDoc.recvDecline")}</button>
              </div>
              {recvMode === "accept" ? (
                <div className="close-note">{t("salesDoc.recvAcceptHint")}</div>
              ) : (
                <>
                  <div className="close-note">{t("salesDoc.recvDeclineHint")}</div>
                  <div className="field-sm" style={{ marginTop: 10 }}><label>{t("salesDoc.lostReason")}</label><textarea value={recvReason} onChange={(e) => setRecvReason(e.target.value)} placeholder={t("salesDoc.recvReasonPh")} style={{ minHeight: 64 }} /></div>
                </>
              )}
            </div>
            <div className="wf-flow-f">
              <button className="btn" onClick={() => setRecvOpen(false)}>{t("salesDoc.cancel")}</button>
              {recvMode === "accept"
                ? <button className="btn primary" onClick={confirmReceive}><CheckCircle size={15} />{t("salesDoc.confirmReceive")}</button>
                : <button className="btn" style={{ background: "var(--red)", color: "#fff", borderColor: "var(--red)", opacity: recvReason.trim() ? 1 : 0.5 }} onClick={confirmReceive}><ArrowLeft size={15} />{t("salesDoc.confirmDecline")}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
