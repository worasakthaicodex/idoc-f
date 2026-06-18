import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, ArrowLeft, Hexagon, Save } from "../../shared/icons";
import CrmHelpButton from "./CrmHelpButton";
import LangSwitcher from "../../shared/LangSwitcher";
import CustomerSide from "./CustomerSide";
import { getGradeConfig, setGradeConfig, runGradeCut, nextCutDue, type GradeConfig, type Grade } from "./customerGradeConfig";
import "./customer.css";
import "../activity/tools.css"; // ใช้คลาส sh-table / sh-badge

export default function CustomerGradeSettings() {
  const nav = useNavigate();
  const { i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const L = (t: string, e: string) => (th ? t : e);
  const session = getSession();
  const [c, setC] = useState<GradeConfig>(() => getGradeConfig());
  const [saving, setSaving] = useState(false);
  const [cutting, setCutting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!session) return <div className="p-crm"><div className="crm-body"><div className="banner err">{L("กรุณาเข้าสู่ระบบ", "Please log in")}</div></div></div>;

  const setN = (k: keyof GradeConfig, v: string) => { setC((s) => ({ ...s, [k]: Math.max(0, Math.round(Number(v) || 0)) })); setMsg(null); };
  const dateStr = (ms?: number | null) => (ms ? new Date(ms).toLocaleDateString(th ? "th-TH" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—");

  const save = async () => {
    setSaving(true);
    const ok = await setGradeConfig(c);
    setSaving(false);
    setMsg({ ok, text: ok ? L("บันทึกการตั้งค่าแล้ว ✓", "Saved ✓") : L("บันทึกขึ้นเซิร์ฟเวอร์ไม่สำเร็จ", "Server save failed") });
    window.setTimeout(() => setMsg(null), 4000);
  };

  const doCut = async () => {
    if (!window.confirm(L("ตัดเกรดลูกค้าทั้งหมดตอนนี้ตามเกณฑ์นี้? (จะอัปเดตเกรดในข้อมูลลูกค้า)", "Cut grades for all customers now?"))) return;
    setCutting(true); setMsg(null);
    try {
      const r = await runGradeCut(c);
      setC(getGradeConfig()); // ดึง lastCutAt ที่เพิ่งบันทึก
      const d = r.dist;
      setMsg({ ok: true, text: L(
        `ตัดเกรดเสร็จ ✓ ตรวจ ${r.scanned} ราย · เปลี่ยน ${r.changed} ราย · A:${d.A} B:${d.B} C:${d.C} D:${d.D} ไม่ซื้อ:${d.NONE} ใหม่:${d.NEW}`,
        `Done ✓ scanned ${r.scanned}, changed ${r.changed} · A:${d.A} B:${d.B} C:${d.C} D:${d.D} NONE:${d.NONE} NEW:${d.NEW}`) });
    } catch (e) {
      setMsg({ ok: false, text: L("ตัดเกรดไม่สำเร็จ: ", "Grade cut failed: ") + (e as Error).message });
    } finally { setCutting(false); }
  };

  const RULES: { g: Grade; tone: string; desc: string }[] = [
    { g: "A", tone: "green", desc: L(`เปิด SO ตั้งแต่ ${c.aMin} ครั้งขึ้นไป ใน ${c.windowYears} ปี`, `≥ ${c.aMin} SO in ${c.windowYears} yrs`) },
    { g: "B", tone: "blue", desc: L(`เปิด SO ${c.bMin} ครั้ง ใน ${c.windowYears} ปี`, `${c.bMin} SO in ${c.windowYears} yrs`) },
    { g: "C", tone: "amber", desc: L(`เปิด SO ${c.cMin} ครั้ง ใน ${c.windowYears} ปี`, `${c.cMin} SO in ${c.windowYears} yrs`) },
    { g: "D", tone: "gray", desc: L(`เคยเปิด SO แต่ในช่วง ${c.windowYears} ปีไม่มี`, `Had SO but none in ${c.windowYears} yrs`) },
    { g: "NONE", tone: "gray", desc: L("ไม่เคยซื้อ (ติดต่อแล้วแต่ไม่มี SO)", "Never bought") },
    { g: "NEW", tone: "gray", desc: L("ไม่เคยติดต่อ (ไม่มีเอกสารใดเลย)", "Never contacted") },
  ];

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} onClick={() => nav("/app")}>{L("iDoc ERP", "iDoc ERP")}</div>
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
            <div className="company-pick"><Hexagon size={15} /><b style={{ color: "var(--txt)" }}>{L("การตัดเกรดลูกค้า", "Customer grading")}</b></div>
          </div>

          <div className="crm-body">
            <div className="card">
              <div className="sh"><Hexagon size={15} />{L("เกณฑ์การให้เกรด (ปรับได้)", "Grading rules (editable)")}</div>
              <div style={{ padding: "4px 2px 12px", color: "var(--txt2)", fontSize: 13 }}>
                {L("ให้เกรดอัตโนมัติจากจำนวนครั้งที่เปิดใบสั่งขาย (SO) ภายในช่วงปีที่กำหนด", "Auto-grade by number of SO opened within the window")}
              </div>

              <div className="crm-dl" style={{ marginBottom: 12 }}>
                <div className="field-sm" style={{ maxWidth: 220 }}>
                  <label>{L("ช่วงปีที่พิจารณา (ปี)", "Window (years)")}</label>
                  <input type="number" min={1} value={c.windowYears} onChange={(e) => setN("windowYears", e.target.value)} />
                </div>
                <div className="field-sm" style={{ maxWidth: 220 }}>
                  <label>{L("A: SO อย่างน้อย (ครั้ง)", "A: min SO")}</label>
                  <input type="number" min={1} value={c.aMin} onChange={(e) => setN("aMin", e.target.value)} />
                </div>
                <div className="field-sm" style={{ maxWidth: 220 }}>
                  <label>{L("B: SO อย่างน้อย (ครั้ง)", "B: min SO")}</label>
                  <input type="number" min={1} value={c.bMin} onChange={(e) => setN("bMin", e.target.value)} />
                </div>
                <div className="field-sm" style={{ maxWidth: 220 }}>
                  <label>{L("C: SO อย่างน้อย (ครั้ง)", "C: min SO")}</label>
                  <input type="number" min={1} value={c.cMin} onChange={(e) => setN("cMin", e.target.value)} />
                </div>
              </div>

              <table className="sh-table" style={{ marginBottom: 4 }}>
                <tbody>
                  {RULES.map((r) => (
                    <tr key={r.g}>
                      <td style={{ width: 70 }}><span className={`sh-badge ${r.tone}`}>{L("เกรด", "Grade")} {r.g}</span></td>
                      <td>{r.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="sh"><Hexagon size={15} />{L("รอบการตัดเกรด", "Grading cycle")}</div>
              <div className="crm-dl" style={{ marginBottom: 10 }}>
                <div className="field-sm" style={{ maxWidth: 260 }}>
                  <label>{L("ตัดเกรดทุกกี่เดือน", "Cut every (months)")}</label>
                  <input type="number" min={1} value={c.cutMonths} onChange={(e) => setN("cutMonths", e.target.value)} />
                </div>
              </div>
              <div style={{ fontSize: 13, color: "var(--txt2)", lineHeight: 1.9 }}>
                <div>{L("ตัดเกรดล่าสุด", "Last cut")}: <b style={{ color: "var(--txt)" }}>{dateStr(c.lastCutAt)}</b></div>
                <div>{L("ครบกำหนดรอบถัดไป", "Next due")}: <b style={{ color: "var(--txt)" }}>{dateStr(nextCutDue(c))}</b></div>
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button className="btn primary" disabled={saving} onClick={save}><Save size={15} />{saving ? "…" : L("บันทึกการตั้งค่า", "Save settings")}</button>
                <button className="btn" disabled={cutting} onClick={doCut}><Hexagon size={15} />{cutting ? L("กำลังตัดเกรด…", "Cutting…") : L("ตัดเกรดตอนนี้", "Cut grades now")}</button>
                {msg && <span style={{ fontSize: 13, fontWeight: 600, color: msg.ok ? "var(--green, #1f7a44)" : "var(--red, #c0392b)" }}>{msg.text}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
