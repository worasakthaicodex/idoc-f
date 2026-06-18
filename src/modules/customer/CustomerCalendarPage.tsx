import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, ChevronLeft, ChevronRight, Bell, Calendar, Building, ArrowLeft } from "../../shared/icons";
import CrmHelpButton from "./CrmHelpButton";
import LangSwitcher from "../../shared/LangSwitcher";
import CustomerSide from "./CustomerSide";
import { loadCalendar, syncCalendar, saveCalendar, deleteCalendar, isOverdue, type CalEvent, type CalPriority } from "../inbox/calendarStore";
import { fetchAllDocs } from "../sales/clRequests";
import "./customer.css";
import "../inbox/inbox.css";

const pad = (n: number) => String(n).padStart(2, "0");
const dstr = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const today = new Date();
const todayStr = dstr(today.getFullYear(), today.getMonth(), today.getDate());
const MONTHS_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const DOW_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const DOW_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** เกี่ยวกับลูกค้า = มีรหัสลูกค้ากำกับ (customerRef) */
const isCust = (e: CalEvent) => !!(e.customerRef && e.customerRef.trim());

/** บันทึกตรงในลูกค้า = มาจากโมดูลลูกค้า (module "crm") เท่านั้น
 *  — ไม่เอาของที่มาจากงานขาย (CL/FO/QT/SO = module "sales") ที่อ้างอิงเอกสารระบบเก่ายังไม่ย้ายมา */
const isCrmDirect = (e: CalEvent) => e.module === "crm";

/** วันแจ้งเตือน = ก่อน "วันดำเนินการ" 1 เดือน (ถ้าตั้ง remindDate ไว้เองแล้ว ใช้ค่านั้น) */
const remindOf = (e: CalEvent): string => {
  if (e.remindDate && e.remindDate.trim()) return e.remindDate;
  const [yy, mm, dd] = e.activityDate.split("-").map(Number);
  const d = new Date(yy, mm - 1, dd);
  d.setMonth(d.getMonth() - 1);
  return dstr(d.getFullYear(), d.getMonth(), d.getDate());
};

/**
 * เตือนประจำปี "ปีก่อน ๆ ขายอะไรได้ ปีนี้ไปเสนอใหม่" — อ่านย้อนหลังจาก SO ที่ปิดการขายได้ของ "ทุกปีที่ผ่านมา"
 *  - ทำงานทุกปีอัตโนมัติ: อิงปีปัจจุบัน (thisYear) ไม่ผูกปีตายตัว → ขึ้นปีใหม่ ครั้งแรกที่เปิดหน้านี้จะเลื่อนมาเตือนปีใหม่ให้เอง
 *  - SO จริง (ไม่ใช่ดราฟ) · ไม่ปิดไม่ได้/ยกเลิก · วันที่ขายตั้งแต่ที่เริ่มมีข้อมูล (DATA_FLOOR) จนถึง "ก่อนปีนี้"
 *  - ลงเป็นแจ้งเตือนปีนี้: ใช้ วัน/เดือน เดิม เปลี่ยนเป็นปีปัจจุบัน (สถานะรอดำเนินการ)
 *  - 1 SO = 1 เหตุการณ์ (refType "SO" + เลข SO) ที่ "เลื่อนปี" ทุกปี · เคารพสถานะ "ทำแล้ว" ภายในปีเดียวกัน
 */
