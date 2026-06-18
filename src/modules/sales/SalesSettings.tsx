import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Grid, ChevronDown, Help, Workflow, Shield, User, Columns } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import SalesSide from "./SalesSide";
import { getEnabledFields } from "./salesFieldConfig";
import { SALES_DOC_TYPES } from "./salesFields";
import { settingsGet, settingsSet } from "../../shared/settingsStore";
import { canAccessSalesSettings } from "./salesAccess";
import { fieldOptsOf } from "../product/productFields";
import "../customer/customer.css";

export const DETACH_KEY = "sales.form.detachable";
export const isFormDetachable = () => settingsGet<boolean>(DETACH_KEY, false);

/** ประเภทสินค้า (materialType) ที่อนุญาตให้นำมาเสนอราคาในตารางย่อย (QT) — ค่าเริ่มต้น = ทุกประเภท */
export const QUOTE_TYPES_KEY = "sales.quote.itemTypes";
export const ALL_QUOTE_TYPES = fieldOptsOf("materialType");
export const getQuoteItemTypes = (): string[] => settingsGet<string[]>(QUOTE_TYPES_KEY, ALL_QUOTE_TYPES);

/** ป้ายชื่อเอกสารงานขายต่อชนิด (th/en) */
const DOC_LABEL: Record<string, { th: string; en: string }> = {
  CL: { th: "CL · ลูกค้ามุ่งหวัง", en: "CL · Lead" },
  FO: { th: "FO · ใบติดตาม", en: "FO · Follow-up" },
  QT: { th: "QT · ใบเสนอราคา", en: "QT · Quotation" },
  SO: { th: "SO · ใบสั่งขาย", en: "SO · Sales order" },
};

