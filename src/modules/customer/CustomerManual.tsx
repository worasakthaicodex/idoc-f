import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, Building, ArrowLeft, Search } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import CrmHelpButton from "./CrmHelpButton";
import "./customer.css";

/** หนึ่งงาน (how-to) — คำถาม + ขั้นตอน 2 ภาษา */
type Task = { qTh: string; qEn: string; stepsTh: string[]; stepsEn: string[] };
type Section = { id: string; th: string; en: string; noteTh?: string; noteEn?: string; tasks: Task[] };

const SECTIONS: Section[] = [
  {
    id: "core", th: "ข้อมูลลูกค้า", en: "Customer data",
    tasks: [
      { qTh: "เพิ่มลูกค้าใหม่", qEn: "Add a new customer",
        stepsTh: ["เปิดเมนู “ข้อมูลลูกค้า” ทางซ้าย", "กดปุ่ม “เพิ่มลูกค้า” (มุมขวาบนของตาราง)", "กรอกชื่อ และข้อมูลตามฟิลด์ที่บริษัทเปิดไว้", "เลือกสถานะ (ปกติ “ใช้งาน”)", "กด “บันทึก”"],
        stepsEn: ["Open \"Customer data\" in the left menu", "Click \"Add customer\" (top-right of the table)", "Fill in the name and the enabled fields", "Choose a status (usually \"Active\")", "Click \"Save\""] },
      { qTh: "ค้นหาลูกค้าแบบง่าย", qEn: "Quick search",
        stepsTh: ["ที่หน้าข้อมูลลูกค้า เลือกแถบ “ค้นหาแบบง่าย”", "พิมพ์คำค้น (ชื่อ / รหัส / กลุ่ม)", "กดปุ่ม “ค้นหา” (ค้นจริงที่ฐานข้อมูล)"],
        stepsEn: ["Pick the \"Simple\" search tab", "Type a keyword (name / code / group)", "Click \"Search\" (queries the database)"] },
      { qTh: "ค้นหาแบบเต็มพิกัด (รายฟิลด์)", qEn: "Advanced search (per field)",
        stepsTh: ["เลือกแถบ “เต็มพิกัด”", "กรอกเงื่อนไขในแต่ละฟิลด์ที่ต้องการ", "กด “ค้นหา” · ล้างเงื่อนไขด้วยปุ่ม “ล้างตัวกรอง”"],
        stepsEn: ["Pick the \"Advanced\" tab", "Fill conditions per field", "Click \"Search\"; use \"Clear filters\" to reset"] },
      { qTh: "ดูหรือแก้ไขลูกค้า", qEn: "View or edit a customer",
        stepsTh: ["กดที่แถวลูกค้าเพื่อเปิดรายละเอียด", "กดปุ่ม “แก้ไข”", "ปรับข้อมูลที่ต้องการ", "กด “บันทึก”"],
        stepsEn: ["Click a customer row to open details", "Click \"Edit\"", "Change the data", "Click \"Save\""] },
      { qTh: "ดูลูกค้าสถานะอื่น (ไม่ใช่ใช้งาน)", qEn: "See non-active customers",
        stepsTh: ["ที่หน้าข้อมูลลูกค้า สลับไปแท็บ “สถานะอื่น ๆ” เหนือตาราง", "ค้นหาในแท็บนี้ได้ตามปกติ"],
        stepsEn: ["Switch to the \"Other statuses\" tab above the table", "Search works the same in this tab"] },
    ],
  },
  {
    id: "requests", th: "คำขอดำเนินการ", en: "Action requests",
    noteTh: "ให้พนักงานที่ไม่ใช่แอดมินเป็นคนขอเพิ่ม/แก้ไข/เปลี่ยนสถานะลูกค้า แล้วส่งให้ผู้ตรวจ — แอดมินมีหน้าที่แค่ตรวจสอบและอนุมัติผล ลดภาระงานแอดมิน",
    noteEn: "Non-admin staff submit add/edit/status requests for review — the admin only checks and approves, reducing admin workload.",
    tasks: [
      { qTh: "สร้างคำขอ (เพิ่ม/แก้ไข/เปลี่ยนสถานะ)", qEn: "Create a request",
        stepsTh: ["เปิดเมนู “คำขอดำเนินการ”", "กด “สร้างคำขอ” แล้วเลือกประเภท", "เลือกลูกค้า (กรณีแก้ไข/เปลี่ยนสถานะ) หรือกรอกข้อมูลใหม่", "กรอกรายละเอียดให้ครบ", "กดส่งเรื่อง"],
        stepsEn: ["Open \"Action requests\"", "Click \"New request\" and pick a type", "Select a customer (edit/status) or enter new data", "Fill in the details", "Submit"] },
      { qTh: "รับเรื่องและดำเนินการ", qEn: "Receive and process",
        stepsTh: ["ดูใบที่อยู่ใน “รอรับ” (ตัวเลขสีแดงข้างเมนู = ใบที่ส่งมาให้)", "กด “รับเรื่อง”", "ตรวจสอบ/แก้ไขตามคำขอ", "กด “ส่ง” ขั้นต่อไป หรือ “เสร็จสิ้น”"],
        stepsEn: ["Check slips in \"To receive\" (red number = sent to you)", "Click \"Receive\"", "Review/apply the request", "Click \"Send\" to the next step, or \"Done\""] },
    ],
  },
  {
    id: "groups", th: "กลุ่มลูกค้า", en: "Customer groups",
    tasks: [
      { qTh: "ดูจำนวนลูกค้าตามกลุ่ม/เกรด", qEn: "Count customers by group/grade",
        stepsTh: ["เปิด “กลุ่มลูกค้า” แท็บ “ตามประเภท”", "กดที่ป้ายกลุ่มเพื่อดูรายชื่อตัวอย่าง (หัว/ท้าย)"],
        stepsEn: ["Open \"Customer groups\" → \"By type\"", "Click a chip to preview names (head/tail)"] },
      { qTh: "ดูว่าเหลือรายชื่อให้ใช้เท่าไร", qEn: "See how many leads remain",
        stepsTh: ["ติ๊ก “เฉพาะที่ยังไม่อยู่ในตะกร้าฉัน”", "ตัวเลขจะตัดคนที่อยู่ในตะกร้าของฉัน/ที่แชร์ให้ฉันออก"],
        stepsEn: ["Tick \"Not in my baskets\"", "Counts exclude customers in your own/shared baskets"] },
      { qTh: "ดูตามงานขาย (FO/QT/SO)", qEn: "View by sales",
        stepsTh: ["สลับแท็บ “ตามงานขาย” (ต้องเปิดโมดูลงานขาย)", "กดป้ายปี หรือเลือก “แยกย่อยตาม” กลุ่ม เพื่อเจาะดู"],
        stepsEn: ["Switch to \"By sales\" (requires the Sales module)", "Click a year chip or pick \"Break down by\" to drill in"] },
    ],
  },
  {
    id: "basket", th: "ตะกร้ารายชื่อ", en: "Lead baskets",
    tasks: [
      { qTh: "สร้างตะกร้าใหม่", qEn: "Create a basket",
        stepsTh: ["เปิดเมนู “ตะกร้ารายชื่อ”", "กด “สร้างตะกร้า”", "ตั้งชื่อในกล่องที่ขึ้นมา แล้วยืนยัน"],
        stepsEn: ["Open \"Lead baskets\"", "Click \"New basket\"", "Name it in the popup and confirm"] },
      { qTh: "ใส่รายชื่อลงตะกร้า", qEn: "Add leads to a basket",
        stepsTh: ["ทีละราย: ที่ popup รายชื่อ กดไอคอนตะกร้าหน้าแถว (กลายเป็นเครื่องหมายถูก = ใส่แล้ว)", "ยกก้อน: เลือกตะกร้าปลายทาง ใส่จำนวน แล้วกด “ใส่ N รายแรก”", "ติ๊ก “เฉพาะที่ยังไม่อยู่ในตะกร้า” ถ้าไม่อยากได้คนซ้ำ"],
        stepsEn: ["One by one: click the basket icon on a row (turns to a check = added)", "Bulk: pick the target basket, set a count, click \"Add first N\"", "Tick \"only not in basket\" to skip duplicates"] },
      { qTh: "แชร์ตะกร้าให้เพื่อนร่วมงาน", qEn: "Share a basket",
        stepsTh: ["เปิดตะกร้าที่ต้องการ", "กดปุ่ม “แชร์”", "เลือกผู้ใช้ที่ใช้โมดูลลูกค้า แล้วบันทึก (ผู้รับเห็นแบบอ่านอย่างเดียว)"],
        stepsEn: ["Open the basket", "Click \"Share\"", "Pick users with the customer module and save (read-only for them)"] },
    ],
  },
  {
    id: "active", th: "ลูกค้าที่เคลื่อนไหว", en: "Recently active",
    tasks: [
      { qTh: "ดูลูกค้าที่เพิ่งมีความเคลื่อนไหว", qEn: "See recently active customers",
        stepsTh: ["เปิดเมนู “ลูกค้าที่เคลื่อนไหว”", "ดูรายชื่อ 200 รายล่าสุด พร้อมแหล่งที่มา (เครื่องมือ/เอกสาร/ปฏิทิน) และวันที่", "พิมพ์ในช่องค้นหาเพื่อกรอง · กดแถวเพื่อเปิดลูกค้า"],
        stepsEn: ["Open \"Recently active\"", "See the latest 200 with source (tool/doc/calendar) and date", "Type in the search box to filter; click a row to open"] },
    ],
  },
  {
    id: "calendar", th: "ปฏิทินและกิจกรรม", en: "Calendar & activity",
    tasks: [
      { qTh: "เพิ่มกิจกรรม/นัดหมายของลูกค้า", qEn: "Add a customer activity",
        stepsTh: ["เปิด “ปฏิทินและกิจกรรม” แท็บ “ปฏิทิน”", "กดวันที่ในปฏิทิน (หรือปุ่ม “เพิ่มกิจกรรม”)", "กรอกกิจกรรม และ รหัสลูกค้า (บังคับ)", "ตั้งวันเตือนล่วงหน้าและความสำคัญ", "กด “บันทึก”"],
        stepsEn: ["Open \"Calendar & activity\" → \"Calendar\"", "Click a day (or \"Add\")", "Enter the activity and a customer code (required)", "Set a remind date and priority", "Click \"Save\""] },
      { qTh: "ดูสิ่งที่ถึงกำหนด / ทำเครื่องหมายเสร็จ", qEn: "See due items / mark done",
        stepsTh: ["สลับแท็บ “แจ้งเตือน” เพื่อดูงานที่ถึงกำหนด/เลยกำหนด", "ในตารางกิจกรรม กดเครื่องหมายถูกเพื่อทำเสร็จ"],
        stepsEn: ["Switch to the \"Notifications\" tab for due/overdue items", "In the events table, click the check to mark done"] },
    ],
  },
  {
    id: "reports", th: "รายงาน", en: "Reports",
    tasks: [
      { qTh: "ดูรายงานเรียลไทม์", qEn: "View realtime reports",
        stepsTh: ["เปิดเมนู “รายงาน” แท็บ “เรียลไทม์”", "ดูกราฟวงกลม (จำนวนครั้งติดต่อ / ความครบถ้วน) และการ์ดเกรด", "กดส่วนวงกลมเพื่อดูรายชื่อ + ส่งออกได้"],
        stepsEn: ["Open \"Reports\" → \"Realtime\"", "View the donut charts and grade card", "Click a slice to list names + export"] },
      { qTh: "ตัดเกรดลูกค้า (รอบใหม่)", qEn: "Cut grades (new period)",
        stepsTh: ["ที่การ์ด “การปรับเกรด” กดปุ่ม “ตัดเกรดตอนนี้”", "ยืนยัน — ระบบบันทึกเกรดปัจจุบันเป็นรอบใหม่ และเทียบขึ้น/ลงกับรอบก่อน"],
        stepsEn: ["On the \"Grade movement\" card, click \"Cut grades now\"", "Confirm — it snapshots current grades and compares up/down vs the previous cut"] },
      { qTh: "ดูรายงานย้อนหลัง + ตั้งรอบเดือนเอง", qEn: "Historical + custom month cycle",
        stepsTh: ["สลับแท็บ “ย้อนหลัง”", "เลือกช่วงวันที่ และ “จัดตาม” วัน/สัปดาห์/เดือน/ปี", "ถ้ารอบบริษัทไม่ตรงเดือนปฏิทิน ตั้ง “เริ่มรอบวันที่” (เช่น 25)", "สลับมุมมอง “กราฟ/ตาราง” และ “แท่ง/เส้น” ได้"],
        stepsEn: ["Switch to \"Historical\"", "Pick a date range and \"By\" day/week/month/year", "If your cycle isn't a calendar month, set \"Cycle start\" (e.g. 25)", "Toggle Chart/Table and Bar/Line"] },
      { qTh: "ส่งออกข้อมูล / ดูข้อมูลดิบ", qEn: "Export / view raw data",
        stepsTh: ["กดปุ่ม “CSV” บนการ์ดเพื่อส่งออกไฟล์", "กด “ข้อมูลดิบ” เพื่อดูรายการเต็มในป๊อปอัป (ส่งออกได้เช่นกัน)"],
        stepsEn: ["Click \"CSV\" on a card to export", "Click \"Raw\" to view the full list in a popup (also exportable)"] },
    ],
  },
  {
    id: "settings", th: "ตั้งค่า CRM", en: "CRM settings",
    tasks: [
      { qTh: "ปรับสถานะ / ฟิลด์ / คอลัมน์ / เครื่องมือ", qEn: "Configure statuses / fields / columns / tools",
        stepsTh: ["เปิดเมนู “ตั้งค่า CRM” (เฉพาะผู้มีสิทธิ์)", "เลือกหัวข้อที่ต้องการ (สถานะ / ฟิลด์ / ตัวเลือกฟิลด์ / คอลัมน์ / ค้นหา / เครื่องมือ / เกณฑ์พร้อมใช้)", "ปรับค่าแล้วบันทึก — มีผลกับทั้งบริษัท"],
        stepsEn: ["Open \"CRM settings\" (permitted users only)", "Pick a topic (statuses / fields / options / columns / search / tools / readiness)", "Change and save — applies company-wide"] },
    ],
  },
];