const DATA_FLOOR = "2025-04-01"; // วันแรกที่เริ่มมีข้อมูล SO จริงในระบบ (เก่ากว่านี้ยังไม่ย้ายมา)
let soWonBackfillRan = false;
async function backfillSoWonToCalendar(me: string): Promise<number> {
  if (soWonBackfillRan) return 0;
  soWonBackfillRan = true;
  try {
    const sos = await fetchAllDocs("SO");
    await syncCalendar();
    const thisYear = today.getFullYear();
    const yearStart = `${thisYear}-01-01`;                              // ตัดของปีปัจจุบันออก (ยังไม่ถึงรอบเตือน)
    const byRef = new Map(loadCalendar().filter((e) => e.module === "crm" && e.refType === "SO").map((e) => [e.refCode || "", e]));
    const wanted = new Set<string>();
    let changed = 0;
    for (const s of sos || []) {
      if (s.code.startsWith("DRAFT-")) continue;                         // ยังไม่ใช่ SO จริง
      const sv = s.values || {};
      if (sv.closeResult === "lost" || sv.closeResult === "cancel") continue; // ปิดไม่ได้/ยกเลิก → ไม่เอา
      const cust = (sv.customerRef || sv.customerCode || "").trim();
      if (!cust) continue;
      const date = (sv.orderDate || sv.closeDate || "").trim() || (s.savedAt ? new Date(s.savedAt).toISOString().slice(0, 10) : "");
      if (!date || date < DATA_FLOOR || date >= yearStart) continue;     // ทุกปีที่ผ่านมา (ก่อนปีนี้) ตั้งแต่เริ่มมีข้อมูล
      wanted.add(s.code);
      const remindThisYear = `${thisYear}-${date.slice(5)}`;             // วัน/เดือนเดิม → ปีนี้ (เตือนไปเสนอใหม่)
      const svc = (sv.closedService || sv.servicesOffered || "").trim();
      const amt = (sv.saleAmount || "").trim();
      const title = `ปี ${date.slice(0, 4)} ปิดการขายได้${svc ? " · " + svc : ""}${amt ? " · " + amt + "฿" : ""} — ไปเสนอใหม่ (${s.code})`;
      const base: CalEvent = {
        activityDate: remindThisYear, remindDate: null, priority: "NORMAL", status: "PENDING", confirmed: false,
        title, customerRef: cust, refType: "SO", refCode: s.code, module: "crm", createdBy: sv.salesperson || me || null,
      };
      const ev = byRef.get(s.code);
      if (!ev) { if (await saveCalendar(base)) changed++; }              // ยังไม่มี → สร้าง
      else if (ev.activityDate.slice(0, 4) !== String(thisYear)) {       // ของปีก่อน/ลงผิด → เลื่อนมาเตือนปีนี้ใหม่ (ภายในปีเดียวกันไม่ยุ่ง = เคารพ "ทำแล้ว")
        if (await saveCalendar({ ...ev, ...base })) changed++;
      }
    }
    // ลบรายการที่ระบบเคยลงไว้แต่ไม่อยู่ในชุดที่ต้องการแล้ว (เช่น SO ปีปัจจุบันจากรอบก่อน)
    for (const [ref, ev] of byRef) {
      if (ref && !wanted.has(ref) && ev.id) { await deleteCalendar(ev.id); changed++; }
    }
    return changed;
  } catch { soWonBackfillRan = false; return 0; }
}

/**
 * ปฏิทินและกิจกรรม (ของโมดูลลูกค้า) — คล้าย /inbox แต่เมนูบน (top tabs) และเฉพาะที่เกี่ยวกับลูกค้า
 * แสดงของทุกคน (ไม่กรองตามผู้ใช้) · บันทึกจริงที่ /api/calendar
 */
