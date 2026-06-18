import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch, type Page } from "../../shared/api";
import { getSession } from "../../shared/session";
import { Help, ArrowLeft, ArrowRight, CheckCircle, Check, X, Shield, Paperclip, FileText, Search, ChevronLeft, Save, Trash } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import { PROD_FIELDS, GROUPS, COLUMN_KEYS, fieldType, prodLabel, groupLabel, type ProdField } from "./productFields";
import { getEnabledFields, getFieldOptions, getEnabledStatuses, statusText } from "./productConfig";
import { saveRequest, deleteRequest, getRequest, appendLog, loadLog, relabelLog, saveReqTab } from "./productRequests";
import { fetchStages, defaultStages, fetchAuthorities, pickAuthorityFrame, memberAt, memberIsEmpty, resolveCandidates, fetchModuleUsers, docTypesOf, loadUsedFrame, storeUsedFrame, getIssueEvent, type Stage, type Authority, type MemberRule, type UsedFrame } from "../workflow/workflowConfig";
import { getDoc } from "../workflow/docRegistry";
import "./registerProductDocs";
import "../sales/qt.css";
import "../customer/request.css";

const MODULE = "product";
const REQ_DOCTYPE = docTypesOf(MODULE)[0]?.code ?? "PRODUCT_REQUEST";

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]; dp[0] = j;
    for (let i = 1; i <= m; i++) { const tmp = dp[i]; dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = tmp; }
  }
  return dp[m];
}
function similarityPct(a: string, b: string): number {
  const x = a.trim().toLowerCase(), y = b.trim().toLowerCase();
  if (!x || !y) return 0;
  return Math.round((1 - levenshtein(x, y) / Math.max(x.length, y.length)) * 100);
}
const genReqCode = () => `PRQ-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
const genDraft = () => `DRAFT-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
const isDraft = (c?: string | null) => !!c && c.startsWith("DRAFT-");

type Topic = "ADD" | "EDIT" | "STATUS";
type Product = { id: string; code: string; name: string; status?: string; groupName?: string; attributes?: Record<string, string> };
const isColumn = (k: string) => COLUMN_KEYS.includes(k);

