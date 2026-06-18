import { useTranslation } from "react-i18next";
import { Help } from "../../shared/icons";

/** ปุ่ม "?" บน topbar ของ CRM — เปิดคู่มือใน "แท็บใหม่" (ดูคู่กับหน้างานได้) */
export default function CrmHelpButton() {
  const { i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  return (
    <div className="ic" style={{ cursor: "pointer" }} title={th ? "คู่มือการใช้งาน (เปิดแท็บใหม่)" : "User manual (new tab)"} onClick={() => window.open("/customer/manual", "_blank", "noopener")}><Help /></div>
  );
}
