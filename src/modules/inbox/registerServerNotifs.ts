import { registerNotifProvider, type AppNotif } from "../../shared/notifications";
import { loadServerNotifs } from "./notifStore";

/**
 * แจ้งเตือนจาก backend ที่เขียนไว้ตอนมีเหตุการณ์ (ส่งเอกสาร/ปิดการขายได้)
 * กดแล้วเปิดเอกสารที่อ้างอิงเลย (QT/FO/SO/CL)
 */
const docTo = (rt?: string | null, rc?: string | null): string => {
  if (rt && rc) {
    if (rt === "QT") return `/sales/qt/${rc}`;
    if (rt === "FO") return `/sales/fo/d/${rc}`;
    if (rt === "SO") return `/sales/so/d/${rc}`;
    if (rt === "CL") return `/sales/cl/${rc}/full`;
  }
  return "/inbox";
};

registerNotifProvider(() =>
  loadServerNotifs().map((n): AppNotif => ({
    id: `srv-${n.id}`,
    kind: n.kind,
    primary: n.title,
    secondary: n.body || "",
    to: docTo(n.refType, n.refCode),
    at: new Date(n.createdAt).getTime() || Date.now(),
  })),
);
