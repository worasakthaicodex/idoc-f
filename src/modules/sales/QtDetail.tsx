import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import {
  Help, ArrowLeft, ArrowRight, Save, Trash, Check, CheckCircle, Refresh, ChevronLeft, FileText, X, Shield, User, Plus, Print,
} from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import CrossNavSelect from "../../shared/CrossNavSelect";
import ModuleDeps from "../../shared/ModuleDeps";
import CustomerWorkPanel from "./CustomerWorkPanel";
import CustomerPicker from "./CustomerPicker";
import AddToBasketButton from "../customer/AddToBasketButton";
import { listAttachments } from "../../shared/attachments";
import FloatingPanel from "../../shared/FloatingPanel";
import { isFormDetachable, getQuoteItemTypes } from "./SalesSettings";
import ProductItemInput from "./ProductItemInput";
import AgeBadge from "./AgeBadge";
import { ageStartMs } from "./salesAge";
import { fetchModuleUsers, getIssueEvent, fetchStages, defaultStages, fetchDocCreators, type Stage } from "../workflow/workflowConfig";
import { fieldsOf, coreKeysOf, type SalesField } from "./salesFields";
import { getEnabledFields, getGroupOverrides, groupOf } from "./salesFieldConfig";
import { getFieldOptions } from "./salesFieldOptions";
import { getClDoc, fetchClDoc, fetchDocsByCustomer, saveClDoc, deleteClDoc, genClCode, issueClCode, syncSalesDocs, SALES_DOCS_EVENT, appendFlowLog, loadFlowLog, fmtQtItems, type ClDoc, type FlowLogEntry } from "./clRequests";
import { fetchClChain, type ChainDoc } from "./clLeads";
import { getCloseStrategies, getLostReasons, getRequiredCloseFiles } from "./salesCloseConfig";
import "./qt.css";

const DOC = "QT";
const MODULE = "sales";
type PaneKey = "review" | "customer";
const paneTitles: Record<PaneKey, string> = { review: "salesDoc.reviewTitle", customer: "salesDoc.customerTab" };
const railItems: { key: PaneKey; label: string; Icon: (p: { size?: number }) => React.JSX.Element }[] = [
  { key: "review", label: "salesDoc.review", Icon: Shield },
  { key: "customer", label: "salesDoc.customerTab", Icon: User },
];
const TOTALS = ["grandTotal", "grandDiscount", "grandTotal2", "vat", "netAmount"];
// ฟิลด์ FO ที่นำมาแสดงในแท็บ "รายละเอียด" (เฉพาะ QT ที่มี FO แนบ)
const FO_DETAIL: { key: string; alt?: string; label: string }[] = [
  { key: "servicesWanted", label: "salesDoc.foServicesWanted" },
  { key: "customerNeed", label: "salesDoc.foCustomerNeed" },
  { key: "saleUrgency", alt: "teleUrgency", label: "salesDoc.foUrgency" },
  { key: "winProbability", label: "salesDoc.foWinProb" },
  { key: "expectedPrice", label: "salesDoc.foExpectedPrice" },
  { key: "suggestedPrice", label: "salesDoc.foSuggestedPrice" },
];

type QtRev = { no: number; at: number; by: string; snap: Record<string, string> };
const parseRevs = (s?: string): QtRev[] => { try { const a = s ? JSON.parse(s) : []; return Array.isArray(a) ? a : []; } catch { return []; } };

type LineItem = { name: string; code?: string; serviceType: string; price: string; discount: string; qty: string; unit: string };
const parseItems = (s?: string): LineItem[] => { try { const a = s ? JSON.parse(s) : []; return Array.isArray(a) ? a : []; } catch { return []; } };
const num = (v?: string) => { const n = parseFloat((v || "").replace(/,/g, "")); return isNaN(n) ? 0 : n; };
const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const rowTotal = (it: LineItem) => num(it.price) * num(it.qty) - num(it.discount);

