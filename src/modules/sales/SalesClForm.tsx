import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Help, ArrowLeft, Save, Trash, ChevronLeft, FileText } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import ModuleDeps from "../../shared/ModuleDeps";
import { fetchModuleUsers, getIssueEvent, docTypeName } from "../workflow/workflowConfig";

const DOC_TONE: Record<string, string> = { CL: "var(--purple)", FO: "#0a84ff", QT: "var(--green)", SO: "#ff9500" };
import { SALES_GROUPS, fieldsOf, coreKeysOf, type SalesField } from "./salesFields";
import { getEnabledFields, getGroupOverrides, groupOf } from "./salesFieldConfig";
import { getFieldOptions } from "./salesFieldOptions";
import { getClDoc, saveClDoc, deleteClDoc, genClCode, type ClDoc } from "./clRequests";
import "./cl.css";

const MODULE = "sales";
const INP: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid var(--field-bd)", borderRadius: 8, fontSize: 13.5, background: "#fff" };

/** สร้าง/แก้เอกสารงานขาย (CL/FO/QT/SO) — ซ้าย Documents · ขวา ฟอร์ม (ฟิลด์จาก /sales/settings) */
export default function SalesClForm({ doc = "CL" }: { doc?: string }) {
  const DOC = doc;
  const base = `/sales/${DOC.toLowerCase()}`;
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const session = getSession();
  const { code: routeCode } = useParams();

  // ใบใหม่ → ตั้งชื่อชุด/แคมเปญเริ่มต้นให้ (แก้ทับได้)
  const [values, setValues] = useState<Record<string, string>>(() =>
    routeCode ? {} : ({ campaignName: `ชุดรายชื่อ ${new Date().toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" })}` } as Record<string, string>));
  const [existing, setExisting] = useState<ClDoc | null>(null);
  const [users, setUsers] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("idoc.cl.full.collapsed") === "1");
  const toggleTree = () => setCollapsed((c) => { const n = !c; localStorage.setItem("idoc.cl.full.collapsed", n ? "1" : "0"); return n; });

  const enabledKeys = useMemo(() => getEnabledFields(DOC), []);
  const grpOv = useMemo(() => getGroupOverrides(DOC), []);
  useEffect(() => { fetchModuleUsers(MODULE).then(setUsers).catch(() => {}); }, []);
  useEffect(() => {
    if (!routeCode) return;
    const rec = getClDoc(routeCode, DOC);
    if (rec) { setExisting(rec); setValues(rec.values ?? {}); }
  }, [routeCode]);

  const label = (k: string) => t(`salesFields.${k}`, { defaultValue: k });
  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));
  const val = (k: string) => values[k] ?? "";
  const docNo = existing?.code ?? (th ? "เอกสารใหม่" : "New");
  const titleVal = (values[coreKeysOf(DOC)[0] ?? ""] ?? "").trim();
  const docName = docTypeName(DOC, i18n.language);

  // จัดกลุ่มตาม override ที่ลากไว้ + เรียงตามลำดับฟิลด์ที่เปิดใช้
  const groups = SALES_GROUPS
    .map((g) => ({ g, fields: enabledKeys.filter((k) => groupOf(DOC, k, grpOv) === g).map((k) => fieldsOf(DOC).find((f) => f.key === k)).filter(Boolean) as SalesField[] }))
    .filter((x) => x.fields.length > 0);

  const [saving, setSaving] = useState(false);
  const save = async () => {
    const titleKey = coreKeysOf(DOC)[0] ?? "campaignName";
    const title = (values[titleKey] ?? "").trim();
    if (!title) { alert(th ? "กรุณากรอกข้อมูลที่จำเป็น (*)" : "Please fill the required field (*)"); return; }
    // กฎออกเลข (numbering) — CREATE=ออกเลขตอนสร้าง · อื่น ๆ=DRAFT จนถึงเหตุการณ์นั้น (เหมือนใบคำขอ)
    const issueEvent = getIssueEvent(DOC);
    const genDraft = () => `DRAFT-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const code = existing?.code ?? (issueEvent === "CREATE" ? genClCode(DOC) : genDraft());
    setSaving(true);
    const ok = await saveClDoc({
      code,
      title,
      telesale: (values.telesale ?? values.salesperson ?? "").trim(),
      phase: existing?.phase ?? "PROCESS",
      savedAt: Date.now(),
      values: { ...values, createdBy: values.createdBy || (session?.fullName || session?.email || session?.companyCode || "") },
      stageId: existing?.stageId,
      received: existing?.received,
      bounce: existing?.bounce,
      sent: existing?.sent,
    }, DOC);
    setSaving(false);
    if (!ok) { alert(th ? "บันทึกขึ้นเซิร์ฟเวอร์ไม่สำเร็จ — โปรดลองอีกครั้ง" : "Saving to the server failed — please try again"); return; }
    // CL มีหน้าเต็ม (/full) · เอกสารอื่นกลับกล่อง
    nav(DOC === "CL" ? `/sales/cl/${encodeURIComponent(code)}/full` : base);
  };
  const onDelete = () => {
    if (!existing) return;
    if (!window.confirm(th ? "ลบเอกสารนี้?" : "Delete this document?")) return;
    deleteClDoc(existing.code, DOC); nav(base);
  };

  const ctrl = (f: SalesField) => {
    const type = f.type ?? "text";
    if (type === "textarea") return <textarea value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} style={INP} />;
    if (type === "number") return <input type="number" value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} style={INP} />;
    if (type === "date") return <input type="date" value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} style={INP} />;
    if (type === "member") return (
      <select value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} style={INP}>
        <option value="">—</option>{users.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
    );
    if (type === "select") return (
      <select value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} style={INP}>
        <option value="">—</option>{getFieldOptions(DOC, f.key).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
    if (type === "multiselect") {
      const sel = val(f.key) ? val(f.key).split(",").map((s) => s.trim()).filter(Boolean) : [];
      const toggle = (o: string) => set(f.key, (sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o]).join(", "));
      return (
        <div className="ms-chips">
          {getFieldOptions(DOC, f.key).map((o) => (
            <button type="button" key={o} className={`ms-chip${sel.includes(o) ? " on" : ""}`} onClick={() => toggle(o)}>{o}</button>
          ))}
        </div>
      );
    }
    return <input value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} style={INP} />;
  };

  if (!session) {
    return <div className="p-clreport"><div className="rpt"><div className="banner err">{t("customer.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("customer.goLogin")}</button></div></div>;
  }

  return (
    <div className="p-clreport">
      {/* top bar */}
      <div className="topbar">
        <div className="qtag" style={{ background: DOC_TONE[DOC] ?? "var(--blue)" }}>{DOC}</div>
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>iDoc ERP</div>
        <div className="doctitle">{docNo}{titleVal ? ` · ${titleVal}` : ` · ${docName}`}</div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      {/* main: Documents (ซ้าย ขึ้นสุดใต้ topbar) + workzone(toolbar + form) */}
      <div className="layout">
        <div className={`dtree${collapsed ? " collapsed" : ""}`}>
          <div className="th">
            <span>Documents</span>
            <div className="collapse-btn" title="ยุบ/ขยาย" onClick={toggleTree}><ChevronLeft size={16} /></div>
          </div>
          <div className="tlist">
            <div className="titem cl sel"><FileText />{docNo}</div>
          </div>
          <ModuleDeps moduleKey="sales" />
        </div>

        <div className="workzone">
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav(base)}><ArrowLeft /><span>{t("custForm.back")}</span></div>
            <div className="tbtn primary" onClick={() => { if (!saving) save(); }}><Save /><span>{saving ? "…" : t("custForm.save")}</span></div>
            {existing && <div className="tbtn" style={{ marginLeft: "auto", color: "var(--red)" }} onClick={onDelete}><Trash size={15} /><span>{th ? "ลบ" : "Delete"}</span></div>}
          </div>

          <div className="rpt cl-form">
            <div className="rpt-head">{existing ? existing.code : `${th ? "เพิ่ม" : "New"} ${docName}`}</div>
            <div className="rpt-sub">{th ? "กรอกข้อมูลเอกสาร" : "Fill in the document details"}</div>
            {groups.map(({ g, fields }) => (
              <div className="rpt-card" key={g} style={{ marginBottom: 18 }}>
                <div className="st">{t(`salesFields.group.${g}`, { defaultValue: g })}</div>
                <div className="cl-form-grid">
                  {g === "general" && (
                    <div className="cl-fld">
                      <label>{th ? "รหัสเอกสาร" : "Document no."}</label>
                      <input value={docNo} readOnly style={{ ...INP, background: "var(--bg)" }} />
                    </div>
                  )}
                  {fields.map((f) => (
                    <div className="cl-fld" key={f.key} style={{ gridColumn: f.type === "textarea" ? "1 / -1" : undefined }}>
                      <label>{label(f.key)}{f.core ? " *" : ""}</label>
                      {ctrl(f)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
