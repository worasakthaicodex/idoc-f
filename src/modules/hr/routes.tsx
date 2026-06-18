import { Route } from "react-router-dom";
import HrPage from "./HrPage";
import EmployeeForm from "./EmployeeForm";
import EmployeeDetail from "./EmployeeDetail";
import PositionForm from "./PositionForm";
import DepartmentForm from "./DepartmentForm";
import DivisionForm from "./DivisionForm";
import HrSettings from "./HrSettings";
import EmployeeFieldsSettings from "./EmployeeFieldsSettings";
import EmployeeFieldOptionsSettings from "./EmployeeFieldOptionsSettings";

/** ระบบบุคคล (HR) — พนักงาน/ตำแหน่ง/แผนก/ฝ่าย (ทุกอย่างแยกเป็นฟอร์มเต็มหน้า) */
export const hrRoutes = [
  <Route key="hr" path="/hr" element={<HrPage />} />,
  <Route key="hr-emp-new" path="/hr/employee/new" element={<EmployeeForm />} />,
  <Route key="hr-emp-detail" path="/hr/employee/:id" element={<EmployeeDetail />} />,
  <Route key="hr-emp-edit" path="/hr/employee/:id/edit" element={<EmployeeForm />} />,
  <Route key="hr-pos-new" path="/hr/position/new" element={<PositionForm />} />,
  <Route key="hr-pos-edit" path="/hr/position/:id" element={<PositionForm />} />,
  <Route key="hr-dept-new" path="/hr/department/new" element={<DepartmentForm />} />,
  <Route key="hr-dept-edit" path="/hr/department/:id" element={<DepartmentForm />} />,
  <Route key="hr-div-new" path="/hr/division/new" element={<DivisionForm />} />,
  <Route key="hr-div-edit" path="/hr/division/:id" element={<DivisionForm />} />,
  <Route key="hr-settings" path="/hr/settings" element={<HrSettings />} />,
  <Route key="hr-settings-fields" path="/hr/settings/fields" element={<EmployeeFieldsSettings />} />,
  <Route key="hr-settings-field-options" path="/hr/settings/field-options" element={<EmployeeFieldOptionsSettings />} />,
];
