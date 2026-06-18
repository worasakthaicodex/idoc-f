import { Route } from "react-router-dom";
import CustomerPage from "./CustomerPage";
import CustomerGroups from "./CustomerGroups";
import CustomerForm from "./CustomerForm";
import CustomerDetail from "./CustomerDetail";
import CrmSettings from "./CrmSettings";
import CustomerFieldsSettings from "./CustomerFieldsSettings";
import CustomerFieldOptionsSettings from "./CustomerFieldOptionsSettings";
import CustomerStatusSettings from "./CustomerStatusSettings";
import CustomerColumnsSettings from "./CustomerColumnsSettings";
import CustomerSearchFieldsSettings from "./CustomerSearchFieldsSettings";
import CustomerToolsSettings from "./CustomerToolsSettings";
import CustomerReadinessSettings from "./CustomerReadinessSettings";
import CustomerGradeSettings from "./CustomerGradeSettings";
import CustomerFileTypesSettings from "./CustomerFileTypesSettings";
import CustomerRequestForm from "./CustomerRequestForm";
import CustomerRequestList from "./CustomerRequestList";
import CustomerBasket from "./CustomerBasket";
import CustomerActivePage from "./CustomerActivePage";
import CustomerCalendarPage from "./CustomerCalendarPage";
import CustomerReportsPage from "./CustomerReportsPage";
import CustomerManual from "./CustomerManual";

/** โมดูลลูกค้า (CRM) — จัดการข้อมูลลูกค้า (รายการ / รายละเอียด / ฟอร์ม / ตั้งค่า) */
export const customerRoutes = [
  <Route key="customer" path="/customer" element={<CustomerPage />} />,
  <Route key="customer-groups" path="/customer/groups" element={<CustomerGroups />} />,
  <Route key="customer-basket" path="/customer/basket" element={<CustomerBasket />} />,
  <Route key="customer-active" path="/customer/active" element={<CustomerActivePage />} />,
  <Route key="customer-calendar" path="/customer/calendar" element={<CustomerCalendarPage />} />,
  <Route key="customer-reports" path="/customer/reports" element={<CustomerReportsPage />} />,
  <Route key="customer-manual" path="/customer/manual" element={<CustomerManual />} />,
  <Route key="customer-new" path="/customer/new" element={<CustomerForm />} />,
  <Route key="customer-requests" path="/customer/requests" element={<CustomerRequestList />} />,
  <Route key="customer-req-new" path="/customer/requests/new" element={<CustomerRequestForm />} />,
  <Route key="customer-req-edit" path="/customer/requests/:code" element={<CustomerRequestForm />} />,
  <Route key="customer-settings" path="/customer/settings" element={<CrmSettings />} />,
  <Route key="customer-settings-fields" path="/customer/settings/fields" element={<CustomerFieldsSettings />} />,
  <Route key="customer-settings-field-options" path="/customer/settings/field-options" element={<CustomerFieldOptionsSettings />} />,
  <Route key="customer-settings-statuses" path="/customer/settings/statuses" element={<CustomerStatusSettings />} />,
  <Route key="customer-settings-columns" path="/customer/settings/columns" element={<CustomerColumnsSettings />} />,
  <Route key="customer-settings-search" path="/customer/settings/search" element={<CustomerSearchFieldsSettings />} />,
  <Route key="customer-settings-tools" path="/customer/settings/tools" element={<CustomerToolsSettings />} />,
  <Route key="customer-settings-readiness" path="/customer/settings/readiness" element={<CustomerReadinessSettings />} />,
  <Route key="customer-settings-grade" path="/customer/settings/grade" element={<CustomerGradeSettings />} />,
  <Route key="customer-settings-filetypes" path="/customer/settings/filetypes" element={<CustomerFileTypesSettings />} />,
  <Route key="customer-detail" path="/customer/:id" element={<CustomerDetail />} />,
  <Route key="customer-edit" path="/customer/:id/edit" element={<CustomerForm />} />,
];
