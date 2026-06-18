import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { apiFetch } from "../../shared/api";
import { Grid, ChevronDown, Help, ChevronLeft, ChevronRight, Plus, Trash, Check, Bell, Calendar } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import NotifBell from "../../shared/NotifBell";
import { getNotifs, subscribeNotifs, isNotifRead, markNotifRead, markAllNotifsRead, unreadCount, type AppNotif } from "../../shared/notifications";
import { loadCalendar, syncCalendar, saveCalendar, deleteCalendar, isOverdue, type CalEvent, type CalPriority } from "./calendarStore";
import "../customer/customer.css";
import "./inbox.css";

const REF_TYPES = ["", "CL", "FO", "QT", "SO", "CUSTOMER"];
const pad = (n: number) => String(n).padStart(2, "0");
const dstr = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const today = new Date();
const todayStr = dstr(today.getFullYear(), today.getMonth(), today.getDate());
const blank = (): CalEvent => ({ activityDate: todayStr, remindDate: "", priority: "NORMAL", status: "PENDING", confirmed: false, title: "", customerRef: "", refType: "", refCode: "" });
const MONTHS_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const DOW_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const DOW_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** ศูนย์ "เตือน & ปฏิทิน" — เมนูซ้าย 2 แท็บ · ปฏิทินจริง (month grid) + ตาราง + ฟอร์มเพิ่ม */
export default function InboxPage() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const session = getSession();
  const me = session?.fullName || session?.email || session?.companyCode || "";

  const [, setTick] = useState(0);
  const [tab, setTab] = useState<"notif" | "calendar">("calendar");
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1)); // เดือนที่แสดง
  const [selDate, setSelDate] = useState(""); // วันที่เลือกในปฏิทิน → กรองตาราง
  const [showAll, setShowAll] = useState(false); // false = แสดง 7 วันถัดไป (ค่าเริ่มต้น), true = ทั้งหมด
  const [showForm, setShowForm] = useState(false); // popup ฟอร์มเพิ่มกิจกรรม
  const [draft, setDraft] = useState<CalEvent>(blank);
  const [busy, setBusy] = useState(false);

  useEffect(() => { syncCalendar(); return subscribeNotifs(() => setTick((n) => n + 1)); }, []);

  const notifs: AppNotif[] = getNotifs(); // ประเมินใหม่ทุก re-render (subscribeNotifs → setTick)
  // หน้านี้ = ปฏิทินของฉันเท่านั้น (กิจกรรมที่ฉันบันทึก/ไม่มีผู้บันทึก) · ไม่โชว์ของคนอื่น · ไม่โชว์ที่เลยมาเกิน 3 เดือน
  const cutoff = (() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); })();
  const events = loadCalendar().filter((e) => (!e.createdBy || e.createdBy === me) && e.activityDate >= cutoff);
  // ค่าเริ่มต้น = 7 วันถัดไป (วันนี้ถึงวันนี้+6) · เลือกวันในปฏิทิน → เฉพาะวันนั้น · กดป้าย → ทั้งหมด
  const in7Str = (() => { const d = new Date(); d.setDate(d.getDate() + 6); return dstr(d.getFullYear(), d.getMonth(), d.getDate()); })();
  const shown = selDate
    ? events.filter((e) => e.activityDate === selDate)
    : showAll ? events
      : events.filter((e) => e.activityDate >= todayStr && e.activityDate <= in7Str);

  const pri = (p: CalPriority) => (th ? { LOW: "ต่ำ", NORMAL: "ปกติ", HIGH: "สำคัญ" }[p] : p);
  const statusOf = (e: CalEvent) => (e.status === "DONE" ? "DONE" : isOverdue(e) ? "OVERDUE" : "PENDING");
  const statusLabel = (s: string) => (th ? { PENDING: "รอดำเนินการ", DONE: "ดำเนินการแล้ว", OVERDUE: "เลยกำหนด" }[s] : s);

  // คลิกวันในปฏิทิน → กรองตารางตามวันนั้น (ไม่เปิดฟอร์ม)
  const pickDate = (date: string) => setSelDate((cur) => (cur === date ? "" : date));
  const openForm = () => { setDraft({ ...blank(), activityDate: selDate || todayStr }); setShowForm(true); };
  const add = async () => {
    if (!draft.title.trim() || !draft.activityDate) { alert(th ? "กรอกกิจกรรมและวันที่" : "Enter activity and date"); return; }
    setBusy(true);
    const ok = await saveCalendar({ ...draft, remindDate: draft.remindDate || null, createdBy: me });
    setBusy(false);
    if (ok) { setDraft(blank()); setShowForm(false); } else alert(th ? "บันทึกไม่สำเร็จ" : "Save failed");
  };
  const markDone = async (e: CalEvent) => {
    if (e.priority === "HIGH" && !window.confirm(th ? "กิจกรรมสำคัญ — ยืนยันว่าทำแล้ว?" : "Important — confirm done?")) return;
    await saveCalendar({ ...e, status: "DONE", confirmed: true });
  };
  const del = async (e: CalEvent) => { if (e.id && window.confirm(th ? "ลบกิจกรรมนี้?" : "Delete?")) await deleteCalendar(e.id); };

  // เปิดเอกสารที่อ้างอิง (QT/FO/SO/CL) ตามชนิด
  const docUrl = (rt?: string | null, rc?: string | null): string | null => {
    if (!rt || !rc) return null;
    switch (rt) {
      case "QT": return `/sales/qt/${rc}`;
      case "FO": return `/sales/fo/d/${rc}`;
      case "SO": return `/sales/so/d/${rc}`;
      case "CL": return `/sales/cl/${rc}/full`;
      default: return null;
    }
  };
  // ไปหน้าลูกค้า — customerRef เป็น "โค้ด" ต้องแปลงเป็น id (UUID) ก่อน · หาไม่เจอ → เปิดรายการลูกค้าค้นด้วยโค้ด
  const tenant = session?.companyId ?? "";
  const goCustomer = async (codeRef?: string | null) => {
    if (!codeRef) return;
    try {
      const list = await apiFetch<{ id: string; code: string }[]>(`/customers/lookup?q=${encodeURIComponent(codeRef)}`, { tenant });
      const hit = (list || []).find((x) => x.code === codeRef) || (list || [])[0];
      if (hit?.id) { nav(`/customer/${hit.id}`); return; }
    } catch { /* ignore */ }
    nav(`/customer?q=${encodeURIComponent(codeRef)}`);
  };

  // ตารางปฏิทินของเดือนที่แสดง
  const y = view.getFullYear(), m = view.getMonth();
  const startDow = new Date(y, m, 1).getDay();
  const daysIn = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const evOf = (d: number) => events.filter((e) => e.activityDate === dstr(y, m, d));
  const monthLabel = th ? `${MONTHS_TH[m]} ${y + 543}` : view.toLocaleDateString("en", { month: "long", year: "numeric" });

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err">{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("custForm.goLogin")}</button></div></div>;
  }

  const addForm = (
    <div className="ib-add">
      <label>{th ? "วันที่กิจกรรม" : "Activity date"}<input type="date" value={draft.activityDate} onChange={(e) => setDraft({ ...draft, activityDate: e.target.value })} /></label>
      <label>{th ? "เตือนล่วงหน้า" : "Remind on"}<input type="date" value={draft.remindDate ?? ""} onChange={(e) => setDraft({ ...draft, remindDate: e.target.value })} /></label>
      <label>{th ? "ความสำคัญ" : "Priority"}
        <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as CalPriority })}>
          <option value="LOW">{pri("LOW")}</option><option value="NORMAL">{pri("NORMAL")}</option><option value="HIGH">{pri("HIGH")}</option>
        </select>
      </label>
      <label style={{ flex: 2 }}>{th ? "กิจกรรม" : "Activity"}<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={th ? "ทำอะไร" : "What"} /></label>
      <label>{th ? "รหัสลูกค้า" : "Customer"}<input value={draft.customerRef ?? ""} onChange={(e) => setDraft({ ...draft, customerRef: e.target.value })} /></label>
      <label>{th ? "อ้างอิง" : "Ref"}
        <select value={draft.refType ?? ""} onChange={(e) => setDraft({ ...draft, refType: e.target.value })}>{REF_TYPES.map((r) => <option key={r} value={r}>{r || "—"}</option>)}</select>
      </label>
      <label>{th ? "เลขอ้างอิง" : "Ref code"}<input value={draft.refCode ?? ""} onChange={(e) => setDraft({ ...draft, refCode: e.target.value })} /></label>
      <div style={{ display: "flex", gap: 8, alignSelf: "flex-end" }}>
        <button className="btn primary" disabled={busy} onClick={add}><Plus size={14} />{busy ? "…" : (th ? "บันทึก" : "Save")}</button>
        <button className="btn" onClick={() => setShowForm(false)}>{th ? "ยกเลิก" : "Cancel"}</button>
      </div>
    </div>
  );

  const formModal = showForm && (
    <div className="ib-modal-ov" onClick={() => setShowForm(false)}>
      <div className="ib-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ib-modal-head"><Plus size={16} />{th ? "เพิ่มกิจกรรม" : "Add event"}
          <button className="ib-modal-x" onClick={() => setShowForm(false)}>✕</button>
        </div>
        {addForm}
      </div>
    </div>
  );

  return (
    <div className="p-crm p-inbox">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>iDoc ERP</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{th ? "เตือน & ปฏิทิน" : "Alerts & Calendar"}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <NotifBell />
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        {/* เมนูซ้าย 2 แท็บ */}
        <div className="crm-side">
          <div className="side-title">{th ? "เตือน & ปฏิทิน" : "Alerts & Calendar"}</div>
          <div className={`side-item${tab === "notif" ? " active" : ""}`} onClick={() => setTab("notif")}>
            <Bell size={16} /><span>{th ? "แจ้งเตือน" : "Notifications"}</span>
            {unreadCount() > 0 && <span className="side-count">{unreadCount()}</span>}
          </div>
          <div className={`side-item${tab === "calendar" ? " active" : ""}`} onClick={() => setTab("calendar")}>
            <Calendar size={16} /><span>{th ? "ปฏิทิน" : "Calendar"}</span>
          </div>
        </div>

        <div className="crm-content">
          <div className="crm-body">
            {tab === "notif" ? (
              <div className="card cal-table-card">
                <div className="sh"><Bell size={16} />{th ? "แจ้งเตือน" : "Notifications"} <span className="ff-count" style={{ marginLeft: 6 }}>{notifs.length}</span>
                  {unreadCount() > 0 && <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--blue)", cursor: "pointer", fontWeight: 600 }} onClick={() => markAllNotifsRead()}>{th ? `อ่านทั้งหมด (${unreadCount()})` : `Mark all read (${unreadCount()})`}</span>}
                </div>
                {notifs.length === 0 ? <div className="ib-empty">{th ? "ไม่มีแจ้งเตือน" : "No notifications"}</div> : (
                  <div className="ib-notifs cal-table-wrap">
                    {notifs.map((n) => {
                      const agg = n.kind === "calFollowups";
                      const read = isNotifRead(n.id);
                      return (
                        <div key={n.id} className="ib-notif" style={read ? { opacity: 0.55 } : undefined} onClick={() => { markNotifRead(n.id); if (n.to) nav(n.to); }}>
                          <div className="ib-kind">{t(`notif.kind.${n.kind}`, { defaultValue: th ? "แจ้งเตือน" : "Alert" })}</div>
                          <div className="ib-main">{agg ? t("notif.followupsText", { count: n.primary }) : n.primary}</div>
                          {n.secondary && <div className="ib-sub">{agg ? t("notif.followupsOverdue", { count: n.secondary }) : n.secondary}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="cal-layout">
                {/* ปฏิทินจริง (month grid) — คอลัมน์ซ้าย ขนาดเล็ก */}
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
                              {evOf(d).slice(0, 2).map((e) => (
                                <div key={e.id} className={`cal-ev ${statusOf(e).toLowerCase()}`} title={e.title}>{e.title}</div>
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
                    <div className="sh"><Calendar size={16} />{th ? "กิจกรรมของฉัน" : "My events"} <span className="ff-count" style={{ marginLeft: 6 }}>{shown.length}</span>
                      {selDate
                        ? <span className="cal-filter" onClick={() => setSelDate("")}>{selDate} ✕</span>
                        : <span className="cal-filter" onClick={() => setShowAll((s) => !s)}>{showAll ? (th ? "ทั้งหมด" : "All") : (th ? "7 วันถัดไป" : "Next 7 days")}</span>}
                      <button className="btn primary" style={{ marginLeft: 8, padding: "4px 12px" }} onClick={openForm}><Plus size={14} />{th ? "เพิ่ม" : "Add"}</button>
                    </div>
                    <div className="cal-table-wrap">
                      <table className="data-grid">
                        <thead><tr>
                          <th>{th ? "วันที่" : "Date"}</th><th>{th ? "เตือน" : "Remind"}</th><th>{th ? "ความสำคัญ" : "Priority"}</th>
                          <th>{th ? "สถานะ" : "Status"}</th><th>{th ? "กิจกรรม" : "Activity"}</th><th>{th ? "ลูกค้า" : "Customer"}</th>
                          <th>{th ? "อ้างอิง" : "Ref"}</th><th>{th ? "ผู้บันทึก" : "By"}</th><th></th>
                        </tr></thead>
                        <tbody>
                          {shown.length === 0 && <tr className="empty-row"><td colSpan={9}>{selDate ? (th ? "ไม่มีกิจกรรมในวันนี้" : "No events on this day") : (th ? "ยังไม่มีกิจกรรม" : "No events")}</td></tr>}
                          {shown.map((e) => {
                          const st = statusOf(e);
                          return (
                            <tr key={e.id}>
                              <td>{e.activityDate}</td>
                              <td className="muted">{e.remindDate || "—"}</td>
                              <td><span className={`ib-pri ${e.priority.toLowerCase()}`}>{pri(e.priority)}</span></td>
                              <td><span className={`ib-st ${st.toLowerCase()}`}>{statusLabel(st)}</span></td>
                              <td>{e.title}</td>
                              <td>{e.customerRef
                                ? <a style={{ color: "var(--blue)", cursor: "pointer" }} title={th ? "ไปหน้าลูกค้า" : "Open customer"} onClick={() => goCustomer(e.customerRef)}>{e.customerRef}</a>
                                : <span className="muted">—</span>}</td>
                              <td>{(() => {
                                const u = docUrl(e.refType, e.refCode);
                                const label = e.refType ? `${e.refType}${e.refCode ? " " + e.refCode : ""}` : "—";
                                return u
                                  ? <a style={{ color: "var(--blue)", cursor: "pointer" }} title={th ? "เปิดเอกสาร" : "Open document"} onClick={() => nav(u)}>{label}</a>
                                  : <span className="muted">{label}</span>;
                              })()}</td>
                              <td className="muted">{e.createdBy || "—"}</td>
                              <td style={{ whiteSpace: "nowrap" }}>
                                {st !== "DONE" && <button className="ib-act" title={th ? "ทำแล้ว" : "Done"} onClick={() => markDone(e)}><Check size={14} /></button>}
                                <button className="ib-act danger" title={th ? "ลบ" : "Delete"} onClick={() => del(e)}><Trash size={14} /></button>
                              </td>
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
      {formModal}
    </div>
  );
}
