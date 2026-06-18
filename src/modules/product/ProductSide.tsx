import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Shield } from "../../shared/icons";
import { productMenu } from "./productMenu";

/** เมนูซ้ายใช้ร่วมทุกหน้าของโมดูลสินค้า/บริการ · active = key ที่ไฮไลต์ */
export default function ProductSide({ active }: { active: string }) {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");

  return (
    <div className="crm-side">
      <div className="side-title">{th ? "สินค้าและบริการ" : "Products & Services"}</div>
      {productMenu.map((m) => (
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
      <div className="side-divider" />
      <div className={`side-item${active === "settings" ? " active" : ""}`} onClick={() => nav("/product/settings")}>
        <Shield size={17} /><span>{th ? "ตั้งค่า" : "Settings"}</span>
      </div>
    </div>
  );
}