/** บทนำ — ระบบนี้ทำอะไรได้บ้าง (ภาพรวมก่อนลงวิธีทำ) */
const INTRO = {
  leadTh: "ระบบลูกค้า (CRM) ช่วยเก็บและดูแลฐานลูกค้าของบริษัทแบบครบวงจร ตั้งแต่บันทึกข้อมูล จัดกลุ่ม ติดตามการติดต่อ ไปจนถึงรายงานสรุป — ทุกอย่างบันทึกจริงและแยกข้อมูลของแต่ละบริษัท",
  leadEn: "The Customer (CRM) module manages your company's customer base end-to-end — recording data, grouping, tracking contact, through to summary reports. Everything is saved per company.",
  bulletsTh: [
    "บันทึกและค้นหาลูกค้า — รองรับการค้นหาทั้งแบบรวดเร็ว (คำเดียว) และเจาะลึกรายฟิลด์ แยกตามสถานะ เข้าถึงข้อมูลได้รวดเร็วและแม่นยำ แม้มีลูกค้าจำนวนมาก",
    "คำขอดำเนินการ — ให้พนักงานทั่วไป (ที่ไม่ใช่แอดมิน) ขอเพิ่ม/แก้ไข/เปลี่ยนสถานะลูกค้าได้ แอดมินแค่ตรวจสอบ/อนุมัติผล ช่วยลดภาระงานแอดมิน",
    "จัดกลุ่มลูกค้าตามประเภท/เกรด (และตามงานขาย FO/QT/SO) — แบ่งลูกค้าให้หยิบไปใช้ได้ง่าย ตรงตามที่ต้องการ และทราบจำนวนล่วงหน้าก่อนลงมือ",
    "ตะกร้ารายชื่อส่วนตัว — เก็บรายชื่อลูกค้าที่สนใจไว้ใช้คราวหลัง แทนการจดลงไฟล์ภายนอก (เช่น Excel) และแชร์ให้เพื่อนร่วมงานได้",
    "ดูลูกค้าที่เพิ่งเคลื่อนไหวล่าสุด — เช็คว่าลูกค้ารายไหนมีความเคลื่อนไหว เผื่อเคยดำเนินการอะไรไปแล้วแต่จำไม่ได้ (อ้างจากเครื่องมือ/เอกสาร/ปฏิทิน)",
    "ปฏิทินและแจ้งเตือนกิจกรรมลูกค้า — ไว้ติดตามการขาย เสนอบริการให้ทันรอบบริการ/ต่ออายุของลูกค้าแต่ละราย",
    "รายงานการดำเนินการต่างๆ ที่เกี่ยวข้องกับลูกค้า — ทั้งแบบเรียลไทม์ (จำนวนครั้งที่ติดต่อ ความครบถ้วนของข้อมูล การปรับเกรด) และย้อนหลัง (การเพิ่มลูกค้า/คำขอดำเนินการ ตามช่วงเวลา) ดูเป็นกราฟ/ตาราง และส่งออกเป็นไฟล์ CSV ได้",
    "ตั้งค่าได้เอง — รองรับการปรับตั้งค่าให้ระบบเหมาะกับหน้างานจริงของแต่ละบริษัท เช่น สถานะลูกค้า ฟิลด์และตัวเลือก คอลัมน์ที่แสดง ฟิลด์ที่ค้นได้ เครื่องมือ และเกณฑ์ “พร้อมใช้”",
  ],
  bulletsEn: [
    "Record and search customers — fast (single keyword) and deep (per-field) search by status, reaching data quickly and accurately even with many customers",
    "Action requests — let non-admin staff request to add/edit/change-status of customers; the admin only reviews/approves, cutting the admin's workload",
    "Group customers by type/grade (and by sales FO/QT/SO) — grab exactly the set you need and know the counts in advance",
    "Personal lead baskets — keep customers you're interested in for later instead of an outside file (e.g. Excel); shareable with colleagues",
    "See recently active customers — check who has had activity, in case you already did something but can't recall (from tools/documents/calendar)",
    "Calendar & reminders for customer activities — follow up sales and offer services in time for each customer's service/renewal cycle",
    "Reports on customer-related operations — both realtime (times contacted, data completeness, grade changes) and historical (customer additions/requests over time), as charts/tables, exportable to CSV",
    "Self-configurable — adapt the system to each company's real workflow: customer statuses, fields & options, visible columns, searchable fields, tools, and the \"ready\" rules",
  ],
  hintTh: "เลือกหัวข้อด้านซ้าย หรือค้นวิธีทำด้านบน เพื่อดูขั้นตอนทีละขั้น",
  hintEn: "Pick a topic on the left, or search a how-to above, for step-by-step instructions",
};

