import { lazy } from "react";
import { Route } from "react-router-dom";

// เปลี่ยนจาก import ธรรมดา มาเป็น lazy load ทั้งหมด
const SalesHome = lazy(() => import("./SalesHome"));
const SalesSettings = lazy(() => import("./SalesSettings"));
const SalesFieldsSettings = lazy(() => import("./SalesFieldsSettings"));
const SalesFieldOptionsSettings = lazy(() => import("./SalesFieldOptionsSettings"));
const SalesCloseSettings = lazy(() => import("./SalesCloseSettings"));
const SalesWorkboxSettings = lazy(() => import("./SalesWorkboxSettings"));
const SalesAgeSettings = lazy(() => import("./SalesAgeSettings"));
const SalesDocuments = lazy(() => import("./SalesDocuments"));
const SalesClForm = lazy(() => import("./SalesClForm"));
const SalesFoForm = lazy(() => import("./SalesFoForm"));
const QtDetail = lazy(() => import("./QtDetail"));
const ClReport = lazy(() => import("./ClReport"));
const SalesPrint = lazy(() => import("./SalesPrint"));
const SalesReportsPage = lazy(() => import("./SalesReportsPage"));
const SalesReportsRealtime = lazy(() => import("./SalesReportsRealtime"));
const SalesReportDetail = lazy(() => import("./SalesReportDetail"));

/** ระบบงานขาย (Sales) */
export const salesRoutes = [
  // หน้าแรกโมดูล: 2 เมนู (กล่องงาน · การตั้งค่า)
  <Route key="sales" path="/sales" element={<SalesHome />} />,
  <Route key="sales-settings" path="/sales/settings" element={<SalesSettings />} />,
  <Route key="sales-fields" path="/sales/settings/fields" element={<SalesFieldsSettings />} />,
  <Route key="sales-field-options" path="/sales/settings/field-options" element={<SalesFieldOptionsSettings />} />,
  <Route key="sales-close-settings" path="/sales/settings/close" element={<SalesCloseSettings />} />,
  <Route key="sales-workbox-settings" path="/sales/settings/workbox" element={<SalesWorkboxSettings />} />,
  <Route key="sales-age-settings" path="/sales/settings/age" element={<SalesAgeSettings />} />,
  
  // ฟอร์มสร้าง/แก้ CL (กล่อง CL ใช้ layout เดิมใน SalesDocuments)
  <Route key="sales-cl-new" path="/sales/cl/new" element={<SalesClForm />} />,
  <Route key="sales-cl-doc" path="/sales/cl/d/:code" element={<SalesClForm />} />,
  <Route key="sales-fo-new" path="/sales/fo/new" element={<SalesFoForm />} />,
  <Route key="sales-fo-doc" path="/sales/fo/d/:code" element={<SalesFoForm />} />,
  <Route key="sales-so-new" path="/sales/so/new" element={<SalesFoForm doc="SO" />} />,
  <Route key="sales-so-doc" path="/sales/so/d/:code" element={<SalesFoForm doc="SO" />} />,
  
  // กล่องเอกสารตามขั้น (CL/FO/QT/SO โครงเดียวกัน)
  // หน้าพิมพ์เอกสาร + รายงาน (ต้องมาก่อน /sales/:stage)
  <Route key="sales-print" path="/sales/print/:doc/:code" element={<SalesPrint />} />,
  <Route key="sales-reports" path="/sales/reports" element={<SalesReportsPage />} />,
  <Route key="sales-reports-rt" path="/sales/reports/realtime" element={<SalesReportsRealtime />} />,
  <Route key="sales-reports-h" path="/sales/reports/h/:id" element={<SalesReportDetail />} />,
  <Route key="sales-stage" path="/sales/:stage" element={<SalesDocuments />} />,
  
  // detail ของแต่ละใบ
  <Route key="sales-qt" path="/sales/qt/:id" element={<QtDetail />} />,
  <Route key="sales-cl-full" path="/sales/cl/:id/full" element={<ClReport />} />,
];