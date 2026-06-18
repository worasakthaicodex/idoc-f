import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";
import AttachmentBox from "../../shared/AttachmentBox";
import { Grid, ChevronDown, Help, ArrowLeft, Save, CheckCircle, Box, Dollar, FileText, Plus, X } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import ProductSide from "./ProductSide";
import { PROD_FIELDS, GROUPS, COLUMN_KEYS, isColumnField, fieldType, prodLabel, groupLabel, type ProdField, type FieldGroup } from "./productFields";
import { getEnabledFields, getFieldOptions, getEnabledStatuses, statusText } from "./productConfig";
import { MODULE, isModuleAdmin } from "../../shared/access";
import "../customer/customer.css";

const GROUP_ICON: Record<FieldGroup, typeof Box> = {
  basic: Box, type: Box, uom: Box, classification: FileText, sales: Dollar,
  purchasing: Dollar, mrp: Box, storage: Box, accounting: Dollar, costing: Dollar, quality: FileText,
};

export default function ProductForm() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const th = lang.startsWith("th");
  const { id } = useParams();
  const isNew = !id;
  const session = getSession();
  const tenant = session?.companyId ?? "";

  const [values, setValues] = useState<Record<string, string>>({});
  const [orig, setOrig] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState("ACTIVE");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const enabled = getEnabledFields();
  const enabledSet = new Set(enabled);

  useEffect(() => {
    if (!isNew && tenant) {
      apiFetch<Record<string, unknown>>(`/products/${id}`, { tenant })
        .then((c) => {
          setOrig(c); setCode(String(c.code ?? "")); setStatus(String(c.status ?? "ACTIVE"));
          const attrs = (c.attributes as Record<string, string>) ?? {};
          const next: Record<string, string> = {};
          PROD_FIELDS.forEach((f) => { next[f.key] = isColumnField(f.key) ? String(c[f.key] ?? "") : String(attrs[f.key] ?? ""); });
          setValues(next);
        })
        .catch((err) => setError(t("custForm.errLoad") + ": " + err.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));
  const val = (k: string) => values[k] ?? "";

  async function save() {
    if (!val("name").trim()) { setError(t("custForm.errRequireName")); return; }
    setError(""); setBusy(true);
    try {
      const body: Record<string, unknown> = {};
      COLUMN_KEYS.forEach((k) => {
        if (enabledSet.has(k)) { const v = val(k).trim(); body[k] = v ? val(k) : null; }
        else body[k] = orig[k] ?? null;
      });
      const attributes: Record<string, string> = { ...((orig.attributes as Record<string, string>) ?? {}) };
      PROD_FIELDS.forEach((f) => {
        if (isColumnField(f.key) || !enabledSet.has(f.key)) return;
        const v = val(f.key).trim();
        if (v) attributes[f.key] = v; else delete attributes[f.key];
      });
      body.attributes = attributes;
      body.status = status;

      if (isNew) { await apiFetch("/products", { method: "POST", tenant, body }); nav("/product"); }
      else { await apiFetch(`/products/${id}`, { method: "PUT", tenant, body }); nav(`/product/${id}`); }
    } catch (e) {
      setError(t("custForm.errSave") + ": " + (e as Error).message);
    } finally { setBusy(false); }
  }

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err">{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("custForm.goLogin")}</button></div></div>;
  }

  function renderField(f: ProdField) {
    const label = prodLabel(f.key, lang) + (f.core ? " *" : "");
    const type = fieldType(f.key);
    const wide = type === "textarea" || f.key === "name"; // ชื่อยาว → เต็มความกว้าง
    let control;
    if (type === "textarea") control = <textarea value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} />;
    else if (type === "number") control = <input type="number" value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} />;
    else if (type === "select") control = (
      <select value={val(f.key)} onChange={(e) => set(f.key, e.target.value)}>
        <option value="">{t("custForm.pickOne")}</option>
        {getFieldOptions(f.key).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
    else if (type === "table") {
      // ตารางย่อยผู้ขาย (Purchasing) — หลายผู้ขาย/ราคาซื้อ/lead time · เก็บเป็น JSON ในคีย์เดียว
      type Vendor = { supplier: string; price: string; leadTime: string };
      let rows: Vendor[] = [];
      try { const a = JSON.parse(val(f.key) || "[]"); rows = Array.isArray(a) ? a : []; } catch { rows = []; }
      const setRows = (nx: Vendor[]) => set(f.key, JSON.stringify(nx));
      const upd = (i: number, patch: Partial<Vendor>) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
      const td: React.CSSProperties = { padding: "4px 6px", borderBottom: "1px solid var(--line-soft)" };
      const inp: React.CSSProperties = { width: "100%", padding: "5px 7px", border: "1px solid var(--field-bd, #cbd3dd)", borderRadius: 6, fontSize: 12.5 };
      return (
        <div className="field-sm wide" key={f.key}>
          <label>{label}</label>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ textAlign: "left", fontSize: 11.5, color: "var(--txt2)" }}>
              <th style={td}>{th ? "ผู้ขาย" : "Vendor"}</th><th style={{ ...td, width: 130 }}>{th ? "ราคาซื้อ" : "Price"}</th><th style={{ ...td, width: 120 }}>Lead time</th><th style={{ ...td, width: 32 }} />
            </tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={4} style={{ ...td, color: "var(--txt3)", fontSize: 12.5 }}>{th ? "ยังไม่มีผู้ขาย" : "No vendors"}</td></tr>
              ) : rows.map((r, i) => (
                <tr key={i}>
                  <td style={td}><input value={r.supplier || ""} onChange={(e) => upd(i, { supplier: e.target.value })} style={inp} /></td>
                  <td style={td}><input type="number" value={r.price || ""} onChange={(e) => upd(i, { price: e.target.value })} style={inp} /></td>
                  <td style={td}><input type="number" value={r.leadTime || ""} onChange={(e) => upd(i, { leadTime: e.target.value })} style={inp} /></td>
                  <td style={td}><button type="button" title={th ? "ลบ" : "Delete"} onClick={() => setRows(rows.filter((_, idx) => idx !== i))} style={{ border: "none", background: "none", color: "var(--red)", cursor: "pointer" }}><X size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => setRows([...rows, { supplier: "", price: "", leadTime: "" }])}
            style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--blue)", background: "none", border: "1px dashed var(--blue)", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>
            <Plus size={14} />{th ? "เพิ่มผู้ขาย" : "Add vendor"}
          </button>
        </div>
      );
    }
    else control = <input type="text" value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} />;
    return (
      <div className={`field-sm${wide ? " wide" : ""}`} key={f.key}>
        <label>{label}</label>{control}
      </div>
    );
  }

  const groups = GROUPS
    .map((g) => ({ g, fields: PROD_FIELDS.filter((f) => f.group === g && enabledSet.has(f.key)) }))
    .filter((x) => x.fields.length > 0);

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{t("product.title")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <ProductSide active="core" />

        <div className="crm-content">
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav(isNew ? "/product" : `/product/${id}`)}><ArrowLeft /><span>{t("custForm.back")}</span></div>
            <div className="tbsep" />
            {isModuleAdmin(MODULE.PRODUCT) && <div className="tbtn primary" onClick={save}><Save /><span>{busy ? t("custForm.saving") : t("custForm.save")}</span></div>}
          </div>

          <div className="crm-body">
            <div className="form-head">{isNew ? t("product.headNew") : t("product.headEdit", { code })}</div>
            {error && <div className="banner err">{error}</div>}

            <div className="card">
              <div className="sh"><CheckCircle size={15} />{t("product.statusTitle")}</div>
              <div className="crm-grid">
                <div className="field-sm">
                  <label>{prodLabel("status", lang)}</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    {[...new Set([status, ...getEnabledStatuses()])].map((c) => <option key={c} value={c}>{statusText(c, lang)}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {groups.map(({ g, fields }) => {
              const Icon = GROUP_ICON[g];
              return (
                <div className="card" key={g}>
                  <div className="sh"><Icon size={15} />{groupLabel(g, lang)}</div>
                  <div className="crm-grid">{fields.map(renderField)}</div>
                  {g === "basic" && (
                    <div style={{ marginTop: 12 }}>
                      <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>{t("product.images", { defaultValue: "รูปสินค้า (สูงสุด 5)" })}</label>
                      <AttachmentBox ownerType="PRODUCT_IMAGE" ownerId={id || ""} accept="image/*" image max={5}
                        disabledReason={isNew ? t("product.saveFirstImages", { defaultValue: "บันทึกสินค้าก่อน จึงแนบรูปได้ (สูงสุด 5)" }) : undefined} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
