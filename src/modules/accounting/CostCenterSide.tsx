import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Box, Mail, Shield, ArrowLeft, BarChart, ArrowRight, FileText, Refresh } from "../../shared/icons";

/** เมนูซ้ายของพื้นที่ Cost Center */
export default function CostCenterSide({ active }: { active: string }) {
  const nav = useNavigate();
  const { i18n } = useTranslation();
  const thai = i18n.language.startsWith("th");
  const item = (key: string, to: string, Icon: typeof Box, label: string) => (
    <div className={`side-item${active === key ? " active" : ""}`} onClick={() => nav(to)}>
      <Icon size={17} /><span>{label}</span>
    </div>
  );
  return (
    <div className="crm-side">
      <div className="side-title">Cost Center</div>
      <div className="side-item" onClick={() => nav("/accounting/cost-center")}>
        <ArrowLeft size={17} /><span>{thai ? "กลับ Transaction Codes" : "Back to Transaction Codes"}</span>
      </div>
      <div className="side-divider" />
      {item("manage", "/accounting/cost-center/manage", Box, "Cost Center")}
      {item("requests", "/accounting/cost-center/requests", Mail, thai ? "คำขอดำเนินการ Cost Center" : "Cost Center requests")}
      {item("planning", "/accounting/cost-center/planning", BarChart, thai ? "วางแผน (Planning)" : "Planning")}
      {item("plan-requests", "/accounting/cost-center/planning/requests", Mail, thai ? "คำขอดำเนินการ (Planning)" : "Planning requests")}
      <div className="side-divider" />
      {/* CC3 — ค่าใช้จ่ายจริง & ปันส่วน Overhead */}
      {item("posting-actual", "/accounting/cost-center/posting", FileText, thai ? "บันทึกค่าใช้จ่าย Actual" : "Post actual costs")}
      {item("posting-auto", "/accounting/cost-center/posting/auto", Refresh, thai ? "บันทึกค่าใช้ Automatic" : "Automatic postings")}
      {item("posting-req", "/accounting/cost-center/posting/requests", Mail, thai ? "คำขอดำเนินการ บันทึกค่าใช้จ่าย" : "Posting requests")}
      {item("overhead", "/accounting/cost-center/overhead", ArrowRight, thai ? "ปันส่วนค่าใช้จ่าย Overhead" : "Overhead allocation")}
      {item("overhead-req", "/accounting/cost-center/overhead/requests", Mail, thai ? "คำขอดำเนินการปันส่วนค่าใช้จ่าย" : "Allocation requests")}
      <div className="side-divider" />
      {item("settings", "/accounting/settings", Shield, thai ? "ตั้งค่า" : "Settings")}
    </div>
  );
}
