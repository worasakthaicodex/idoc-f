import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getSession } from "./session";

// หน้า public ที่เข้าได้โดยไม่ต้องล็อกอิน (เว็บหลัก + หน้าเข้าสู่ระบบ)
const PUBLIC_PATHS = new Set(["/", "/login"]);

/**
 * ยามเฝ้าเซสชันระดับแอป — login หมดอายุ/หลุด (ไม่มี session) แล้วอยู่หน้าที่ไม่ใช่ public
 * จะถูกดีดกลับไป /login อัตโนมัติทุกหน้า (เดิมแต่ละหน้าโชว์ banner "ยังไม่ล็อกอิน" ค้างไว้เฉย ๆ ไม่เด้ง)
 * platform owner มี companyId="" แต่ยังมี session object → ถือว่าล็อกอินอยู่
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const loggedIn = !!getSession();
  if (!loggedIn && !PUBLIC_PATHS.has(pathname)) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
