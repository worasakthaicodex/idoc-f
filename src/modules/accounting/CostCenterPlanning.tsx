import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { BarChart, ArrowLeft, Building } from "../../shared/icons";
import AccTopbar from "./AccTopbar";
import CostCenterSide from "./CostCenterSide";
import "../customer/customer.css";

/** CC02 · Planning (KP06 + KPF6 รวมกัน) — เตรียมหน้าไว้ก่อน (placeholder) */
export default function CostCenterPlanning() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const thai = i18n.language.startsWith("th");
  const T = (a: string, b: string) => (thai ? a : b);
  const session = getSession();

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err"><Building size={15} />{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}><ArrowLeft size={15} />{t("custForm.goLogin")}</button></div></div>;
  }

  return (
    <div className="p-crm">
      <AccTopbar />
      <div className="crm-main">
        <CostCenterSide active="planning" />
        <div className="crm-content">
          <div className="crm-body">
            <div style={{ display: "grid", placeItems: "center", padding: "72px 20px", textAlign: "center" }}>
              <div style={{ maxWidth: 440 }}>
                <div style={{ display: "inline-flex", padding: 18, borderRadius: 16, background: "var(--sel, #eef2ff)", color: "var(--blue)", marginBottom: 14 }}>
                  <BarChart size={40} />
                </div>
                <h2 style={{ margin: "0 0 6px" }}>CC02 · Planning</h2>
                <div style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 10 }}>≈ KP06 + KPF6 (SAP)</div>
                <p style={{ color: "var(--txt2)", fontSize: 13.5, lineHeight: 1.6 }}>
                  {T("กรอกแผน Cost Element + วางแผน Activity Type/Rate (รวมเป็นหน้าเดียว)",
                     "Enter Cost Element plan + plan activity type/rate (one page)")}
                </p>
                <p style={{ color: "var(--txt3)", fontSize: 12.5 }}>{T("เตรียมหน้าไว้ก่อน — เดี๋ยวทำเนื้อหาจริงทีหลัง", "Placeholder — content coming later")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
