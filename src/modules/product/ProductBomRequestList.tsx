import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, Help, Plus, Search, ArrowLeft } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import ProductSide from "./ProductSide";
import { loadBomRequests, BOM_STATUSES, bomTopicLabel } from "./bomRequests";
import "../customer/customer.css";

const TONE: Record<string, string> = { "รับเข้า": "blue", "ดำเนินการ": "amber", "ส่งออก": "gray", "เสร็จสิ้น": "green" };
const fmt = (ts: number) => { const d = new Date(ts), p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export default function ProductBomRequestList() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();
  const all = useMemo(() => loadBomRequests(), []);
  const [tab, setTab] = useState<string>(BOM_STATUSES[1]);   // เปิดมาที่ "ดำเนินการ" (งานที่กำลังทำ)
  const [q, setQ] = useState("");

  const tabs = [...BOM_STATUSES];   // 4 กล่อง: รับเข้า · ดำเนินการ · ส่งออก · เสร็จสิ้น (ไม่มี "ทั้งหมด"/"ร่าง")
  const countOf = (s: string) => all.filter((r) => r.status === s).length;
  const rows = all.filter((r) => r.status === tab &&
    (!q.trim() || [r.code, r.itemCode, r.description, r.requester].some((x) => (x || "").toLowerCase().includes(q.toLowerCase()))));

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
        <ProductSide active="bomRequests" />
        <div className="crm-content">
          <div className="subbar">
            <div className="company-pick"><ArrowLeft size={15} style={{ cursor: "pointer" }} onClick={() => nav("/product")} />คำขอดำเนินการสูตรการผลิต (BOM)</div>
            <div className="u-spacer" />
            <div className="fields" onClick={() => nav("/product/bom/requests/new")} style={{ cursor: "pointer" }}><Plus size={16} />สร้างคำขอ BOM</div>
          </div>

          <div className="tabs">
            {tabs.map((s) => (
              <div key={s} className={`tab${tab === s ? " active" : ""}`} onClick={() => setTab(s)}>
                {s}{countOf(s) > 0 && <span className="soon">{countOf(s)}</span>}
              </div>
            ))}
          </div>

          <div className="crm-body">
            <div className="card">
              <div className="ch">
                <div className="req-search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา รหัส/Item/ผู้ขอ" /></div>
                <span className="muted">{rows.length} รายการ</span>
              </div>
              <table className="data-grid">
                <thead><tr><th>รหัสคำขอ</th><th>ประเภทคำขอ</th><th>Item Code</th><th>รายละเอียด</th><th>ประเภท BOM</th><th>ผู้ขอ</th><th>วันที่</th><th>สถานะ</th></tr></thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr className="empty-row"><td colSpan={8} style={{ textAlign: "center", padding: 22, color: "var(--txt3)" }}>ยังไม่มีคำขอ</td></tr>
                  ) : rows.map((r) => (
                    <tr key={r.code} style={{ cursor: "pointer" }} onClick={() => nav(`/product/bom/requests/${encodeURIComponent(r.code)}`)}>
                      <td className="docno">{r.code}</td><td>{bomTopicLabel(r.topic)}</td><td>{r.itemCode}</td><td>{r.description || "—"}</td><td>{r.bomType}</td>
                      <td>{r.requester}</td><td>{fmt(r.savedAt)}</td>
                      <td><span className={`chip ${TONE[r.status] || "gray"}`}>{r.status}</span></td>
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
