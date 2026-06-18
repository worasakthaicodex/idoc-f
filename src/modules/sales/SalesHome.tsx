import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Grid, ChevronDown, Help, ArrowRight } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import NotifBell from "../../shared/NotifBell";
import SalesSide from "./SalesSide";
import { getRoleBoxes } from "../workflow/workflowConfig";
import { getWorkboxByPosition } from "./salesWorkbox";
import { apiFetch } from "../../shared/api";
import { getSession, isPlatformOwner } from "../../shared/session";
import "../customer/customer.css";
import "./sales.css";

/** กล่องงานแบ่งตาม 4 บทบาท (pipeline การขาย) — แต่ละบทบาทดูแลเอกสารช่วงของตัวเอง */
const ROLES: { key: string; code: string; to: string; color: string; th: string; en: string; thD: string; enD: string }[] = [
  { key: "mk", code: "MK", to: "/sales/cl", color: "#0a84ff", th: "การตลาด (MK)", en: "Marketing (MK)", thD: "หาลูกค้ามุ่งหวัง — CL", enD: "Find leads — CL" },
  { key: "telesale", code: "TS", to: "/sales/fo", color: "#5e5ce6", th: "เทเลเซล", en: "Telesale", thD: "โทรติดตาม เปิดโอกาส — FO", enD: "Call & follow-up — FO" },
  { key: "sale", code: "SL", to: "/sales/qt", color: "#34c759", th: "เซล", en: "Sale", thD: "เสนอราคา ปิดการขาย — QT", enD: "Quote & close — QT" },
  { key: "adminsale", code: "AD", to: "/sales/so", color: "#ff9500", th: "แอดมินขาย", en: "Admin Sale", thD: "ออกใบสั่งขาย จัดการเอกสาร — SO", enD: "Orders & docs — SO" },
];

export default function SalesHome() {
  const nav = useNavigate();
  const { i18n } = useTranslation();
  const th = i18n.language.startsWith("th");

  // กรองกล่องงานตามตำแหน่งของผู้ใช้ (ตั้งที่ /sales/settings/workbox) — กันกดผิดกล่อง
  const [shownRoles, setShownRoles] = useState(ROLES);


  
// 🎯 อัปเกรดท่อน useEffect ในหน้า SalesHome เพื่อใช้ประโยชน์จากแคช RAM สูงสุดครับเดฟ
  useEffect(() => {
    const cfg = getWorkboxByPosition();   
    const s = getSession();
    const anyRestricted = Object.values(cfg).some((arr) => (arr?.length || 0) > 0);
    
    if (isPlatformOwner() || s?.role === "COMPANY_OWNER" || !anyRestricted) { 
      setShownRoles(ROLES); 
      return; 
    }
    
    const k = (x?: string) => (x || "").trim().toLowerCase();
    const meKeys = [s?.fullName, s?.email, s?.employeeCode].filter(Boolean).map((v) => k(v as string));
    
    // 🎯 แก้จุดนี้: ประกาศ interface หรือรับโครงสร้างตามที่ API ส่งกลับมาให้ตรงไทป์
    apiFetch<{ content: { fullName?: string; email?: string; employeeCode?: string; position?: string; role?: string }[] }>(
      "/admin/employees?size=300", 
      { tenant: s?.companyId ?? "" } // 👈 ยังคงส่งตั๋วบริษัทตามกติกาของเดฟไว้เพื่อความปลอดภัย
    )
      .then((r) => {
        // ดึงข้อมูลพนักงานเสร็จปุ๊บ ค้นหาตัวเองเพื่อเช็กตำแหน่ง (Position)
        const me = r.content?.find((e) => 
          meKeys.includes(k(e.fullName)) || 
          meKeys.includes(k(e.email)) || 
          meKeys.includes(k(e.employeeCode))
        );
        
        if (me?.role === "COMPANY_OWNER") { 
          setShownRoles(ROLES); 
          return; 
        }
        
        const pos = me?.position;
        // กรองกล่องงานตามสิทธิ์ตำแหน่งพนักงาน
        setShownRoles(ROLES.filter((rr) => { 
          const ps = cfg[rr.key]; 
          return !ps || ps.length === 0 || (!!pos && ps.includes(pos)); 
        }));
      })
      .catch(() => setShownRoles(ROLES)); // ถ้าพังให้ fallback แสดงกล่องทั้งหมดกันเหนียวไว้ก่อน
  }, []);

  // เปิดกล่องงานของบทบาท → ไปกล่อง "แรก" ที่ตั้งไว้ใน role-box (คงบทบาทไว้ผ่าน ?role)
  const openRole = (r: { key: string; to: string }) => {
    const first = getRoleBoxes("sales")[r.key]?.[0];
    const dest = first ? `/sales/${first.toLowerCase()}` : r.to;
    nav(`${dest}?role=${r.key}`);
  };

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
        <NotifBell />
        <div className="ic"><Help /></div>
        <div className="me">A</div>
      </div>

      <div className="crm-main">
        <SalesSide active="worklist" />

        <div className="crm-content">
          <div className="crm-body">
            <div className="set-head">{th ? "กล่องงาน" : "Work box"}</div>
            <div className="set-sub">{th ? "แบ่งตามบทบาท — เลือกกล่องงานของคุณ" : "By role — open your work box"}</div>

            <div className="sales-flow">
              {shownRoles.map((r, i) => (
                <div key={r.key} className="sf-step">
                  <div className="sf-card" onClick={() => openRole(r)}>
                    <div className="sf-code" style={{ background: r.color }}>{r.code}</div>
                    <div className="sf-name">{th ? r.th : r.en}</div>
                    <div className="sf-desc">{th ? r.thD : r.enD}</div>
                  </div>
                  {i < shownRoles.length - 1 && <span className="sf-arrow"><ArrowRight size={18} /></span>}
                </div>
              ))}
              {shownRoles.length === 0 && <div className="set-hint" style={{ padding: "8px 2px" }}>{th ? "ไม่มีกล่องงานสำหรับตำแหน่งของคุณ — ติดต่อผู้ดูแล" : "No work box for your position — contact admin"}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
