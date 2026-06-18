import { useEffect, Suspense } from "react"; // ลบ useReducer ออกถ้าไม่ได้ใช้
import { Routes, Route, Navigate } from "react-router-dom";
import { getSession } from "./shared/session";
import { loadSettings } from "./shared/settingsStore";
import { siteRoutes } from "./modules/site/routes";
import { commonRoutes } from "./modules/common/routes";
import { salesRoutes } from "./modules/sales/routes";
import { companiesRoutes } from "./modules/companies/routes";
import { hrRoutes } from "./modules/hr/routes";
import { catalogRoutes } from "./modules/catalog/routes";
import { customerRoutes } from "./modules/customer/routes";
import { productRoutes } from "./modules/product/routes";
import { workflowRoutes } from "./modules/workflow/routes";
import { inboxRoutes } from "./modules/inbox/routes";
import GlobalNotifier from "./shared/GlobalNotifier";
import RequireAuth from "./shared/RequireAuth";
import "./modules/customer/registerNotifs";
import "./modules/inbox/registerServerNotifs";
import "./modules/inbox/registerCalendarNotifs";

import { startLiveEvents, stopLiveEvents } from "./shared/liveEvents";

export default function App() {
  useEffect(() => {
    // 1. โหลด settings (แก้ Error: loadSettings ไม่ได้ถูกใช้)
    if (getSession()?.companyId) { 
      loadSettings(); 
    }

    // 2. เริ่มรัน SSE
    startLiveEvents();

    // 3. ดักฟังสถานะการเปิด/ปิดหน้าจอ
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopLiveEvents();
      } else {
        startLiveEvents();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);

    // 4. Cleanup
    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      stopLiveEvents();
    };
  }, []);

  return (
    <>
      <GlobalNotifier />
      <Suspense fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#666' }}>
          กำลังโหลดหน้าเว็บ...
        </div>
      }>
        <RequireAuth>
          <Routes>
            {siteRoutes}
            {commonRoutes}
            {salesRoutes}
            {companiesRoutes}
            {hrRoutes}
            {catalogRoutes}
            {customerRoutes}
            {productRoutes}
            {workflowRoutes}
            {inboxRoutes}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RequireAuth>
      </Suspense>
    </>
  );
}