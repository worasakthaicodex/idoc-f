import { registerNotifProvider, type AppNotif } from "../../shared/notifications";
import { getSession } from "../../shared/session";
import { dueEvents, isOverdue } from "./calendarStore";

/**
 * แหล่งแจ้งเตือนของปฏิทิน — กิจกรรมที่ถึงวันเตือน/เลยกำหนด (ยังไม่ทำ)
 *  1) เตือน "ผู้บันทึก" เป็นรายการ ๆ (กิจกรรมที่เราเป็นคนบันทึก หรือไม่มีผู้บันทึก)
 *  2) เตือน "รวม" สำหรับกิจกรรมติดตามลูกค้าที่คนอื่น/เครื่องมือบันทึกไว้ — รวมเป็นใบเดียว
 *     เพื่อให้ทีมตามเสนอราคาลูกค้าได้ทันแม้ไม่ใช่ผู้บันทึก
 * โผล่บนกระดิ่ง + หน้า /inbox · กดแล้วไปหน้า /inbox
 */
const me = (): string => { const s = getSession(); return s?.fullName || s?.email || s?.companyCode || ""; };

/** กดแจ้งเตือนแล้วไปเปิดเอกสารที่อ้างอิงเลย (QT/FO/SO/CL) · ไม่มีอ้างอิง → ไปหน้า /inbox */
const docTo = (rt?: string | null, rc?: string | null): string => {
  if (rt && rc) {
    if (rt === "QT") return `/sales/qt/${rc}`;
    if (rt === "FO") return `/sales/fo/d/${rc}`;
    if (rt === "SO") return `/sales/so/d/${rc}`;
    if (rt === "CL") return `/sales/cl/${rc}/full`;
  }
  return "/inbox";
};

registerNotifProvider(() => {
  const m = me();
  // ไม่เตือนกิจกรรมที่เลยมาเกิน 3 เดือน (ของเก่าที่ค้างไว้นานแล้ว — ข้ามไป)
  const cutoff = (() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); })();
  const due = dueEvents().filter((e) => (e.remindDate || e.activityDate) >= cutoff);
  const mine = due.filter((e) => !e.createdBy || e.createdBy === m);
  const others = due.filter((e) => e.createdBy && e.createdBy !== m);

  const out: AppNotif[] = mine.map((e) => ({
    id: `cal-${e.id ?? e.title}-${e.activityDate}`,
    kind: isOverdue(e) ? "calOverdue" : "calDue",
    primary: e.title,
    secondary: e.customerRef || e.refCode || "",
    to: docTo(e.refType, e.refCode),   // กดแล้วเปิดเอกสารที่อ้างอิงเลย
    at: new Date(e.remindDate || e.activityDate).getTime() || Date.now(),
  }));

  if (others.length > 0) {
    const overdue = others.filter(isOverdue).length;
    out.push({
      id: "cal-followups",
      kind: "calFollowups",
      primary: String(others.length),
      secondary: overdue > 0 ? String(overdue) : "",
      to: "/inbox",
      at: Math.max(...others.map((e) => new Date(e.remindDate || e.activityDate).getTime() || 0)),
    });
  }
  return out;
});
