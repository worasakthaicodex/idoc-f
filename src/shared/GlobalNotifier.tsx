import { useEffect, useRef } from "react";
import { getNotifs, subscribeNotifs, isNotifRead } from "./notifications";
import { armNotifSound, playNotifSound, notifyOS } from "./notifSound";
import { syncCalendarDue } from "../modules/inbox/calendarStore";
import { refreshServerNotifs } from "../modules/inbox/notifStore";
import { startLiveEvents, stopLiveEvents } from "./liveEvents";

// ไม่ poll วนพื้นหลัง — แจ้งเตือนถูก "เขียนไว้" ที่ backend ตอนมีเหตุการณ์ (ส่ง/ปิดชนะ) · อ่านตอนเปิดแอป + push ผ่าน SSE ตอนเปิดหน้าอยู่
// ใบรอรับโหลดสดตอนเข้าหน้างานขายเอง · ปฏิทินถึงกำหนด = วันละครั้ง (TTL ใน syncCalendarDue)
// ช่วงเงียบกลางคืน 22:00–08:00 — ไม่เด้งเสียง/แจ้งเตือน
const QUIET_START = 22;
const QUIET_END = 8;
const inQuiet = () => { const h = new Date().getHours(); return h >= QUIET_START || h < QUIET_END; };

// จำว่า "เคยเด้งเสียงให้ใบไหนแล้ว" — เก็บใน localStorage เพื่อให้จำข้ามรีโหลด/แท็บ
// (เดิมจำใน RAM ของ component → รีโหลดทีก็ลืม → แจ้งเตือนที่ยังไม่อ่านเด้งซ้ำทุกครั้ง = น่ารำคาญ)
const ALERTED_KEY = "idoc.notif.alerted";
const loadAlerted = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(ALERTED_KEY) || "[]") as string[]); } catch { return new Set(); } };
const saveAlerted = (s: Set<string>): void => { try { localStorage.setItem(ALERTED_KEY, JSON.stringify([...s].slice(-3000))); } catch { /* ignore */ } };

/**
 * ตัวแจ้งเตือนกลาง (mount ครั้งเดียวทั้งแอป) — ไม่มี UI
 *  - เล่นเสียงเมื่อมีแจ้งเตือน "ใหม่จริง" (กันเด้งซ้ำของเดิมตอนโหลด)
 *  - เด้ง OS notification เมื่อแท็บอยู่เบื้องหลัง
 *  - ดึงเอกสารขาย/ปฏิทินเป็นระยะ เพื่อจับงานที่เพิ่งถูกส่งมา
 */
export default function GlobalNotifier() {
  const first = useRef(true);

  useEffect(() => {
    armNotifSound(); // ดักการแตะครั้งแรกเสมอ (ปลดล็อกเสียง) — ปลอดภัยแม้ยังไม่ล็อกอิน
  console.log("🚀 [ไซเรน] -> GlobalNotifier กำลัง MOUNT (เริ่มทำงานใหม่ชัวร์ ๆ)");

    const evaluate = () => {
      const all = getNotifs();
      const ids = all.filter((n) => n.id !== "cal-followups").map((n) => n.id);
      const alerted = loadAlerted();   // อ่านสดจาก localStorage → จำข้ามรีโหลด/แท็บ

      // เล่นเสียงเฉพาะ "ใบใหม่จริง" ที่ยังไม่เคยเด้งเสียง (ข้ามรีโหลด) และยังไม่ถูกอ่าน
      // → เปิด/รีโหลดหน้าซ้ำ ของเดิมที่ยังไม่อ่านจะไม่เด้งซ้ำอีก (แก้บัค "ไม่อ่านแล้วดังตลอด")
      const fresh = ids.filter((id) => !alerted.has(id) && !isNotifRead(id));

      if (first.current) {
        first.current = false; // ตั้งต้น — ไม่เล่นเสียงให้ของที่มีอยู่แล้ว
      } else if (fresh.length > 0 && !inQuiet()) {   // ช่วงเงียบกลางคืน: ไม่เด้งเสียง/แจ้งเตือน
        playNotifSound();
        const lead = all.find((n) => fresh.includes(n.id));
        if (lead) notifyOS(lead.primary, lead.secondary);
      }
      // บันทึกว่า "เด้ง/เห็นแล้ว" (รวม first load ที่เงียบไว้ด้วย) → ครั้งหน้าจะไม่เด้งซ้ำ
      if (fresh.length > 0) { fresh.forEach((id) => alerted.add(id)); saveAlerted(alerted); }
    };

    evaluate();
    const unsub = subscribeNotifs(evaluate);

    // ดึง "ครั้งเดียว" ตอนเปิดแอป ให้กระดิ่งมีข้อมูลเริ่มต้น — ไม่มี timer วนพื้นหลัง
    refreshServerNotifs().catch(() => {});     // แจ้งเตือนที่เขียนไว้ (ส่งเอกสาร/ปิดการขายได้)
    syncCalendarDue().catch(() => {});         // ปฏิทินถึงกำหนด (วันละครั้ง via TTL)
    startLiveEvents();                         // SSE — มี event จริงค่อยดึง (ไม่ fetch ตอน connect, กัน storm)

    return () => { 
      console.warn("🚨 [ไซเรน] -> GlobalNotifier กำลัง UNMOUNT (โดนถอดปลั๊กออกเรียบร้อย!)");
      unsub(); stopLiveEvents(); };
  }, []);

  return null;
}
