import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cart } from "../../shared/icons";
import { listBaskets, createBasket, addToBasket, type Basket } from "./basketStore";
import "./addBasket.css";

/**
 * ปุ่ม "ใส่ตะกร้า" แบบ playlist (เหมือน YouTube) — เลือกตะกร้า/สร้างใหม่ได้ทันที
 * พร้อมระบุ "เหตุผลที่ใส่" + "วันที่ต้องหยิบออก" ตอนเพิ่ม
 * ใช้ได้ทั้งหน้ารายละเอียดลูกค้า และเอกสารงานขาย (FO/QT/CL/SO) — ส่ง code = รหัสลูกค้า
 */
export default function AddToBasketButton({ code, name, variant = "btn", disabled }: { code: string; name?: string; variant?: "btn" | "tbtn"; disabled?: boolean }) {
  const { i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const L = (t: string, e: string) => (th ? t : e);
  const [open, setOpen] = useState(false);
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [selId, setSelId] = useState("");
  const [reason, setReason] = useState("");
  const [removeBy, setRemoveBy] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    listBaskets().then((b) => { setBaskets(b); setSelId((s) => s || (b[0]?.id ?? "")); }).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const doCreate = async () => {
    const nm = newName.trim();
    if (!nm) return;
    setBusy(true);
    try { const b = await createBasket(nm); setBaskets((s) => [b, ...s]); setSelId(b.id); setNewName(""); setCreating(false); }
    catch { setMsg(L("สร้างไม่สำเร็จ", "Create failed")); }
    finally { setBusy(false); }
  };
  const doAdd = async () => {
    if (!selId || !code) return;
    setBusy(true); setMsg(""); setBad(false);
    try {
      const r = await addToBasket(selId, { codes: [code], reason: reason.trim() || undefined, removeBy: removeBy || undefined });
      if (r.added > 0) {
        setMsg(L("เพิ่มลงตะกร้าแล้ว ✓", "Added ✓"));
        window.setTimeout(() => { setOpen(false); setMsg(""); setReason(""); setRemoveBy(""); }, 1200);
      } else if (r.conflicts && r.conflicts.length > 0) {
        const c = r.conflicts[0];
        setBad(true);
        setMsg(L(`หยิบไม่ได้ — อยู่ในตะกร้า “${c.basketName}” ของ ${c.owner} แล้ว`, `Can't add — held in “${c.basketName}” by ${c.owner}`));
      } else {
        setMsg(L("มีอยู่ในตะกร้านี้แล้ว", "Already in this basket"));
      }
    } catch { setBad(true); setMsg(L("เพิ่มไม่สำเร็จ", "Add failed")); }
    finally { setBusy(false); }
  };

  const cls = variant === "tbtn" ? "tbtn" : "btn";
  return (
    <div className="atb" ref={ref}>
      <div className={cls} onClick={() => { if (!disabled && code) setOpen((o) => !o); }} title={disabled ? L("บันทึกเอกสารก่อนจึงจะใส่ตะกร้าได้", "Save first") : L("เพิ่มลงตะกร้ารายชื่อ", "Add to basket")} style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
        <Cart size={15} /><span>{L("ใส่ตะกร้า", "Basket")}</span>
      </div>
      {open && (
        <div className="atb-pop">
          <div className="atb-h">{L("บันทึกลงตะกร้า", "Save to basket")}{name ? ` · ${name}` : ""}</div>
          <div className="atb-list">
            {baskets.length === 0 && <div className="atb-empty">{L("ยังไม่มีตะกร้า — สร้างใหม่ด้านล่าง", "No basket yet — create one below")}</div>}
            {baskets.map((b) => (
              <label key={b.id} className="atb-item">
                <input type="radio" name="atb-sel" checked={selId === b.id} onChange={() => setSelId(b.id)} />
                <span className="atb-name">{b.name}</span><span className="atb-cnt">{b.count}</span>
              </label>
            ))}
          </div>
          {creating ? (
            <div className="atb-new">
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doCreate(); }} placeholder={L("ชื่อตะกร้าใหม่", "New basket name")} />
              <button className="btn primary" disabled={busy} onClick={doCreate}>{L("สร้าง", "Create")}</button>
            </div>
          ) : (
            <div className="atb-create" onClick={() => setCreating(true)}>＋ {L("สร้างตะกร้าใหม่", "Create new basket")}</div>
          )}
          <div className="atb-f">
            <label>{L("เหตุผลที่ใส่ตะกร้า", "Reason for adding")}</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={L("ทำไมถึงเก็บรายชื่อนี้ไว้…", "Why keep this name…")} />
          </div>
          <div className="atb-f">
            <label>{L("วันที่ต้องหยิบออก", "Remove by (date)")}</label>
            <input type="date" value={removeBy} onChange={(e) => setRemoveBy(e.target.value)} />
          </div>
          {msg && <div className="atb-msg-row" style={{ color: bad ? "var(--red, #c0392b)" : "var(--green, #1f7a44)" }}>{msg}</div>}
          <div className="atb-act">
            <button className="btn" onClick={() => setOpen(false)}>{L("ปิด", "Close")}</button>
            <button className="btn primary" disabled={busy || !selId} onClick={doAdd}>{L("เพิ่มลงตะกร้า", "Add")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
