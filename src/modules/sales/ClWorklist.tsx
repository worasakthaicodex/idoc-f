import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, Check, Trash, Edit, FileText } from "../../shared/icons";
import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";
import ToolsPanel from "../activity/ToolsPanel";
import SalesHistoryPanel from "../activity/SalesHistoryPanel";
import AddToBasketButton from "../customer/AddToBasketButton";
import { loadRequests } from "../customer/customerRequests";
import { loadClDocs, syncSalesDocs } from "./clRequests";
import { getEnabledFields } from "../customer/customerFieldConfig";
import { CUST_FIELDS, GROUPS } from "../customer/customerFields";
import { saveCalendar, deleteCalendar, fetchCalendarByRef, type CalEvent } from "../inbox/calendarStore";
import { fetchClWorklist, fetchClFoCustomers, currentUser, type WorkLead } from "./clLeads";

type CustomerRec = { id: string; code: string; name: string; status?: string; groupName?: string; attributes?: Record<string, string> };
const CUST_COLS = ["name", "groupName"];

/** เนื้อหาแท็บ "รายชื่อ" ของชุด CL — จัดกลุ่มจากข้อมูลจริงที่อ้างอิง CL นี้:
 *   รอโทร · นัดแล้ว (นัดในปฏิทินยังไม่เสร็จ) · โทรแล้ว (มี Call result) · ส่งต่อ FO (มี FO อ้างอิง CL)
 *  แผงขวา = ข้อมูลติดต่อ + เครื่องมือ (ToolsPanel เดียวกับหน้าลูกค้า) + นัดหมาย */

type Bucket = "todo" | "appt" | "called" | "topush";
const BUCKET: Record<Bucket, { label: string; cls: string }> = {
  todo: { label: "salesDoc.bktTodo", cls: "chip blue" },
  appt: { label: "salesDoc.bktAppt", cls: "chip amber" },
  called: { label: "salesDoc.bktCalled", cls: "chip green" },
  topush: { label: "salesDoc.bktPush", cls: "chip" },
};

const enc = encodeURIComponent;
const today = () => new Date().toISOString().slice(0, 10);

