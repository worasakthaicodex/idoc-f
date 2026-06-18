import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession, isPlatformOwner, isCompanyOwner } from "../../shared/session";
import { settingsGet, settingsSetAwait } from "../../shared/settingsStore";
import { Grid, ChevronDown, Help, ArrowLeft, Building, Save, Print } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import NotifBell from "../../shared/NotifBell";
import AttachmentBox from "../../shared/AttachmentBox";
import "./companyManage.css";

type Profile = { legalName: string; taxId: string; branch: string; address: string; phone: string; email: string; website: string; note: string };
const KEY = "company.profile";
const blank: Profile = { legalName: "", taxId: "", branch: "", address: "", phone: "", email: "", website: "", note: "" };

/** การจัดการบริษัท — แก้ข้อมูลบริษัท (เก็บต่อบริษัท) + แนบโลโก้ + พิมพ์ข้อมูล */
export default function CompanyManagePage() {
  const nav = useNavigate();
  const { i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const session = getSession();
  const [p, setP] = useState<Profile>(() => ({ ...blank, ...settingsGet<Partial<Profile>>(KEY, {}) }));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const L = (t: string, e: string) => (th ? t : e);
  const set = (k: keyof Profile, v: string) => { setP((s) => ({ ...s, [k]: v })); setMsg(null); };
  const save = async () => {
    setSaving(true);
    const ok = await settingsSetAwait(KEY, p);
    setSaving(false);
    setMsg({ ok, text: ok ? L("บันทึกข้อมูลบริษัทแล้ว ✓", "Company info saved ✓") : L("บันทึกขึ้นเซิร์ฟเวอร์ไม่สำเร็จ (เก็บในเครื่องชั่วคราว)", "Saved locally, server save failed") });
    window.setTimeout(() => setMsg(null), 4000);
  };

  if (!session) return <div className="p-cm"><div style={{ padding: 24 }}>{L("กรุณาเข้าสู่ระบบ", "Please log in")}</div></div>;
  if (isPlatformOwner()) return <Navigate to="/server" replace />; // เจ้าของระบบไม่ใช้หน้านี้ → ไปจัดการ server
  if (!isCompanyOwner()) return <Navigate to="/app" replace />;    // เฉพาะเจ้าของบริษัท (ผู้ดูแล/คนเช่าระบบ) — พนักงานทั่วไปเข้าไม่ได้

  const fields: { k: keyof Profile; th: string; en: string; wide?: boolean; area?: boolean }[] = [
    { k: "legalName", th: "ชื่อจดทะเบียน", en: "Legal name", wide: true },
    { k: "taxId", th: "เลขประจำตัวผู้เสียภาษี", en: "Tax ID" },
    { k: "branch", th: "สาขา", en: "Branch" },
    { k: "phone", th: "โทรศัพท์", en: "Phone" },
    { k: "email", th: "อีเมล", en: "Email" },
    { k: "website", th: "เว็บไซต์", en: "Website" },
    { k: "address", th: "ที่อยู่", en: "Address", wide: true, area: true },
    { k: "note", th: "หมายเหตุ (ท้ายเอกสาร)", en: "Note (doc footer)", wide: true, area: true },
  ];

  return (
    <div className="p-cm">
      <div className="topbar no-print">
        <div className="app" style={{ cursor: "pointer" }} onClick={() => nav("/app")}>iDoc ERP</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{L("การจัดการบริษัท", "Company")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <NotifBell />
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="cm-toolbar no-print">
        <div className="tbtn" onClick={() => nav("/app")}><ArrowLeft /><span>{L("กลับ", "Back")}</span></div>
        <div className="tbtn primary" onClick={() => { if (!saving) save(); }}><Save /><span>{saving ? "…" : L("บันทึก", "Save")}</span></div>
        <div className="tbtn" onClick={() => window.print()}><Print /><span>{L("พิมพ์ข้อมูลบริษัท", "Print")}</span></div>
        {msg && <span style={{ alignSelf: "center", marginLeft: 6, fontSize: 13, fontWeight: 600, color: msg.ok ? "var(--green, #1f7a44)" : "var(--amber, #b28600)" }}>{msg.text}</span>}
      </div>

      <div className="cm-body">
        {/* ฟอร์มแก้ไข (ไม่พิมพ์) */}
        <div className="cm-card no-print">
          <div className="cm-h"><Building size={16} />{L("ข้อมูลบริษัท", "Company info")}</div>
          <div className="cm-base">{session.companyName || "—"} <span className="muted">· {session.companyCode}</span></div>
          <div className="cm-grid">
            {fields.map((f) => (
              <div className={`field-sm${f.wide ? " wide" : ""}`} key={f.k}>
                <label>{th ? f.th : f.en}</label>
                {f.area
                  ? <textarea value={p[f.k]} onChange={(e) => set(f.k, e.target.value)} />
                  : <input value={p[f.k]} onChange={(e) => set(f.k, e.target.value)} />}
              </div>
            ))}
          </div>
        </div>

        {/* โลโก้ & ลายเซ็น — ใช้บนหัว/ท้ายเอกสารพิมพ์ */}
        <div className="cm-card no-print">
          <div className="cm-h"><Building size={16} />{L("โลโก้ & ลายเซ็น (ใช้บนเอกสารพิมพ์)", "Logo & signature (for printed docs)")}</div>
          <div className="cm-grid">
            <div className="field-sm"><label>{L("โลโก้บริษัท", "Company logo")}</label>
              <AttachmentBox ownerType="COMPANY_LOGO" ownerId={session.companyId || ""} accept="image/*" image single
                disabledReason={session.companyId ? "" : L("ไม่มีรหัสบริษัท", "No company id")} />
            </div>
            <div className="field-sm"><label>{L("ลายเซ็นผู้มีอำนาจ", "Authorized signature")}</label>
              <AttachmentBox ownerType="COMPANY_SIGN" ownerId={session.companyId || ""} accept="image/*" image single
                disabledReason={session.companyId ? "" : L("ไม่มีรหัสบริษัท", "No company id")} />
            </div>
          </div>
        </div>

        {/* ใบข้อมูลสำหรับพิมพ์ */}
        <div className="cm-print">
          <div className="cm-print-name">{p.legalName || session.companyName || "—"}</div>
          <div className="cm-print-rows">
            {p.branch && <div><b>{L("สาขา", "Branch")}:</b> {p.branch}</div>}
            {p.taxId && <div><b>{L("เลขผู้เสียภาษี", "Tax ID")}:</b> {p.taxId}</div>}
            {p.address && <div><b>{L("ที่อยู่", "Address")}:</b> {p.address}</div>}
            {p.phone && <div><b>{L("โทร", "Tel")}:</b> {p.phone}</div>}
            {p.email && <div><b>{L("อีเมล", "Email")}:</b> {p.email}</div>}
            {p.website && <div><b>{L("เว็บไซต์", "Web")}:</b> {p.website}</div>}
          </div>
          {p.note && <div className="cm-print-note">{p.note}</div>}
        </div>
      </div>
    </div>
  );
}
