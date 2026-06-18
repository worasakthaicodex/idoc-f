import { Route } from "react-router-dom";
import Home from "./Home";
import CompanyManagePage from "./CompanyManagePage";
import ServerManagePage from "./ServerManagePage";
import ModuleShell from "./ModuleShell";
import CostCenterPage from "../accounting/CostCenterPage";
import CostCenterRequestList from "../accounting/CostCenterRequestList";
import CostCenterRequestForm from "../accounting/CostCenterRequestForm";
import AccountingSettings from "../accounting/AccountingSettings";
import CostCenterFieldsSettings from "../accounting/CostCenterFieldsSettings";
import CostCenterPlanning from "../accounting/CostCenterPlanning";
import CostCenterOverhead from "../accounting/CostCenterOverhead";
import CostCenterPosting from "../accounting/CostCenterPosting";
import CcPlaceholder from "../accounting/CcPlaceholder";
import PlanningRequestList from "../accounting/PlanningRequestList";
import PlanningRequestForm from "../accounting/PlanningRequestForm";

/** โมดูลใหม่ที่ยังไม่มี UI จริง — เลย์เอาต์แบบ /sales (เมนูซ้าย: รายงาน + ตั้งค่า) */
const NEW_MODULES = [
  { key: "accounting", base: "/accounting" },
  { key: "finance", base: "/finance" },
  { key: "pp", base: "/pp" },
  { key: "manufacturing", base: "/manufacturing" },
];

/** หน้ากลาง (workspace หลัง login) — Home/hub เลือกระบบ */
export const commonRoutes = [
  <Route key="home" path="/app" element={<Home />} />,
  <Route key="company-manage" path="/company" element={<CompanyManagePage />} />,
  <Route key="server-manage" path="/server" element={<ServerManagePage />} />,
  ...NEW_MODULES.flatMap((m) => [
    <Route key={`${m.key}-home`} path={m.base} element={<ModuleShell titleKey={m.key} base={m.base} active="reports" />} />,
    // บัญชีมีหน้าตั้งค่าจริง (AccountingSettings) — โมดูลอื่นยังใช้ placeholder
    ...(m.key === "accounting" ? [] : [<Route key={`${m.key}-settings`} path={`${m.base}/settings`} element={<ModuleShell titleKey={m.key} base={m.base} active="settings" />} />]),
  ]),
  <Route key="accounting-settings" path="/accounting/settings" element={<AccountingSettings />} />,
  <Route key="accounting-settings-cc-fields" path="/accounting/settings/cc-fields" element={<CostCenterFieldsSettings />} />,
  // บัญชี — เมนู Cost center (Transaction Codes)
  <Route key="accounting-cost-center" path="/accounting/cost-center" element={<ModuleShell titleKey="accounting" base="/accounting" active="cost-center" />} />,
  // Cost Center area (จาก CC01) — master list + คำขอ + ฟอร์ม
  <Route key="acc-cc-manage" path="/accounting/cost-center/manage" element={<CostCenterPage />} />,
  <Route key="acc-cc-planning" path="/accounting/cost-center/planning" element={<CostCenterPlanning />} />,
  <Route key="acc-cc-posting" path="/accounting/cost-center/posting" element={<CostCenterPosting view="actual" />} />,
  <Route key="acc-cc-posting-auto" path="/accounting/cost-center/posting/auto" element={<CostCenterPosting view="auto" />} />,
  <Route key="acc-cc-posting-req" path="/accounting/cost-center/posting/requests" element={<CcPlaceholder active="posting-req" sap="KB11N" titleTh="คำขอดำเนินการ บันทึกค่าใช้จ่าย" titleEn="Posting action requests" descTh="บันทึกค่าใช้จ่ายจริงด้วยตนเอง ผ่านใบคำขอ (เดินตาม workflow แบบเดียวกับ Cost Center / Planning)" descEn="Post actual costs manually via an action request (same workflow as Cost Center / Planning)" />} />,
  <Route key="acc-cc-overhead" path="/accounting/cost-center/overhead" element={<CostCenterOverhead />} />,
  <Route key="acc-cc-overhead-req" path="/accounting/cost-center/overhead/requests" element={<CcPlaceholder active="overhead-req" sap="KSU5 / KSV5" titleTh="คำขอดำเนินการปันส่วนค่าใช้จ่าย" titleEn="Allocation action requests" descTh="ขอปันส่วนค่าใช้จ่าย Overhead ไปยัง Production CC ผ่านใบคำขอ (เดินตาม workflow)" descEn="Request overhead allocation to production CCs via an action request (workflow)" />} />,
  <Route key="acc-plan-requests" path="/accounting/cost-center/planning/requests" element={<PlanningRequestList />} />,
  <Route key="acc-plan-req-new" path="/accounting/cost-center/planning/requests/new" element={<PlanningRequestForm />} />,
  <Route key="acc-plan-req-view" path="/accounting/cost-center/planning/requests/:code" element={<PlanningRequestForm />} />,
  <Route key="acc-cc-requests" path="/accounting/cost-center/requests" element={<CostCenterRequestList />} />,
  <Route key="acc-cc-req-new" path="/accounting/cost-center/requests/new" element={<CostCenterRequestForm />} />,
  <Route key="acc-cc-req-view" path="/accounting/cost-center/requests/:code" element={<CostCenterRequestForm />} />,
];
