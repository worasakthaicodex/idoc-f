import { registerNotifProvider, type AppNotif } from "../../shared/notifications";
import { loadClDocs } from "./clRequests";
import { getSession } from "../../shared/session";

/**
 * แหล่งแจ้งเตือนของงานขาย — เอกสาร CL/FO/QT/SO ที่อยู่ "กล่องรับเข้า" (ถูกส่ง/ตีกลับมา ยังไม่กดรับ)
 *  - ผู้รับ: ใบรอรับ (เกิน 1 วัน = ขึ้นเป็น "เกินกำหนด")
 *  - ผู้ส่ง: เตือนเมื่อผู้รับยังไม่รับเกิน 1 วัน
 * โผล่บนกระดิ่งทุกหน้า + หน้า /inbox · กดแล้วไปที่ "กล่องงาน" ของชนิดนั้น
 */
const me = (): string => { const s = getSession(); return s?.fullName || s?.email || s?.companyCode || ""; };
const SALES_DOCS = ["CL", "FO", "QT", "SO"] as const;
const DAY = 86_400_000;

registerNotifProvider(() => {
  const m = me();
  if (!m) return [];
  const now = Date.now();
  const out: AppNotif[] = [];
  for (const doc of SALES_DOCS) {
    for (const r of loadClDocs(doc)) {
      if (r.phase !== "RECEIVE" || r.received || !r.sent) continue; // อยู่กล่องรับเข้า ยังไม่กดรับ (รวมใบตีกลับ)
      const rc = r.sent.recipients;
      const forMe = !rc || rc.length === 0 || rc.includes(m);
      const sentAt = r.sent.at ?? r.savedAt;
      const waitedDays = Math.floor((now - sentAt) / DAY);
      const overdue = waitedDays >= 1;
      const cust = r.values?.customerName || r.values?.customerCode || r.title || "";
      const to = `/sales/${doc.toLowerCase()}`;
      const tag = r.bounce ? "↩ ถูกตีกลับ" : "";
      // ผู้รับ: ใบรอรับ (เกิน 1 วัน → เร่ง)
      if (forMe) {
        out.push({
          id: `sales-in-${doc}-${r.code}`,
          kind: overdue ? "docOverdue" : "docIncoming",
          primary: `${doc} ${r.code}`,
          secondary: [cust, tag, overdue ? `รอรับ ${waitedDays} วัน` : ""].filter(Boolean).join(" · "),
          to, at: sentAt,
        });
      }
      // ผู้ส่ง: เตือนเมื่อผู้รับยังไม่รับเกิน 1 วัน (ไม่ซ้ำกับกรณีส่งหาตัวเอง)
      if (overdue && r.sent.by === m && !forMe) {
        out.push({
          id: `sales-out-${doc}-${r.code}`,
          kind: "docWaitingReceiver",
          primary: `${doc} ${r.code}`,
          secondary: [cust, `ผู้รับยังไม่รับ ${waitedDays} วัน`].filter(Boolean).join(" · "),
          to, at: sentAt,
        });
      }
    }
  }
  return out;
});
