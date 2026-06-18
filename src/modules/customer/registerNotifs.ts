import { registerNotifProvider } from "../../shared/notifications";
import { incomingRequests } from "./customerRequests";

/**
 * แหล่งแจ้งเตือนของ CRM — ใบ "คำขอดำเนินการ" ที่รอรับ (ถูกส่งมา ยังไม่กดรับ)
 * โผล่บนกระดิ่งที่ /app · กดแล้วเด้งไปเปิดใบนั้น
 */
registerNotifProvider(() =>
  incomingRequests().map((r) => ({
    id: `req-${r.code}`,
    kind: "reqIncoming",
    primary: r.code,
    secondary: r.customer,
    to: `/customer/requests/${encodeURIComponent(r.code)}`,
    at: r.sent?.at ?? r.savedAt,
  })),
);