export default function ClWorklist({ code, readOnly }: { code: string; owner?: string; readOnly?: boolean }) {
  const { t } = useTranslation();
  const [leads, setLeads] = useState<WorkLead[]>([]);
  const [cust, setCust] = useState<CustomerRec | null>(null); // ข้อมูลลูกค้าเต็ม (แท็บ ข้อมูลทั่วไป)
  const [tab, setTab] = useState<Bucket>("todo");
  const [selCode, setSelCode] = useState<string>("");
  const [pane, setPane] = useState<"contact" | "other" | "saleshistory" | "tools" | "appt">("contact");
  const [apptAct, setApptAct] = useState("");
  const [apptDate, setApptDate] = useState("");
  const [remindDate, setRemindDate] = useState("");
  const [allAppts, setAllAppts] = useState<CalEvent[]>([]); // นัดทั้งหมด (กรองเป็นรายลูกค้าตอนแสดง)
  // แหล่งจัดกลุ่ม (อ้างอิง CL นี้)
  const [calledSet, setCalledSet] = useState<Set<string>>(new Set());            // ลูกค้าที่มี Call result
  const [appts, setAppts] = useState<Map<string, { due: string; done: boolean }>>(new Map()); // นัดในปฏิทิน
  const [foSet, setFoSet] = useState<Set<string>>(new Set());                    // ลูกค้าที่เปิด FO อ้างอิง CL นี้
  const tenant = getSession()?.companyId ?? "";

  // โหลดข้อมูลทั้งหมดที่อ้างอิง CL นี้
  const reloadGroups = () => {
    if (tenant) {
      // "โทรแล้ว" = มีผลโทร (CALL_RESULT) หรือการสื่อสาร (COMMUNICATION) ที่บันทึกในชุด CL นี้
      Promise.all([
        apiFetch<{ customerCode?: string }[]>(`/activities?kind=CALL_RESULT&subjectType=CL&subjectCode=${enc(code)}`, { tenant }),
        apiFetch<{ customerCode?: string }[]>(`/activities?kind=COMMUNICATION&subjectType=CL&subjectCode=${enc(code)}`, { tenant }),
      ])
        .then(([calls, comms]) => setCalledSet(new Set([...(calls || []), ...(comms || [])].map((a) => a.customerCode || "").filter(Boolean))))
        .catch(() => {});
    }
    fetchCalendarByRef("CL", code).then((evs) => {
      const mine = evs.filter((e) => e.customerRef);   // server กรอง refType/refCode ให้แล้ว
      setAllAppts(mine);
      const m = new Map<string, { due: string; done: boolean }>();
      mine.forEach((e) => m.set(e.customerRef!, { due: e.activityDate, done: e.status === "DONE" || e.confirmed }));
      setAppts(m);
    }).catch(() => {});
    fetchClFoCustomers(code).then((refs) => setFoSet(new Set(refs || []))).catch(() => {});
  };
  useEffect(() => { fetchClWorklist(code).then(setLeads).catch(() => {}); reloadGroups(); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps
  // รีเฟรชกลุ่มอัตโนมัติเมื่อบันทึกเครื่องมือ (Call result ฯลฯ) จากแผงขวา
  useEffect(() => {
    const h = () => reloadGroups();
    window.addEventListener("idoc:activity-changed", h);
    return () => window.removeEventListener("idoc:activity-changed", h);
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // จัดกลุ่มราย lead: FO > นัด(ยังไม่เสร็จ&ยังไม่เลยกำหนด) > โทรแล้ว > รอโทร · นัดเลยกำหนดยังไม่เสร็จ = เด้งกลับรอโทร
  const bucketOf = (l: WorkLead): Bucket => {
    if (foSet.has(l.code)) return "topush";
    const a = appts.get(l.code);
    if (a && !a.done) return a.due >= today() ? "appt" : "todo";
    if (calledSet.has(l.code)) return "called";
    return "todo";
  };

  const counts = useMemo(() => {
    const m: Record<Bucket, number> = { todo: 0, appt: 0, called: 0, topush: 0 };
    leads.forEach((l) => { m[bucketOf(l)] += 1; });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, calledSet, appts, foSet]);

  const shown = useMemo(() => leads.filter((l) => bucketOf(l) === tab), [leads, tab, calledSet, appts, foSet]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = leads.find((l) => l.code === selCode) ?? shown[0];

  // กันกดขอซ้ำ: มีคำขอ (EDIT/STATUS) ค้างของลูกค้ารายนี้จาก CL นี้ไหม · มี FO เปิดค้างไหม
  const [reqTick, setReqTick] = useState(0);
  useEffect(() => { syncSalesDocs("FO").then(() => setReqTick((n) => n + 1)).catch(() => {}); const h = () => setReqTick((n) => n + 1); window.addEventListener("focus", h); return () => window.removeEventListener("focus", h); }, [code]);
  // 1 รายชื่อต่อ CL นี้: ขอแก้/แก้สถานะได้ครั้งเดียว · เปิด FO ได้ใบเดียว (นับทุกสถานะ ไม่ใช่แค่ที่ค้าง)
  const matchCust = (cv: string) => !!sel && (cv === sel.code || cv.startsWith(sel.code + " "));   // customer เก็บเป็น "รหัส · ชื่อ"
  const pendingReq = useMemo(() => !!sel && loadRequests().some((r) => matchCust(r.customer) && r.origin?.code === code && (r.topic === "EDIT" || r.topic === "STATUS")), [sel, code, reqTick]);
  // FO ที่เปิดจากรายนี้ใน CL นี้ (ถ้ามี) — ใช้ทั้งกันเปิดซ้ำ + กดดูได้
  const openFoDoc = useMemo(() => (!sel ? null : (loadClDocs("FO").find((d) => d.values?.customerRef === sel.code && d.values?.srcCl === code) ?? null)), [sel, code, reqTick]);
  // เลือกตัวแรกของแท็บเมื่อ "สลับแท็บ" หรือ "ยังไม่ได้เลือก/รายที่เลือกหายจาก list จริง"
  // ไม่เด้งตอน calledSet/appts/foSet เปลี่ยน (บันทึกโทร/นัดแล้วรายย้ายแท็บ ไม่ทำให้ selection เด้งไปรายแรกอีก = บัค)
  useEffect(() => { setSelCode(shown[0]?.code ?? ""); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!selCode || !leads.some((l) => l.code === selCode)) setSelCode((cur) => (cur && leads.some((l) => l.code === cur) ? cur : shown[0]?.code ?? "")); }, [leads]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAppt = async () => {
    if (!sel || !apptAct.trim()) return;
    try {
      await saveCalendar({ activityDate: apptDate || today(), remindDate: remindDate || null, title: apptAct.trim(), customerRef: sel.code, refType: "CL", refCode: code, module: "sales", createdBy: currentUser(), priority: "NORMAL", status: "PENDING", confirmed: false });
      setApptAct(""); setApptDate(""); setRemindDate(""); reloadGroups();
    } catch { alert(t("salesDoc.saveApptFail")); }
  };
  const markApptDone = async (ev: CalEvent) => { try { await saveCalendar({ ...ev, status: "DONE", confirmed: true }); reloadGroups(); } catch { /* ignore */ } };
  const delAppt = async (ev: CalEvent) => { if (!ev.id || !window.confirm(t("salesDoc.delApptConfirm"))) return; try { await deleteCalendar(ev.id); reloadGroups(); } catch { /* ignore */ } };

  // โหลดข้อมูลลูกค้าเต็ม (สำหรับแท็บ "ข้อมูลทั่วไป") — ค้นด้วยรหัสลูกค้าแล้วจับคู่รหัสตรง
  useEffect(() => {
    setCust(null);
    if (!sel?.code || !tenant) return;
    apiFetch<{ content: CustomerRec[] }>(`/customers?q=${enc(sel.code)}&size=10`, { tenant })
      .then((p) => setCust((p.content || []).find((c) => c.code === sel!.code) || null))
      .catch(() => setCust(null));
  }, [sel?.code, tenant]); // eslint-disable-line react-hooks/exhaustive-deps

  // กลุ่มฟิลด์ "ข้อมูลทั่วไป" = ฟิลด์ลูกค้าที่เปิดใช้ ยกเว้นกลุ่มติดต่อ (แยกไปแท็บข้อมูลติดต่อแล้ว) และ name
  const enabledSet = useMemo(() => new Set(getEnabledFields()), []);
  const genGroups = useMemo(() => GROUPS
    .filter((g) => g !== "contact")
    .map((g) => ({ g, fields: CUST_FIELDS.filter((f) => f.group === g && enabledSet.has(f.key) && f.key !== "name") }))
    .filter((x) => x.fields.length > 0), [enabledSet]);
  const cval = (key: string): string => {
    const raw = CUST_COLS.includes(key) ? (cust as Record<string, unknown> | null)?.[key] : cust?.attributes?.[key];
    return raw == null || raw === "" ? "" : String(raw);
  };
  const reqEdit = () => {
    if (!sel) return;
    const path = `/customer/requests/new?topic=EDIT&customer=${enc(sel.code)}&srcType=CL&srcCode=${enc(code)}`;
    window.open(path, "_blank", "noopener");
  };
  const reqStatus = () => {
    if (!sel) return;
    const path = `/customer/requests/new?topic=STATUS&customer=${enc(sel.code)}&srcType=CL&srcCode=${enc(code)}`;
    window.open(path, "_blank", "noopener");
  };
  const openFo = () => {
    if (!sel) return;
    const qs = new URLSearchParams({ srcCl: code, customerRef: sel.code, customerName: sel.name });
    window.open(`/sales/fo/new?${qs.toString()}`, "_blank", "noopener");
  };

  const tabs: { key: Bucket; label: string }[] = [
    { key: "todo", label: t("salesDoc.bktTodo") }, { key: "appt", label: t("salesDoc.bktAppt") }, { key: "called", label: t("salesDoc.bktCalled") }, { key: "topush", label: t("salesDoc.bktPush") },
  ];

  return (
    <div className="cl-worklist-wrap">
      <div className="tabs sub">
        {tabs.map((t) => (
          <div key={t.key} className={`tab${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label} <span className="badge">{counts[t.key]}</span>
          </div>
        ))}
      </div>

      <div className="worklist">
        {/* center: รายชื่อในแท็บ */}
        <div className="center">
          <div className="chead"><span>{t("salesDoc.leadList")} · <b>{shown.length}</b> {t("salesDoc.leadCount")}</span></div>
          <div className="leadwrap">
            {shown.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}>{t("salesDoc.noInBucket")}</div>
            ) : shown.map((l) => {
              const st = BUCKET[bucketOf(l)];
              const company = l.name;                       // ชื่อบริษัท = หลัก (ขึ้นบน)
              const person = l.contactPerson || "";          // ผู้ติดต่อ = รอง (ล่าง)
              return (
                <div key={l.code} className={`lead${sel?.code === l.code ? " sel" : ""}`} onClick={() => setSelCode(l.code)}>
                  <div className="ava">{(company || person).replace(/^(บริษัท|คุณ)\s*/, "").trim().charAt(0) || "•"}</div>
                  <div className="who">
                    <div className="nm">{company || person || "—"}</div>
                    <div className="co">{person || "—"}</div>
                  </div>
                  <div className="ph2">{l.phone || "—"}</div>
                  <span className="st"><span className={st.cls}>{t(st.label)}</span></span>
                </div>
              );
            })}
          </div>
        </div>

        {/* right: ข้อมูลติดต่อ + เครื่องมือ + นัดหมาย */}
        <div className="right">
          {readOnly ? (
            <div className="empty" style={{ padding: 28, textAlign: "center" }}>{t("salesDoc.notHeldErr", { defaultValue: "เอกสารนี้ไม่ได้อยู่กับคุณ — ดู/แก้ไขข้อมูลรายชื่อไม่ได้" })}</div>
          ) : sel ? (
            <>
              <div className="ld-head compact">
                <div className="who">
                  <div className="nm">{sel.name || "—"}</div>
                  {sel.contactPerson && <div className="co">{sel.contactPerson}</div>}
                </div>
                <span className={BUCKET[bucketOf(sel)].cls}>{t(BUCKET[bucketOf(sel)].label)}</span>
                <span style={{ marginLeft: "auto" }}><AddToBasketButton code={sel.code} name={sel.name} /></span>
              </div>

              <div className="rt-tabs">
                <button className={pane === "contact" ? "on" : ""} onClick={() => setPane("contact")}>{t("salesDoc.contact")}</button>
                <button className={pane === "other" ? "on" : ""} onClick={() => setPane("other")}>{t("salesDoc.general")}</button>
                <button className={pane === "saleshistory" ? "on" : ""} onClick={() => setPane("saleshistory")}>{t("salesDoc.salesHistory")}</button>
                <button className={pane === "tools" ? "on" : ""} onClick={() => setPane("tools")}>{t("salesDoc.tools")}</button>
                <button className={pane === "appt" ? "on" : ""} onClick={() => setPane("appt")}>{t("salesDoc.appt")}</button>
              </div>

              {pane === "contact" ? (
                <div className="rt-body">
                  <div className="ct-h">{t("salesDoc.companyInfo")}</div>
                  <div className="kv">
                    <div className="r"><span className="k">{t("salesDoc.companyName")}</span><span className="v">{sel.name}</span></div>
                    <div className="r"><span className="k">{t("salesDoc.custCode")}</span><span className="v">{sel.code}</span></div>
                    <div className="r"><span className="k">{t("salesDoc.companyPhone")}</span><span className="v">{sel.phone || "—"}</span></div>
                    <div className="r"><span className="k">{t("salesDoc.companyEmail")}</span><span className="v">{sel.email || "—"}</span></div>
                  </div>
                  <div className="ct-h">{t("salesDoc.contact1")}</div>
                  <div className="kv">
                    <div className="r"><span className="k">{t("salesDoc.name")}</span><span className="v">{sel.contactPerson || "—"}</span></div>
                    <div className="r"><span className="k">{t("salesDoc.position")}</span><span className="v">{sel.position || "—"}</span></div>
                    <div className="r"><span className="k">{t("salesDoc.phone")}</span><span className="v">{sel.phone || "—"}</span></div>
                    <div className="r"><span className="k">{t("salesDoc.email")}</span><span className="v">{sel.email || "—"}</span></div>
                  </div>
                  <div className="ct-h">{t("salesDoc.contact2")}</div>
                  <div className="kv">
                    <div className="r"><span className="k">{t("salesDoc.name")}</span><span className="v muted">—</span></div>
                    <div className="r"><span className="k">{t("salesDoc.position")}</span><span className="v muted">—</span></div>
                    <div className="r"><span className="k">{t("salesDoc.phone")}</span><span className="v muted">—</span></div>
                    <div className="r"><span className="k">{t("salesDoc.email")}</span><span className="v muted">—</span></div>
                  </div>
                </div>
              ) : pane === "other" ? (
                <div className="rt-body">
                  {!cust ? (
                    <div className="ph-note">{t("salesDoc.loadingCust")}</div>
                  ) : (
                    <>
                      {genGroups.map(({ g, fields }) => (
                        <div key={g}>
                          <div className="ct-h">{t(`custFields.group.${g}`, { defaultValue: g })}</div>
                          <div className="kv">
                            {fields.map((f) => {
                              const v = cval(f.key);
                              return (
                                <div className="r" key={f.key}>
                                  <span className="k">{t(`custFields.${f.key}`, { defaultValue: f.key })}</span>
                                  <span className={`v${v ? "" : " muted"}`}>{v || "—"}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ) : pane === "saleshistory" ? (
                <div className="rt-body tools"><SalesHistoryPanel customerCode={sel.code} /></div>
              ) : pane === "tools" ? (
                <div className="rt-body tools">
                  <ToolsPanel context="customer" customerCode={sel.code} refType="CL" refCode={code} />
                </div>
              ) : (
                <div className="rt-body">
                  <div className="field-sm"><label>{t("salesDoc.apptActivity")}</label><input value={apptAct} onChange={(e) => setApptAct(e.target.value)} placeholder={t("salesDoc.apptPlaceholder")} /></div>
                  <div className="field-sm"><label>{t("salesDoc.apptDate")}</label><input type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)} /></div>
                  <div className="field-sm"><label>{t("salesDoc.remindDate")}</label><input type="date" value={remindDate} onChange={(e) => setRemindDate(e.target.value)} /></div>
                  <button className="btn-dark" onClick={saveAppt}><Calendar size={15} />{t("salesDoc.saveToCal")}</button>
                  <div className="acts-hint">{t("salesDoc.apptHintCl", { code })}</div>

                  {(() => {
                    const mine = allAppts.filter((e) => e.customerRef === sel.code).sort((a, b) => a.activityDate.localeCompare(b.activityDate));
                    return (
                      <>
                        <div className="t" style={{ margin: "16px 0 8px" }}><Calendar size={14} />{t("salesDoc.apptOfCust", { count: mine.length })}</div>
                        {mine.length === 0 ? (
                          <div style={{ fontSize: 12.5, color: "var(--txt3)" }}>{t("salesDoc.noAppt")}</div>
                        ) : (
                          <div className="loglist">
                            {mine.map((ev) => {
                              const done = ev.status === "DONE" || ev.confirmed;
                              return (
                                <div className="logitem" key={ev.id}>
                                  <div className="lt"><span>{ev.title}</span><span>{ev.activityDate}{ev.remindDate ? ` · ${t("salesDoc.remindPrefix")} ${ev.remindDate}` : ""}</span></div>
                                  <div className="lb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span className={`chip ${done ? "green" : "amber"}`}>{done ? t("salesDoc.done") : t("salesDoc.pending")}</span>
                                    <span className="appt-acts">
                                      {!done && <button type="button" className="lnk" title={t("salesDoc.markDone")} onClick={() => markApptDone(ev)}><Check size={15} /></button>}
                                      <button type="button" className="lnk del" title={t("salesDoc.delAppt")} onClick={() => delAppt(ev)}><Trash size={14} /></button>
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ปุ่มลัดท้ายแผง — แสดงทุกแท็บ */}
              <div className="rt-foot">
                <button className="btn sm" disabled={pendingReq} onClick={reqEdit} title={pendingReq ? t("salesDoc.reqOnce", { defaultValue: "ขอแล้วใน CL นี้ (ขอได้ครั้งเดียว)" }) : t("salesDoc.reqEditTitle")}><Edit size={14} />{t("salesDoc.reqEdit")}</button>
                <button className="btn sm" disabled={pendingReq} onClick={reqStatus} title={pendingReq ? t("salesDoc.reqOnce", { defaultValue: "ขอแล้วใน CL นี้ (ขอได้ครั้งเดียว)" }) : t("salesDoc.reqStatusTitle", { defaultValue: "ส่งคำขอปรับสถานะลูกค้า" })}><Edit size={14} />{t("salesDoc.reqStatus", { defaultValue: "ขอแก้สถานะ" })}</button>
                <button className="btn sm primary" onClick={openFoDoc ? () => window.open(`/sales/fo/d/${enc(openFoDoc.code)}`, "_blank", "noopener") : openFo} title={openFoDoc ? t("salesDoc.foView", { defaultValue: "เปิดดู FO ที่สร้างไว้" }) : t("salesDoc.openFoTitle")}><FileText size={14} />{openFoDoc ? t("salesDoc.foOpened", { defaultValue: "ดู FO ที่เปิด" }) : t("salesDoc.openFo")}</button>
              </div>
            </>
          ) : (
            <div className="empty">{t("salesDoc.selectLead")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
