import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";

/**
 * ช่อง "รายการ" ในตารางย่อย — ค้นสินค้า/บริการจากโมดูล Product (/products) แบบ autocomplete
 * เลือกได้ → เติมชื่อ + ราคา (+ รหัสสินค้า) ให้แถวนั้น · ถ้าไม่มีโมดูล/ค้นไม่เจอ = พิมพ์เองได้ตรง ๆ
 */
type Prod = { id: string; code: string; name: string; attributes?: Record<string, string> };

export default function ProductItemInput({ value, onChange, onPick, placeholder, allowTypes }: {
  value: string;
  onChange: (name: string) => void;                                  // พิมพ์เอง (manual)
  onPick: (p: { code: string; name: string; price: string }) => void; // เลือกจาก Product
  placeholder?: string;
  allowTypes?: string[];   // จำกัดประเภทสินค้า (materialType) ที่ค้นเจอ · ว่าง/ไม่ส่ง = ไม่กรอง
}) {
  const { t } = useTranslation();
  const tenant = getSession()?.companyId ?? "";
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Prod[]>([]);

  useEffect(() => {
    if (!editing) return;
    const s = q.trim();
    if (!s || !tenant) { setRows([]); return; }
    const h = setTimeout(() => {
      // prefix (ส่วนหน้า) — เร็วแม้สินค้าจำนวนมาก · ไม่มีโมดูล/ค้นไม่เจอ = พิมพ์เองได้
      apiFetch<Prod[]>(`/products/lookup?q=${encodeURIComponent(s)}&limit=20`, { tenant })
        .then((rs) => setRows(rs || [])).catch(() => setRows([]));
    }, 250);
    return () => clearTimeout(h);
  }, [q, tenant, editing]);

  // กรองตามประเภทสินค้าที่อนุญาต — ซ่อนเฉพาะรายการที่ "ระบุประเภทอื่น" · ไม่ระบุประเภท = ยังค้นเจอ
  const shown = allowTypes && allowTypes.length
    ? rows.filter((p) => { const mt = p.attributes?.materialType; return !mt || allowTypes.includes(mt); })
    : rows;

  return (
    <div style={{ position: "relative" }}>
      <input
        value={editing ? q : value}
        onChange={(e) => { setEditing(true); setQ(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => { setEditing(true); setQ(value); setOpen(true); }}
        onBlur={() => setTimeout(() => { setOpen(false); setEditing(false); }, 150)}
        placeholder={placeholder || t("salesDoc.searchProduct")}
      />
      {open && editing && shown.length > 0 && (
        <div className="ta-menu" style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 40, background: "#fff", border: "1px solid var(--line)", borderRadius: 8, maxHeight: 220, overflow: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.12)" }}>
          {shown.map((p) => (
            <div key={p.id} style={{ padding: "8px 11px", fontSize: 12.5, cursor: "pointer" }}
              onMouseDown={(e) => { e.preventDefault(); onPick({ code: p.code, name: p.name, price: p.attributes?.price || "" }); setEditing(false); setOpen(false); setQ(""); }}>
              <b>{p.code}</b> · {p.name}{p.attributes?.price ? ` · ฿${p.attributes.price}` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
