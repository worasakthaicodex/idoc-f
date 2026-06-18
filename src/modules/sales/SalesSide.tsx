import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Box, Shield, BarChart } from "../../shared/icons";
import { canAccessSalesSettings } from "./salesAccess";

/** เมนูซ้ายของโมดูลงานขาย — โครงเดียวกับลูกค้า/สินค้า (active = key ที่ไฮไลต์) */
const MENU: { key: string; Icon: typeof Box; enabled: boolean; to?: string; th: string; en: string }[] = [
  { key: "worklist", Icon: Box, enabled: true, to: "/sales", th: "กล่องงาน", en: "Work box" },
  { key: "reports", Icon: BarChart, enabled: true, to: "/sales/reports", th: "รายงานการขาย", en: "Sales reports" },
];

export default function SalesSide({ active }: { active: string }) {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");

  return (
    <div className="crm-side">
      <div className="side-title">{th ? "งานขาย" : "Sales"}</div>
      {MENU.map((m) => (
        <div
          key={m.key}
          className={`side-item${active === m.key ? " active" : ""}${m.enabled ? "" : " disabled"}`}
          onClick={() => { if (m.to) nav(m.to); }}
        >
          <m.Icon size={17} />
          <span>{th ? m.th : m.en}</span>
          {!m.enabled && <span className="soon">{t("common.soon")}</span>}
        </div>
      ))}
      {canAccessSalesSettings() && (<>
        <div className="side-divider" />
        <div className={`side-item${active === "settings" ? " active" : ""}`} onClick={() => nav("/sales/settings")}>
          <Shield size={17} /><span>{th ? "ตั้งค่า" : "Settings"}</span>
        </div>
      </>)}
    </div>
  );
}