/** ตั้งค่างานขาย — layout เมนูซ้ายเหมือนลูกค้า/สินค้า · Workflow ใช้ engine กลาง (module=sales, เอกสาร CL→FO→QT→SO) */
export default function SalesSettings() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const [detach, setDetach] = useState(() => isFormDetachable());
  const toggleDetach = (on: boolean) => { setDetach(on); settingsSet(DETACH_KEY, on); };
  const [quoteTypes, setQuoteTypes] = useState<string[]>(() => getQuoteItemTypes());
  const toggleQuoteType = (tp: string) => setQuoteTypes((cur) => { const next = cur.includes(tp) ? cur.filter((x) => x !== tp) : [...cur, tp]; settingsSet(QUOTE_TYPES_KEY, next); return next; });

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title="กลับหน้าหลัก" onClick={() => nav("/app")}>iDoc ERP</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title="กลับไปเลือกระบบ" onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{th ? "งานขาย" : "Sales"}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">A</div>
      </div>

      <div className="crm-main">
        <SalesSide active="settings" />

        <div className="crm-content">
          <div className="crm-body">
            <div className="ios-body">
              <div className="ios-head">
                <div className="ios-title">{th ? "ตั้งค่างานขาย" : "Sales settings"}</div>
                <div className="ios-sub">{th ? "ตั้งค่าระบบงาน เอกสาร และสิทธิ์ของงานขาย" : "Configure workflow, documents and permissions"}</div>
              </div>

              {!canAccessSalesSettings() && (
                <div className="ios-group"><div className="ios-row"><div className="ios-ic gray"><Shield size={16} /></div><div className="ios-label" style={{ color: "var(--red)" }}>{th ? "เฉพาะผู้ดูแลสูงสุดของงานขายเท่านั้น" : "Sales super-admin only"}</div></div></div>
              )}
              {canAccessSalesSettings() && (<>

              <div className="ios-group-title">{th ? "ฟิลด์เอกสาร (Document fields)" : "Document fields"}</div>
              {SALES_DOC_TYPES.map((doc) => (
                <div className="ios-group" key={doc} style={{ marginBottom: 10 }}>
                  <div className="ios-row link" onClick={() => nav(`/sales/settings/fields?doc=${doc}`)}>
                    <div className="ios-ic blue"><User size={16} /></div>
                    <div className="ios-label">{th ? DOC_LABEL[doc].th : DOC_LABEL[doc].en}</div>
                    <div className="ios-value">{t("custFields.selected", { n: getEnabledFields(doc).length })}</div>
                    <span className="chev">›</span>
                  </div>
                  <div className="ios-row link" onClick={() => nav(`/sales/settings/field-options?doc=${doc}`)}>
                    <div className="ios-ic" style={{ background: "#ff9500" }}><Columns size={16} /></div>
                    <div className="ios-label">{th ? "ตัวเลือกฟิลด์" : "Field options"}</div>
                    <span className="chev">›</span>
                  </div>
                </div>
              ))}

              <div className="ios-group-title">{th ? "ระบบงาน & อัตโนมัติ" : "Workflow & automation"}</div>
              <div className="ios-group">
                <div className="ios-row link" onClick={() => nav("/workflow?module=sales")}>
                  <div className="ios-ic" style={{ background: "#5e5ce6" }}><Workflow size={16} /></div>
                  <div className="ios-label">{th ? "Workflow & การอนุมัติ" : "Workflow & approvals"}</div>
                  <div className="ios-value">CL · FO · QT · SO</div>
                  <span className="chev">›</span>
                </div>
                <div className="ios-row link" onClick={() => nav("/sales/settings/close")}>
                  <div className="ios-ic" style={{ background: "#1f7a44" }}><Shield size={16} /></div>
                  <div className="ios-label">{th ? "การปิดการขาย (QT)" : "Deal closing (QT)"}</div>
                  <div className="ios-value">{th ? "กลยุทธ · สาเหตุ · ไฟล์บังคับ" : "strategy · reasons · files"}</div>
                  <span className="chev">›</span>
                </div>
                <div className="ios-row link" onClick={() => nav("/sales/settings/workbox")}>
                  <div className="ios-ic" style={{ background: "#0a84ff" }}><Grid size={16} /></div>
                  <div className="ios-label">{th ? "กล่องงานตามตำแหน่ง" : "Work box by position"}</div>
                  <div className="ios-value">{th ? "เลือกกล่องที่แต่ละตำแหน่งเห็น" : "boxes visible per position"}</div>
                  <span className="chev">›</span>
                </div>
                <div className="ios-row link" onClick={() => nav("/sales/settings/age")}>
                  <div className="ios-ic" style={{ background: "#ff9500" }}><Workflow size={16} /></div>
                  <div className="ios-label">{th ? "อายุเอกสาร (CL/FO/QT)" : "Document age (CL/FO/QT)"}</div>
                  <div className="ios-value">{th ? "วันหมดอายุในกล่องดำเนินการ" : "expiry days in In-progress"}</div>
                  <span className="chev">›</span>
                </div>
              </div>

              <div className="ios-group-title">{th ? "การแสดงผลฟอร์ม" : "Form display"}</div>
              <div className="ios-group">
                <div className="ios-row">
                  <div className="ios-ic" style={{ background: "#5e5ce6" }}><Columns size={16} /></div>
                  <div className="ios-label">{th ? "ดึงกลุ่มข้อมูลออกมาเป็นกล่องลอย (ลากเทียบกันได้)" : "Pop out field groups as floating panels"}</div>
                  <label className="ios-switch">
                    <input type="checkbox" checked={detach} onChange={(e) => toggleDetach(e.target.checked)} />
                    <span />
                  </label>
                </div>
              </div>
              <div className="ios-group-footer">{th ? "เปิดแล้วในฟอร์มเอกสาร (FO/QT) จะมีปุ่ม ⧉ ที่แต่ละแท็บ กดเพื่อดึงกลุ่มนั้นออกมาเป็นกล่องลอย ลากไปดูเทียบกันได้" : "Adds a ⧉ button on each tab to detach that group into a draggable panel."}</div>

              <div className="ios-group-title">{th ? "การเสนอราคา — ประเภทสินค้าที่นำมาเสนอได้" : "Quoting — allowed item types"}</div>
              <div className="ios-group">
                {ALL_QUOTE_TYPES.map((tp) => (
                  <div className="ios-row" key={tp}>
                    <div className="ios-ic" style={{ background: "#34c759" }}><Grid size={16} /></div>
                    <div className="ios-label">{tp}</div>
                    <label className="ios-switch">
                      <input type="checkbox" checked={quoteTypes.includes(tp)} onChange={() => toggleQuoteType(tp)} />
                      <span />
                    </label>
                  </div>
                ))}
              </div>
              <div className="ios-group-footer">{th
                ? "ติ๊กเฉพาะประเภทที่อยากให้ค้นเจอในตารางย่อยใบเสนอราคา (QT) · สินค้าที่ระบุประเภทอื่นจะถูกซ่อนตอนค้น (สินค้าที่ยังไม่ระบุประเภทยังค้นเจอได้)"
                : "Only checked types appear in the QT item picker. Products tagged with other types are hidden (untyped products still searchable)."}</div>

              <div className="ios-group-title">{th ? "อื่น ๆ" : "Other"}</div>
              <div className="ios-group">
                <div className="ios-row">
                  <div className="ios-ic" style={{ background: "#0a84ff" }}><Shield size={16} /></div>
                  <div className="ios-label">{th ? "สิทธิ์ & ทีมขาย (MK / Telesale / Sale / AdminSale)" : "Permissions & teams"}</div>
                  <span className="ios-value">{t("common.soon")}</span>
                </div>
              </div>
              </>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