export default function ProductRequestForm() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const session = getSession();
  const tenant = session?.companyId ?? "";
  const { code: routeCode } = useParams();

  const [topic, setTopic] = useState<Topic>("ADD");
  const [all, setAll] = useState<Product[]>([]);
  const [picked, setPicked] = useState<Product | null>(null);
  const [q, setQ] = useState("");
  const [openPick, setOpenPick] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("ACTIVE");
  const [pane, setPane] = useState<"review" | "files">("review");
  const [panelOpen, setPanelOpen] = useState(true);
  const [files, setFiles] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedCode, setSavedCode] = useState<string | null>(null);
  const [original, setOriginal] = useState<string>("");

  const pickPane = (key: "review" | "files") => { if (pane === key && panelOpen) { setPanelOpen(false); return; } setPane(key); setPanelOpen(true); };

  const enabled = getEnabledFields();
  const enabledSet = new Set(enabled);

  const issueEvent = getIssueEvent(REQ_DOCTYPE);
  const issued = !!savedCode && !isDraft(savedCode);
  const ruleLabel = t(issueEvent === "CREATE" ? "custReq.ruleCreate" : issueEvent === "RECEIVE" ? "custReq.ruleReceive" : "custReq.ruleApprove");

  const [stages, setStages] = useState<Stage[]>(() => defaultStages());
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowMode, setFlowMode] = useState<"approve" | "reject">("approve");
  const [flowReason, setFlowReason] = useState("");
  const [flowBusy, setFlowBusy] = useState(false);
  const [flowErr, setFlowErr] = useState("");
  const [flowTo, setFlowTo] = useState("");        // ผู้รับที่เลือก ("" = ส่งทั้งกลุ่ม/เหมา)
  const [moduleUsers, setModuleUsers] = useState<string[]>([]);
  const [confirmDel, setConfirmDel] = useState(false);
  const [loadedPhase, setLoadedPhase] = useState<string | null>(null);
  const [received, setReceived] = useState<{ by: string; at: number } | null>(null);
  const [bounce, setBounce] = useState<{ by: string; at: number; reason: string } | null>(null);
  const [recvOpen, setRecvOpen] = useState(false);
  const [recvMode, setRecvMode] = useState<"accept" | "decline">("accept");
  const [recvReason, setRecvReason] = useState("");
  const [usedFrame, setUsedFrame] = useState<UsedFrame | null>(() => loadUsedFrame(REQ_DOCTYPE));
  const [stageId, setStageId] = useState<string | undefined>(undefined);
  const [log, setLog] = useState<ReturnType<typeof loadLog>>([]);
  useEffect(() => { fetchStages(REQ_DOCTYPE).then(setStages).catch(() => {}); }, []);
  useEffect(() => { fetchAuthorities(REQ_DOCTYPE).then(setAuthorities).catch(() => {}); }, []);
  useEffect(() => { fetchModuleUsers(MODULE).then(setModuleUsers).catch(() => {}); }, []);
  const headIdx = Math.max(0, stages.findIndex((s) => s.pinned === "head"));
  const curStageIdx = (() => { if (stageId) { const i = stages.findIndex((s) => s.id === stageId); if (i >= 0) return i; } return headIdx; })();

  const describeMember = (m?: MemberRule): string => {
    if (!m) return "—";
    if (m.mode === "ALL") return t("custReq.flow.modeAll");
    if (m.mode === "USERS") return m.users.length ? m.users.join(", ") : "—";
    const parts = [...m.positions, ...m.departments, ...m.divisions];
    return parts.length ? parts.join(" · ") : "—";
  };

  useEffect(() => { if (tenant) apiFetch<Page<Product>>("/products?size=300", { tenant }).then((p) => setAll(p.content)).catch(() => {}); }, [tenant]);

  useEffect(() => {
    if (!routeCode) return;
    const rec = getRequest(routeCode);
    if (!rec) return;
    setTopic(rec.topic as Topic);
    setValues(rec.values ?? {});
    setOriginal(JSON.stringify(rec.origValues ?? rec.values ?? {}));
    setStatus(rec.status); setSavedCode(rec.code); setSaved(true);
    setLoadedPhase(rec.phase); setReceived(rec.received ?? null); setBounce(rec.bounce ?? null); setStageId(rec.stageId); setLog(loadLog(rec.code));
    let p: Product | null = null;
    if (rec.picked) p = { id: rec.picked.id, code: rec.picked.code, name: rec.picked.name, status: rec.picked.status } as Product;
    else if (rec.topic !== "ADD" && rec.customer) {
      const i = rec.customer.indexOf(" · ");
      p = { id: i >= 0 ? rec.customer.slice(0, i) : rec.customer, code: i >= 0 ? rec.customer.slice(0, i) : rec.customer, name: i >= 0 ? rec.customer.slice(i + 3) : "", status: rec.status } as Product;
    }
    setPicked(p);
  }, [routeCode]);

  const changeTopic = (tp: Topic) => { setTopic(tp); setPicked(null); setValues({}); setStatus("ACTIVE"); setSubmitted(false); setSaved(false); setSavedCode(null); setOriginal(""); };

  const choose = (c: Product) => {
    setPicked(c); setQ(""); setOpenPick(false); setSubmitted(false); setSaved(false);
    setStatus(c.status || "ACTIVE");
    const attrs = c.attributes ?? {};
    const next: Record<string, string> = {};
    PROD_FIELDS.forEach((f) => { next[f.key] = isColumn(f.key) ? String((c as Record<string, unknown>)[f.key] ?? "") : String(attrs[f.key] ?? ""); });
    setValues(next); setOriginal(JSON.stringify(next));
  };

  const set = (k: string, v: string) => { setValues((s) => ({ ...s, [k]: v })); setSaved(false); };
  const changeStatus = (v: string) => { setStatus(v); setSaved(false); };
  const val = (k: string) => values[k] ?? "";

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return all.slice(0, 30);
    return all.filter((c) => c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s)).slice(0, 30);
  }, [q, all]);

  const nameVal = val("name").trim();
  const nameFilled = !!nameVal;
  const maxSim = topic === "ADD" && nameFilled ? all.reduce((mx, c) => Math.max(mx, similarityPct(nameVal, c.name)), 0) : 0;
  const simOk = maxSim < 50;
  const changed = !!picked && JSON.stringify(values) !== original;
  const statusChanged = !!picked && status !== (picked.status || "ACTIVE");

  const origObj: Record<string, string> = (() => { try { return original ? JSON.parse(original) : {}; } catch { return {}; } })();
  const diffRows = topic === "EDIT" && picked
    ? Array.from(new Set([...Object.keys(origObj), ...Object.keys(values)])).filter((k) => String(origObj[k] ?? "") !== String(values[k] ?? "")).map((k) => ({ key: k, before: origObj[k] ?? "", after: values[k] ?? "" }))
    : [];

  const fieldKeys = enabled.filter((k) => k !== "name");
  const missingFields = fieldKeys.filter((k) => !val(k).trim());
  const fieldsOk = missingFields.length === 0;
  const missNames = missingFields.slice(0, 4).map((k) => prodLabel(k, lang)).join(", ") + (missingFields.length > 4 ? " …" : "");

  const checks: { ok: boolean; label: string }[] = [
    ...(topic === "ADD"
      ? [
          { ok: nameFilled, label: nameFilled ? t("custReq.ckName") : t("custReq.ckNameMiss") },
          { ok: simOk, label: simOk ? t("custReq.ckSim", { pct: maxSim }) : t("custReq.ckSimMiss", { pct: maxSim }) },
          { ok: fieldsOk, label: fieldsOk ? t("custReq.ckFields", { n: fieldKeys.length }) : t("custReq.ckFieldsMiss", { n: missingFields.length, names: missNames }) },
        ]
      : [
          { ok: !!picked, label: picked ? t("prodReq.ckItem") : t("prodReq.ckItemMiss") },
          ...(topic === "EDIT" ? [{ ok: changed, label: changed ? t("custReq.ckEdited") : t("custReq.ckEditedMiss") }] : []),
          ...(topic === "STATUS" ? [{ ok: statusChanged, label: statusChanged ? t("custReq.ckStatusChg") : t("custReq.ckStatusChgMiss") }] : []),
        ]),
    { ok: saved, label: saved ? t("custReq.ckSaved") : t("custReq.ckSavedMiss") },
  ];
  const allOk = checks.every((c) => c.ok);
  const dataValid = topic === "ADD" ? nameFilled : topic === "EDIT" ? (!!picked && changed) : (!!picked && statusChanged);
  const hasContent = nameFilled || !!picked || Object.values(values).some((v) => !!v && v.trim());
  const dirty = !saved && (topic === "ADD" ? hasContent : dataValid);

  const onSave = () => {
    if (!dataValid) { setPane("review"); setPanelOpen(true); return; }
    const code = savedCode ?? (issueEvent === "CREATE" ? genReqCode() : genDraft());
    saveRequest({
      code, topic, customer: picked ? `${picked.code} · ${picked.name}` : nameVal,
      requester: session?.fullName || session?.email || session?.companyCode || "—",
      status, values, phase: "PROCESS", savedAt: Date.now(),
      picked: picked ? { id: picked.id, code: picked.code, name: picked.name, status: picked.status } : undefined,
      origValues: original ? JSON.parse(original) : undefined,
    });
    setSavedCode(code); setSaved(true); setPane("review"); setPanelOpen(true);
  };

  const onSend = () => { if (!allOk) { setPane("review"); setPanelOpen(true); return; } setFlowMode("approve"); setFlowReason(""); setFlowErr(""); setFlowTo(""); setFlowOpen(true); };

  async function applyRequest(rec: ReturnType<typeof getRequest>): Promise<boolean> {
    if (!rec) return false;
    const desc = getDoc(REQ_DOCTYPE);
    if (!desc?.complete) return false;
    return desc.complete(rec as unknown as Record<string, unknown>, { tenant, changedBy: meName });
  }

  const atCreateStage = curStageIdx === headIdx;
  const onDelete = () => { if (savedCode) deleteRequest(savedCode); nav("/product/requests"); };

  const canReceive = loadedPhase === "RECEIVE" && !received && !bounce;
  const meName = session?.fullName || session?.email || session?.companyCode || "—";
  const openReceive = () => { setRecvMode("accept"); setRecvReason(""); setRecvOpen(true); };
  const confirmReceive = () => {
    if (!savedCode) return;
    const rec = getRequest(savedCode);
    if (!rec) return;
    if (recvMode === "accept") {
      const r = { by: meName, at: Date.now() };
      let code = rec.code;
      if (issueEvent === "RECEIVE" && isDraft(code)) { const real = genReqCode(); relabelLog(code, real); deleteRequest(code); code = real; }
      saveRequest({ ...rec, code, received: r, phase: "PROCESS" });
      appendLog({ code, action: "RECEIVE", by: meName, at: r.at, toStage: stages[curStageIdx]?.name });
      setSavedCode(code); setReceived(r); setLoadedPhase("PROCESS"); setLog(loadLog(code));
      if (code !== rec.code) nav(`/product/requests/${code}`, { replace: true });
    } else {
      if (!recvReason.trim()) return;
      const b = { by: meName, at: Date.now(), reason: recvReason.trim() };
      saveRequest({ ...rec, bounce: b, phase: "PROCESS" });
      appendLog({ code: rec.code, action: "DECLINE", by: meName, at: b.at, reason: b.reason });
      setBounce(b); setLoadedPhase("PROCESS"); setLog(loadLog(rec.code));
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

    if (isApproveStage && flowMode === "reject") {
      if (!flowReason.trim()) { setFlowErr(t("custReq.flow.reasonReq")); return; }
      const b = { by: creatorName, at, reason: flowReason.trim() };
      saveRequest({ ...rec, bounce: b, phase: "PROCESS" });
      appendLog({ code: savedCode, action: "REJECT", by: creatorName, at, fromStage: fromName, reason: b.reason });
      setBounce(b); setLoadedPhase("PROCESS"); setLog(loadLog(savedCode)); setFlowOpen(false); setPane("review"); setPanelOpen(true);
      return;
    }

    if (frame) { const f: UsedFrame = { id: frame.id, name: frame.name || frame.note || "" }; storeUsedFrame(REQ_DOCTYPE, f); setUsedFrame(f); }
    const action = isApproveStage ? "APPROVE" : "SEND";

    const issueIfNeeded = (): string => {
      let c = savedCode!;
      if (issueEvent === "APPROVE" && isApproveStage && isDraft(c)) { const real = genReqCode(); relabelLog(c, real); deleteRequest(c); c = real; }
      return c;
    };
    const afterIssue = (code: string) => { if (code !== savedCode) { setSavedCode(code); nav(`/product/requests/${code}`, { replace: true }); } };

    if (nextStage && nextStage.kind === "DONE") {
      setFlowBusy(true); setFlowErr("");
      const ok = await applyRequest(rec);
      setFlowBusy(false);
      if (!ok) { setFlowErr(t("custReq.flow.applyErr")); return; }
      const code = issueIfNeeded();
      saveRequest({ ...rec, code, stageId: nextStage.id, phase: "DONE", sent: { by: creatorName, to: toWho, at, fromStage: fromName, toStage: toName } });
      appendLog({ code, action, by: creatorName, to: toWho, at, fromStage: fromName, toStage: toName });
      appendLog({ code, action: "COMPLETE", by: creatorName, at: Date.now(), toStage: toName });
      setStageId(nextStage.id); setLoadedPhase("DONE"); setLog(loadLog(code)); setFlowOpen(false); setPane("review"); setPanelOpen(true); setSubmitted(true);
      afterIssue(code);
      return;
    }

    const code = issueIfNeeded();
    const sent = { by: creatorName, to: toWho, at, fromStage: fromName, toStage: toName, recipients };
    saveRequest({ ...rec, code, stageId: nextStage?.id ?? rec.stageId, phase: "RECEIVE", sent });
    appendLog({ code, action, fromStage: fromName, toStage: toName, by: creatorName, to: toWho, at });
    setFlowOpen(false); saveReqTab("EXPORT"); nav("/product/requests");
  };

  function renderField(f: ProdField) {
    if (f.key === "name") return null;
    const type = fieldType(f.key);
    let ctrl;
    if (type === "textarea") ctrl = <textarea value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} />;
    else if (type === "number") ctrl = <input type="number" value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} />;
    else if (type === "select") ctrl = (
      <select value={val(f.key)} onChange={(e) => set(f.key, e.target.value)}>
        <option value="">—</option>
        {getFieldOptions(f.key).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
    else ctrl = <input value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} />;
    return (
      <div className={`field${type === "textarea" ? " top" : ""}`} key={f.key}>
        <label>{prodLabel(f.key, lang)}</label>
        <div className="ctrl">{ctrl}</div>
      </div>
    );
  }

  const groups = GROUPS
    .map((g) => ({ g, fields: PROD_FIELDS.filter((f) => f.group === g && enabledSet.has(f.key) && f.key !== "name") }))
    .filter((x) => x.fields.length > 0);

  const creator = { fullName: session?.fullName, email: session?.email, employeeCode: session?.employeeCode };
  const creatorName = session?.fullName || session?.email || session?.companyCode || "—";
  const curStage: Stage | undefined = stages[curStageIdx];
  const nextStage: Stage | undefined = stages[curStageIdx + 1];
  const frame = curStage ? pickAuthorityFrame(authorities, curStage.id, creator) : null;
  const toMember: MemberRule | undefined = frame && nextStage ? memberAt(frame, nextStage.id) : undefined;
  const candidates = resolveCandidates(toMember, moduleUsers); // ผู้รับที่เป็นไปได้ของขั้นถัดไป (มีหลายคน → เลือกได้)

  const atApproveStage = curStage?.kind === "APPROVE";
  const atDone = curStage?.kind === "DONE" || loadedPhase === "DONE";
  const canSaveDoc = !atApproveStage && !atDone;

  return (
    <div className="p-qt p-req">
      <div className="topbar">
        <div className="qtag" style={{ background: "#0a84ff" }}>PRQ</div>
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="doctitle">{t("prodReq.title")}</div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session?.companyCode.charAt(0) ?? "A"}</div>
      </div>

      <div className="main">
        <div className={`dtree${collapsed ? " collapsed" : ""}`}>
          <div className="th">
            <span>{t("custReq.docs", { defaultValue: "เอกสาร" })}</span>
            <div className="collapse-btn" onClick={() => setCollapsed((c) => !c)}><ChevronLeft size={16} /></div>
          </div>
          <div className="tlist">
            <div className="titem qt sel"><FileText />{issued ? savedCode : t("custReq.codePending")}</div>
            {picked && <div className="titem child"><FileText size={14} />{picked.code} · {picked.name}</div>}
          </div>
          <div className="dnote">{t("custReq.numberingRule")}: <b>{ruleLabel}</b></div>
        </div>

        <div className="workzone">
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav("/product/requests")}><ArrowLeft /><span>{t("custReq.back")}</span></div>
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
                  {t("custReq.submitted")}{usedFrame && <div style={{ marginTop: 4 }}>{t("custReq.flow.used")}: <b>{usedFrame.name || "—"}</b></div>}
                </div>
              )}
              {received && <div className="banner" style={{ background: "var(--green-bg)", color: "#0e6027", padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 13 }}>✓ {t("custReq.recv.receivedBy", { by: received.by })} · {new Date(received.at).toLocaleString()}</div>}
              {bounce && <div className="banner" style={{ background: "var(--red-bg)", color: "var(--red)", padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 13 }}>↩ {t("custReq.recv.bouncedBy", { by: bounce.by })}: <b>{bounce.reason}</b></div>}

              <div className="sect">
                <div className="sh">{t("custReq.secDetail")}</div>
                <div className="cols2">
                  <div className="field">
                    <label>{t("custReq.topic")}</label>
                    <div className="ctrl">
                      <select value={topic} onChange={(e) => changeTopic(e.target.value as Topic)}>
                        <option value="ADD">{t("prodReq.topicAdd")}</option>
                        <option value="EDIT">{t("prodReq.topicEdit")}</option>
                        <option value="STATUS">{t("prodReq.topicStatus")}</option>
                      </select>
                    </div>
                  </div>
                  {topic !== "ADD" && (
                    <div className="field">
                      <label>{t("prodReq.item")}</label>
                      <div className="ctrl" style={{ position: "relative" }}>
                        <input value={picked ? `${picked.code} · ${picked.name}` : q} onChange={(e) => { setQ(e.target.value); setPicked(null); setOpenPick(true); }} onFocus={() => setOpenPick(true)} onBlur={() => setTimeout(() => setOpenPick(false), 150)} placeholder={t("prodReq.searchItem")} />
                        <span className="pick"><Search size={16} /></span>
                        {openPick && !picked && (
                          <div className="ta-menu" style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 30, background: "#fff", border: "1px solid var(--line)", borderRadius: 8, maxHeight: 240, overflow: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.12)" }}>
                            {matches.length === 0 && <div style={{ padding: 10, color: "var(--txt3)", fontSize: 13 }}>—</div>}
                            {matches.map((c) => (
                              <div key={c.id} style={{ padding: "9px 12px", fontSize: 13, cursor: "pointer" }} onMouseDown={(e) => { e.preventDefault(); choose(c); }}><b>{c.code}</b> · {c.name}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {topic === "EDIT" && picked && (
                <div className="sect">
                  <div className="sh">{t("custReq.diff.changes")}</div>
                  {diffRows.length === 0 ? <div style={{ color: "var(--txt3)", fontSize: 13 }}>{t("custReq.diff.noChange")}</div> : (
                    <table className="data-grid">
                      <thead><tr><th>{t("custReq.diff.colField")}</th><th>{t("custReq.diff.colBefore")}</th><th>{t("custReq.diff.colAfter")}</th></tr></thead>
                      <tbody>
                        {diffRows.map((r) => (
                          <tr key={r.key}>
                            <td>{prodLabel(r.key, lang)}</td>
                            <td style={{ color: "var(--txt3)", textDecoration: "line-through" }}>{r.before || t("custReq.diff.empty")}</td>
                            <td style={{ color: "#0e6027", fontWeight: 500 }}>{r.after || t("custReq.diff.empty")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {(topic === "ADD" || (topic === "EDIT" && picked)) && (
                <>
                  <div className="sect">
                    <div className="sh">{topic === "ADD" ? t("prodReq.newItem") : t("prodReq.editItem")}</div>
                    <div className="field full">
                      <label>{prodLabel("name", lang)} *</label>
                      <div className="ctrl"><input value={val("name")} onChange={(e) => set("name", e.target.value)} /></div>
                    </div>
                  </div>
                  {groups.map(({ g, fields }) => (
                    <div className="sect" key={g}>
                      <div className="sh">{groupLabel(g, lang)}</div>
                      <div className="cols2">{fields.map(renderField)}</div>
                    </div>
                  ))}
                </>
              )}

              {topic === "STATUS" && picked && (
                <div className="sect">
                  <div className="sh">{t("prodReq.statusEdit")}</div>
                  <div className="field">
                    <label>{t("custReq.currentStatus")}</label>
                    <div className="ctrl" style={{ display: "flex", alignItems: "center", paddingLeft: 2 }}><span className="chip gray">{statusText(picked.status || "ACTIVE", lang)}</span></div>
                  </div>
                  <div className="field">
                    <label>{t("custReq.newStatus")}</label>
                    <div className="ctrl">
                      <select value={status} onChange={(e) => changeStatus(e.target.value)}>
                        {[...new Set([status, ...getEnabledStatuses()])].map((code) => <option key={code} value={code}>{statusText(code, lang)}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rightwrap">
              <div className={`hpanel${panelOpen ? "" : " closed"}`}>
                <div className="hh">
                  <span>{pane === "review" ? t("custReq.review") : t("custReq.files")}</span>
                  <div className="x" onClick={() => setPanelOpen(false)}><X size={16} /></div>
                </div>
                <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
                  {pane === "review" ? (
                    <>
                      <div className="review">
                        {checks.map((c, i) => <div className="rcheck" key={i}><span className={c.ok ? "ok" : "miss"}>{c.ok ? <Check /> : <X />}</span>{c.label}</div>)}
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
                    <>
                      {files.map((f, i) => <div className="att" key={i}><FileText /><div><div className="an">{f}</div></div></div>)}
                      <label className="upload">{t("custReq.uploadHint")}<input type="file" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]?.name; if (f) setFiles((x) => [...x, f]); }} /></label>
                    </>
                  )}
                </div>
              </div>
              <div className="rail">
                <div className={`ritem${pane === "review" && panelOpen ? " active" : ""}`} onClick={() => pickPane("review")}>
                  <Shield /><span>{t("custReq.review")}</span>{!allOk && <span className="ribadge">{checks.filter((c) => !c.ok).length}</span>}
                </div>
                <div className={`ritem${pane === "files" && panelOpen ? " active" : ""}`} onClick={() => pickPane("files")}>
                  <Paperclip /><span>{t("custReq.files")}</span>{files.length > 0 && <span className="ribadge" style={{ background: "var(--blue)" }}>{files.length}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {flowOpen && (
        <div className="wf-flow-ov" onClick={() => setFlowOpen(false)}>
          <div className="wf-flow-card" onClick={(e) => e.stopPropagation()}>
            <div className="wf-flow-h"><span>{t("custReq.flow.title")}</span><button className="x" onClick={() => setFlowOpen(false)}><X size={16} /></button></div>
            <div className="wf-flow-b">
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
                <div className="wf-flow-node"><span className="lbl">{t("custReq.flow.from")}</span><span className="who">{creatorName}</span><span className="stg">{curStage?.name}</span></div>
                <span className="wf-flow-arrow"><ArrowRight size={20} /></span>
                <div className="wf-flow-node to"><span className="lbl">{t("custReq.flow.to")}</span><span className="who">{nextStage ? (flowTo || (candidates.length > 1 ? t("custReq.flow.chooseBelow") : candidates[0] || describeMember(toMember))) : "—"}</span><span className="stg">{nextStage ? nextStage.name : t("custReq.flow.noNext")}</span></div>
              </div>
              {/* ผู้รับขั้นถัดไปมีหลายคน → เลือกเจาะจง หรือส่งทั้งกลุ่ม (เหมา) ใครรับก่อนได้งาน */}
              {nextStage && nextStage.kind !== "DONE" && candidates.length > 1 && !(curStage?.kind === "APPROVE" && flowMode === "reject") && (
                <div className="wf-flow-pick">
                  <label className="wf-lbl">{t("custReq.flow.chooseRecipient")}</label>
                  <select value={flowTo} onChange={(e) => setFlowTo(e.target.value)}>
                    <option value="">{t("custReq.flow.toGroup", { n: candidates.length })}</option>
                    {candidates.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="wf-flow-pickhint">{flowTo ? t("custReq.flow.toOneHint") : t("custReq.flow.toGroupHint")}</div>
                </div>
              )}
              {frame && <div className="wf-flow-meta">{t("custReq.flow.frame")}: <b>{frame.name || frame.note || "—"}</b></div>}
              {nextStage?.kind === "DONE" && getDoc(REQ_DOCTYPE)?.completeLabel && <div className="wf-flow-meta">{t("custReq.flow.destination")}: <b>{getDoc(REQ_DOCTYPE)?.completeLabel}</b></div>}
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

      {recvOpen && (
        <div className="wf-flow-ov" onClick={() => setRecvOpen(false)}>
          <div className="wf-flow-card" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="wf-flow-h"><span>{t("custReq.recv.title")}</span><button className="x" onClick={() => setRecvOpen(false)}><X size={16} /></button></div>
            <div className="wf-flow-b">
              <div className="wf-seg" style={{ marginBottom: 12 }}>
                <button className={recvMode === "accept" ? "on" : ""} onClick={() => setRecvMode("accept")}>{t("custReq.recv.accept")}</button>
                <button className={recvMode === "decline" ? "on" : ""} onClick={() => setRecvMode("decline")}>{t("custReq.recv.decline")}</button>
              </div>
              {recvMode === "accept" ? <div style={{ fontSize: 13, color: "var(--txt2)", lineHeight: 1.6 }}>{t("custReq.recv.acceptHint")}</div> : (
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

      {confirmDel && (
        <div className="wf-flow-ov" onClick={() => setConfirmDel(false)}>
          <div className="wf-flow-card" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="wf-flow-h"><span>{t("custReq.deleteConfirmTitle")}</span><button className="x" onClick={() => setConfirmDel(false)}><X size={16} /></button></div>
            <div className="wf-flow-b"><div style={{ fontSize: 13.5, color: "var(--txt2)", lineHeight: 1.6 }}>{t("custReq.deleteConfirmBody", { code: savedCode || "—" })}</div></div>
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
