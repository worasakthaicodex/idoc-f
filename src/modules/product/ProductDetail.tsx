import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, Help, ArrowLeft, Edit, Box, Dollar, FileText, Trash, X } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import ProductSide from "./ProductSide";
import { PROD_FIELDS, GROUPS, isColumnField, prodLabel, groupLabel, type FieldGroup } from "./productFields";
import { getEnabledFields, statusTone, statusText } from "./productConfig";
import "../customer/customer.css";

const GROUP_ICON: Record<FieldGroup, typeof Box> = {
  basic: Box, type: Box, uom: Box, classification: FileText, sales: Dollar,
  purchasing: Dollar, mrp: Box, storage: Box, accounting: Dollar, costing: Dollar, quality: FileText,
};
const DAY = 24 * 3600 * 1000;
type Product = { id: string; code: string; name: string; status: string; groupName?: string; attributes?: Record<string, string>; createdAt?: string };

export default function ProductDetail() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { id } = useParams();
  const session = getSession();
  const tenant = session?.companyId ?? "";

  const [p, setP] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const th = lang.startsWith("th");
  const meName = session?.fullName || session?.email || session?.companyCode || "—";

  useEffect(() => {
    if (tenant && id) {
      apiFetch<Product>(`/products/${id}`, { tenant })
        .then(setP)
        .catch((e) => setError(t("custForm.errLoad") + ": " + e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const enabledSet = new Set(getEnabledFields());
  const valOf = (key: string): string => {
    if (!p) return "";
    if (key === "name") return p.name;
    if (key === "groupName") return p.groupName ?? "";
    if (isColumnField(key)) return String((p as Record<string, unknown>)[key] ?? "");
    return p.attributes?.[key] ?? "";
  };

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err">{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("custForm.goLogin")}</button></div></div>;
  }

  const groups = GROUPS
    .map((g) => ({ g, fields: PROD_FIELDS.filter((f) => f.group === g && enabledSet.has(f.key)) }))
    .filter((x) => x.fields.length > 0);

  // เพิ่มไม่เกิน 3 วัน = ลบจริงได้ · เกินนั้น = ตั้ง "รอลบ" (PENDING_DELETE) ลบอัตโนมัติใน 6 เดือน
  const within3Days = !!p?.createdAt && Date.now() - new Date(p.createdAt).getTime() <= 3 * DAY;
  const isPending = p?.status === "PENDING_DELETE";
  const onDelete = async () => {
    if (!p || !id) return;
    setBusy(true); setError("");
    try {
      if (within3Days) {
        await apiFetch(`/products/${id}`, { method: "DELETE", tenant });
      } else {
        await apiFetch(`/products/${id}`, { method: "PUT", tenant, body: { name: p.name, groupName: p.groupName ?? null, status: "PENDING_DELETE", attributes: p.attributes ?? {}, changedBy: meName } });
      }
      nav("/product");
    } catch (e) {
      setError(t("custForm.errSave") + ": " + (e as Error).message); setBusy(false); setConfirmDel(false);
    }
  };

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
            <div className="tbtn" onClick={() => nav("/product")}><ArrowLeft /><span>{t("custForm.back")}</span></div>
            <div className="tbsep" />
            <div className="tbtn primary" onClick={() => nav(`/product/${id}/edit`)}><Edit /><span>{t("product.edit")}</span></div>
            {p && !isPending && <div className="tbtn" onClick={() => setConfirmDel(true)} style={{ color: "var(--red)" }}><Trash /><span>{th ? "ลบ" : "Delete"}</span></div>}
          </div>

          <div className="crm-body">
            {error && <div className="banner err">{error}</div>}
            {p && (
              <>
                <div className="form-head">{p.name}</div>
                <div className="form-sub">{p.code} · <span className={`chip ${statusTone(p.status)}`}>{statusText(p.status, lang)}</span></div>

                {groups.map(({ g, fields }) => {
                  const Icon = GROUP_ICON[g];
                  return (
                    <div className="card" key={g}>
                      <div className="sh"><Icon size={15} />{groupLabel(g, lang)}</div>
                      <div className="crm-grid">
                        {fields.map((f) => (
                          <div className={`field-sm${f.type === "table" ? " wide" : ""}`} key={f.key}>
                            <label>{prodLabel(f.key, lang)}</label>
                            {f.type === "table" ? (() => {
                              let rows: { supplier?: string; price?: string; leadTime?: string }[] = [];
                              try { const a = JSON.parse(valOf(f.key) || "[]"); rows = Array.isArray(a) ? a : []; } catch { rows = []; }
                              return rows.length === 0 ? <div className="ro-val">—</div> : (
                                <div className="ro-val">{rows.map((r, i) => (
                                  <div key={i} style={{ fontSize: 12.5 }}>{r.supplier || "—"} · {r.price || "-"} · LT {r.leadTime || "-"} {lang.startsWith("th") ? "วัน" : "d"}</div>
                                ))}</div>
                              );
                            })() : <div className="ro-val">{valOf(f.key) || "—"}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ยืนยันลบ — ≤3 วัน ลบจริง · เกิน 3 วัน ตั้ง "รอลบ" 6 เดือน */}
      {confirmDel && p && (
        <div onClick={() => !busy && setConfirmDel(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.38)", display: "grid", placeItems: "center", zIndex: 100, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 440, maxWidth: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.25)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", borderBottom: "1px solid var(--line)", fontSize: 15, fontWeight: 700 }}>
              <span>{th ? "ยืนยันการลบ" : "Confirm delete"}</span>
              <button onClick={() => setConfirmDel(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--txt2)" }}><X size={16} /></button>
            </div>
            <div style={{ padding: "18px", fontSize: 13.5, color: "var(--txt2)", lineHeight: 1.6 }}>
              {within3Days
                ? (th ? `ลบ "${p.name}" ออกถาวร? (เพิ่มไม่เกิน 3 วัน — ลบได้ทันที)` : `Permanently delete "${p.name}"? (added within 3 days)`)
                : (th ? `"${p.name}" เพิ่มเกิน 3 วันแล้ว — ระบบจะตั้งเป็น "รอลบ" และลบอัตโนมัติใน 6 เดือน (กู้คืนได้ก่อนครบกำหนด)` : `"${p.name}" is older than 3 days — it will be marked "Pending delete" and purged automatically in 6 months.`)}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 18px", borderTop: "1px solid var(--line)" }}>
              <button className="btn" onClick={() => setConfirmDel(false)} disabled={busy}>{th ? "ยกเลิก" : "Cancel"}</button>
              <button className="btn" style={{ background: "var(--red)", color: "#fff", borderColor: "var(--red)", opacity: busy ? 0.6 : 1 }} onClick={onDelete} disabled={busy}>
                <Trash size={15} />{busy ? (th ? "กำลังลบ…" : "Deleting…") : within3Days ? (th ? "ลบถาวร" : "Delete") : (th ? "ตั้งรอลบ" : "Mark pending")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
