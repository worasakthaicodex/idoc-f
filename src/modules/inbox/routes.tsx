import { Route } from "react-router-dom";
import InboxPage from "./InboxPage";

/** ศูนย์กลาง "เตือน & ปฏิทิน" — ใช้ข้ามทุกโมดูล */
export const inboxRoutes = [
  <Route key="inbox" path="/inbox" element={<InboxPage />} />,
];
