import { Route } from "react-router-dom";
import Landing from "./Landing";
import Login from "./Login";

/** เว็บหลัก (public) + เข้าสู่ระบบ */
export const siteRoutes = [
  <Route key="landing" path="/" element={<Landing />} />,
  <Route key="login" path="/login" element={<Login />} />,
];
