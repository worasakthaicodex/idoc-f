import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, Check, Trash } from "../../shared/icons";
import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";
import ToolsPanel from "../activity/ToolsPanel";
import SalesHistoryPanel from "../activity/SalesHistoryPanel";
import CustomerFoSnapshot from "../customer/CustomerFoSnapshot";
import { getEnabledFields } from "../customer/customerFieldConfig";
import { CUST_FIELDS, GROUPS } from "../customer/customerFields";
import { saveCalendar, deleteCalendar, fetchCalendarByRef, type CalEvent } from "../inbox/calendarStore";

/**
 * แผงทำงานราย "ลูกค้า" ใช้ร่วมทุกเอกสาร (CL/FO/QT/SO) — เนื้อหาเดียวกับแผงขวาในกล่อง CL
 * แท็บ: ข้อมูลติดต่อ · ข้อมูลทั่วไป · Sales history · เครื่องมือ (ToolsPanel: สื่อสาร/ผลโทร/ระบบ/ไฟล์) · นัดหมาย
 *  - customerCode = รหัสลูกค้า (REG) · refType/refCode = เอกสารอ้างอิง (เช่น FO/QT) → แนบกับเครื่องมือ/นัด
 *  - ทุกอย่างบันทึกจริง อ้างอิงกลับเอกสารนี้ และโชว์ทั้งหน้าลูกค้าและเอกสาร
 */

type CustomerRec = { id: string; code: string; name: string; status?: string; groupName?: string; attributes?: Record<string, string> };
const CUST_COLS = ["name", "groupName"];
const enc = encodeURIComponent;
const today = () => new Date().toISOString().slice(0, 10);
const currentUser = () => { const s = getSession(); return s?.fullName || s?.email || s?.companyCode || "-"; };

