import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";
import { Search } from "../../shared/icons";

/**
 * เลือกลูกค้า "จริงที่ DB" แบบ prefix (ส่วนหน้า) ผ่าน /customers/lookup — เร็วแม้ลูกค้าหลักหมื่น
 * ไม่โหลดทั้งหมดมากรองฝั่งหน้า · เลือกแล้วคืนทั้ง code (REG) + name
 * วางไว้ใน <div className="ctrl" style={{position:relative}}> (คืน fragment: input + ไอคอน + เมนู)
 */
type CustomerRec = { id: string; code: string; name: string };

export default function CustomerPicker({ value, code, onPick, placeholder, locked, onUnlock }: {
  value: string;                                   // ชื่อลูกค้าที่เลือกไว้
  code?: string;                                   // รหัสลูกค้า (REG) ที่เลือกไว้
  onPick: (c: { code: string; name: string }) => void;
  placeholder?: string;
  locked?: boolean;                                // ล็อกลูกค้าที่เลือกมาแล้ว (เช่นมาจาก CL) — แสดงเป็นชิป
  onUnlock?: () => void;                            // กด "เปลี่ยน" เพื่อปลดล็อกและค้นใหม่
}) {
  const { t } = useTranslation();
  const tenant = getSession()?.companyId ?? "";
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);   // กำลังพิมพ์ค้น (ยังไม่เลือก)
  const [rows, setRows] = useState<CustomerRec[]>([]);

  useEffect(() => {
    if (!editing) return;
    const s = q.trim();
    if (!s || !tenant) { setRows([]); return; }
    const h = setTimeout(() => {
      apiFetch<CustomerRec[]>(`/customers/lookup?q=${encodeURIComponent(s)}&limit=30`, { tenant })
        .then(setRows).catch(() => setRows([]));
    }, 250);
    return () => clearTimeout(h);
  }, [q, tenant, editing]);

  const display = editing ? q : (value ? (code ? `${code} · ${value}` : value) : "");

  // ลูกค้าถูกเลือกมาแล้ว (เช่นจาก CL) → แสดงเป็นชิปเลือกแล้ว + ปุ่มเปลี่ยน (ไม่ต้องค้นใหม่)
  if (locked && value) {
    return (
      <div className="cust-locked">
        <span className="cl-pill">✓ {code ? <b>{code}</b> : null} {code ? "· " : ""}{value}</span>
        {onUnlock && <button type="button" className="cl-change" onClick={onUnlock}>{t("salesDoc.change")}</button>}
      </div>
    );
  }

  return (
    <>
      <input
        value={display}
        onChange={(e) => { setEditing(true); setQ(e.target.value); setOpen(true); }}
        onFocus={() => { setEditing(true); setQ(""); setOpen(true); }}
        onBlur={() => setTimeout(() => { setOpen(false); setEditing(false); }, 150)}
        placeholder={placeholder || t("salesDoc.searchCust")}
      />
      <span className="pick"><Search size={16} /></span>
      {open && editing && (
        <div className="ta-menu" style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 30, background: "#fff", border: "1px solid var(--line)", borderRadius: 8, maxHeight: 240, overflow: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.12)" }}>
          {rows.length === 0 ? (
            <div style={{ padding: 10, color: "var(--txt3)", fontSize: 13 }}>{q.trim() ? t("salesDoc.notFoundCust") : t("salesDoc.typeToSearch")}</div>
          ) : rows.map((c) => (
            <div key={c.id} style={{ padding: "9px 12px", fontSize: 13, cursor: "pointer" }}
              onMouseDown={(e) => { e.preventDefault(); onPick({ code: c.code, name: c.name }); setEditing(false); setOpen(false); setQ(""); }}>
              <b>{c.code}</b> · {c.name}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
