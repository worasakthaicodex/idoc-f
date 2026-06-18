import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Search, Building, ArrowLeft } from "../../shared/icons";
import { getSession } from "../../shared/session";
import AccTopbar from "./AccTopbar";
import CostCenterSide from "./CostCenterSide";
import { loadCostCenters, ccStatusLabel, ccStatusCancelled } from "./costCenterStore";
import "../customer/customer.css";

/** เมนู "Cost Center" — ตารางดูรายการ + ปุ่มเพิ่มด้านบน (กดเพิ่ม = ไปฟอร์มขอเพิ่ม) */
export default function CostCenterPage() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const thai = i18n.language.startsWith("th");
  const T = (a: string, b: string) => (thai ? a : b);
  const session = getSession();
  const [rows] = useState(() => loadCostCenters());
  const [q, setQ] = useState("");

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err"><Building size={15} />{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}><ArrowLeft size={15} />{t("custForm.goLogin")}</button></div></div>;
  }

  const s = q.trim().toLowerCase();
  const filtered = rows.filter((c) => !s || c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s));

  return (
    <div className="p-crm">
      <AccTopbar />
      <div className="crm-main">
        <CostCenterSide active="manage" />
        <div className="crm-content">
          <div className="subbar">
            <div className="company-pick"><Building size={15} />Cost Center</div>
            <div className="u-spacer" />
            <div className="fields" onClick={() => nav("/accounting/cost-center/requests/new?topic=ADD")}><Plus size={16} />{T("เพิ่ม Cost Center", "Add Cost Center")}</div>
          </div>

          <div className="crm-body">
            <div className="card">
              <div className="ch">
                <div className="req-search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("ค้นหา รหัส / ชื่อ", "Search code / name")} /></div>
                <span className="muted">{filtered.length} {T("รายการ", "items")}</span>
              </div>
              <table className="data-grid">
                <thead><tr>
                  <th>Cost Center</th><th>{T("ชื่อ", "Name")}</th><th>CC Category</th><th>Company Code</th><th>Currency</th><th>{T("สถานะ", "Status")}</th>
                </tr></thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr className="empty-row"><td colSpan={6}>{T("ยังไม่มี Cost Center — กด “เพิ่ม Cost Center” ด้านบน", "No Cost Centers yet — click “Add Cost Center” above")}</td></tr>
                  ) : filtered.map((c) => (
                    <tr key={c.code}>
                      <td className="docno">{c.values.costCenter || c.code}</td>
                      <td>{c.name}</td>
                      <td>{c.values.ccCategory || "—"}</td>
                      <td>{c.values.companyCode || "—"}</td>
                      <td>{c.values.currency || "—"}</td>
                      <td><span className={`chip ${ccStatusCancelled(c.status) ? "red" : "green"}`}>{ccStatusLabel(c.status, thai)}</span></td>
                    </tr>
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
