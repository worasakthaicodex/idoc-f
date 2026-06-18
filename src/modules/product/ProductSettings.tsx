import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, Help, Box, Columns, Search, Workflow } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import ProductSide from "./ProductSide";
import { getEnabledFields, getColumns, getSearchFields } from "./productConfig";
import { importLegacyProducts } from "./legacyImport";
import "../customer/customer.css";

export default function ProductSettings() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const session = getSession();
  const tenant = session?.companyId ?? "";
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // นำเข้าสินค้า/บริการจากระบบเก่า (ครั้งเดียว) — ใช้ session ปัจจุบัน → tenant ถูกต้อง · กันซ้ำด้วย legacyId
  const runImport = async () => {
    if (busy) return;
    if (!window.confirm(th ? "นำเข้าสินค้า/บริการจากระบบเก่า? รายการที่นำเข้าแล้วจะถูกข้าม" : "Import legacy products/services? Already-imported ones are skipped")) return;
    setBusy(true); setMsg(th ? "กำลังโหลดข้อมูล…" : "Loading…");
    try {
      const r = await importLegacyProducts(tenant, session?.fullName || session?.companyCode || "import",
        (done, x) => setMsg(`${th ? "กำลังนำเข้า" : "Importing"} ${done}/${x.total} · ${th ? "สำเร็จ" : "ok"} ${x.ok} · ${th ? "ข้าม" : "skip"} ${x.skip}${x.fail ? ` · ${th ? "ผิดพลาด" : "fail"} ${x.fail}` : ""}`));
      setMsg(`${th ? "เสร็จสิ้น" : "Done"} · ${th ? "นำเข้า" : "imported"} ${r.ok} · ${th ? "ข้าม" : "skipped"} ${r.skip}${r.fail ? ` · ${th ? "ผิดพลาด" : "failed"} ${r.fail}` : ""}`);
    } catch { setMsg(th ? "นำเข้าไม่สำเร็จ" : "Import failed"); }
    setBusy(false);
  };

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err">{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("custForm.goLogin")}</button></div></div>;
  }

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{t("product.title")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <ProductSide active="settings" />

        <div className="crm-content">
          <div className="crm-body">
            <div className="ios-body">
              <div className="ios-head">
                <div className="ios-title">{th ? "ตั้งค่าสินค้าและบริการ" : "Products & Services settings"}</div>
                <div className="ios-sub">{th ? "ปรับฟิลด์ มุมมองตาราง และการค้นหา ต่อบริษัท" : "Configure fields, table view and search per company"}</div>
              </div>

              <div className="ios-group-title">{th ? "ข้อมูล" : "Data"}</div>
              <div className="ios-group">
                <div className="ios-row link" onClick={() => nav("/product/settings/fields")}>
                  <div className="ios-ic blue"><Box size={16} /></div>
                  <div className="ios-label">{th ? "ฟิลด์ข้อมูล" : "Fields"}</div>
                  <div className="ios-value">{getEnabledFields().length} {th ? "ฟิลด์" : "fields"}</div>
                  <span className="chev">›</span>
                </div>
                <div className="ios-row link" onClick={() => nav("/product/settings/columns")}>
                  <div className="ios-ic" style={{ background: "#ff9500" }}><Columns size={16} /></div>
                  <div className="ios-label">{th ? "มุมมองตาราง (คอลัมน์)" : "Table view (columns)"}</div>
                  <div className="ios-value">{getColumns().length} {th ? "คอลัมน์" : "cols"}</div>
                  <span className="chev">›</span>
                </div>
                <div className="ios-row link" onClick={() => nav("/product/settings/search")}>
                  <div className="ios-ic" style={{ background: "#0a84ff" }}><Search size={16} /></div>
                  <div className="ios-label">{th ? "ตั้งค่าการค้นหา (เต็มพิกัด)" : "Search settings (advanced)"}</div>
                  <div className="ios-value">{getSearchFields().length} {th ? "ฟิลด์" : "fields"}</div>
                  <span className="chev">›</span>
                </div>
              </div>

              <div className="ios-group-title">{th ? "นำเข้าข้อมูล" : "Import data"}</div>
              <div className="ios-group">
                <div className={`ios-row link${busy ? " disabled" : ""}`} onClick={() => !busy && runImport()} style={busy ? { opacity: 0.6, pointerEvents: "none" } : undefined}>
                  <div className="ios-ic" style={{ background: "#34c759" }}><Box size={16} /></div>
                  <div className="ios-label">{th ? "นำเข้าสินค้า/บริการจากระบบเก่า" : "Import products/services from old system"}</div>
                  <div className="ios-value">{busy ? (th ? "กำลังนำเข้า…" : "Importing…") : (th ? "344 รายการ" : "344 items")}</div>
                  <span className="chev">›</span>
                </div>
                {msg && <div style={{ padding: "8px 14px", fontSize: 12.5, color: "var(--txt2)" }}>{msg}</div>}
              </div>

              <div className="ios-group-title">{th ? "ระบบงาน & อัตโนมัติ" : "Workflow & automation"}</div>
              <div className="ios-group">
                <div className="ios-row link" onClick={() => nav("/workflow?module=product")}>
                  <div className="ios-ic" style={{ background: "#5e5ce6" }}><Workflow size={16} /></div>
                  <div className="ios-label">{th ? "Workflow & การอนุมัติ" : "Workflow & approvals"}</div>
                  <span className="chev">›</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
