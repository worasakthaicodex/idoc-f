import { Navigate, Route } from "react-router-dom";
import ModulesPage from "./ModulesPage";
import { isPlatformOwner } from "../../shared/session";

/** ทะเบียนโมดูล — เฉพาะเจ้าของระบบ */
function OwnerOnly() {
  return isPlatformOwner() ? <ModulesPage /> : <Navigate to="/app" replace />;
}

export const catalogRoutes = [
  <Route key="modules" path="/admin/modules" element={<OwnerOnly />} />,
];
