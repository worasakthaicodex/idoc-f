import { Route } from "react-router-dom";
import WorkflowPage from "./WorkflowPage";
import WorkflowStagesPage from "./WorkflowStagesPage";
import WorkflowRoutePage from "./WorkflowRoutePage";
import WorkflowAuthorityPage from "./WorkflowAuthorityPage";
import WorkflowNumberingPage from "./WorkflowNumberingPage";
import WorkflowWorkboxPage from "./WorkflowWorkboxPage";

/** ระบบงาน (Workflow) — ตัวกลางคุมคำขอ/การอนุมัติของทุกโมดูล */
export const workflowRoutes = [
  <Route key="workflow" path="/workflow" element={<WorkflowPage />} />,
  <Route key="workflow-numbering" path="/workflow/numbering" element={<WorkflowNumberingPage />} />,
  <Route key="workflow-workbox" path="/workflow/workbox" element={<WorkflowWorkboxPage />} />,
  <Route key="workflow-stages" path="/workflow/stages" element={<WorkflowStagesPage />} />,
  <Route key="workflow-routes" path="/workflow/routes" element={<WorkflowRoutePage />} />,
  <Route key="workflow-auth" path="/workflow/authorities" element={<WorkflowAuthorityPage />} />,
];
