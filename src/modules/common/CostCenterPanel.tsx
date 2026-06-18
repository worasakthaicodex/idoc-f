import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

/**
 * เนื้อหาเมนู "Cost center" ของโมดูลบัญชี (/accounting/cost-center)
 * ส่วนที่ 3 — Transaction Codes หลัก · รหัสเราเอง (CCxx) เป็นหลัก + อ้างอิง SAP เล็กๆ
 */
type TCode = { code: string; sap: string; title: string; desc: string; descEn: string; to?: string };

const TCODES: TCode[] = [
  { code: "CC01", sap: "KS01-03", title: "Manage Cost Center", desc: "สร้าง / แก้ไข / ดู Cost Center (รวมเป็นหน้าเดียว)", descEn: "Create / change / display Cost Center (one page)", to: "/accounting/cost-center/manage" },
  { code: "CC02", sap: "KP06+KPF6", title: "Planning", desc: "กรอกแผน Cost Element + วางแผน Activity Type/Rate (รวมเป็นหน้าเดียว)", descEn: "Enter Cost Element plan + plan activity type/rate (one page)", to: "/accounting/cost-center/planning" },
  { code: "CC03", sap: "KB11N / FI · KSU5 / KSV5 · KB24N · KB65", title: "Actual Costs & Overhead Allocation", desc: "บันทึกค่าใช้จ่ายจริง (FI/MM/PP หรือบันทึกเอง) · กลับรายการ/ย้าย CE · ปันส่วน Overhead ไป Production CC ตาม Basis", descEn: "Post actual costs (FI/MM/PP or manual) · reverse/repost · allocate overhead to production CCs by basis", to: "/accounting/cost-center/posting" },
  { code: "CC04", sap: "OKP1", title: "Lock/Unlock Period", desc: "ล็อก/ปลดล็อก Period", descEn: "Lock/unlock posting period" },
  { code: "CC05", sap: "KSB1 · S_ALR_87013611", title: "Cost Reports (Line Items & Variance)", desc: "ดู Line Item ค่าใช้จ่าย + รายงานเปรียบเทียบ Plan / Actual / Variance", descEn: "View cost line items + Plan / Actual / Variance report" },
  { code: "CC06", sap: "KSPI", title: "Calc. Activity Rate", desc: "คำนวณ Activity Rate", descEn: "Calculate activity rates" },
  { code: "CC07", sap: "KO88", title: "Settle Internal Order", desc: "Settle Internal Order", descEn: "Settle internal orders" },
];

export default function CostCenterPanel() {
  const nav = useNavigate();
  const { i18n } = useTranslation();
  const thai = i18n.language.startsWith("th");
  return (
    <div style={{ padding: "20px 24px" }}>
      {/* หัวข้อส่วนที่ 3 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--blue, #2563eb)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 15, flex: "0 0 auto" }}>3</div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{thai ? "Transaction Codes หลัก" : "Main Transaction Codes"}</div>
          <div style={{ fontSize: 12.5, color: "var(--txt3)" }}>{thai ? "รหัส Transaction ที่ใช้บ่อยในระบบ (เทียบ SAP)" : "Frequently used transaction codes (SAP reference)"}</div>
        </div>
      </div>

      {/* กริดการ์ด */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {TCODES.map((t) => (
          <div key={t.code} onClick={() => t.to && nav(t.to)}
            style={{ background: "#fff", border: "1px solid var(--line, #e3e8ef)", borderRadius: 8, padding: "14px 16px", cursor: t.to ? "pointer" : "default" }}
            title={t.to ? (thai ? "เปิด" : "Open") : undefined}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
              <span style={{ color: "var(--blue, #2563eb)", fontWeight: 700, fontSize: 15 }}>{t.code}</span>
              <span style={{ fontSize: 10.5, color: "var(--txt3)" }}>≈ {t.sap} (SAP)</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>{t.title}</div>
            <div style={{ fontSize: 11.5, color: "var(--txt3)", marginTop: 4 }}>{thai ? t.desc : t.descEn}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
