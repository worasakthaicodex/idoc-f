import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, Help, Plus, FileText } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import ProductSide from "./ProductSide";
import { loadBomRequests } from "./bomRequests";
import "../customer/customer.css";


/** สูตรการผลิต (BOM) — แสดงสูตรที่ "อนุมัติ/เสร็จสิ้น" แล้วเป็นสูตรใช้งานจริง (มาจากคำขอ BOM) */
export default function ProductBomPage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();
  const boms = useMemo(() => loadBomRequests().filter((r) => r.status === "อนุมัติ" || r.status === "เสร็จสิ้น"), []);

  if (!session) return <div className="p-crm"><div className="crm-body"><div className="banner err">{t("customer.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("customer.goLogin")}</button></div></div>;

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{t("product.title")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <ProductSide active="bom" />
        <div className="crm-content">
          <div className="subbar">
            <div className="company-pick"><FileText size={15} />สูตรการผลิต (BOM)</div>
            <div className="u-spacer" />
            <div className="fields" onClick={() => nav("/product/bom/requests/new")} style={{ cursor: "pointer" }}><Plus size={16} />ขอสร้างสูตรใหม่</div>
          </div>

          <div className="crm-body">
            <div className="card">
              <div className="sh"><FileText size={15} />สูตรที่ใช้งาน (อนุมัติแล้ว)</div>
              <table className="data-grid">
                <thead><tr><th>Item Code</th><th>รายละเอียด</th><th>ประเภท BOM</th><th>หน่วย</th><th>Lot</th><th>ใช้ได้ถึง</th></tr></thead>
                <tbody>
                  {boms.length === 0 ? (
                    <tr className="empty-row"><td colSpan={6} style={{ textAlign: "center", padding: 22, color: "var(--txt3)" }}>ยังไม่มีสูตรที่อนุมัติ — สร้างผ่าน "คำขอดำเนินการสูตรการผลิต (BOM)"</td></tr>
                  ) : boms.map((r) => (
                    <tr key={r.code}><td className="docno">{r.itemCode}</td><td>{r.description || "—"}</td><td>{r.bomType}</td><td>{r.baseUom}</td><td>{r.lotSize}</td><td>{r.validTo || "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