export default function CustomerWorkPanel({
  customerCode, customerName, refType, refCode, footer, onChanged,
}: {
  customerCode: string;
  customerName?: string;
  refType: string;
  refCode: string;
  footer?: React.ReactNode;
  onChanged?: () => void;
}) {
  const { t } = useTranslation();
  const tenant = getSession()?.companyId ?? "";
  const [pane, setPane] = useState<"contact" | "other" | "saleshistory" | "tools" | "appt">("contact");
  const [cust, setCust] = useState<CustomerRec | null>(null);
  const [appts, setAppts] = useState<CalEvent[]>([]);
  const [apptAct, setApptAct] = useState("");
  const [apptDate, setApptDate] = useState("");
  const [remindDate, setRemindDate] = useState("");

  // โหลดข้อมูลลูกค้าเต็มจากรหัส
  useEffect(() => {
    setCust(null);
    if (!customerCode || !tenant) return;
    apiFetch<{ content: CustomerRec[] }>(`/customers?q=${enc(customerCode)}&size=10`, { tenant })
      .then((p) => setCust((p.content || []).find((c) => c.code === customerCode) || null))
      .catch(() => setCust(null));
  }, [customerCode, tenant]);

  // นัดของลูกค้านี้ที่อ้างอิงเอกสารนี้
  const loadAppts = () => {
    if (!customerCode) { setAppts([]); return; }
    fetchCalendarByRef(refType, refCode)
      .then((evs) => setAppts((evs || []).filter((e) => e.customerRef === customerCode)))
      .catch(() => setAppts([]));
  };
  useEffect(() => { loadAppts(); }, [customerCode, refType, refCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ฟิลด์ "ข้อมูลทั่วไป" = ฟิลด์ลูกค้าที่เปิดใช้ ยกเว้นกลุ่มติดต่อ (แยกแท็บ) และ name
  const enabledSet = useMemo(() => new Set(getEnabledFields()), []);
  const genGroups = useMemo(() => GROUPS
    .filter((g) => g !== "contact")
    .map((g) => ({ g, fields: CUST_FIELDS.filter((f) => f.group === g && enabledSet.has(f.key) && f.key !== "name") }))
    .filter((x) => x.fields.length > 0), [enabledSet]);
  const cval = (key: string): string => {
    const raw = CUST_COLS.includes(key) ? (cust as Record<string, unknown> | null)?.[key] : cust?.attributes?.[key];
    return raw == null || raw === "" ? "" : String(raw);
  };
  const a = (k: string) => cust?.attributes?.[k] || "—";
  const name = cust?.name || customerName || customerCode || "—";

  const saveAppt = async () => {
    if (!customerCode || !apptAct.trim()) return;
    try {
      await saveCalendar({ activityDate: apptDate || today(), remindDate: remindDate || null, title: apptAct.trim(), customerRef: customerCode, refType, refCode, module: "sales", createdBy: currentUser(), priority: "NORMAL", status: "PENDING", confirmed: false });
      setApptAct(""); setApptDate(""); setRemindDate(""); loadAppts(); onChanged?.();
    } catch { alert(t("salesDoc.saveApptFail")); }
  };
  const markDone = async (ev: CalEvent) => { try { await saveCalendar({ ...ev, status: "DONE", confirmed: true }); loadAppts(); onChanged?.(); } catch { /* ignore */ } };
  const del = async (ev: CalEvent) => { if (!ev.id || !window.confirm(t("salesDoc.delApptConfirm"))) return; try { await deleteCalendar(ev.id); loadAppts(); onChanged?.(); } catch { /* ignore */ } };

  if (!customerCode) {
    return <div className="cwp"><div className="ph-note">{t("salesDoc.noCustSel")}</div></div>;
  }

  return (
    <div className="cwp">
      <div className="ld-head compact">
        <div className="nm">{name}</div>
        <span className="chip blue">{refType} {refCode}</span>
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
            <div className="r"><span className="k">{t("salesDoc.companyName")}</span><span className="v">{name}</span></div>
            <div className="r"><span className="k">{t("salesDoc.custCode")}</span><span className="v">{customerCode}</span></div>
            <div className="r"><span className="k">{t("salesDoc.companyPhone")}</span><span className="v">{a("phone")}</span></div>
            <div className="r"><span className="k">{t("salesDoc.companyEmail")}</span><span className="v">{a("email")}</span></div>
          </div>
          <div className="ct-h">{t("salesDoc.contact1")}</div>
          <div className="kv">
            <div className="r"><span className="k">{t("salesDoc.name")}</span><span className="v">{a("contactPerson")}</span></div>
            <div className="r"><span className="k">{t("salesDoc.position")}</span><span className="v">{a("personPosition")}</span></div>
            <div className="r"><span className="k">{t("salesDoc.phone")}</span><span className="v">{a("personNumber")}</span></div>
            <div className="r"><span className="k">{t("salesDoc.email")}</span><span className="v">{a("personEmail")}</span></div>
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
          <CustomerFoSnapshot customerCode={customerCode} embed />
          {!cust ? (
            <div className="ph-note">{t("salesDoc.loadingCust")}</div>
          ) : (
            genGroups.map(({ g, fields }) => (
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
            ))
          )}
        </div>
      ) : pane === "saleshistory" ? (
        <div className="rt-body tools"><SalesHistoryPanel customerCode={customerCode} /></div>
      ) : pane === "tools" ? (
        <div className="rt-body tools">
          <ToolsPanel context="customer" customerCode={customerCode} refType={refType} refCode={refCode} />
        </div>
      ) : (
        <div className="rt-body">
          <div className="field-sm"><label>{t("salesDoc.apptActivity")}</label><input value={apptAct} onChange={(e) => setApptAct(e.target.value)} placeholder={t("salesDoc.apptPlaceholder")} /></div>
          <div className="field-sm"><label>{t("salesDoc.apptDate")}</label><input type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)} /></div>
          <div className="field-sm"><label>{t("salesDoc.remindDate")}</label><input type="date" value={remindDate} onChange={(e) => setRemindDate(e.target.value)} /></div>
          <button className="btn-dark" onClick={saveAppt}><Calendar size={15} />{t("salesDoc.saveToCal")}</button>
          <div className="acts-hint">{t("salesDoc.apptHint", { ref: `${refType} ${refCode}` })}</div>

          <div className="t" style={{ margin: "16px 0 8px" }}><Calendar size={14} />{t("salesDoc.apptOfCust", { count: appts.length })}</div>
          {appts.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--txt3)" }}>{t("salesDoc.noAppt")}</div>
          ) : (
            <div className="loglist">
              {[...appts].sort((x, y) => x.activityDate.localeCompare(y.activityDate)).map((ev) => {
                const done = ev.status === "DONE" || ev.confirmed;
                return (
                  <div className="logitem" key={ev.id}>
                    <div className="lt"><span>{ev.title}</span><span>{ev.activityDate}{ev.remindDate ? ` · ${t("salesDoc.remindPrefix")} ${ev.remindDate}` : ""}</span></div>
                    <div className="lb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className={`chip ${done ? "green" : "amber"}`}>{done ? t("salesDoc.done") : t("salesDoc.pending")}</span>
                      <span className="appt-acts">
                        {!done && <button type="button" className="lnk" title={t("salesDoc.markDone")} onClick={() => markDone(ev)}><Check size={15} /></button>}
                        <button type="button" className="lnk del" title={t("salesDoc.delAppt")} onClick={() => del(ev)}><Trash size={14} /></button>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {footer && <div className="rt-foot">{footer}</div>}
    </div>
  );
}
