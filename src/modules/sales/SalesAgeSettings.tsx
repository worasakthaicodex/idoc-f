import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, Help, ArrowLeft, Save } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import SalesSide from "./SalesSide";
import { getAgeMap, setAgeMap, AGE_DOCS, DEFAULT_AGE, type AgeMap } from "./salesAge";
import "../customer/customer.css";

const DOC_LABEL: Record<string, { th: string; en: string }> = {
  CL: { th: "ลูกค้ามุ่งหวัง (CL)", en: "Leads (CL)" },
  FO: { th: "ใบเปิดโอกาส (FO)", en: "Opportunity (FO)" },
  QT: { th: "ใบเสนอราคา (QT)", en: "Quotation (QT)" },
};

/** ตั้งค่าอายุเอกสาร (วัน) — เริ่มนับเมื่ออยู่ในกล่องรอดำเนินการ */
export default function SalesAgeSettings() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const session = getSession();

  const [map, setMap] = useState<AgeMap>(() => ({ ...DEFAULT_AGE, ...getAgeMap() }));
  const [dirty, setDirty] = useState(false);
  const set = (doc: string, v: string) => { setMap((m) => ({ ...m, [doc]: Math.max(0, Number(v) || 0) })); setDirty(true); };
  const save = () => { setAgeMap(map); nav("/sales/settings"); };

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err">{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("custForm.goLogin")}</button></div></div>;
  }

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>iDoc ERP</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{th ? "อายุเอกสาร" : "Document age"}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <SalesSide active="settings" />

        <div className="crm-content">
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav("/sales/settings")}><ArrowLeft /><span>{t("custForm.back")}</span></div>
            <div className="tbsep" />
            <div className="tbtn primary" onClick={save}><Save /><span>{t("custForm.save")}</span></div>
            {dirty && <span style={{ marginLeft: 12, fontSize: 12, color: "#b28600", whiteSpace: "nowrap" }}>● {t("custFields.unsaved")}</span>}
          </div>

          <div className="crm-body">
            <div className="set-head">{th ? "อายุเอกสาร (วัน)" : "Document age (days)"}</div>
            <div className="set-sub">{th ? "เริ่มนับถอยหลังเมื่อเอกสารเข้ากล่อง “รอดำเนินการ” — เกินกำหนดถือว่าหมดอายุ" : "Counts down once a doc enters the 'In progress' box — past it = expired"}</div>

            <div className="card">
              <div style={{ padding: "8px 16px 16px" }}>
                {AGE_DOCS.map((doc) => (
                  <div className="field" key={doc} style={{ alignItems: "center" }}>
                    <label>{th ? DOC_LABEL[doc].th : DOC_LABEL[doc].en}</label>
                    <div className="ctrl" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="number" min={0} value={map[doc] ?? ""} onChange={(e) => set(doc, e.target.value)} style={{ maxWidth: 120 }} />
                      <span style={{ fontSize: 12.5, color: "var(--txt2)" }}>{th ? "วัน" : "days"}</span>
                      {doc === "CL" && <span style={{ fontSize: 11.5, color: "var(--txt3)" }}>{th ? "· ผู้ใช้ปรับเองได้ที่ฟอร์ม CL (กรอบเวลา CL) ถ้าไม่ใส่ใช้ค่านี้" : "· CL form can override (timeframe); else this default"}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="set-hint" style={{ padding: "4px 2px" }}>{th ? "SO ไม่มีอายุ (สุดเส้นทาง)" : "SO has no age (end of path)"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