export default function CustomerCalendarPage() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const session = getSession();
  const me = session?.fullName || session?.email || session?.companyCode || "";

  const [, setTick] = useState(0);
  const [tab, setTab] = useState<"notif" | "calendar">("calendar");
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selDate, setSelDate] = useState("");      // วันที่เลือกในปฏิทิน → กรองตาราง
  const [showAll, setShowAll] = useState(false);   // false = 7 วันถัดไป (เริ่มต้น), true = ทั้งหมด

  useEffect(() => {
    syncCalendar().then(() => setTick((n) => n + 1));
    // เติมปฏิทินย้อนหลังจาก SO ที่ปิดการขายได้ (เม.ย. 2025 เป็นต้นไป) แล้วรีเฟรชเมื่อมีการเพิ่ม
    backfillSoWonToCalendar(me).then((added) => { if (added) setTick((n) => n + 1); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // เฉพาะที่บันทึกตรงในลูกค้า (module "crm") + มีรหัสลูกค้า — ไม่เอาของจากงานขาย (CL/FO/QT/SO)
  const events = loadCalendar().filter((e) => isCust(e) && isCrmDirect(e));
  // ค่าเริ่มต้น = 7 วันถัดไป · เลือกวันในปฏิทิน → เฉพาะวันนั้น · กดป้าย → ทั้งหมด
  const in7Str = (() => { const d = new Date(); d.setDate(d.getDate() + 6); return dstr(d.getFullYear(), d.getMonth(), d.getDate()); })();
  const shown = selDate
    ? events.filter((e) => e.activityDate === selDate || remindOf(e) === selDate)   // คลิกวันเตือนในปฏิทินก็เห็นในตาราง
    : showAll ? events
      : events.filter((e) => e.activityDate >= todayStr && e.activityDate <= in7Str);
  // แจ้งเตือน = กิจกรรมลูกค้าที่ถึงกำหนดเตือน (ก่อน 1 เดือน) / เลยกำหนด (ยังไม่ทำ)
  const alerts = events.filter((e) => e.status !== "DONE" && !e.confirmed && remindOf(e) <= todayStr);

  const pri = (p: CalPriority) => (th ? { LOW: "ต่ำ", NORMAL: "ปกติ", HIGH: "สำคัญ" }[p] : p);
  const statusOf = (e: CalEvent) => (e.status === "DONE" ? "DONE" : isOverdue(e) ? "OVERDUE" : "PENDING");
  const statusLabel = (s: string) => (th ? { PENDING: "รอดำเนินการ", DONE: "ดำเนินการแล้ว", OVERDUE: "เลยกำหนด" }[s] : s);

  const pickDate = (date: string) => setSelDate((cur) => (cur === date ? "" : date));
  const goCust = (code?: string | null) => { if (code) nav(`/customer?code=${encodeURIComponent(code)}`); };

  const y = view.getFullYear(), m = view.getMonth();
  const startDow = new Date(y, m, 1).getDay();
  const daysIn = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const evOf = (d: number): { e: CalEvent; remind: boolean }[] => {
    const ds = dstr(y, m, d);
    const out: { e: CalEvent; remind: boolean }[] = [];
    for (const e of events) {
      if (e.activityDate === ds) out.push({ e, remind: false });            // วันดำเนินการ
      else if (remindOf(e) === ds) out.push({ e, remind: true });           // วันแจ้งเตือน (ก่อน 1 เดือน) — โผล่ในปฏิทินด้วย
    }
    return out;
  };
  const monthLabel = th ? `${MONTHS_TH[m]} ${y + 543}` : view.toLocaleDateString("en", { month: "long", year: "numeric" });

  if (!session) {
    return (
      <div className="p-crm"><div className="crm-body">
        <div className="banner err"><Building size={15} />{t("customer.notLoggedIn")}</div>
        <button className="btn primary" onClick={() => nav("/login")}><ArrowLeft size={15} />{t("customer.goLogin")}</button>
      </div></div>
    );
  }

  return (
    <div className="p-crm p-inbox">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{t("customer.title")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <CrmHelpButton />
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <CustomerSide active="calendar" />

        <div className="crm-content">
          <div className="subbar">
            <div className="company-pick"><Building size={15} />{t("customer.menu.calendar", { defaultValue: "ปฏิทินและกิจกรรม" })}</div>
          </div>

          <div className="crm-body">
            {/* เมนูบน (top tabs) แทนเมนูซ้ายแบบ inbox */}
            <div className="tabs" style={{ marginBottom: 14 }}>
              <div className={`tab${tab === "calendar" ? " active" : ""}`} onClick={() => setTab("calendar")}>
                <Calendar size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />{th ? "ปฏิทิน" : "Calendar"}
              </div>
              <div className={`tab${tab === "notif" ? " active" : ""}`} onClick={() => setTab("notif")}>
                <Bell size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />{th ? "แจ้งเตือน" : "Notifications"}
                {alerts.length > 0 && <span className="side-count" style={{ marginLeft: 6 }}>{alerts.length}</span>}
              </div>
            </div>

            {tab === "notif" ? (
              <div className="card cal-table-card">
                <div className="sh"><Bell size={16} />{th ? "แจ้งเตือนลูกค้า (ถึงกำหนด/เลยกำหนด)" : "Customer alerts (due/overdue)"} <span className="ff-count" style={{ marginLeft: 6 }}>{alerts.length}</span></div>
                {alerts.length === 0 ? <div className="ib-empty">{th ? "ไม่มีแจ้งเตือน" : "No notifications"}</div> : (
                  <div className="ib-notifs cal-table-wrap">
                    {alerts.map((e) => {
                      const st = statusOf(e);
                      return (
                        <div key={e.id} className="ib-notif" onClick={() => goCust(e.customerRef)}>
                          <div className="ib-kind"><span className={`ib-st ${st.toLowerCase()}`}>{statusLabel(st)}</span></div>
                          <div className="ib-main">{e.title}</div>
                          <div className="ib-sub">
                            {(th ? "วันที่ " : "On ")}{e.activityDate}
                            {e.customerRef ? ` · ${th ? "ลูกค้า" : "Customer"} ${e.customerRef}` : ""}
                            {e.createdBy ? ` · ${th ? "โดย" : "by"} ${e.createdBy}` : ""}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="cal-layout">
                {/* ปฏิทินจริง (month grid) — คอลัมน์ซ้าย 50% */}
                <div className="card cal-pane">
                  <div className="cal-head">
                    <button className="ib-act" onClick={() => setView(new Date(y, m - 1, 1))}><ChevronLeft size={16} /></button>
                    <div className="cal-title">{monthLabel}</div>
                    <button className="ib-act" onClick={() => setView(new Date(y, m + 1, 1))}><ChevronRight size={16} /></button>
                    <button className="btn" style={{ fontSize: 12, padding: "4px 10px", marginLeft: "auto" }} onClick={() => { setView(new Date(today.getFullYear(), today.getMonth(), 1)); setSelDate(todayStr); }}>{th ? "วันนี้" : "Today"}</button>
                  </div>
                  <div className="cal-grid">
                    {(th ? DOW_TH : DOW_EN).map((d) => <div key={d} className="cal-dow">{d}</div>)}
                    {cells.map((d, i) => {
                      const ds = d !== null ? dstr(y, m, d) : "";
                      return (
                        <div key={i} className={`cal-cell${d === null ? " blank" : ""}${ds && ds === selDate ? " sel" : ""}`} onClick={() => d && pickDate(ds)}>
                          {d !== null && (
                            <>
                              <div className={`cal-day${ds === todayStr ? " today" : ""}`}>{d}</div>
                              {evOf(d).slice(0, 2).map(({ e, remind }) => (
                                <div key={(remind ? "r" : "a") + e.id} className={`cal-ev ${statusOf(e).toLowerCase()}`} title={`${remind ? (th ? "เตือน: " : "Remind: ") : ""}${e.title} · ${e.customerRef ?? ""}`}>{remind ? "🔔 " : ""}{e.title}</div>
                              ))}
                              {evOf(d).length > 2 && <div className="cal-more">+{evOf(d).length - 2}</div>}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* คอลัมน์ขวา: ตาราง (สูงเต็มจอ + สกอลล์) · ฟอร์มเป็น popup */}
                <div className="cal-right">
                  <div className="card cal-table-card">
                    <div className="sh"><Calendar size={16} />{th ? "กิจกรรมลูกค้า" : "Customer events"} <span className="ff-count" style={{ marginLeft: 6 }}>{shown.length}</span>
                      {selDate
                        ? <span className="cal-filter" onClick={() => setSelDate("")}>{selDate} ✕</span>
                        : <span className="cal-filter" onClick={() => setShowAll((s) => !s)}>{showAll ? (th ? "ทั้งหมด" : "All") : (th ? "7 วันถัดไป" : "Next 7 days")}</span>}
                    </div>
                    <div className="cal-table-wrap">
                      <table className="data-grid">
                        <thead><tr>
                          <th>{th ? "วันดำเนินการ" : "Date"}</th><th>{th ? "แจ้งเตือนก่อน 1 เดือน" : "Remind (1mo)"}</th><th>{th ? "ลูกค้า" : "Customer"}</th>
                          <th>{th ? "ความสำคัญ" : "Priority"}</th><th>{th ? "สถานะ" : "Status"}</th><th>{th ? "กิจกรรม" : "Activity"}</th>
                          <th>{th ? "ผู้บันทึก" : "By"}</th>
                        </tr></thead>
                        <tbody>
                          {shown.length === 0 && <tr className="empty-row"><td colSpan={7}>{selDate ? (th ? "ไม่มีกิจกรรมในวันนี้" : "No events on this day") : (th ? "ยังไม่มีกิจกรรม" : "No events")}</td></tr>}
                          {shown.map((e) => {
                            const st = statusOf(e);
                            return (
                              <tr key={e.id}>
                                <td>{e.activityDate}</td>
                                <td className="muted">{remindOf(e)}</td>
                                <td className="docno" style={{ cursor: "pointer" }} onClick={() => goCust(e.customerRef)}>{e.customerRef || "—"}</td>
                                <td><span className={`ib-pri ${e.priority.toLowerCase()}`}>{pri(e.priority)}</span></td>
                                <td><span className={`ib-st ${st.toLowerCase()}`}>{statusLabel(st)}</span></td>
                                <td>{e.title}</td>
                                <td className="muted">{e.createdBy || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