export default function QtDetail() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { id } = useParams();
  const [sp] = useSearchParams();
  const session = getSession();
  const isNew = !id || id === "new";
  const routeCode = isNew ? undefined : id;
  const base = "/sales/qt";

  const [values, setValues] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<ClDoc | null>(null);
  const [users, setUsers] = useState<string[]>([]);
  const me = session?.fullName || session?.email || session?.companyCode || "";
  const [stages, setStages] = useState<Stage[]>(() => defaultStages());
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("idoc.qt.collapsed") === "1");
  const toggleTree = () => setCollapsed((c) => { const n = !c; localStorage.setItem("idoc.qt.collapsed", n ? "1" : "0"); return n; });
  const [pane, setPane] = useState<PaneKey>("review");
  const [panelOpen, setPanelOpen] = useState(true);
  const pickPane = (k: PaneKey) => { if (pane === k && panelOpen) { setPanelOpen(false); return; } setPane(k); setPanelOpen(true); };
  const [sendOpen, setSendOpen] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const qtSendType = "normal"; // ส่งปกติเสมอ (ตามเส้นงาน) — ขอแก้ไข/ขอเพิ่ม เป็นปุ่มแยก
  const [recvOpen, setRecvOpen] = useState(false);
  const [recvMode, setRecvMode] = useState<"accept" | "decline">("accept");
  const [recvReason, setRecvReason] = useState("");
  const [flowLog, setFlowLog] = useState<FlowLogEntry[]>([]);
  const [chain, setChain] = useState<ChainDoc[]>([]);
  const [saving, setSaving] = useState(false);
  const [custLocked, setCustLocked] = useState(false);
  const savedSnap = useRef<string>(""); // สแนปช็อตค่าที่บันทึกล่าสุด — ใช้เช็คว่ามีการแก้ไข (dirty)
  const loadedCode = useRef<string>(""); // โค้ดเอกสารที่โหลดอยู่ — เปลี่ยน = นำทางมาใบใหม่ ต้อง apply ทับ (ข้าม dirty-guard)
  // ปิดการขาย (2 ขา: won/lost)
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeResult, setCloseResult] = useState<"won" | "lost" | "cancel" | "">("");
  const [editOpen, setEditOpen] = useState(false);
  const [editType, setEditType] = useState<"more" | "revision">("more");
  const [editReason, setEditReason] = useState("");
  const [verSnap, setVerSnap] = useState<{ no: number; by: string; at: number; snap: Record<string, string> } | null>(null); // ดูเวอร์ชันเก่า
  const [closeForm, setCloseForm] = useState<Record<string, string>>({});
  const [closeErr, setCloseErr] = useState("");
  const [closing, setClosing] = useState(false);
  const [itemMode, setItemMode] = useState<"summary" | "table">("summary"); // ดูสรุป (ค่าเริ่มต้น) / ตาราง
  const [foDoc, setFoDoc] = useState<ClDoc | null>(null);

  const enabledKeys = useMemo(() => getEnabledFields(DOC), []);
  const grpOv = useMemo(() => getGroupOverrides(DOC), []);
  const quoteItemTypes = useMemo(() => getQuoteItemTypes(), []);   // ประเภทสินค้าที่เสนอราคาได้ (จาก /sales/settings)
  const grpFields = (g: string): SalesField[] => enabledKeys
    .filter((k) => groupOf(DOC, k, grpOv) === g)
    .map((k) => fieldsOf(DOC).find((f) => f.key === k))
    .filter((f): f is SalesField => !!f && !f.hidden && f.group !== "items" && !TOTALS.includes(f.key));

  useEffect(() => { fetchStages(DOC).then(setStages).catch(() => {}); }, []);
  useEffect(() => { fetchModuleUsers(MODULE).then(setUsers).catch(() => {}); }, []);
  const [nextCreators, setNextCreators] = useState<string[]>([]); // ผู้มีสิทธิ์สร้าง SO (QT→SO)
  useEffect(() => { fetchDocCreators("SO").then(setNextCreators).catch(() => {}); }, []);

  // โหลดเอกสาร (local + sync) + flow log
  useEffect(() => {
    if (!routeCode) return;
    const apply = (rec: ClDoc | null) => {
      if (!rec) return;
      setExisting(rec);
      const fresh = loadedCode.current !== rec.code;   // เอกสารคนละใบ (เพิ่งนำทางมา) → ต้อง apply ทับ
      loadedCode.current = rec.code;
      // อย่าทับค่าที่ผู้ใช้กำลังแก้ (dirty) — กัน sync/event มาล้างแถวที่เพิ่งเพิ่ม · ใบใหม่ = ทับเสมอ
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
  }, [routeCode]);

  // เอกสารใหม่จากทางลัด (เช่นเปิด QT จาก FO) → เติมลูกค้า/อ้างอิง + ล็อกลูกค้า
  useEffect(() => {
    if (routeCode) return;
    const seed: Record<string, string> = {};
    ["srcFo", "srcCl", "customerRef", "customerName", "customerCode", "documentRef", "salesperson", "saleDocStatus", "qtOrigin"].forEach((k) => { const v = sp.get(k); if (v) seed[k] = v; });
    if (seed.customerName && !seed.customerCode) seed.customerCode = seed.customerName;
    if (Object.keys(seed).length) setValues((s) => ({ ...seed, ...s }));
    if (sp.get("customerRef")) setCustLocked(true);
  }, [routeCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // สายเอกสารอ้างอิง (เมนูซ้าย) — ปกติจาก CL ต้นทาง. เอกสารที่ย้ายมาไม่มี CL → fallback:
  // ดึง QT/SO/FO ของลูกค้ารายนี้ (endpoint เต็ม ไม่ cap) เพื่อให้เห็น SO ที่ออกจาก QT นี้ + พี่น้อง QT
  const srcCl = values.srcCl || "";
  const custRefForChain = values.customerRef || "";
  useEffect(() => {
    if (srcCl) { fetchClChain(srcCl).then(setChain).catch(() => setChain([])); return; }
    if (!custRefForChain) { setChain([]); return; }
    let alive = true;
    Promise.all((["FO", "QT", "SO"] as const).map((d) =>
      fetchDocsByCustomer(d, custRefForChain)        // กรองที่ backend — ไม่ดึงทั้งตาราง 3 ชนิด
        .then((list) => (list || [])
          .map((x) => ({ docType: d, code: x.code, title: x.title || x.values?.customerName || x.code, srcFo: x.values?.srcFo || "", srcQt: x.values?.srcQt || "" } as ChainDoc)))
        .catch(() => [] as ChainDoc[]),
    )).then((arr) => { if (alive) setChain(arr.flat()); });
    return () => { alive = false; };
  }, [srcCl, custRefForChain]);

  // FO ที่แนบ (สำหรับแท็บ "รายละเอียด")
  const foCode = values.srcFo || values.documentRef || "";
  useEffect(() => {
    if (!foCode) { setFoDoc(null); return; }
    const apply = (fo: ClDoc | null) => {
      setFoDoc(fo);
      // สืบทอดสถานะเอกสาร (Sale) จาก FO ถ้า QT ยังไม่มีค่า
      const foStatus = fo?.values?.saleDocStatus;
      if (foStatus) setValues((s) => (s.saleDocStatus ? s : { ...s, saleDocStatus: foStatus }));
    };
    // ดึง FO ที่แนบ "ใบเดียว" (เบา) — ไม่ sync ทั้งรายการ FO
    const cached = getClDoc(foCode, "FO");
    if (cached) apply(cached);
    fetchClDoc(foCode, "FO").then((fo) => apply(fo ?? getClDoc(foCode, "FO"))).catch(() => apply(getClDoc(foCode, "FO")));
  }, [foCode]);

  const val = (k: string) => values[k] ?? "";
  const setV = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));
  const docNo = existing?.code ?? (isNew ? t("salesDoc.docNew") : id ?? "—");
  const dirty = JSON.stringify(values) !== savedSnap.current; // มีการแก้ไขที่ยังไม่บันทึก → โชว์จุดเขียวที่ปุ่ม Save

  // ===== ตารางย่อย + ยอดรวม =====
  const items = parseItems(values.items);
  const setItems = (next: LineItem[]) => setValues((s) => ({ ...s, items: JSON.stringify(next) }));
  const addItem = () => setItems([...items, { name: "", serviceType: "", price: "", discount: "", qty: "1", unit: "" }]);
  const updItem = (i: number, patch: Partial<LineItem>) => setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const delItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const sumBefore = items.reduce((a, it) => a + num(it.price) * num(it.qty), 0);
  const sumDiscount = items.reduce((a, it) => a + num(it.discount), 0);
  const afterDiscount = sumBefore - sumDiscount;
  const vatAmt = afterDiscount * 0.07;
  const netAmt = afterDiscount + vatAmt;
  // ตัวเลือก "บริการที่ปิดได้" ตอนปิดการขาย = ชุดเดียวกับฟิลด์ "ปิดบริการอะไร" ของ SO (บริการฝึกอบรม/คำปรึกษา/One Stop)
  const serviceOpts = useMemo(() => getFieldOptions("SO", "closedService"), []);

  // ===== ขั้นตอน + ส่ง/รับ (เหมือน FO) =====
  const headIdx = Math.max(0, stages.findIndex((s) => s.pinned === "head"));
  const curIdx = existing?.stageId ? Math.max(0, stages.findIndex((s) => s.id === existing.stageId)) : headIdx;
  const curStage = stages[curIdx];
  const nextStage = curIdx >= 0 ? stages[curIdx + 1] : undefined;
  const atCreateStage = stages.length > 0 && curIdx === headIdx;
  const heldByMe = existing ? (existing.received ? existing.received.by === me : !existing.sent) : true;
  // แก้ไขรายการย่อย/เพิ่มใบเสนอราคา ได้เฉพาะ "ขั้นตอนสร้าง (จัดทำ)" เท่านั้น
  const canEditItems = atCreateStage && heldByMe;
  const canSend = !!existing && !!nextStage && heldByMe;
  const canDelete = !!existing && atCreateStage && heldByMe;
  const canRecall = !!existing && !!existing.sent && existing.sent.by === me && !existing.received && !atCreateStage;
  const recipients = existing?.sent?.recipients;
  const forMe = !recipients || recipients.length === 0 || recipients.includes(me);
  // รับเรื่องได้เมื่อ: ถูกส่งมา ยังไม่รับ เป็นผู้รับ และยังไม่เสร็จ (รองรับทั้ง phase RECEIVE/EXPORT)
  const canReceive = !!existing && !!existing.sent && !existing.received && forMe && existing.phase !== "DONE";

  const custRef = values.customerRef || "";

  // ===== บันทึก / ส่ง / รับ / ดึงกลับ =====
  const persist = (extra: Partial<ClDoc>, vals?: Record<string, string>): ClDoc => {
    const v = vals ?? values;
    const titleKey = coreKeysOf(DOC)[0] ?? "customerCode";
    return {
      code: existing?.code ?? "", title: (v[titleKey] ?? existing?.title ?? "").trim() || (existing?.code ?? ""),
      telesale: (v.salesperson ?? existing?.telesale ?? "").trim(), phase: existing?.phase ?? "PROCESS",
      savedAt: Date.now(), values: v, stageId: existing?.stageId, received: existing?.received, bounce: existing?.bounce, sent: existing?.sent,
      ...extra,
    };
  };
  const save = async () => {
    if (existing && !heldByMe) { alert(t("salesDoc.notHeldErr")); return; }
    const titleKey = coreKeysOf(DOC)[0] ?? "customerCode";
    if (!(values[titleKey] ?? "").trim()) { alert(t("salesDoc.needCustomer")); return; }
    const issueEvent = getIssueEvent(DOC);
    const genDraft = () => `DRAFT-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    // QT ดราฟ (จากการปิด FO) → บันทึกครั้งแรก = ออกเลขจริง "QT เกิด"
    const reborn = !!existing && existing.code.startsWith("DRAFT-") && issueEvent === "CREATE";
    const code = existing?.code ?? (issueEvent === "CREATE" ? genClCode(DOC) : genDraft());
    const finalCode = reborn ? genClCode(DOC) : code;
    // เขียนยอดรวมที่คำนวณจากตารางลงค่า (ให้สรุป/เอกสารอื่นใช้ได้)
    const vals = { ...values, createdBy: values.createdBy || me, grandTotal: String(sumBefore), grandDiscount: String(sumDiscount), grandTotal2: String(afterDiscount), vat: vatAmt.toFixed(2), netAmount: netAmt.toFixed(2), ...(reborn ? { qtDraft: "" } : {}) };
    setSaving(true);
    const ok = await saveClDoc(persist({ code: finalCode, savedAt: Date.now() }, vals), DOC);
    setSaving(false);
    if (!ok) { alert(t("salesDoc.saveErr")); return; }
    if (reborn && existing) deleteClDoc(existing.code, DOC); // ลบดราฟเดิม (กลายเป็นเลขจริงแล้ว)
    // QT ถูกสร้างจริงแล้ว (มีเลขจริง ไม่ใช่ดราฟ) → FO ต้นทางถึงจะ "เสร็จสิ้น" ได้ (ออกจากกล่องส่งออก ไปเสร็จสิ้น)
    if (DOC === "QT" && values.srcFo && !finalCode.startsWith("DRAFT-")) {
      const f = getClDoc(values.srcFo, "FO");
      if (f) await saveClDoc({ ...f, phase: "DONE", values: { ...(f.values ?? {}), handoffConsumed: "1" }, savedAt: Date.now() }, "FO");
    }
    await syncSalesDocs(DOC);
    const rec = getClDoc(finalCode, DOC);
    if (rec) { setExisting(rec); setValues(rec.values ?? {}); }
    savedSnap.current = JSON.stringify(rec?.values ?? vals);
    if (isNew || reborn) nav(`${base}/${finalCode}`, { replace: true });
  };
  const onDelete = async () => {
    if (!existing) return;
    if (!heldByMe) { alert(t("salesDoc.notHeldErr")); return; }
    // QT ที่เกิดจากการปิด FO → ลบแล้ว "คืน FO ต้นทางกลับมา" (ยกเลิกการเสนอราคา, เปิดให้แก้ต่อได้)
    if (values.srcFo) {
      if (!window.confirm(t("salesDoc.confirmDelToFo", { defaultValue: "ลบใบเสนอราคานี้ แล้วคืนกลับเป็นใบเปิดการขาย (FO) เพื่อแก้ไขใหม่?" }))) return;
      const f = getClDoc(values.srcFo, "FO");
      if (f) {
        const fStages = await fetchStages("FO");
        const fIdx = f.stageId ? Math.max(0, fStages.findIndex((s) => s.id === f.stageId)) : fStages.length - 1;
        const fPrev = fStages[Math.max(0, fIdx - 1)];
        await saveClDoc({
          ...f,
          stageId: fPrev?.id ?? f.stageId, phase: "PROCESS",
          received: { by: me, at: Date.now() }, sent: undefined, bounce: undefined,
          values: { ...(f.values ?? {}), closeResult: "", closeDate: "", closeNote: "", handoffConsumed: "", handoffType: "", handoffTo: "" },
          savedAt: Date.now(),
        }, "FO");
      }
      deleteClDoc(existing.code, DOC);
      await syncSalesDocs("QT"); await syncSalesDocs("FO");
      nav(`/sales/fo/d/${encodeURIComponent(values.srcFo)}`); return;
    }
    if (!window.confirm(t("salesDoc.confirmDelete"))) return;
    deleteClDoc(existing.code, DOC); nav("/sales/qt");
  };
  const doSend = async () => {
    if (!existing || !nextStage) return;
    const sent = { by: me, to: sendTo || "—", at: Date.now(), fromStage: stages[curIdx]?.name, toStage: nextStage.name, recipients: sendTo ? [sendTo] : [] };
    const phase = nextStage.kind === "DONE" ? "DONE" as const : "RECEIVE" as const;
    // ลักษณะการส่ง QT (ปกติ/ขอเพิ่ม/แก้ไข) + นับรีวิชั่นเมื่อขอเพิ่ม/แก้ไข
    const vals = { ...values, qtSendType, qtRevisions: String(Number(values.qtRevisions || 0) + (qtSendType !== "normal" ? 1 : 0)) };
    const ok = await saveClDoc(persist({ stageId: nextStage.id, sent, received: undefined, phase, savedAt: Date.now() }, vals), DOC);
    if (!ok) { alert(t("salesDoc.sendFail")); return; }
    appendFlowLog({ code: existing.code, action: nextStage.kind === "DONE" ? "DONE" : "SEND", by: me, to: sendTo || t("salesDoc.wholeGroup"), at: Date.now(), fromStage: stages[curIdx]?.name, toStage: nextStage.name });
    if (getIssueEvent(DOC) === "APPROVE" && existing.code.startsWith("DRAFT-") && curStage?.kind === "APPROVE") await issueClCode(existing.code, DOC);
    setSendOpen(false); await syncSalesDocs(DOC); nav("/sales/qt");
  };
  const doRecall = async () => {
    if (!existing || !existing.sent) return;
    if (!window.confirm(t("salesDoc.confirmRecall"))) return;
    const prev = stages[Math.max(0, curIdx - 1)];
    const upd = persist({ sent: undefined, stageId: prev?.id ?? existing.stageId, phase: "PROCESS", savedAt: Date.now() });
    const ok = await saveClDoc(upd, DOC);
    if (!ok) { alert(t("salesDoc.recallFail")); return; }
    appendFlowLog({ code: existing.code, action: "RECALL", by: me, at: Date.now(), fromStage: curStage?.name, toStage: prev?.name });
    setExisting(upd); setFlowLog(loadFlowLog(existing.code)); await syncSalesDocs(DOC); alert(t("salesDoc.recalled"));
  };
  const openReceive = () => { setRecvMode("accept"); setRecvReason(""); setRecvOpen(true); };
  const confirmReceive = async () => {
    if (!existing) return;
    if (recvMode === "accept") {
      const upd = persist({ received: { by: me, at: Date.now() }, bounce: undefined, phase: "PROCESS", savedAt: Date.now() });
      const ok = await saveClDoc(upd, DOC);
      if (!ok) { alert(t("salesDoc.receiveFail")); return; }
      appendFlowLog({ code: existing.code, action: "RECEIVE", by: me, at: Date.now(), toStage: curStage?.name });
      setExisting(upd);
    } else {
      if (!recvReason.trim()) return;
      // QT ที่มาจากการปิด FO (ดราฟ) → ไม่รับ = ตีกลับไป "FO ต้นทาง" ถอย 1 ขั้น เข้ากล่องรับเข้าเจ้าของ FO แล้วทิ้งดราฟ QT
      if (values.srcFo) {
        const f = getClDoc(values.srcFo, "FO");
        if (f) {
          const fStages = await fetchStages("FO");
          const fIdx = f.stageId ? Math.max(0, fStages.findIndex((s) => s.id === f.stageId)) : fStages.length - 1;
          const fPrev = fStages[Math.max(0, fIdx - 1)];
          const owner = f.sent?.by || f.values?.salesperson || f.telesale || "";
          await saveClDoc({
            ...f,
            stageId: fPrev?.id ?? f.stageId, phase: "RECEIVE", received: undefined,
            bounce: { by: me, at: Date.now(), reason: recvReason.trim() },
            sent: { by: me, to: owner, at: Date.now(), fromStage: fStages[fIdx]?.name, toStage: fPrev?.name, recipients: owner ? [owner] : [] },
            values: { ...(f.values ?? {}), closeResult: "", handoffConsumed: "", handoffType: "" },
            savedAt: Date.now(),
          }, "FO");
        }
        deleteClDoc(existing.code, DOC); // ทิ้งดราฟ QT (ยังไม่เกิด)
        appendFlowLog({ code: existing.code, action: "DECLINE", by: me, at: Date.now(), toStage: values.srcFo });
        setRecvOpen(false); await syncSalesDocs("QT"); await syncSalesDocs("FO"); nav("/sales/qt"); return;
      }
      // ไม่รับ → ตีกลับเข้า "กล่องรับเข้า" ของผู้ที่ส่งมา (ถอย 1 ขั้น + เหตุผล) ไม่ใช่กองในดำเนินการ
      const prev = stages[Math.max(0, curIdx - 1)];
      const sender = existing.sent?.by || existing.telesale || values.salesperson || "";
      const upd = persist({
        sent: { by: me, to: sender, at: Date.now(), fromStage: curStage?.name, toStage: prev?.name, recipients: sender ? [sender] : [] },
        received: undefined,
        bounce: { by: me, at: Date.now(), reason: recvReason.trim() },
        stageId: prev?.id ?? existing.stageId,
        phase: "RECEIVE", savedAt: Date.now(),
      });
      const ok = await saveClDoc(upd, DOC);
      if (!ok) { alert(t("salesDoc.declineFail")); return; }
      appendFlowLog({ code: existing.code, action: "DECLINE", by: me, at: Date.now(), fromStage: curStage?.name, toStage: prev?.name });
      setRecvOpen(false); await syncSalesDocs(DOC); nav("/sales/qt"); return;
    }
    setRecvOpen(false); setFlowLog(loadFlowLog(existing.code)); await syncSalesDocs(DOC);
  };
  // ขอแก้ไข (ระหว่างดำเนินการ) → ส่ง QT กลับกล่องรับเข้าของผู้สร้าง เพื่อขอเพิ่มใบเสนอ/ขอรีวิชั่น
  const openEdit = () => { setEditType("more"); setEditReason(""); setEditOpen(true); };
  const doEditRequest = async () => {
    if (!existing) return;
    if (!heldByMe) { alert(t("salesDoc.notHeldErr")); return; }
    const creator = (values.createdBy || values.salesperson || existing.telesale || "").trim();
    const prev = stages[Math.max(0, curIdx - 1)];
    const vals = { ...values, editReqType: editType, editReqNote: editReason.trim() };
    const upd = persist({ sent: { by: me, to: creator || "—", at: Date.now(), fromStage: curStage?.name, toStage: prev?.name, recipients: creator ? [creator] : [] }, stageId: prev?.id ?? existing.stageId, received: undefined, phase: "RECEIVE", savedAt: Date.now() }, vals);
    const ok = await saveClDoc(upd, DOC);
    if (!ok) { alert(t("salesDoc.sendFail")); return; }
    appendFlowLog({ code: existing.code, action: "SEND", by: me, to: creator || "—", at: Date.now(), fromStage: curStage?.name, toStage: prev?.name });
    setEditOpen(false); await syncSalesDocs(DOC); nav("/sales/qt");
  };
  // ทำรีวิชั่น (ต้องถูกขอมา) — เก็บค่าปัจจุบันเป็นเวอร์ชันเก่า แล้วขึ้นเวอร์ชันใหม่ให้แก้ต่อ
  const revNo = Number(values.revNo || 1);
  const revs = parseRevs(values.revHistory);
  const doRevision = async () => {
    if (!existing) return;
    if (!heldByMe) { alert(t("salesDoc.notHeldErr")); return; }
    if (!window.confirm(t("salesDoc.revisionConfirm", { n: revNo + 1 }))) return;
    const snap: Record<string, string> = { ...values }; delete snap.revHistory;
    const hist = [...revs, { no: revNo, at: Date.now(), by: me, snap }];
    const vals = { ...values, revHistory: JSON.stringify(hist).slice(0, 100000), revNo: String(revNo + 1), editReqType: "", ageRestartAt: String(Date.now()) };
    const upd = persist({ savedAt: Date.now() }, vals);
    const ok = await saveClDoc(upd, DOC);
    if (!ok) { alert(t("salesDoc.saveErr")); return; }
    setExisting(upd); setValues(vals); savedSnap.current = JSON.stringify(vals); await syncSalesDocs(DOC);
  };
  const actLabel = (a: FlowLogEntry["action"]) => t(`salesDoc.act${a}`, { defaultValue: a });

  // ===== ปิดการขาย (ส่งไปขั้นเสร็จสิ้น) =====
  // จำผู้รับช่วงต่อ (handoff QT→SO) ล่าสุดของผู้ใช้นี้ไว้ที่เครื่อง → ครั้งหน้าเลือกให้เลย (ไม่ต้องเลือกใหม่ทุกครั้ง)
  const HANDOFF_KEY = `idoc.sales.handoffTo.qt:${me}`;
  const rememberedHandoff = (): string => { try { const v = localStorage.getItem(HANDOFF_KEY) || ""; return nextCreators.includes(v) ? v : ""; } catch { return ""; } };
  const openClose = () => {
    const svc = serviceOpts[0] || values.servicesOffered || "";
    setCloseResult("");
    setCloseErr("");
    setCloseForm({ closeDate: today(), closeNote: "", closeStrategy: "", closedService: svc, saleAmount: netAmt.toFixed(2), lostReason: "", quoteItemsNote: fmtQtItems(values.items), handoffTo: rememberedHandoff() || nextCreators[0] || values.salesperson || "" });
    setCloseOpen(true);
  };
  const setCf = (k: string, v: string) => setCloseForm((s) => ({ ...s, [k]: v }));
  const doClose = async () => {
    if (!existing || !nextStage) return;
    if (!heldByMe) { setCloseErr(t("salesDoc.notHeldErr")); return; }
    if (!closeResult) { setCloseErr(t("salesDoc.closePickResult")); return; }
    setClosing(true); setCloseErr("");
    try {
      if (closeResult === "won") {
        // ตรวจไฟล์แนบบังคับ (จากเครื่องมือไฟล์แนบของลูกค้า)
        const required = getRequiredCloseFiles();
        if (required.length && custRef) {
          let attached: string[] = [];
          try {
            const atts = await listAttachments("CUSTOMER", custRef);   // ไฟล์แนบของลูกค้า (ระบบ attachment)
            attached = atts.map((a) => a.category || "").filter(Boolean);
          } catch { /* ถือว่าไม่มีไฟล์ */ }
          const missing = required.filter((r) => !attached.includes(r));
          if (missing.length) { setCloseErr(t("salesDoc.closeMissingFiles", { files: missing.join(", ") })); setClosing(false); return; }
        }
      }
      const closeVals: Record<string, string> = {
        ...values,
        closeDate: closeForm.closeDate || today(),
        closeNote: closeForm.closeNote || "",
        closeResult,
        grandTotal: String(sumBefore), grandDiscount: String(sumDiscount), grandTotal2: String(afterDiscount), vat: vatAmt.toFixed(2), netAmount: netAmt.toFixed(2),
      };
      if (closeResult === "won") {
        closeVals.closeStrategy = closeForm.closeStrategy || "";
        closeVals.closedService = closeForm.closedService || "";
        closeVals.saleAmount = closeForm.saleAmount || netAmt.toFixed(2);
        closeVals.lostReason = "";
        closeVals.handoffType = "SO"; closeVals.handoffTo = closeForm.handoffTo || ""; closeVals.handoffConsumed = "1"; // ระบบสร้าง SO ให้อัตโนมัติ
        if (closeForm.handoffTo) { try { localStorage.setItem(HANDOFF_KEY, closeForm.handoffTo); } catch { /* ignore */ } } // จำคนที่เลือกไว้ใช้ครั้งหน้า
      } else {
        closeVals.lostReason = closeForm.lostReason || "";
      }
      // ชนะ = เหมือน "ส่ง" → QT ไปกล่องส่งออกก่อน (ยังไม่เสร็จสิ้น) จะเสร็จสิ้นได้ก็ต่อเมื่อ SO ถูกสร้างจริงแล้ว · แพ้/ยกเลิก = เสร็จสิ้นเลย
      const isWon = closeResult === "won";
      // ผู้รับ SO = คนที่เลือกตอนปิด (handoffTo) ไม่ใช่ salesperson — ไม่งั้นไปโผล่ผิดคน/ทุกคน
      const handoffRecip = (closeForm.handoffTo || values.salesperson || "").trim();
      const recips = isWon && handoffRecip ? [handoffRecip] : [];
      const sent = { by: me, to: isWon ? (handoffRecip || "—") : "—", at: Date.now(), fromStage: stages[curIdx]?.name, toStage: nextStage.name, recipients: recips };
      const ok = await saveClDoc(persist({ stageId: nextStage.id, sent, phase: isWon ? "EXPORT" : "DONE", savedAt: Date.now() }, closeVals), DOC);
      if (!ok) { setCloseErr(t("salesDoc.saveErr")); setClosing(false); return; }
      // QT ปิดได้ → ระบบสร้าง "ใบสั่งขาย (SO)" ให้อัตโนมัติ เข้ากล่องรับเข้าของผู้ขาย (กดเข้าไปดู → รับ/ไม่รับ แบบเดิม)
      if (closeResult === "won") {
        const soVals: Record<string, string> = {
          customerName: val("customerName") || val("customerCode") || "", customerRef: custRef,
          quotationRef: existing.code, srcQt: existing.code, srcCl: values.srcCl || "", srcFo: values.srcFo || "",
          closedService: closeVals.closedService || "", saleAmount: closeVals.saleAmount || "", salesperson: values.salesperson || "",
          quoteItemsNote: closeForm.quoteItemsNote || fmtQtItems(values.items), // ส่งรายการย่อยจากใบเสนอราคาไปช่อง "บันทึกรายการ" ของ SO
          soDraft: "1", // ยังเป็น "ดราฟ" — SO จะเกิดจริง (ออกเลข) เมื่อผู้ขายกดรับแล้วบันทึก
        };
        const soCode = `DRAFT-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
        const recips = soVals.salesperson ? [soVals.salesperson] : [];
        await saveClDoc({ code: soCode, title: soVals.customerName || soCode, telesale: soVals.salesperson, phase: "RECEIVE", savedAt: Date.now(), values: soVals, sent: { by: me, to: soVals.salesperson || "—", at: Date.now(), fromStage: existing.code, toStage: "จัดทำ", recipients: recips } }, "SO");
      }
      appendFlowLog({ code: existing.code, action: "DONE", by: me, to: closeResult === "won" ? t("salesDoc.closeWon") : closeResult === "cancel" ? t("salesDoc.closeCancel") : t("salesDoc.closeLost"), at: Date.now(), fromStage: stages[curIdx]?.name, toStage: nextStage.name });
      if (getIssueEvent(DOC) === "APPROVE" && existing.code.startsWith("DRAFT-")) await issueClCode(existing.code, DOC);
      setClosing(false); setCloseOpen(false);
      await syncSalesDocs(DOC);
      nav("/sales/qt"); // ปิดแล้วย้อนกลับกล่องเลย (เหมือนการส่ง)
    } catch { setCloseErr(t("salesDoc.saveErr")); setClosing(false); }
  };
  // เพิ่มใบเสนอราคาอีกใบ อ้างอิง FO เดิม (ผู้สร้างทำได้เอง / เมื่อถูกขอเพิ่ม)
  const addQuote = () => {
    if (!window.confirm(t("salesDoc.addQuoteConfirm"))) return;
    const qs = new URLSearchParams({
      srcFo: foCode, documentRef: foCode, srcCl: values.srcCl || "",
      customerRef: values.customerRef || custRef, customerName: values.customerName || values.customerCode || "",
      salesperson: values.salesperson || me, qtOrigin: "more",
    });
    nav(`/sales/qt/new?${qs.toString()}`);
  };

  // ===== แท็บ =====
  const showFo = !!foCode;
  const tabsDef = [
    { key: "saleData", label: t("salesDoc.saleData") },
    { key: "quote", label: t("salesDoc.quote") },
    ...(showFo ? [{ key: "fo", label: t("salesDoc.detail") }] : []),
  ];
  const [tab, setTab] = useState("saleData");
  const detachable = isFormDetachable();
  const [floating, setFloating] = useState<string[]>([]);
  const popOut = (g: string) => setFloating((f) => (f.includes(g) ? f : [...f, g]));
  const closeFloat = (g: string) => setFloating((f) => f.filter((x) => x !== g));

  const flabel = (k: string) => t(`salesFields.${k}`, { defaultValue: k });
  const ctrl = (f: SalesField) => {
    const type = f.type ?? "text";
    if (f.key === "customerCode") return (
      <CustomerPicker value={val("customerCode") || val("customerName")} code={val("customerRef")} locked={custLocked} onUnlock={() => setCustLocked(false)}
        onPick={(c) => setValues((s) => ({ ...s, customerCode: c.name, customerName: c.name, customerRef: c.code }))} placeholder={t("salesDoc.searchCust")} />
    );
    if (type === "textarea") return <textarea value={val(f.key)} onChange={(e) => setV(f.key, e.target.value)} />;
    if (type === "number") return <input type="number" value={val(f.key)} onChange={(e) => setV(f.key, e.target.value)} />;
    if (type === "date") return <input type="date" value={val(f.key)} onChange={(e) => setV(f.key, e.target.value)} />;
    // โชว์ค่าที่เก็บไว้แม้ไม่อยู่ใน option list (เช่นค่าที่ย้ายมา) — เติมไว้หน้าสุด
    if (type === "member") { const cur = val(f.key); const us = cur && !users.includes(cur) ? [cur, ...users] : users; return <select value={cur} onChange={(e) => setV(f.key, e.target.value)}><option value="">—</option>{us.map((u) => <option key={u} value={u}>{u}</option>)}</select>; }
    if (type === "select") { const cur = val(f.key); const opts = getFieldOptions(DOC, f.key); const all = cur && !opts.includes(cur) ? [cur, ...opts] : opts; return <select value={cur} onChange={(e) => setV(f.key, e.target.value)}><option value="">—</option>{all.map((o) => <option key={o} value={o}>{o}</option>)}</select>; }
    return <input value={val(f.key)} onChange={(e) => setV(f.key, e.target.value)} />;
  };

  if (!session) return <div className="p-qt"><div className="main"><div style={{ padding: 24 }}>กรุณาเข้าสู่ระบบ</div></div></div>;

  const renderPane = (p: PaneKey) => {
    if (p === "review") {
      const checks = [
        { ok: !!custRef, t: t("salesDoc.chkCustomer") },
        { ok: items.length > 0, t: t("salesDoc.chkHasItem") },
        { ok: !!val("paymentTerms"), t: t("salesDoc.chkPayTerms") },
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
          <AgeBadge doc="QT" startMs={ageStartMs(existing) || (values.followupDate ? new Date(values.followupDate).getTime() : undefined)} endMs={existing?.phase === "DONE" ? ((values.closeDate ? new Date(values.closeDate).getTime() : 0) || existing?.savedAt) : undefined} />
          {checks.map((c, i) => <div className="rcheck" key={i}><span className={c.ok ? "ok" : "miss"}>{c.ok ? <Check /> : <X />}</span>{c.t}</div>)}
          {existing?.bounce && <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--red)" }}>{t("salesDoc.bouncedBy", { by: existing.bounce.by, reason: existing.bounce.reason })}</div>}
          <div style={{ fontSize: 11.5, color: "var(--txt3)", margin: "16px 0 6px", fontWeight: 600 }}>{t("salesDoc.sendRecvHistory")}</div>
          {flowLog.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--txt3)" }}>{t("salesDoc.noSendRecv")}</div> : (
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
    return <CustomerWorkPanel customerCode={custRef} customerName={val("customerName") || val("customerCode")} refType={DOC} refCode={existing?.code ?? ""} />;
  };

  return (
    <div className="p-qt">
      <div className="topbar">
        <div className="qtag" style={{ background: "var(--green)" }}>QT</div>
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>iDoc ERP</div>
        <CrossNavSelect fallback={<div className="doctitle">{docNo}{val("customerCode") ? ` · ${val("customerCode")}` : ""}</div>} />
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="main">
        <div className={`dtree${collapsed ? " collapsed" : ""}`}>
          <div className="th"><span>Documents</span><div className="collapse-btn" title="ยุบ/ขยาย" onClick={toggleTree}><ChevronLeft size={16} /></div></div>
          <div className="tlist">
            {(() => {
              // ต้นไม้ "แม่ → ลูก": CL → FO → (QT ตัวนี้) → เวอร์ชันเก่า / SO / ใบเสนอพี่น้อง
              const meCode = existing?.code || "";
              const shortDate = (ms: number) => new Date(ms).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
              type TRow = { id: string; cls: string; depth: number; label: string; sub?: string; sel?: boolean; to?: string; onClick?: () => void };
              const rows: TRow[] = [];
              let d = 0;
              if (srcCl) rows.push({ id: "cl", cls: "cl", depth: d++, label: srcCl, sub: t("salesDoc.docTypeCL", { defaultValue: "ลูกค้ามุ่งหวัง" }), to: `/sales/cl/${srcCl}/full` });
              if (foCode) rows.push({ id: "fo", cls: "fo", depth: d++, label: foCode, sub: t("salesDoc.docTypeFO", { defaultValue: "ใบเปิดโอกาส" }), to: `/sales/fo/d/${foCode}` });
              const qd = d; // ระดับของใบเสนอราคา
              rows.push({ id: "self", cls: "qt", depth: qd, label: `${docNo}${revNo > 1 ? ` (v${revNo})` : ""}`, sub: t("salesDoc.docTypeQT", { defaultValue: "ใบเสนอราคา" }), sel: true });
              revs.forEach((rv) => rows.push({ id: `v${rv.no}`, cls: "qt", depth: qd + 1, label: `v${rv.no} · ${shortDate(rv.at)}`, sub: t("salesDoc.oldVersion", { defaultValue: "เวอร์ชันเก่า" }), onClick: () => setVerSnap(rv) }));
              chain.filter((c) => c.docType === "SO" && c.srcQt === meCode).forEach((s) => rows.push({ id: s.code, cls: "so", depth: qd + 1, label: s.code, sub: t("salesDoc.docTypeSO", { defaultValue: "ใบสั่งขาย" }), to: `/sales/so/d/${s.code}` }));
              // พี่น้อง = อ้าง FO ต้นทาง "ใบเดียวกัน" เท่านั้น · ไม่มี FO → ไม่นับ (กันรกจาก QT ลูกค้าเดียวกัน)
              chain.filter((c) => c.docType === "QT" && c.code !== meCode && !!foCode && c.srcFo === foCode).forEach((q) => rows.push({ id: q.code, cls: "qt", depth: qd, label: q.code, sub: t("salesDoc.docTypeQTsibling", { defaultValue: "ใบเสนอราคาพี่น้อง" }), to: `/sales/qt/${q.code}` }));
              return rows.map((r) => (
                <div key={r.id} className={`titem ${r.cls}${r.sel ? " sel" : ""}`} style={{ paddingLeft: 14 + r.depth * 16, cursor: r.sel ? "default" : (r.to || r.onClick) ? "pointer" : "default" }} title={r.label}
                  onClick={() => { if (r.sel) return; if (r.onClick) r.onClick(); else if (r.to) window.open(r.to, "_blank", "noopener"); }}>
                  {r.depth > 0 && <span style={{ color: "var(--txt3)", marginLeft: -12, marginRight: -2, fontSize: 12 }}>└</span>}
                  <FileText size={14} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}{r.sub && <span style={{ color: "var(--txt3)", marginLeft: 6, fontSize: 11 }}>{r.sub}</span>}</span>
                </div>
              ));
            })()}
          </div>
          <ModuleDeps moduleKey="sales" />
        </div>

        <div className="workzone">
          <div className="toolbar">
            <div className="tbtn" onClick={() => (window.history.length > 1 ? nav(-1) : nav(base))}><ArrowLeft /><span>{t("salesDoc.back")}</span></div>
            {heldByMe && <div className="tbtn primary" onClick={() => { if (!saving) save(); }}><Save /><span>{saving ? "…" : t("salesDoc.save")}</span>{dirty && <span className="dot" />}</div>}
            {heldByMe && !atCreateStage && existing?.phase !== "DONE" && <div className="tbtn" onClick={openEdit} title={t("salesDoc.editReqTitle")}><Refresh /><span>{t("salesDoc.editReqBtn")}</span></div>}
            {canReceive && <div className="tbtn primary" onClick={openReceive}><CheckCircle /><span>{t("salesDoc.receive")}</span></div>}
            {canDelete && <div className="tbtn" style={{ color: "var(--red)" }} onClick={onDelete}><Trash size={15} /><span>{t("salesDoc.delete")}</span></div>}
            {canSend && nextStage?.kind === "DONE" && <div className="tbtn primary" onClick={openClose}><CheckCircle /><span>{t("salesDoc.closeDeal")}</span></div>}
            {canSend && nextStage?.kind !== "DONE" && <div className="tbtn primary" onClick={() => { setSendTo(""); setSendOpen(true); }}><CheckCircle /><span>{t("salesDoc.send")}</span></div>}
            {canRecall && <div className="tbtn" style={{ color: "#b28600" }} onClick={doRecall} title={t("salesDoc.recallTitle")}><Refresh style={{ transform: "scaleX(-1)" }} /><span>{t("salesDoc.recall")}</span></div>}
            {existing && <div className="tbtn" onClick={() => window.open(`/sales/print/qt/${encodeURIComponent(existing.code)}`, "_blank", "noopener")} title={t("salesDoc.printBtn")}><Print /><span>{t("salesDoc.printBtn")}</span></div>}
            <AddToBasketButton code={values.customerRef || ""} name={values.customerName || values.customerCode || ""} variant="tbtn" disabled={!values.customerRef} />
            {foCode && existing && atCreateStage && <div className={`tbtn${values.editReqType === "more" ? " primary" : ""}`} onClick={addQuote} title={t("salesDoc.addQuoteHint")}><FileText /><span>{t("salesDoc.addQuoteBtn")}</span></div>}
            {heldByMe && atCreateStage && values.editReqType === "revision" &&<div className="tbtn" style={{ color: "#5e5ce6" }} onClick={doRevision} title={t("salesDoc.revisionBtn")}><Refresh /><span>{t("salesDoc.revisionBtn")} (v{revNo})</span></div>}
          </div>

          <div className="stepper">
            {stages.map((s, i) => (
              <Fragment key={s.id}>
                <div className={`step${i === curIdx ? " cur" : i < curIdx ? " done" : ""}`}><span className="sn">{i < curIdx ? <Check size={13} /> : i + 1}</span>{s.name}</div>
                {i < stages.length - 1 && <div className="stepline" />}
              </Fragment>
            ))}
          </div>

          <div className="tabs">
            {tabsDef.map((tk) => (
              <div key={tk.key} className={`tab${tab === tk.key ? " active" : ""}`} onClick={() => setTab(tk.key)}>
                {tk.label}
                {detachable && <span className="tab-pop" title={t("salesDoc.popOut", { defaultValue: "ดึงออกมาดูเทียบ" })} onClick={(e) => { e.stopPropagation(); popOut(tk.key); }}>⧉</span>}
              </div>
            ))}
          </div>

          {detachable && floating.map((g, i) => {
            const title = tabsDef.find((x) => x.key === g)?.label || g;
            const rows = g === "fo"
              ? FO_DETAIL.map((r) => ({ k: t(r.label), v: foDoc?.values?.[r.key] || (r.alt ? foDoc?.values?.[r.alt] : "") || "" }))
              : grpFields(g).map((f) => ({ k: flabel(f.key), v: val(f.key) }));
            if (!rows.length) return null;
            return (
              <FloatingPanel key={g} title={g === "fo" && foCode ? `${title} · ${foCode}` : title} onClose={() => closeFloat(g)} initial={{ x: 40 + i * 28, y: i * 28 }}>
                {rows.map((r, j) => (
                  <div className="fp-row" key={j}>
                    <span className="fp-k">{r.k}</span>
                    <span className={`fp-v${r.v ? "" : " muted"}`}>{r.v || "—"}</span>
                  </div>
                ))}
              </FloatingPanel>
            );
          })}

          <div className="content">
            <div className="center">

              {/* แท็บฟิลด์ (ข้อมูลจาก Sale / การเสนอราคา) */}
              {(tab === "saleData" || tab === "quote") && (
                <div className="sect">
                  <div className="sh">{tabsDef.find((x) => x.key === tab)?.label}</div>
                  {tab === "saleData" && <div className="field"><label>{t("salesDoc.docCode")}</label><div className="ctrl"><input value={docNo} readOnly /></div></div>}
                  {grpFields(tab).map((f) => (
                    <div className={`field${f.type === "textarea" ? " top" : ""}`} key={f.key}>
                      <label>{flabel(f.key)}{f.core ? " *" : ""}</label>
                      <div className="ctrl" style={f.key === "customerCode" ? { position: "relative" } : undefined}>{ctrl(f)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* รายการย่อย + ยอดรวม (เฉพาะแท็บการเสนอราคา) — 2 โหมด: สรุป / ตาราง */}
              {tab === "quote" && (
                <div className="sect">
                  <div className="sh" style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ flex: 1 }}>{t("salesDoc.itemsTitle")}{!canEditItems && <span style={{ fontWeight: 400, fontSize: 11.5, color: "var(--txt3)", marginLeft: 8 }}>· {t("salesDoc.itemsLockedHint")}</span>}</span>
                    <div className="qt-mode">
                      <button type="button" className={itemMode === "summary" ? "on" : ""} onClick={() => setItemMode("summary")}>{t("salesDoc.viewSummary")}</button>
                      <button type="button" className={itemMode === "table" ? "on" : ""} onClick={() => setItemMode("table")}>{t("salesDoc.tableMode")}</button>
                    </div>
                  </div>

                  {itemMode === "table" ? (
                    <>
                      <table className="items">
                        <thead>
                          <tr>
                            <th className="c" style={{ width: 34 }}>#</th>
                            <th>{t("salesDoc.itemName")}</th>
                            <th style={{ width: 150 }}>{t("salesDoc.serviceType")}</th>
                            <th className="r" style={{ width: 96 }}>{t("salesDoc.price")}</th>
                            <th className="r" style={{ width: 80 }}>{t("salesDoc.discount")}</th>
                            <th className="r" style={{ width: 64 }}>{t("salesDoc.qty")}</th>
                            <th className="c" style={{ width: 70 }}>{t("salesDoc.unit")}</th>
                            <th className="r" style={{ width: 104 }}>{t("salesDoc.lineTotal")}</th>
                            <th style={{ width: 34 }} />
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it, i) => (
                            <tr key={i}>
                              <td className="c">{i + 1}</td>
                              {canEditItems ? (<>
                                <td><ProductItemInput value={it.name} allowTypes={quoteItemTypes} onChange={(name) => updItem(i, { name, code: undefined })} onPick={(p) => updItem(i, { name: p.name, code: p.code, price: p.price || it.price })} /></td>
                                <td><select value={it.serviceType} onChange={(e) => updItem(i, { serviceType: e.target.value })}><option value="">—</option>{getFieldOptions(DOC, "itemServiceType").map((o) => <option key={o} value={o}>{o}</option>)}</select></td>
                                <td><input className="r" value={it.price} onChange={(e) => updItem(i, { price: e.target.value })} /></td>
                                <td><input className="r" value={it.discount} onChange={(e) => updItem(i, { discount: e.target.value })} /></td>
                                <td><input className="r" value={it.qty} onChange={(e) => updItem(i, { qty: e.target.value })} /></td>
                                <td><select value={it.unit} onChange={(e) => updItem(i, { unit: e.target.value })}><option value="">—</option>{getFieldOptions(DOC, "itemUnit").map((o) => <option key={o} value={o}>{o}</option>)}</select></td>
                                <td className="r num">{baht(rowTotal(it))}</td>
                                <td className="c"><button type="button" className="lnk del" title={t("salesDoc.delItem")} onClick={() => delItem(i)} style={{ border: "none", background: "none", color: "var(--red)", cursor: "pointer" }}><Trash size={14} /></button></td>
                              </>) : (<>
                                <td>{it.name || "—"}</td>
                                <td>{it.serviceType || "—"}</td>
                                <td className="r num">{it.price || "—"}</td>
                                <td className="r num">{it.discount || "—"}</td>
                                <td className="r num">{it.qty || "—"}</td>
                                <td className="c">{it.unit || "—"}</td>
                                <td className="r num">{baht(rowTotal(it))}</td>
                                <td />
                              </>)}
                            </tr>
                          ))}
                          {canEditItems && <tr><td colSpan={9} style={{ padding: 0 }}><div className="addrow" onClick={addItem}><Plus size={16} />{t("salesDoc.addItem")}</div></td></tr>}
                        </tbody>
                      </table>
                      {items.length === 0 && <div style={{ fontSize: 12.5, color: "var(--txt3)", padding: "8px 2px" }}>{t("salesDoc.noItems")}</div>}
                    </>
                  ) : (
                    <div style={{ fontSize: 12.5, color: "var(--txt3)", padding: "2px 0 8px" }}>{t("salesDoc.itemsCountHint", { count: items.length })}</div>
                  )}

                  {/* ยอดรวม (สรุป) — เดิมเป็น input ซ่อน ตอนนี้ดูจากสรุปได้เลย */}
                  <div className="totals">
                    <div className="trow"><span>{t("salesDoc.totalBefore")}</span><span className="num">{baht(sumBefore)}</span></div>
                    <div className="trow"><span>{t("salesDoc.totalDiscount")}</span><span className="num">{baht(sumDiscount)}</span></div>
                    <div className="trow"><span>{t("salesDoc.afterDiscount")}</span><span className="num">{baht(afterDiscount)}</span></div>
                    <div className="trow"><span>{t("salesDoc.vat7")}</span><span className="num">{baht(vatAmt)}</span></div>
                    <div className="trow grand"><span>{t("salesDoc.grandNet")}</span><span className="num">{baht(netAmt)}</span></div>
                  </div>
                </div>
              )}

              {/* แท็บ "รายละเอียด" = ข้อมูลจาก FO ที่แนบ */}
              {tab === "fo" && (
                <div className="sect">
                  <div className="sh">{t("salesDoc.foDetailTitle")} {foCode ? `· ${foCode}` : ""}</div>
                  {!foDoc ? (
                    <div style={{ fontSize: 12.5, color: "var(--txt3)" }}>{t("salesDoc.foNotFound")} ({foCode || "—"})</div>
                  ) : (
                    <div className="kv">
                      {FO_DETAIL.map((r) => {
                        const v = foDoc.values?.[r.key] || (r.alt ? foDoc.values?.[r.alt] : "") || "";
                        return <div className="r" key={r.key}><span className="k">{t(r.label)}</span><span className={`v${v ? "" : " muted"}`}>{v || "—"}</span></div>;
                      })}
                    </div>
                  )}
                  <div style={{ marginTop: 10 }}><button type="button" className="btn" onClick={() => window.open(`/sales/fo/d/${encodeURIComponent(foCode)}`, "_blank", "noopener")} style={{ fontSize: 12.5 }}>{t("salesDoc.openFoDoc")} ↗</button></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* เมนูขวา เต็มความสูง (เหมือน CL/FO) */}
        <div className="rightwrap">
          <div className={`hpanel${panelOpen ? "" : " closed"}${pane === "customer" && panelOpen ? " wide" : ""}`}>
            <div className="hh"><span>{t(paneTitles[pane])}</span><div className="x" title={t("salesDoc.closePanel")} onClick={() => setPanelOpen(false)}><X size={16} /></div></div>
            <div className="hbody">{renderPane(pane)}</div>
          </div>
          <div className="rail">
            {railItems.map((r) => (
              <div key={r.key} className={`ritem${pane === r.key && panelOpen ? " active" : ""}`} onClick={() => pickPane(r.key)}>
                <r.Icon size={20} /><span>{t(r.label)}</span>
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
                </div>
              )}
              <div className="wf-flow-pickhint">{t("salesDoc.qtSendNormalHint", { defaultValue: "ส่งปกติ (ตามเส้นงาน) — ขอแก้ไข/ขอเพิ่มใบ ใช้ปุ่มแยกในแถบเครื่องมือ" })}</div>
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
            <div className="wf-flow-h"><span>{t("salesDoc.closeDeal")}</span><button className="x" onClick={() => setCloseOpen(false)}><X size={16} /></button></div>
            <div className="wf-flow-b">
              <div className="close-seg so3">
                <button type="button" className={closeResult === "won" ? "on won" : ""} onClick={() => { setCloseResult("won"); setCloseErr(""); }}>✓ {t("salesDoc.closeWon")}</button>
                <button type="button" className={closeResult === "lost" ? "on lost" : ""} onClick={() => { setCloseResult("lost"); setCloseErr(""); }}>✕ {t("salesDoc.closeLost")}</button>
                <button type="button" className={closeResult === "cancel" ? "on" : ""} onClick={() => { setCloseResult("cancel"); setCloseErr(""); }}>⊘ {t("salesDoc.closeCancel")}</button>
              </div>

              <div className="field-sm"><label>{t("salesDoc.closeDate")}</label><input type="date" value={closeForm.closeDate || ""} onChange={(e) => setCf("closeDate", e.target.value)} /></div>

              {closeResult === "won" && (
                <>
                  <div className="field-sm"><label>{t("salesDoc.closeStrategy")}</label>
                    <select value={closeForm.closeStrategy || ""} onChange={(e) => setCf("closeStrategy", e.target.value)}>
                      <option value="">—</option>{getCloseStrategies().map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="field-sm"><label>{t("salesDoc.closedService")}</label>
                    <select value={closeForm.closedService || ""} onChange={(e) => setCf("closedService", e.target.value)}>
                      <option value="">{t("custForm.pickOne", { defaultValue: "— เลือกบริการ —" })}</option>
                      {serviceOpts.map((o) => <option key={o} value={o}>{o}</option>)}
                      {closeForm.closedService && !serviceOpts.includes(closeForm.closedService) && <option value={closeForm.closedService}>{closeForm.closedService}</option>}
                    </select>
                  </div>
                  <div className="field-sm"><label>{t("salesDoc.saleAmount")}</label><input value={closeForm.saleAmount || ""} onChange={(e) => setCf("saleAmount", e.target.value)} /></div>
                  <div className="field-sm"><label>{t("salesFields.quoteItemsNote", { defaultValue: "บันทึกรายการ (จากใบเสนอราคา)" })}</label>
                    <textarea rows={5} value={closeForm.quoteItemsNote || ""} onChange={(e) => setCf("quoteItemsNote", e.target.value)} placeholder={t("salesDoc.quoteItemsHint", { defaultValue: "รายการย่อยจากใบเสนอราคา — ส่งไปยังใบสั่งขาย (SO)" })} style={{ width: "100%", resize: "vertical" }} />
                  </div>
                  <div className="field-sm"><label>{t("salesDoc.handoffTo", { doc: "SO" })}</label>
                    <select value={closeForm.handoffTo || ""} onChange={(e) => setCf("handoffTo", e.target.value)}>
                      {nextCreators.map((u) => <option key={u} value={u}>{u}</option>)}
                      <option value="">{t("salesDoc.handoffWhole")}</option>
                    </select>
                  </div>
                  {getRequiredCloseFiles().length > 0 && <div className="close-note">{t("salesDoc.closeReqFilesNote", { files: getRequiredCloseFiles().join(", ") })}</div>}
                </>
              )}
              {closeResult === "lost" && (
                <div className="field-sm"><label>{t("salesDoc.lostReason")}</label>
                  <select value={closeForm.lostReason || ""} onChange={(e) => setCf("lostReason", e.target.value)}>
                    <option value="">—</option>{getLostReasons().map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              )}
              {closeResult === "cancel" && <div className="close-note">{t("salesDoc.closeCancelHint")}</div>}

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

      {editOpen && (
        <div className="wf-flow-ov" onClick={() => setEditOpen(false)}>
          <div className="wf-flow-card" onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
            <div className="wf-flow-h"><span>{t("salesDoc.editReqTitle")}</span><button className="x" onClick={() => setEditOpen(false)}><X size={16} /></button></div>
            <div className="wf-flow-b">
              <div className="close-seg">
                <button type="button" className={editType === "more" ? "on won" : ""} onClick={() => setEditType("more")}>{t("salesDoc.editReqMore")}</button>
                <button type="button" className={editType === "revision" ? "on won" : ""} onClick={() => setEditType("revision")}>{t("salesDoc.editReqRevision")}</button>
              </div>
              <div className="close-note">{editType === "more" ? t("salesDoc.editReqMoreHint") : t("salesDoc.editReqRevisionHint")}</div>
              <div className="field-sm" style={{ marginTop: 10 }}><label>{t("salesDoc.editReqReason")}</label><textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} style={{ minHeight: 60 }} /></div>
            </div>
            <div className="wf-flow-f">
              <button className="btn" onClick={() => setEditOpen(false)}>{t("salesDoc.cancel")}</button>
              <button className="btn primary" onClick={doEditRequest}><Refresh size={15} />{t("salesDoc.confirmEditReq")}</button>
            </div>
          </div>
        </div>
      )}

      {verSnap && (() => {
        const s = verSnap.snap || {};
        const its = parseItems(s.items);
        return (
          <div className="wf-flow-ov" onClick={() => setVerSnap(null)}>
            <div className="wf-flow-card" onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
              <div className="wf-flow-h"><span>{t("salesDoc.versionTitle", { n: verSnap.no })}</span><button className="x" onClick={() => setVerSnap(null)}><X size={16} /></button></div>
              <div className="wf-flow-b">
                <div className="close-note">{t("custForm.by", { defaultValue: "โดย" })} {verSnap.by || "—"} · {new Date(verSnap.at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</div>
                <div className="kv" style={{ marginTop: 10 }}>
                  <div className="r"><span className="k">{t("salesFields.servicesOffered", { defaultValue: "บริการที่นำเสนอ" })}</span><span className="v">{s.servicesOffered || "—"}</span></div>
                  <div className="r"><span className="k">{t("salesDoc.itemsTitle")}</span><span className="v">{its.length}</span></div>
                  <div className="r"><span className="k">{t("salesFields.netAmount", { defaultValue: "ราคาเสนอรวม" })}</span><span className="v">{s.netAmount ? `฿${s.netAmount}` : "—"}</span></div>
                  <div className="r"><span className="k">{t("salesFields.paymentTerms", { defaultValue: "เงื่อนไขชำระเงิน" })}</span><span className="v">{s.paymentTerms || "—"}</span></div>
                  <div className="r"><span className="k">{t("salesFields.promotionInfo", { defaultValue: "หมายเหตุ" })}</span><span className="v">{s.promotionInfo || "—"}</span></div>
                </div>
              </div>
              <div className="wf-flow-f"><button className="btn primary" onClick={() => setVerSnap(null)}>{t("salesDoc.cancel")}</button></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
