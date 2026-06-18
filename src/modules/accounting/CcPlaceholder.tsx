import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Mail, ArrowLeft, Building } from "../../shared/icons";
import AccTopbar from "./AccTopbar";
import CostCenterSide from "./CostCenterSide";
import "../customer/customer.css";

/** หน้า placeholder ในพื้นที่ Cost Center (เมนูซ้ายเดิม) — ใช้ซ้ำสำหรับกล่องคำขอที่ยังไม่ได้ทำ */
export default function CcPlaceholder({ active, titleTh, titleEn, descTh, descEn, sap }: {
  active: string; titleTh: string; titleEn: string; descTh: string; descEn: string; sap?: string;
}) {
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
        <CostCenterSide active={active} />
        <div className="crm-content">
          <div className="crm-body">
            <div style={{ display: "grid", placeItems: "center", padding: "72px 20px", textAlign: "center" }}>
              <div style={{ maxWidth: 460 }}>
                <div style={{ display: "inline-flex", padding: 18, borderRadius: 16, background: "var(--sel, #eef2ff)", color: "var(--blue)", marginBottom: 14 }}><Mail size={38} /></div>
                <h2 style={{ margin: "0 0 6px" }}>{T(titleTh, titleEn)}</h2>
                {sap && <div style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 10 }}>≈ {sap} (SAP)</div>}
                <p style={{ color: "var(--txt2)", fontSize: 13.5, lineHeight: 1.6 }}>{T(descTh, descEn)}</p>
                <p style={{ color: "var(--txt3)", fontSize: 12.5 }}>{T("เตรียมไว้ — เดี๋ยวทำฟอร์ม + กล่องคำขอจริงทีหลัง (แบบ Cost Center / Planning)", "Placeholder — request form + box coming later (like Cost Center / Planning)")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
