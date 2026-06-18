import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FileText, X } from "./icons";
import { listAttachments, uploadAttachment, deleteAttachment, attachmentDownloadUrl, humanSize, MAX_UPLOAD_BYTES, type Attachment } from "./attachments";

/**
 * กล่องไฟล์แนบใช้ซ้ำ — ผูกกับ owner (ownerType+ownerId) ผ่านระบบ attachment ของ backend
 * ใช้ได้ทั้ง: เครื่องมือไฟล์แนบ (CUSTOMER) · คำขอ (REQ) · พนักงาน รูป/ลายเซ็น (EMPLOYEE_PHOTO/SIGN) · โลโก้บริษัท
 */
export default function AttachmentBox({
  ownerType, ownerId, title, accept, image, single, max, disabledReason, categories, sourceRef,
}: {
  ownerType: string; ownerId: string;
  title?: string; accept?: string;
  image?: boolean;      // แสดงรูปตัวอย่าง (รูป/ลายเซ็น/โลโก้)
  single?: boolean;     // เก็บไฟล์เดียว (อัปใหม่ = ลบเก่าทิ้ง)
  max?: number;         // จำกัดจำนวนไฟล์ (เช่น รูปสินค้าไม่เกิน 5)
  disabledReason?: string;
  categories?: string[];   // ชนิดไฟล์ให้เลือก (จากการตั้งค่า) — ถ้ามี = บังคับเลือกก่อนอัป
  sourceRef?: string;      // เอกสารต้นทาง (auto จาก context ที่เปิดอยู่ เช่น QT202606-1) — ไม่ให้พิมพ์เอง
}) {
  const { i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const [items, setItems] = useState<Attachment[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [category, setCategory] = useState("");
  const disabled = !ownerId || !!disabledReason;
  const useCat = !!categories && categories.length > 0;

  const reload = useCallback(() => {
    if (!ownerId) { setItems([]); return; }
    listAttachments(ownerType, ownerId).then(setItems).catch(() => setItems([]));
  }, [ownerType, ownerId]);
  useEffect(() => { reload(); }, [reload]);

  // โหลดรูปตัวอย่าง (signed url) เฉพาะโหมดรูป
  useEffect(() => {
    if (!image) return;
    let alive = true;
    items.forEach((a) => { if (!thumbs[a.id]) attachmentDownloadUrl(a.id).then((u) => { if (alive && u) setThumbs((s) => ({ ...s, [a.id]: u })); }).catch(() => {}); });
    return () => { alive = false; };
  }, [items, image]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPick = async (file?: File) => {
    setErr("");
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) { setErr(th ? "ไฟล์เกิน 10MB" : "File exceeds 10MB"); return; }
    if (useCat && !category) { setErr(th ? "เลือกชนิดไฟล์ก่อน" : "Pick a file type first"); return; }
    setBusy(true);
    try {
      if (single) { for (const a of items) await deleteAttachment(a.id).catch(() => {}); }
      await uploadAttachment(ownerType, ownerId, file, { category: useCat ? category : undefined, sourceRef: sourceRef || undefined });
      reload();
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setErr(m === "FILE_TOO_LARGE" ? (th ? "ไฟล์เกิน 10MB" : "Too large")
        : m === "NO_OWNER" ? (th ? "บันทึกเอกสารก่อนจึงแนบไฟล์ได้" : "Save the document first")
        : (th ? "อัปโหลดไม่สำเร็จ (ตรวจการตั้งค่าที่เก็บไฟล์)" : "Upload failed"));
    } finally { setBusy(false); }
  };

  const open = async (id: string) => { const u = await attachmentDownloadUrl(id); if (u) window.open(u, "_blank", "noopener"); };
  const remove = async (id: string) => { if (!window.confirm(th ? "ลบไฟล์นี้?" : "Delete this file?")) return; await deleteAttachment(id).catch(() => {}); reload(); };

  return (
    <div className="att-box">
      {title && <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>{title}</div>}

      {image ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
          {items.map((a) => (
            <div key={a.id} style={{ position: "relative", width: 110 }}>
              {thumbs[a.id]
                ? <img src={thumbs[a.id]} alt={a.filename} style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)", cursor: "pointer" }} onClick={() => open(a.id)} />
                : <div style={{ width: 110, height: 110, borderRadius: 8, border: "1px solid var(--line)", display: "grid", placeItems: "center", color: "var(--txt3)" }}><FileText /></div>}
              <button type="button" onClick={() => remove(a.id)} title={th ? "ลบ" : "Delete"} style={{ position: "absolute", top: -8, right: -8, background: "#fff", border: "1px solid var(--line)", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", color: "var(--red)" }}><X size={13} /></button>
            </div>
          ))}
        </div>
      ) : (
        items.map((a) => (
          <div className="att" key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
            <FileText />
            <div style={{ flex: 1, minWidth: 0 }}>
              <a onClick={() => open(a.id)} style={{ cursor: "pointer", wordBreak: "break-all", color: "var(--blue)" }}>{a.filename}</a>
              <div style={{ fontSize: 11, color: "var(--txt3)" }}>
                {a.category && <span style={{ background: "#eef2f8", borderRadius: 10, padding: "0 7px", marginRight: 6, color: "var(--txt2)" }}>{a.category}</span>}
                {humanSize(a.sizeBytes)}
                {a.sourceRef && <span style={{ marginLeft: 6 }}>· {th ? "จาก" : "from"} {a.sourceRef}</span>}
              </div>
            </div>
            <button type="button" onClick={() => remove(a.id)} title={th ? "ลบ" : "Delete"} style={{ border: "none", background: "none", color: "var(--red)", cursor: "pointer" }}><X size={15} /></button>
          </div>
        ))
      )}

      {useCat && !image && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", margin: "4px 0 8px" }}>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--field-bd, #cbd3dd)", borderRadius: 7, fontSize: 12.5 }}>
            <option value="">{th ? "— เลือกชนิดไฟล์ —" : "— file type —"}</option>
            {categories!.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {sourceRef && <span className="muted" style={{ fontSize: 11.5 }}>{th ? "ผูกกับเอกสาร" : "linked to"}: <b style={{ color: "var(--txt2)" }}>{sourceRef}</b></span>}
        </div>
      )}

      {max != null && items.length >= max ? (
        <div className="muted" style={{ fontSize: 11.5 }}>{th ? `ครบ ${max} ไฟล์แล้ว (ลบก่อนเพิ่มใหม่)` : `Reached ${max} files`}</div>
      ) : (
        <label className="upload" style={{ display: "inline-block", ...(disabled || busy ? { opacity: 0.6, pointerEvents: "none" } : {}) }}>
          {busy ? (th ? "กำลังอัปโหลด…" : "Uploading…") : (th ? "เลือกไฟล์ (สูงสุด 10MB)" : "Choose file (max 10MB)")}
          <input type="file" accept={accept} disabled={disabled || busy} style={{ display: "none" }} onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      )}
      {disabledReason && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{disabledReason}</div>}
      {err && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 6 }}>{err}</div>}
    </div>
  );
}
