import { Navigate, Route } from "react-router-dom";
import CompaniesPage from "./CompaniesPage";
import { isPlatformOwner } from "../../shared/session";

/** เข้าได้เฉพาะเจ้าของระบบ (Gmail ที่ fix ไว้) — คนอื่นเด้งกลับหน้าหลัก */
function OwnerOnly() {
  return isPlatformOwner() ? <CompaniesPage /> : <Navigate to="/app" replace />;
}

/** ผู้ดูแลแพลตฟอร์ม (super admin) — ทะเบียนบริษัทที่เช่าใช้ */
export const companiesRoutes = [
  <Route key="companies" path="/admin/companies" element={<OwnerOnly />} />,
];
