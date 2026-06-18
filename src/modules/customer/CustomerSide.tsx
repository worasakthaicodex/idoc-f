import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Shield } from "../../shared/icons";
import { subscribeNotifs } from "../../shared/notifications";
import ModuleDeps from "../../shared/ModuleDeps";
import { customerMenu } from "./customerMenu";
import { incomingCount } from "./customerRequests";
import { canAccessCrmSettings } from "./crmAccess";

/**
 * เมนูซ้ายใช้ร่วมทุกหน้าของโมดูลลูกค้า (รายการ/ฟอร์ม/รายละเอียด/ตั้งค่า)
 * active = key ที่ไฮไลต์ ("core" | ... | "settings")
 * เมนู "คำขอดำเนินการ" โชว์ตัวเลขจำนวนใบที่รอรับ (อัปเดตสด)
 */
export default function CustomerSide({ active }: { active: string }) {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();
  const [pending, setPending] = useState(() => incomingCount());

  useEffect(() => subscribeNotifs(() => setPending(incomingCount())), []);

  return (
    <div className="crm-side">
      <div className="side-title">{t("customer.title")}</div>
      {customerMenu.map((m) => (
        <div
          key={m.key}
          className={`side-item${active === m.key ? " active" : ""}${m.enabled ? "" : " disabled"}`}
          onClick={() => { if (m.to) nav(m.to); }}
        >
          <m.Icon size={17} />
          <span>{t(`customer.menu.${m.key}`)}</span>
          {m.key === "requests" && m.enabled && pending > 0 && <span className="side-count">{pending > 99 ? "99+" : pending}</span>}
          {!m.enabled && <span className="soon">{t("common.soon")}</span>}
        </div>
      ))}
      {canAccessCrmSettings(session) && (
        <>
          <div className="side-divider" />
          <div className={`side-item${active === "settings" ? " active" : ""}`} onClick={() => nav("/customer/settings")}>
            <Shield size={17} /><span>{t("customer.menu.settings")}</span>
          </div>
        </>
      )}
      {/* โมดูลที่ต้องพึ่ง (ข้ามโมดูล) + สถานะพร้อมใช้ — แสดงสถานะอย่างเดียว ไม่กดไปไหน */}
      <ModuleDeps moduleKey="customer" readOnly />
    </div>
  );
}
