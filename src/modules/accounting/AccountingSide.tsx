import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Box, BarChart, Shield } from "../../shared/icons";

/** เมนูซ้ายโมดูลบัญชี (ชุดเดียวกับ /accounting) — ใช้ร่วม ตั้งค่า/workflow/หน้าในโมดูล */
export default function AccountingSide({ active }: { active: "cost-center" | "reports" | "settings" }) {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  return (
    <div className="crm-side">
      <div className="side-title">{t("home.tiles.accounting.title")}</div>
      <div className={`side-item${active === "cost-center" ? " active" : ""}`} onClick={() => nav("/accounting/cost-center")}>
        <Box size={17} /><span>Cost center</span>
      </div>
      <div className={`side-item${active === "reports" ? " active" : ""}`} onClick={() => nav("/accounting")}>
        <BarChart size={17} /><span>{th ? "รายงาน" : "Reports"}</span>
      </div>
      <div className="side-divider" />
      <div className={`side-item${active === "settings" ? " active" : ""}`} onClick={() => nav("/accounting/settings")}>
        <Shield size={17} /><span>{th ? "ตั้งค่า" : "Settings"}</span>
      </div>
    </div>
  );
}
