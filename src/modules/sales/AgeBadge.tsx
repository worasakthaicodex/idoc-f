import { useTranslation } from "react-i18next";
import { ageInfo } from "./salesAge";

/** ป้ายบอกอายุคงเหลือ/หมดอายุ ของเอกสาร — ใช้ในแผงตรวจทานด้านขวา (CL/FO/QT) */
export default function AgeBadge({ doc, startMs, overrideDays, endMs }: { doc: string; startMs?: number | null; overrideDays?: number; endMs?: number | null }) {
  const { t } = useTranslation();
  const ai = ageInfo(doc, startMs, overrideDays, endMs);
  if (!ai.lifespan) return null;
  const warn = ai.left != null && ai.left <= 3 && !ai.expired;
  // เอกสารปิดแล้ว (frozen): อายุหยุดนับ — โชว์เป็นกลาง (เทา) ว่าใช้เวลาไปกี่วัน ไม่ใช่ "หมดอายุ"
  const color = ai.frozen ? "#5a6470" : ai.expired ? "var(--red)" : warn ? "#b28600" : "#1f7a44";
  const bg = ai.frozen ? "#eef1f4" : ai.expired ? "#fdeaea" : warn ? "#fff7e6" : "#e7f5ec";
  const text = ai.frozen
    ? (ai.used && ai.used > 0
        ? t("salesDoc.ageClosed", { n: ai.used, defaultValue: "ปิดแล้ว · ใช้เวลา {{n}} วัน" })
        : t("salesDoc.ageClosedNoDays", { defaultValue: "ปิดแล้ว" }))   // ไม่มีวันสร้าง/คำนวณไม่ได้ → แค่ "ปิดแล้ว"
    : !ai.started
      ? t("salesDoc.ageNotStarted", { n: ai.lifespan })
      : ai.expired
        ? t("salesDoc.ageExpired", { n: Math.abs(ai.left ?? 0) })
        : t("salesDoc.ageRemaining", { n: ai.left, total: ai.lifespan });
  return <div style={{ background: bg, color, border: `1px solid ${color}40`, borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>{text}</div>;
}
