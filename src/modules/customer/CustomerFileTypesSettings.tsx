import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, ArrowLeft, FileText, Save } from "../../shared/icons";
import CrmHelpButton from "./CrmHelpButton";
import LangSwitcher from "../../shared/LangSwitcher";
import CustomerSide from "./CustomerSide";
import { getAttachFileTypes, setAttachFileTypes } from "../sales/salesCloseConfig";
import "./customer.css";

/** ตั้งค่า "ชนิดไฟล์แนบ" (ใช้ร่วมทั้งเครื่องมือไฟล์แนบลูกค้า + ไฟล์บังคับก่อนปิดการขาย) */
export default function CustomerFileTypesSettings() {
  const nav = useNavigate();
  const { i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const L = (t: string, e: string) => (th ? t : e);
  const session = getSession();
  const [types, setTypes] = useState<string[]>(() => getAttachFileTypes());
  const [val, setVal] = useState("");
  const [msg, setMsg] = useState("");

  if (!session) return <div className="p-crm"><div className="crm-body"><div className="banner err">{L("กรุณาเข้าสู่ระบบ", "Please log in")}</div></div></div>;

  const add = () => { const v = val.trim(); if (!v || types.includes(v)) return; setTypes((s) => [...s, v]); setVal(""); setMsg(""); };
  const remove = (v: string) => { setTypes((s) => s.filter((x) => x !== v)); setMsg(""); };
  const save = () => { setAttachFileTypes(types); setMsg(L("บันทึกแล้ว ✓", "Saved ✓")); window.setTimeout(() => setMsg(""), 3000); };

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} onClick={() => nav("/app")}>iDoc ERP</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{L("ลูกค้า", "Customer")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <CrmHelpButton />
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <CustomerSide active="settings" />
        <div className="crm-content">
          <div className="subbar">
            <div className="fields" onClick={() => nav("/customer/settings")}><ArrowLeft size={16} />{L("ตั้งค่า CRM", "CRM settings")}</div>
            <div className="vsep" />
            <div className="company-pick"><FileText size={15} /><b style={{ color: "var(--txt)" }}>{L("ชนิดไฟล์แนบ", "Attachment file types")}</b></div>
          </div>

          <div className="crm-body">
            <div className="card">
              <div className="sh"><FileText size={15} />{L("ชนิดไฟล์แนบ", "File types")} <span className="ff-count" style={{ marginLeft: 6 }}>{types.length}</span></div>
              <div style={{ padding: "6px 2px 12px", color: "var(--txt2)", fontSize: 13 }}>
                {L("ชุดชนิดไฟล์นี้ใช้ตอนแนบไฟล์ในเครื่องมือ \"ไฟล์แนบ\" ของลูกค้า และใช้กำหนด \"ไฟล์บังคับก่อนปิดการขาย\" (เลือกจากชุดนี้ ไม่ต้องพิมพ์เอง)", "Used by the customer attachment tool and the required-files-before-close setting.")}
              </div>
              <div className="opt-chips">
                {types.map((v) => (
                  <span key={v} className="opt-chip">{v}<button type="button" onClick={() => remove(v)}>×</button></span>
                ))}
                <input className="opt-add" value={val} placeholder={L("เพิ่มชนิดไฟล์…", "Add type…")}
                  onChange={(e) => setVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
                <button className="btn primary" onClick={save}><Save size={15} />{L("บันทึก", "Save")}</button>
                {msg && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--green, #1f7a44)" }}>{msg}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
