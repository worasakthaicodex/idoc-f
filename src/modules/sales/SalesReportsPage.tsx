import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, Help, Building, ArrowLeft, BarChart, Clock, ArrowRight } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import NotifBell from "../../shared/NotifBell";
import SalesSide from "./SalesSide";
import { HIST_REPORTS } from "./salesReportDefs";
import "../customer/customer.css";
import "./sales.css";

/** สารบัญรายงานการขาย — กดเข้าทีละใบ (โหลดเฉพาะรายงานที่เลือก ไม่โหลดทั้งหมดพร้อมกัน) */
export default function SalesReportsPage() {
  const nav = useNavigate();
  const { i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const session = getSession();

  if (!session) return <div className="p-crm"><div className="crm-body"><div className="banner err"><Building size={15} />{th ? "กรุณาเข้าสู่ระบบ" : "Please log in"}</div><button className="btn primary" onClick={() => nav("/login")}><ArrowLeft size={15} />{th ? "ไปหน้าเข้าสู่ระบบ" : "Login"}</button></div></div>;

  const Card = ({ title, desc, to }: { title: string; desc: string; to: string }) => (
    <div className="set-card" onClick={() => nav(to)} style={{ cursor: "pointer" }}>
      <div className="set-card-body">
        <div className="set-card-title">{title}</div>
        <div className="set-card-desc">{desc}</div>
      </div>
      <ArrowRight size={16} />
    </div>
  );

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title="กลับหน้าหลัก" onClick={() => nav("/app")}>iDoc ERP</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{th ? "งานขาย" : "Sales"}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <NotifBell />
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <SalesSide active="reports" />
        <div className="crm-content">
          <div className="subbar">
            <div className="company-pick"><BarChart size={15} />{th ? "รายงานการขาย" : "Sales reports"}</div>
          </div>

          <div className="crm-body">
            <div className="set-head"><Clock size={15} style={{ verticalAlign: -2, marginRight: 6 }} />{th ? "เรียลไทม์ (ตอนนี้)" : "Realtime"}</div>
            <div className="set-grid">
              <Card title={th ? "เรียลไทม์ — ถือครองตอนนี้" : "Realtime — held now"} desc={th ? "ถือครองต่อคน · สถานะ H-W-C · บริการ · มูลค่า QT" : "Held per person · status · service · QT value"} to="/sales/reports/realtime" />
            </div>

            <div className="set-head" style={{ marginTop: 18 }}><BarChart size={15} style={{ verticalAlign: -2, marginRight: 6 }} />{th ? "ไม่เรียลไทม์ (ย้อนหลัง)" : "Historical"}</div>
            <div className="set-sub">{th ? "เลือกช่วงเวลา · รายวัน/สัปดาห์/เดือน/ปี · ระบุรอบตัด · กราฟแท่ง/เส้น" : "Range · day/week/month/year · cycle · bar/line"}</div>
            <div className="set-grid">
              {HIST_REPORTS.map((r) => <Card key={r.id} title={th ? r.title.th : r.title.en} desc={th ? r.desc.th : r.desc.en} to={`/sales/reports/h/${r.id}`} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
