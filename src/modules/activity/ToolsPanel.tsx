import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";
import { Save, Edit, X, Undo, ChevronDown, Plus } from "../../shared/icons";
import { TOOL_BY_KEY, type ToolDef, type ToolField } from "./tools";
import { getEnabledTools } from "./toolConfig";
import { getAttachFileTypes } from "../sales/salesCloseConfig";
import AttachmentBox from "../../shared/AttachmentBox";
import { saveCalendar, syncCalendar, loadCalendar } from "../inbox/calendarStore";
import "./tools.css";

/** วันหมดอายุ − 7 วัน (วันที่เตือนล่วงหน้า) — คำนวณแบบ local date ไม่ให้เพี้ยนเพราะ timezone */
const minus7 = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() - 7);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
};

type ActivityResponse = {
  id: string;
  createdBy?: string;
  occurredAt?: string;
  createdAt?: string;
  payload?: Record<string, string>;
  status?: "ACTIVE" | "VOID";
  voidedAt?: string;
  subjectType?: string | null;   // เอกสารอ้างอิง (ถ้าบันทึกผ่านทางลัด เช่น CL)
  subjectCode?: string | null;
};

/**
 * แผงเครื่องมือเอกสารใช้ร่วม — ฝังหน้าไหนก็ได้ (ลูกค้า/QT/SO ...)
 * คีย์หลัก 3 ตัว: customerCode + subjectType/subjectCode (เอกสารอ้างอิง) + parentType/parentCode (เอกสารแม่)
 *  - เปิดจากหน้าลูกค้า: ส่งแค่ customerCode → ดึง/บันทึก "ตามลูกค้า"
 *  - เปิดจากหน้าเอกสาร: ส่ง subject/parent ด้วย → ดึง/บันทึก "ตามเอกสาร"
 */