/** คู่มือการใช้งาน CRM — หน้าเต็ม (how-to ทีละขั้น) · เปิดจากปุ่ม ? บน topbar */
export default function CustomerManual() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const session = getSession();
  const [q, setQ] = useState("");

  const key = q.trim().toLowerCase();
  const match = (s: Section) => {
    if (!key) return s;
    const tasks = s.tasks.filter((tk) => [tk.qTh, tk.qEn, ...tk.stepsTh, ...tk.stepsEn].join(" ").toLowerCase().includes(key));
    const titleHit = (s.th + " " + s.en).toLowerCase().includes(key);
    return tasks.length || titleHit ? { ...s, tasks: titleHit ? s.tasks : tasks } : null;
  };
  const sections = SECTIONS.map(match).filter(Boolean) as Section[];
  const go = (id: string) => document.getElementById(`man-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err"><Building size={15} />{t("customer.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}><ArrowLeft size={15} />{t("customer.goLogin")}</button></div></div>;
  }

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex" }}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{th ? "คู่มือการใช้งาน CRM" : "CRM user manual"}</span>
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <CrmHelpButton />
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <div className="crm-content">
          <div className="subbar">
            <div className="company-pick" style={{ cursor: "pointer" }} onClick={() => nav("/customer")}><ArrowLeft size={15} />{th ? "ไปข้อมูลลูกค้า" : "To customers"}</div>
            <div className="u-spacer" />
          </div>

          <div className="crm-body">
            <div className="man-page">
              {/* สารบัญ */}
              <aside className="man-toc">
                <div className="man-toc-h">{th ? "คู่มือการใช้งาน CRM" : "CRM user manual"}</div>
                {!key && <button className="man-toc-item" onClick={() => go("intro")}>{th ? "บทนำ — ระบบทำอะไรได้" : "Intro — what it does"}</button>}
                {SECTIONS.map((s) => (
                  <button key={s.id} className="man-toc-item" onClick={() => go(s.id)}>{th ? s.th : s.en}</button>
                ))}
              </aside>

              {/* เนื้อหา */}
              <div className="man-content">
                <div className="man-search man-search-lg">
                  <Search size={15} />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={th ? "ค้นหาวิธีทำ เช่น “เพิ่มลูกค้า”, “แชร์ตะกร้า”…" : "Search how-to, e.g. \"add customer\"…"} />
                </div>

                {!key && (
                  <section id="man-intro" className="man-block man-intro">
                    <h2 className="man-block-h">{th ? "ระบบนี้ทำอะไรได้บ้าง" : "What this system can do"}</h2>
                    <p className="man-lead">{th ? INTRO.leadTh : INTRO.leadEn}</p>
                    <ul className="man-caps">
                      {(th ? INTRO.bulletsTh : INTRO.bulletsEn).map((b, i) => {
                        const idx = b.indexOf("—");
                        return idx < 0
                          ? <li key={i}>{b}</li>
                          : <li key={i}><b className="man-cap-name">{b.slice(0, idx).trim()}</b> — {b.slice(idx + 1).trim()}</li>;
                      })}
                    </ul>
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>{th ? INTRO.hintTh : INTRO.hintEn}</div>
                  </section>
                )}

                {sections.length === 0 && <div className="muted" style={{ padding: 20 }}>{th ? "ไม่พบวิธีทำที่ค้น" : "No matching how-to"}</div>}

                {sections.map((s) => (
                  <section key={s.id} id={`man-${s.id}`} className="man-block">
                    <h2 className="man-block-h">{th ? s.th : s.en}</h2>
                    {(s.noteTh || s.noteEn) && <p className="man-note">{th ? s.noteTh : s.noteEn}</p>}
                    {s.tasks.map((tk, i) => (
                      <div className="man-task" key={i}>
                        <div className="man-task-q">{th ? tk.qTh : tk.qEn}</div>
                        <ol className="man-steps">
                          {(th ? tk.stepsTh : tk.stepsEn).map((st, j) => <li key={j}>{st}</li>)}
                        </ol>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
