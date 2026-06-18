import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, Plus, Trash, Box, X, Users, ArrowLeft } from "../../shared/icons";
import CrmHelpButton from "./CrmHelpButton";
import LangSwitcher from "../../shared/LangSwitcher";
import CustomerSide from "./CustomerSide";
import { getReadiness } from "./customerReadinessConfig";
import { listBaskets, createBasket, deleteBasket, updateBasket, fetchBasketItems, removeFromBasket, updateBasketItem, getShares, setShares, fetchCrmUsers, currentOwner, type Basket, type BasketItem, type CrmUser } from "./basketStore";
import "./customer.css";

/** ตะกร้ารายชื่อลูกค้า — ของผู้ใช้คนนี้ · เลือก/สร้าง/ลบตะกร้า + ตารางรายชื่อ (FO/CL/QT/SO) */
export default function CustomerBasket() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const session = getSession();

  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [curId, setCurId] = useState<string>("");
  const [items, setItems] = useState<BasketItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [naming, setNaming] = useState(false);   // popup สร้างตะกร้า
  const [nameVal, setNameVal] = useState("");
  const [sharing, setSharing] = useState(false);  // popup แชร์
  const [crmUsers, setCrmUsers] = useState<CrmUser[]>([]);
  const [shareSel, setShareSel] = useState<Set<string>>(new Set());
  // แก้ในเครื่องก่อน แล้วกด "บันทึก" ทีเดียว (ไม่ auto-save กัน server โดนยิงบ่อย)
  const [dirty, setDirty] = useState<Record<string, { reason?: string; removeBy?: string }>>({});
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const myCode = currentOwner();
  const cur = baskets.find((b) => b.id === curId);
  const isOwned = cur ? cur.owner === myCode : true;   // ตะกร้าที่ถูกแชร์มา = อ่านอย่างเดียว
  const mine = baskets.filter((b) => b.owner === myCode);
  const shared = baskets.filter((b) => b.owner !== myCode);

  const reloadBaskets = (pick?: string) =>
    listBaskets().then((bs) => { setBaskets(bs); setCurId((c) => pick ?? (bs.some((b) => b.id === c) ? c : "")); })
      .catch((e) => setErr(String(e.message ?? e)));

  useEffect(() => { reloadBaskets(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    setDirty({}); setNoteDraft(null); setSavedMsg("");   // เปลี่ยนตะกร้า = ทิ้งที่ค้างแก้
    if (!curId) { setItems([]); return; }
    setLoading(true);
    fetchBasketItems(curId).then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, [curId]);

  const newBasket = () => { setNameVal(th ? "ตะกร้าใหม่" : "New basket"); setNaming(true); };
  const doCreate = async () => {
    const b = await createBasket(nameVal.trim() || (th ? "ตะกร้าใหม่" : "New basket"));
    setNaming(false);
    await reloadBaskets(b.id);
  };
  const delBasket = async () => {
    if (!curId || !window.confirm(th ? "ลบตะกร้านี้?" : "Delete this basket?")) return;
    await deleteBasket(curId);
    setCurId("");
    await reloadBaskets();
  };
  const removeItem = async (code: string) => {
    await removeFromBasket(curId, code);
    setItems((xs) => xs.filter((x) => x.code !== code));
    setBaskets((bs) => bs.map((b) => (b.id === curId ? { ...b, count: Math.max(0, b.count - 1) } : b)));
  };
  const todayISO = new Date().toISOString().slice(0, 10);
  // ----- แก้ในเครื่อง (ยังไม่ยิง server) -----
  const editItem = (code: string, field: "reason" | "removeBy", v: string) => { setDirty((d) => ({ ...d, [code]: { ...d[code], [field]: v } })); setSavedMsg(""); };
  const itemVal = (it: BasketItem, field: "reason" | "removeBy") => { const e = dirty[it.code]; return (e && e[field] != null) ? (e[field] as string) : (it[field] || ""); };
  const noteVal = noteDraft != null ? noteDraft : (cur?.note || "");
  const noteDirty = noteDraft != null && noteDraft !== (cur?.note || "");
  const hasChanges = Object.keys(dirty).length > 0 || noteDirty;
  const saveAll = async () => {
    if (!hasChanges || saving) return;
    setSaving(true);
    try {
      for (const code of Object.keys(dirty)) {
        const it = items.find((x) => x.code === code); if (!it) continue;
        await updateBasketItem(curId, code, { reason: itemVal(it, "reason"), removeBy: itemVal(it, "removeBy") });
      }
      if (noteDirty) await updateBasket(curId, { note: noteDraft as string });
      // sync state ในเครื่อง
      setItems((xs) => xs.map((x) => (dirty[x.code] ? { ...x, reason: itemVal(x, "reason"), removeBy: itemVal(x, "removeBy") } : x)));
      if (noteDirty) setBaskets((bs) => bs.map((b) => (b.id === curId ? { ...b, note: noteDraft } : b)));
      setDirty({}); setNoteDraft(null);
      setSavedMsg(th ? "บันทึกแล้ว ✓" : "Saved ✓");
      window.setTimeout(() => setSavedMsg(""), 3000);
    } catch { setSavedMsg(th ? "บันทึกไม่สำเร็จ" : "Save failed"); }
    finally { setSaving(false); }
  };
  const openShare = () => {
    if (!curId) return;
    setSharing(true);
    fetchCrmUsers().then(setCrmUsers).catch(() => setCrmUsers([]));
    getShares(curId).then((s) => setShareSel(new Set(s))).catch(() => setShareSel(new Set()));
  };
  const toggleShare = (code: string) => setShareSel((s) => { const n = new Set(s); if (n.has(code)) n.delete(code); else n.add(code); return n; });
  const saveShares = async () => { await setShares(curId, [...shareSel]); setSharing(false); };

  const cfg = getReadiness();
  const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(th ? "th-TH" : "en", { dateStyle: "medium" }) : (th ? "ยังไม่ติดต่อ" : "never"));
  // พร้อมใช้ (ประมาณจาก No-contact; calendarDue คำนวณภายหลัง)
  const ready = (it: BasketItem): boolean | null => {
    if (!cfg.sinceContact.on) return null;
    if (!it.lastContact) return true;
    const d = new Date(it.lastContact); d.setMonth(d.getMonth() + cfg.sinceContact.months);
    return d.getTime() <= Date.now();
  };

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err">{t("customer.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("customer.goLogin")}</button></div></div>;
  }

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{t("customer.title")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <CrmHelpButton />
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <CustomerSide active="basket" />

        <div className="crm-content">
          <div className="subbar">
            <div className="company-pick"><Box size={15} />{t("customer.menu.basket", { defaultValue: "ตะกร้ารายชื่อ" })}</div>
          </div>

          <div className="crm-body">
            {err && <div className="banner err">{err}</div>}

            {!curId ? (
              /* ===== หน้าแรก: รายการตะกร้า (กดเข้าไปดูเนื้อหา) ===== */
              <>
                <div className="bsk-glabel">{th ? "ตะกร้าของฉัน" : "My baskets"}</div>
                <div className="bsk-list">
                  {mine.map((b) => (
                    <div key={b.id} className="bsk-card" onClick={() => setCurId(b.id)}>
                      <div className="bc-ic"><Box size={18} /></div>
                      <div className="bc-main"><div className="bc-name">{b.name}</div><div className="bc-sub">{th ? `${b.count} รายชื่อ` : `${b.count} names`}</div></div>
                    </div>
                  ))}
                  <div className="bsk-card dashed" onClick={newBasket}><Plus size={16} />{th ? "ตะกร้าใหม่" : "New basket"}</div>
                </div>

                {shared.length > 0 && (
                  <>
                    <div className="bsk-glabel">{th ? "แชร์มา" : "Shared with me"}</div>
                    <div className="bsk-list">
                      {shared.map((b) => (
                        <div key={b.id} className="bsk-card shared" onClick={() => setCurId(b.id)}>
                          <div className="bc-ic"><Users size={18} /></div>
                          <div className="bc-main"><div className="bc-name">{b.name}</div><div className="bc-sub">{th ? `${b.count} รายชื่อ · แชร์โดย ${b.owner}` : `${b.count} · by ${b.owner}`}</div></div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              /* ===== เนื้อหาในตะกร้า ===== */
              <>
                <div className="bsk-head">
                  <button className="btn" style={{ padding: "5px 12px" }} onClick={() => setCurId("")}><ArrowLeft size={15} />{th ? "ตะกร้าทั้งหมด" : "All baskets"}</button>
                  <b>{cur?.name}{cur && !isOwned ? (th ? "  · แชร์มา" : "  · shared") : ""}</b>
                  {isOwned ? (
                    <>
                      <button className="btn primary" style={{ padding: "5px 14px" }} disabled={!hasChanges || saving} onClick={saveAll}>{saving ? "…" : (th ? "บันทึก" : "Save")}{hasChanges && <span className="dot" style={{ marginLeft: 6 }} />}</button>
                      {savedMsg && <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--green, #1f7a44)" }}>{savedMsg}</span>}
                      <button className="btn" style={{ padding: "5px 12px" }} onClick={openShare}><Users size={14} />{th ? "แชร์" : "Share"}</button>
                      <button className="btn" style={{ padding: "5px 12px", color: "var(--red)" }} onClick={delBasket}><Trash size={14} />{th ? "ลบ" : "Delete"}</button>
                    </>
                  ) : (
                    <span className="bsk-ro">{th ? "อ่านอย่างเดียว" : "read-only"}</span>
                  )}
                </div>

                <div className="card" style={{ marginBottom: 12 }}>
                  <div className="sh">{th ? "เหตุผลรวมของตะกร้านี้" : "Basket reason"}</div>
                  {isOwned
                    ? <textarea className="bsk-note" value={noteVal} placeholder={th ? "ทำไมถึงรวมรายชื่อชุดนี้ไว้ (เช่น แคมเปญ/เป้าหมาย)…" : "Why this set of names (campaign/goal)…"} onChange={(e) => { setNoteDraft(e.target.value); setSavedMsg(""); }} />
                    : <div className="bsk-note-ro">{cur?.note || <span className="muted">—</span>}</div>}
                </div>

                <div className="card">
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-grid">
                  <thead>
                    <tr>
                      <th>{th ? "ชื่อลูกค้า" : "Customer"}</th>
                      <th>{th ? "ประเภท" : "Type"}</th>
                      <th>{th ? "รหัส" : "Code"}</th>
                      <th>{th ? "ติดต่อล่าสุด" : "Last contact"}</th>
                      <th>{th ? "เหตุผลที่ใส่ตะกร้า" : "Reason"}</th>
                      <th>{th ? "ต้องหยิบออก" : "Remove by"}</th>
                      <th>{th ? "พร้อมใช้" : "Ready"}</th>
                      <th className="r">FO</th>
                      <th className="r">CL</th>
                      <th className="r">QT</th>
                      <th className="r">SO</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr className="empty-row"><td colSpan={12}>{t("common.loading", { defaultValue: "กำลังโหลด…" })}</td></tr>}
                    {!loading && items.length === 0 && <tr className="empty-row"><td colSpan={12}>{th ? "ตะกร้าว่าง — ใส่รายชื่อจากหน้ากลุ่ม/ลูกค้า" : "Empty — add names from groups/customers"}</td></tr>}
                    {items.map((it) => {
                      const r = ready(it);
                      const rb = itemVal(it, "removeBy");
                      const overdue = !!rb && rb < todayISO;
                      return (
                        <tr key={it.code}>
                          <td>{it.name}</td>
                          <td className="muted">{it.groupName || "—"}</td>
                          <td className="muted">{it.code}</td>
                          <td className="muted">{fmt(it.lastContact)}</td>
                          <td>{isOwned
                            ? <input className="bsk-reason" value={itemVal(it, "reason")} placeholder={th ? "เหตุผล…" : "reason…"} onChange={(e) => editItem(it.code, "reason", e.target.value)} />
                            : <span className="muted">{it.reason || "—"}</span>}</td>
                          <td>{isOwned
                            ? <input type="date" className="bsk-date" value={rb} style={overdue ? { color: "var(--red)", fontWeight: 600 } : undefined} onChange={(e) => editItem(it.code, "removeBy", e.target.value)} />
                            : <span className={overdue ? "" : "muted"} style={overdue ? { color: "var(--red)", fontWeight: 600 } : undefined}>{it.removeBy || "—"}</span>}</td>
                          <td>{r == null ? <span className="muted">—</span> : <span className={`rdy ${r ? "y" : "n"}`}>{r ? (th ? "พร้อม" : "Ready") : (th ? "ยัง" : "No")}</span>}</td>
                          <td className="r num">{it.fo}</td>
                          <td className="r num muted">—</td>
                          <td className="r num">{it.qt}</td>
                          <td className="r num">{it.so}</td>
                          <td>{isOwned && <button className="row-x del" title={th ? "เอาออก" : "Remove"} onClick={() => removeItem(it.code)}><Trash size={13} /></button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {naming && (
        <div className="grp-pop-overlay" onClick={() => setNaming(false)}>
          <div className="grp-pop" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="grp-pop-head">
              <div className="gp-title"><b>{th ? "ตะกร้าใหม่" : "New basket"}</b></div>
              <button className="gp-x" onClick={() => setNaming(false)}><X size={16} /></button>
            </div>
            <div className="grp-pop-body" style={{ padding: 16 }}>
              <label style={{ fontSize: 12.5, color: "var(--txt2)" }}>{th ? "ชื่อตะกร้า" : "Basket name"}</label>
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input autoFocus value={nameVal} onChange={(e) => setNameVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") doCreate(); }}
                style={{ width: "100%", marginTop: 6, padding: "8px 10px", border: "1px solid var(--field-bd)", borderRadius: 8, fontSize: 14 }} />
            </div>
            <div className="grp-pop-foot">
              <button className="btn" onClick={() => setNaming(false)}>{th ? "ยกเลิก" : "Cancel"}</button>
              <button className="btn primary" onClick={doCreate} disabled={!nameVal.trim()}>{th ? "สร้าง" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {sharing && (
        <div className="grp-pop-overlay" onClick={() => setSharing(false)}>
          <div className="grp-pop" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="grp-pop-head">
              <div className="gp-title"><b>{th ? "แชร์ตะกร้า" : "Share basket"}</b>{cur ? ` · ${cur.name}` : ""}</div>
              <button className="gp-x" onClick={() => setSharing(false)}><X size={16} /></button>
            </div>
            <div className="grp-pop-body">
              <div style={{ padding: "10px 16px 4px", fontSize: 12, color: "var(--txt3)" }}>{th ? "เลือกผู้ใช้ที่มีสิทธิ์ใช้โมดูลลูกค้า" : "Pick users with customer-module access"}</div>
              {crmUsers.length === 0 && <div className="muted" style={{ padding: 16 }}>{th ? "ไม่มีผู้ใช้ให้เลือก" : "No eligible users"}</div>}
              {crmUsers.map((u) => (
                <label key={u.code} className="gp-row" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={shareSel.has(u.code)} onChange={() => toggleShare(u.code)} style={{ marginRight: 8 }} />
                  <span className="gp-name">{u.name}</span>
                  <span className="gp-code">{u.code}</span>
                </label>
              ))}
            </div>
            <div className="grp-pop-foot">
              <button className="btn" onClick={() => setSharing(false)}>{th ? "ยกเลิก" : "Cancel"}</button>
              <button className="btn primary" onClick={saveShares}>{th ? "บันทึก" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