export default function ToolsPanel({
  context,
  customerCode = "",
  subjectType = "",
  subjectCode = "",
  parentType = "",
  parentCode = "",
  refType = "",
  refCode = "",
}: {
  context: string;
  customerCode?: string;
  subjectType?: string;
  subjectCode?: string;
  parentType?: string;
  parentCode?: string;
  /** ทางลัด: บันทึกตามลูกค้า (customerCode) แต่แนบรหัสเอกสารอ้างอิงไว้ด้วย (เช่นเปิดจาก CL) */
  refType?: string;
  refCode?: string;
}) {
  const { t } = useTranslation();
  const session = getSession();
  const tenant = session?.companyId ?? "";

  const enabled: ToolDef[] = getEnabledTools(context).map((k) => TOOL_BY_KEY[k]).filter(Boolean);

  const [active, setActive] = useState<string>(enabled[0]?.key ?? "");
  const [form, setForm] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [list, setList] = useState<ActivityResponse[]>([]);
  const [busy, setBusy] = useState(false);
  const [sortAsc, setSortAsc] = useState(false); // false = ใหม่→เก่า
  const [formOpen, setFormOpen] = useState(false); // ฟอร์มเพิ่ม/แก้ไข พับไว้เป็นค่าเริ่มต้น

  const tool = TOOL_BY_KEY[active] ?? enabled[0];
  const byDoc = !!subjectCode;

  // "ระบบที่ลูกค้ามี" → เขียนลงปฏิทิน (เหตุการณ์ CRM) เตือนล่วงหน้า 7 วันก่อนวันหมดอายุ
  //  - กันซ้ำด้วย key คงที่ (ลูกค้า|ระบบ|วันหมดอายุ) เก็บใน refCode → เช็คว่าเคยลงยังก่อนลงใหม่
  const sysCalKey = (sys: string, expiry: string) => `${customerCode}|${sys}|${expiry}`;
  async function ensureSystemEvent(payload: Record<string, string>, known?: Set<string>): Promise<boolean> {
    const expiry = (payload.expiry || "").trim();
    if (!expiry || !customerCode) return false;
    const sys = (payload.system || "").trim() || "ระบบ";
    const key = sysCalKey(sys, expiry);
    if (known?.has(key)) return false;
    if (loadCalendar().some((e) => e.refType === "SYSTEM" && e.refCode === key)) return false; // เคยลงแล้ว
    const ok = await saveCalendar({
      activityDate: expiry, remindDate: minus7(expiry), priority: "NORMAL", status: "PENDING", confirmed: false,
      title: `${sys} หมดอายุ${payload.scope ? " · " + payload.scope : ""}`,
      customerRef: customerCode, refType: "SYSTEM", refCode: key, module: "crm",
      createdBy: session?.fullName || session?.companyCode || null,
    });
    if (ok) known?.add(key);
    return ok;
  }
  // เติมปฏิทินย้อนหลังให้ระบบที่นำเข้าหลังบ้าน (ข้ามการเขียนปฏิทินไป) — เช็คก่อน ถ้ายังไม่เคยลงก็ลงเลย
  //  เอาเฉพาะที่ "มีวันหมดอายุ และยังไม่ถึง (ตั้งแต่วันนี้เป็นต้นไป)" — ของที่หมดอายุไปแล้วไม่ต้องลง
  async function backfillSystemEvents(rows: ActivityResponse[]) {
    const todayLocal = (() => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })();
    const withExp = rows.filter((r) => r.status !== "VOID" && (r.payload?.expiry || "").trim() >= todayLocal);
    if (!withExp.length || !customerCode) return;
    await syncCalendar();
    const known = new Set<string>();
    let added = 0;
    for (const r of withExp) if (await ensureSystemEvent(r.payload!, known)) added++;
    if (added) window.dispatchEvent(new Event("idoc:activity-changed"));
  }

  const flabel = (k: string) => t(`tools.fields.${k}`, { defaultValue: k });
  const tlabel = (k: string) => t(`tools.${k}.title`, { defaultValue: k });
  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "");

  function reload() {
    if (!tenant || !tool) return;
    const qp = new URLSearchParams({ kind: tool.kind });
    if (byDoc) { qp.set("subjectType", subjectType); qp.set("subjectCode", subjectCode); }
    else { qp.set("customerCode", customerCode); }
    apiFetch<ActivityResponse[]>(`/activities?${qp.toString()}`, { tenant })
      .then((rows) => { setList(rows); if (tool.kind === "CUSTOMER_SYSTEM" && !byDoc) backfillSystemEvents(rows); })
      .catch(() => setList([]));
  }

  useEffect(() => {
    setEditingId(null); setForm({});
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tenant, customerCode, subjectCode]);

  if (enabled.length === 0) {
    return <div className="tp"><div className="tp-empty">{t("custForm.noTools")}</div></div>;
  }

  const startEdit = (e: ActivityResponse) => { setEditingId(e.id); setForm({ ...(e.payload || {}) }); setFormOpen(true); };
  const cancelEdit = () => { setEditingId(null); setForm({}); };

  async function save() {
    const payload: Record<string, string> = {};
    tool.fields.forEach((f) => { const v = (form[f.key] || "").trim(); if (v) payload[f.key] = v; });
    if (Object.keys(payload).length === 0) return;
    setBusy(true);
    try {
      if (editingId) {
        await apiFetch(`/activities/${editingId}`, { method: "PUT", tenant, body: { payload } });
      } else {
        const body: Record<string, unknown> = {
          kind: tool.kind,
          customerCode: customerCode || null,
          createdBy: session?.fullName || session?.companyCode || null,
          payload,
        };
        if (byDoc) {
          body.subjectType = subjectType;
          body.subjectCode = subjectCode;
          body.parentType = parentType || null;
          body.parentCode = parentCode || null;
        } else if (refType && refCode) {
          // ทางลัด: เก็บตามลูกค้า + แนบรหัสเอกสารอ้างอิง (เช่น CL) เพื่อให้รู้ว่ามาจากไหน
          body.subjectType = refType;
          body.subjectCode = refCode;
        }
        await apiFetch("/activities", { method: "POST", tenant, body });
      }
      // ระบบที่ลูกค้ามี → เขียน/อัปเดตเหตุการณ์ปฏิทิน (เตือนล่วงหน้า 7 วัน) ทันทีที่บันทึก
      if (tool.writesCalendar && !byDoc) { await syncCalendar(); await ensureSystemEvent(payload); }
      setForm({}); setEditingId(null);
      reload();
      window.dispatchEvent(new Event("idoc:activity-changed")); // ให้หน้าที่ฝัง (เช่นกล่อง CL) รีเฟรชกลุ่ม
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    if (!window.confirm(t("custForm.confirmDelete"))) return;
    await apiFetch(`/activities/${id}`, { method: "DELETE", tenant });
    if (editingId === id) cancelEdit();
    reload();
    window.dispatchEvent(new Event("idoc:activity-changed"));
  }

  async function restore(id: string) {
    await apiFetch(`/activities/${id}/restore`, { method: "POST", tenant });
    reload();
    window.dispatchEvent(new Event("idoc:activity-changed"));
  }

  const renderField = (f: ToolField) => {
    const v = form[f.key] ?? "";
    const set = (val: string) => setForm((s) => ({ ...s, [f.key]: val }));
    let ctrl;
    if (f.type === "textarea") ctrl = <textarea value={v} onChange={(e) => set(e.target.value)} />;
    else if (f.type === "select") ctrl = (
      <select value={v} onChange={(e) => set(e.target.value)}>
        <option value="">{t("custForm.pickOne")}</option>
        {(f.key === "fileType" ? getAttachFileTypes() : (f.opts || [])).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
    else if (f.type === "number") ctrl = <input type="number" value={v} onChange={(e) => set(e.target.value)} />;
    else if (f.type === "date") ctrl = <input type="date" value={v} onChange={(e) => set(e.target.value)} />;
    else ctrl = <input type="text" value={v} onChange={(e) => set(e.target.value)} />;
    return (
      <div className={`field-sm${f.wide ? " wide" : ""}`} key={f.key}>
        <label>{flabel(f.key)}</label>
        {ctrl}
      </div>
    );
  };

  const sorted = [...list].sort((a, b) => {
    const ta = new Date(a.occurredAt || a.createdAt || 0).getTime();
    const tb = new Date(b.occurredAt || b.createdAt || 0).getTime();
    return sortAsc ? ta - tb : tb - ta;
  });

  return (
    <div className="tp">
      <div className="tp-seg">
        {enabled.map((tt) => (
          <div key={tt.key} className={`seg${active === tt.key ? " active" : ""}`} onClick={() => { setActive(tt.key); }}>
            <tt.Icon size={16} />
            <span>{tlabel(tt.key)}</span>
          </div>
        ))}
      </div>

      {tool.kind === "ATTACHMENT" ? (
        <div className="tp-card" style={{ padding: 14 }}>
          <AttachmentBox ownerType={byDoc ? subjectType : "CUSTOMER"} ownerId={byDoc ? subjectCode : customerCode} categories={getAttachFileTypes()} sourceRef={byDoc ? subjectCode : refCode} />
        </div>
      ) : (<>
      {/* ฟอร์มเพิ่ม / แก้ไข — พับได้ (พับไว้เป็นค่าเริ่มต้น) */}
      <div className="tp-card">
        <div className="tp-h tp-foldhead" onClick={() => setFormOpen((o) => !o)} style={{ cursor: "pointer" }}>
          {editingId ? <Edit size={15} /> : <Plus size={15} />}
          {editingId ? t("custForm.toolEdit") : t("custForm.toolAdd")} · {tlabel(tool.key)}
          <ChevronDown size={16} style={{ marginLeft: "auto", transform: formOpen ? "none" : "rotate(-90deg)", transition: "transform .12s" }} />
        </div>
        {formOpen && (
          <>
            <div className="tp-grid">{tool.fields.map(renderField)}</div>
            <div className="tp-actions" style={{ display: "flex", gap: 8 }}>
              <button className="btn primary" onClick={save} disabled={busy}>
                <Save size={15} />{busy ? t("custForm.saving") : editingId ? t("custForm.toolUpdate") : t("custForm.save")}
              </button>
              {editingId && <button className="btn" onClick={cancelEdit}>{t("custForm.toolCancel")}</button>}
            </div>
          </>
        )}
      </div>

      {/* ประวัติ */}
      <div className="tp-card">
        <div className="tp-h">
          <span style={{ flex: 1 }}>{t("custForm.toolHistory")} · {tlabel(tool.key)} <span className="cnt" style={{ marginLeft: 6 }}>{list.length}</span></span>
          <span className="tp-sort" onClick={() => setSortAsc((s) => !s)}>{sortAsc ? t("custForm.sortOldest") : t("custForm.sortNewest")}</span>
        </div>
        <div className="tp-log">
          {sorted.length === 0 ? (
            <div className="tp-empty">{t("custForm.toolEmpty")}</div>
          ) : sorted.map((e) => {
            const voided = e.status === "VOID";
            return (
            <div className={`row${voided ? " voided" : ""}`} key={e.id}>
              <div className="rmain">
                <div className="lmeta">
                  <span>{t("custForm.by")} {e.createdBy || "—"}</span>
                  <span>{voided ? t("custForm.voidedNote") : fmt(e.occurredAt || e.createdAt)}</span>
                  {e.subjectType && e.subjectCode && <span className="chip blue" style={{ fontSize: 10 }}>{e.subjectType} {e.subjectCode}</span>}
                </div>
                <div className="lbody">
                  {tool.fields.filter((f) => e.payload?.[f.key]).map((f) => (
                    <div key={f.key}><span className="lk">{flabel(f.key)}: </span>{e.payload?.[f.key]}</div>
                  ))}
                </div>
              </div>
              <div className="ractions">
                {voided ? (
                  <button className="ract restore" title={t("custForm.toolRestore")} onClick={() => restore(e.id)}><Undo size={15} /></button>
                ) : (
                  <>
                    <button className="ract" title={t("custForm.toolEdit")} onClick={() => startEdit(e)}><Edit size={14} /></button>
                    <button className="ract del" title={t("custForm.toolDelete")} onClick={() => del(e.id)}><X size={15} /></button>
                  </>
                )}
              </div>
            </div>
            );
          })}
        </div>
      </div>
      </>)}
    </div>
  );
}
