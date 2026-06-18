import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { ChevronLeft, FileText, ArrowLeft, Save, Trash, Help, Plus, X, Lock } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import ProductItemInput from "../sales/ProductItemInput";
import { getBomRequest, saveBomRequest, deleteBomRequest, genBomReqCode, BOM_TYPES, BOM_UOMS, BOM_STATUSES, BOM_TOPICS, type BomRequest } from "./bomRequests";
import "../customer/request.css";

const today = () => new Date().toISOString().slice(0, 10);
type Comp = { item: string; code: string; type: string; desc: string; issue: string; qty: string; uom: string; scrap: string; effDate: string; op: string; unitCost: string; level: number };
const COMP_TYPES = ["RM", "SF", "PKG", "BY", "PH"];
const TYPE_CHIP: Record<string, { label: string; bg: string; fg: string }> = {
  FG: { label: "FG", bg: "#dbeafe", fg: "#1d4ed8" },
  SF: { label: "SF", bg: "#ede9fe", fg: "#6d28d9" },
  RM: { label: "RM", bg: "#dcfce7", fg: "#15803d" },
  PKG: { label: "PKG", bg: "#ffedd5", fg: "#c2410c" },
  BY: { label: "BY", bg: "#ccfbf1", fg: "#0f766e" },
  PH: { label: "Phantom", bg: "#f1f5f9", fg: "#475569" },
};
const ISSUE_OPTS = ["MN", "BF", "KB"];
const OP_OPTS = ["—", "OP-05", "OP-08", "OP-10", "OP-20", "OP-25"];
const MODAL_TITLE: Record<string, string> = { component: "Add Component", subbom: "Add Sub-BOM", phantom: "Add Phantom Item", coby: "Add Co/By-Product", edit: "แก้ไขรายการส่วนประกอบ" };
const TYPE_LABEL: Record<string, string> = { RM: "RM - Raw Material", SF: "SF - Semi-Finished", PKG: "PKG - Packaging", PH: "PH - Phantom", BY: "BY - Co/By-Product" };
const numv = (v: string) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const effQ = (c: Comp) => numv(c.qty) * (1 + numv(c.scrap) / 100);
const lineTotal = (c: Comp) => numv(c.qty) * numv(c.unitCost);

export default function ProductBomRequestForm() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { code } = useParams();
  const session = getSession();
  const me = session?.fullName || session?.email || session?.companyCode || "";
  const isNew = !code;

  const blank: BomRequest = { code: "", topic: "ADD", itemCode: "", description: "", bomType: BOM_TYPES[0], baseUom: BOM_UOMS[0], lotSize: "1", validFrom: today(), validTo: "", copyFrom: "", components: "[]", requester: me, status: BOM_STATUSES[1], savedAt: 0 };  // default = ดำเนินการ (PROCESS)
  const [f, setF] = useState<BomRequest>(blank);
  const set = (k: keyof BomRequest, v: string) => setF((s) => ({ ...s, [k]: v }));
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<"info" | "bom">("info");
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const [modal, setModal] = useState<"" | "component" | "subbom" | "phantom" | "coby" | "edit">("");
  const [mf, setMf] = useState<Record<string, string>>({});
  const mset = (k: string, v: string) => setMf((s) => ({ ...s, [k]: v }));

  useEffect(() => { if (code) { const r = getBomRequest(code); if (r) setF({ ...blank, ...r }); } }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // ส่วนประกอบ (Bill of Materials) — เก็บ JSON ในคีย์ components (มี level สำหรับ tree)
  let comps: Comp[] = [];
  try { const a = JSON.parse(f.components || "[]"); comps = Array.isArray(a) ? a.map((c) => ({ level: 1, ...c })) : []; } catch { comps = []; }
  const setComps = (nx: Comp[]) => set("components", JSON.stringify(nx));
  const updC = (i: number, patch: Partial<Comp>) => setComps(comps.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeSel = () => { if (selIdx != null && comps[selIdx]) { setComps(comps.filter((_, i) => i !== selIdx)); setSelIdx(null); } };
  const move = (dir: "up" | "down") => { if (selIdx == null) return; const j = dir === "up" ? selIdx - 1 : selIdx + 1; if (j < 0 || j >= comps.length) return; const nx = [...comps]; [nx[selIdx], nx[j]] = [nx[j], nx[selIdx]]; setComps(nx); setSelIdx(j); };
  const compCost = comps.reduce((a, c) => a + lineTotal(c), 0);
  const rmCount = comps.filter((c) => c.type === "RM").length;
  const sel = selIdx != null ? comps[selIdx] : null;
  const isSaved = f.savedAt > 0;   // ต้องบันทึกคำขอก่อน จึงจะกรอกตารางส่วนประกอบ (แท็บ 2) ได้

  const openModal = (k: typeof modal) => {
    const def: Record<string, Record<string, string>> = {
      component: { item: "", desc: "", type: "RM", qty: "1", uom: f.baseUom, scrap: "0", issue: "MN", op: "—", effDate: f.validFrom || today(), pos: "end" },
      subbom: { item: "", qty: "1", scrap: "0", issue: "BF", op: "OP-10" },
      phantom: { item: "", desc: "", qty: "1", op: "OP-10" },
      coby: { item: "", prodType: "By-Product", qty: "0.030", uom: "KG", valuation: "Residual Value", op: "OP-05" },
    };
    setMf({ ...(def[k as string] || {}) }); setModal(k);
  };
  // คลิกแถว → เลือก + เปิด popup แก้ไข (ไม่แก้ inline ในตารางแล้ว)
  const openEdit = (i: number) => {
    const c = comps[i]; if (!c) return;
    setSelIdx(i);
    setMf({ item: c.item, code: c.code || "", desc: c.desc, type: c.type, qty: c.qty, uom: c.uom, scrap: c.scrap, issue: c.issue, op: c.op, effDate: c.effDate, unitCost: c.unitCost });
    setModal("edit");
  };
  const confirmAdd = () => {
    if (modal === "edit") {
      if (selIdx == null) return;
      updC(selIdx, { item: mf.item, code: mf.code || "", desc: mf.desc, type: mf.type, qty: mf.qty || "1", uom: mf.uom, scrap: mf.scrap || "0", issue: mf.issue, op: mf.op, effDate: mf.effDate, unitCost: mf.unitCost || "0" });
      setModal(""); return;
    }
    let comp: Comp; let mode: "end" | "before" | "after" = "end";
    if (modal === "component") {
      comp = { item: mf.item, code: "", type: mf.type, desc: mf.desc, issue: mf.issue, qty: mf.qty || "1", uom: mf.uom, scrap: mf.scrap || "0", effDate: mf.effDate, op: mf.op, unitCost: "0", level: sel?.level ?? 1 };
      mode = (mf.pos as "end" | "before" | "after") || "end";
    } else if (modal === "subbom") {
      comp = { item: mf.item, code: "", type: "SF", desc: "", issue: mf.issue, qty: mf.qty || "1", uom: f.baseUom, scrap: mf.scrap || "0", effDate: f.validFrom || today(), op: mf.op, unitCost: "0", level: (sel?.level ?? 0) + 1 }; mode = "after";
    } else if (modal === "phantom") {
      comp = { item: mf.item, code: "", type: "PH", desc: mf.desc, issue: "BF", qty: mf.qty || "1", uom: f.baseUom, scrap: "0", effDate: f.validFrom || today(), op: mf.op, unitCost: "0", level: (sel?.level ?? 0) + 1 }; mode = "after";
    } else {
      const by = (mf.prodType || "").startsWith("By");
      comp = { item: mf.item, code: "", type: "BY", desc: mf.valuation || "", issue: "BF", qty: by ? `-${mf.qty}` : mf.qty, uom: mf.uom, scrap: "0", effDate: f.validFrom || today(), op: mf.op, unitCost: "0", level: (sel?.level ?? 0) + 1 }; mode = "after";
    }
    const list = [...comps];
    if (selIdx == null || mode === "end") list.push(comp);
    else if (mode === "before") list.splice(selIdx, 0, comp);
    else list.splice(selIdx + 1, 0, comp);
    setComps(list); setModal("");
  };

  const onSave = () => {
    if (!f.itemCode.trim()) { alert(f.topic === "ADD" ? "กรอก Item Code" : "ค้นหา/เลือกสินค้าก่อน"); return; }
    const saved: BomRequest = { ...f, code: f.code || genBomReqCode(), requester: f.requester || me, savedAt: Date.now() };
    saveBomRequest(saved);
    setF(saved);   // อยู่ที่ฟอร์มต่อ — แท็บ "รายการส่วนประกอบ (BOM)" จะปลดล็อก
    if (isNew) nav(`/product/bom/requests/${encodeURIComponent(saved.code)}`, { replace: true });
  };
  const onDelete = () => { if (code && window.confirm("ลบคำขอนี้?")) { deleteBomRequest(code); nav("/product/bom/requests"); } };

  if (!session) return <div className="p-qt p-req"><div style={{ padding: 24 }}><div className="banner err">{t("customer.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("customer.goLogin")}</button></div></div>;

  const isAdd = f.topic === "ADD";
  const cellTd: React.CSSProperties = { padding: "4px 6px", borderBottom: "1px solid var(--line-soft)" };
  const inp: React.CSSProperties = { width: "100%", padding: "5px 7px", border: "1px solid var(--field-bd, #cbd3dd)", borderRadius: 6, fontSize: 12 };
  const tb: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, padding: "5px 10px", border: "1px solid var(--line)", borderRadius: 6, background: "#fff", cursor: "pointer", color: "var(--txt)" };
  const R = (label: string, ctrl: React.ReactNode) => (<div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 10, alignItems: "center" }}><label style={{ fontSize: 12.5, color: "var(--txt2)" }}>{label}</label><div>{ctrl}</div></div>);

  return (
    <div className="p-qt p-req">
      <div className="topbar">
        <div className="qtag" style={{ background: "#0a84ff" }}>BOM</div>
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="doctitle">คำขอดำเนินการสูตรการผลิต (BOM)</div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="main">
        <div className={`dtree${collapsed ? " collapsed" : ""}`}>
          <div className="th"><span>เอกสาร</span><div className="collapse-btn" onClick={() => setCollapsed((c) => !c)}><ChevronLeft size={16} /></div></div>
          <div className="tlist">
            <div className="titem qt sel"><FileText />{f.code || "ใหม่ (ยังไม่บันทึก)"}</div>
            {f.itemCode && <div className="titem child"><FileText size={14} />{f.itemCode}{f.description ? ` · ${f.description}` : ""}</div>}
          </div>
          <div className="dnote">ประเภทคำขอ: <b>{BOM_TOPICS.find((x) => x.v === f.topic)?.th}</b></div>
        </div>

        <div className="workzone">
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav("/product/bom/requests")}><ArrowLeft /><span>กลับ</span></div>
            <div className="tbsep" />
            <div className="tbtn primary" onClick={onSave}><Save /><span>บันทึก</span></div>
            {!isNew && <div className="tbtn" onClick={onDelete} style={{ color: "var(--red)" }}><Trash /><span>ลบ</span></div>}
          </div>

          <div className="tabs">
            <div className={`tab${tab === "info" ? " active" : ""}`} onClick={() => setTab("info")}>ข้อมูลคำขอ</div>
            <div className={`tab${tab === "bom" ? " active" : ""}${!isSaved ? " locked" : ""}`}
                 onClick={() => { if (isSaved) setTab("bom"); }}
                 title={!isSaved ? "บันทึกคำขอก่อน จึงจะกรอกรายการส่วนประกอบได้" : undefined}
                 style={!isSaved ? { color: "var(--txt3)", cursor: "default" } : undefined}>
              รายการส่วนประกอบ (BOM){!isSaved && <Lock size={12} style={{ marginLeft: 5, verticalAlign: "-1px" }} />}
            </div>
          </div>

          <div className="content">
            <div className="center">
              {tab === "info" && <>
              <div className="sect">
                <div className="sh">รายละเอียดคำขอ</div>
                <div className="cols2">
                  <div className="field">
                    <label>ประเภทคำขอ</label>
                    <div className="ctrl"><select value={f.topic} onChange={(e) => { set("topic", e.target.value); }}>{BOM_TOPICS.map((tp) => <option key={tp.v} value={tp.v}>{tp.th}</option>)}</select></div>
                  </div>
                  <div className="field">
                    <label>{isAdd ? "Item Code *" : "ค้นหาสินค้า *"}</label>
                    <div className="ctrl">
                      {isAdd
                        ? <input value={f.itemCode} onChange={(e) => set("itemCode", e.target.value)} placeholder="FG-XXXX" />
                        : <ProductItemInput value={f.itemCode} onChange={(name) => set("itemCode", name)} onPick={(p) => setF((s) => ({ ...s, itemCode: p.code, description: p.name }))} placeholder="พิมพ์รหัส/ชื่อสินค้า (ค้นจากระบบ)" />}
                    </div>
                  </div>
                </div>
              </div>

              <div className="sect">
                <div className="sh">ข้อมูลสูตรการผลิต (BOM)</div>
                <div className="cols2">
                  <div className="field"><label>Description</label><div className="ctrl"><input value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="ชื่อสินค้า" /></div></div>
                  <div className="field"><label>BOM Type</label><div className="ctrl"><select value={f.bomType} onChange={(e) => set("bomType", e.target.value)}>{BOM_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}</select></div></div>
                  <div className="field"><label>Base UoM</label><div className="ctrl"><select value={f.baseUom} onChange={(e) => set("baseUom", e.target.value)}>{BOM_UOMS.map((o) => <option key={o} value={o}>{o}</option>)}</select></div></div>
                  <div className="field"><label>Lot Size</label><div className="ctrl"><input type="number" min="1" value={f.lotSize} onChange={(e) => set("lotSize", e.target.value)} /></div></div>
                  <div className="field"><label>Valid From</label><div className="ctrl"><input type="date" value={f.validFrom} onChange={(e) => set("validFrom", e.target.value)} /></div></div>
                  <div className="field"><label>Valid To</label><div className="ctrl"><input type="date" value={f.validTo} onChange={(e) => set("validTo", e.target.value)} /></div></div>
                  <div className="field"><label>สถานะ</label><div className="ctrl"><select value={f.status} onChange={(e) => set("status", e.target.value)}>{BOM_STATUSES.map((o) => <option key={o} value={o}>{o}</option>)}</select></div></div>
                </div>
              </div>
              </>}

              {tab === "bom" && (
              <div className="sect">
                <div className="sh" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>รายการส่วนประกอบ (Bill of Materials)</span>
                  <span style={{ marginLeft: "auto", fontWeight: 400, fontSize: 11.5, color: "var(--txt2)" }}>
                    Components: <b>{comps.length}</b> · RM: <b>{rmCount}</b> · Cost: <b style={{ color: "var(--blue)" }}>฿ {compCost.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                  </span>
                </div>

                {/* toolbar */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  <button type="button" style={tb} onClick={() => openModal("component")}><Plus size={13} style={{ color: "var(--green)" }} />Add Component</button>
                  <button type="button" style={tb} onClick={() => openModal("subbom")}>Sub-BOM</button>
                  <button type="button" style={tb} onClick={() => openModal("phantom")}>Phantom</button>
                  <button type="button" style={tb} onClick={() => openModal("coby")}>Co/By-Product</button>
                  <span style={{ width: 1, background: "var(--line)", margin: "0 3px" }} />
                  <button type="button" style={{ ...tb, color: selIdx == null ? "var(--txt3)" : "var(--red)", opacity: selIdx == null ? 0.5 : 1 }} onClick={removeSel}><Trash size={13} />Remove</button>
                  <button type="button" style={tb} onClick={() => move("up")} title="เลื่อนขึ้น">↑</button>
                  <button type="button" style={tb} onClick={() => move("down")} title="เลื่อนลง">↓</button>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: 1080, borderCollapse: "collapse" }}>
                    <thead><tr style={{ textAlign: "left", fontSize: 10.5, color: "var(--txt2)", background: "var(--bg)" }}>
                      <th style={{ ...cellTd, width: 30 }}>Lv</th><th style={{ ...cellTd, width: 56 }}>Type</th><th style={{ ...cellTd, minWidth: 150 }}>Item Code</th>
                      <th style={{ ...cellTd, minWidth: 150 }}>Description</th><th style={{ ...cellTd, width: 60 }}>Issue</th>
                      <th style={{ ...cellTd, width: 64 }}>Qty/1</th><th style={{ ...cellTd, width: 64 }}>UoM</th><th style={{ ...cellTd, width: 60 }}>Scrap%</th>
                      <th style={{ ...cellTd, width: 64, textAlign: "right" }}>Eff.Qty</th><th style={{ ...cellTd, width: 120 }}>Eff.Date</th>
                      <th style={{ ...cellTd, width: 90 }}>Op Link</th><th style={{ ...cellTd, width: 74 }}>Unit Cost</th>
                      <th style={{ ...cellTd, width: 74, textAlign: "right" }}>Total</th><th style={{ ...cellTd, width: 30 }} />
                    </tr></thead>
                    <tbody>
                      {/* แถวแรก = FG (Lv 0) จากหัวเอกสาร · ต้นทุน = ผลรวมส่วนประกอบ */}
                      <tr style={{ background: "#eef1f7" }}>
                        <td style={{ ...cellTd, textAlign: "center", fontWeight: 700 }}>0</td>
                        <td style={cellTd}><span style={{ background: TYPE_CHIP.FG.bg, color: TYPE_CHIP.FG.fg, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10 }}>FG</span></td>
                        <td style={cellTd}><b>{f.itemCode || "—"}</b></td>
                        <td style={cellTd}>{f.description || "—"}</td>
                        <td style={{ ...cellTd, textAlign: "center" }}>MN</td>
                        <td style={{ ...cellTd, textAlign: "right" }}>1</td>
                        <td style={cellTd}>{f.baseUom}</td>
                        <td style={{ ...cellTd, textAlign: "right" }}>0.00%</td>
                        <td style={{ ...cellTd, textAlign: "right" }}>1.000</td>
                        <td style={cellTd}>{f.validFrom || "—"}</td>
                        <td style={cellTd}>—</td>
                        <td style={{ ...cellTd, textAlign: "right" }}>{compCost.toFixed(2)}</td>
                        <td style={{ ...cellTd, textAlign: "right", fontWeight: 700 }}>{compCost.toFixed(2)}</td>
                        <td style={cellTd} />
                      </tr>
                      {comps.length === 0 ? (
                        <tr><td colSpan={14} style={{ ...cellTd, color: "var(--txt3)", fontSize: 12.5, textAlign: "center", padding: 12 }}>ยังไม่มีส่วนประกอบ — กดปุ่มด้านบนเพื่อเพิ่ม</td></tr>
                      ) : comps.map((c, i) => {
                        const chip = TYPE_CHIP[c.type] || TYPE_CHIP.RM;
                        const tot = lineTotal(c); const neg = tot < 0;
                        return (
                          <tr key={i} onClick={() => openEdit(i)} title="คลิกเพื่อแก้ไขใน popup" style={{ background: selIdx === i ? "#fff8f5" : undefined, cursor: "pointer" }}>
                            <td style={{ ...cellTd, textAlign: "center", color: "var(--txt3)" }}>{c.level}</td>
                            <td style={cellTd}><span style={{ background: chip.bg, color: chip.fg, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10 }}>{chip.label}</span></td>
                            <td style={{ ...cellTd, paddingLeft: 6 + c.level * 16, fontWeight: 600 }}>{c.item || "—"}</td>
                            <td style={{ ...cellTd, color: "var(--txt2)" }}>{c.desc || "—"}</td>
                            <td style={{ ...cellTd, textAlign: "center" }}>{c.issue}</td>
                            <td style={{ ...cellTd, textAlign: "right" }}>{numv(c.qty).toLocaleString("th-TH", { maximumFractionDigits: 3 })}</td>
                            <td style={cellTd}>{c.uom}</td>
                            <td style={{ ...cellTd, textAlign: "right" }}>{numv(c.scrap).toFixed(1)}%</td>
                            <td style={{ ...cellTd, textAlign: "right", color: "var(--txt2)" }}>{effQ(c).toFixed(3)}</td>
                            <td style={{ ...cellTd, color: "var(--txt2)" }}>{c.effDate || "—"}</td>
                            <td style={{ ...cellTd, textAlign: "center" }}>{c.op}</td>
                            <td style={{ ...cellTd, textAlign: "right" }}>{numv(c.unitCost).toFixed(2)}</td>
                            <td style={{ ...cellTd, textAlign: "right", fontWeight: 600, color: neg ? "var(--red)" : "var(--txt)" }}>{neg ? `(${Math.abs(tot).toFixed(2)})` : tot.toFixed(2)}</td>
                            <td style={{ ...cellTd, textAlign: "center" }}><button type="button" title="ลบ" onClick={(e) => { e.stopPropagation(); setComps(comps.filter((_, idx) => idx !== i)); if (selIdx === i) setSelIdx(null); }} style={{ border: "none", background: "none", color: "var(--red)", cursor: "pointer" }}><Trash size={14} /></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <div onClick={() => setModal("")} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center", zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 400, maxWidth: "92vw", background: "#fff", borderRadius: 10, boxShadow: "0 18px 48px rgba(0,0,0,.28)", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--line)", fontWeight: 700, fontSize: 14 }}>
              <span>{MODAL_TITLE[modal]}</span><button type="button" onClick={() => setModal("")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--txt2)" }}><X size={16} /></button>
            </div>
            <div style={{ padding: 16, display: "grid", gap: 10, maxHeight: "70vh", overflow: "auto" }}>
              {sel && <div style={{ fontSize: 11.5, color: "var(--txt3)" }}>{modal === "component" ? "เพิ่มสัมพันธ์กับแถวที่เลือก" : `เพิ่มเป็นลูกของ: ${sel.item || "(แถวที่เลือก)"}`}</div>}
              {modal === "component" && <>
                {R("Item Code", <input value={mf.item || ""} onChange={(e) => mset("item", e.target.value)} placeholder="RM-XXXX / SF-XXXX" style={inp} />)}
                {R("Description", <input value={mf.desc || ""} onChange={(e) => mset("desc", e.target.value)} placeholder="ชื่อ component" style={inp} />)}
                {R("Item Type", <select value={mf.type} onChange={(e) => mset("type", e.target.value)} style={inp}><option value="RM">RM - Raw Material</option><option value="SF">SF - Semi-Finished</option><option value="PKG">PKG - Packaging</option></select>)}
                {R("Qty per 1 FG", <input type="number" step="0.001" value={mf.qty || ""} onChange={(e) => mset("qty", e.target.value)} style={inp} />)}
                {R("Unit of Measure", <select value={mf.uom} onChange={(e) => mset("uom", e.target.value)} style={inp}>{BOM_UOMS.map((o) => <option key={o} value={o}>{o}</option>)}</select>)}
                {R("Scrap %", <input type="number" step="0.1" min="0" value={mf.scrap || ""} onChange={(e) => mset("scrap", e.target.value)} style={inp} />)}
                {R("Issue Method", <select value={mf.issue} onChange={(e) => mset("issue", e.target.value)} style={inp}><option value="MN">Manual Issue</option><option value="BF">Backflush</option><option value="KB">Kanban</option></select>)}
                {R("Operation Link", <select value={mf.op} onChange={(e) => mset("op", e.target.value)} style={inp}>{OP_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}</select>)}
                {R("Effective Date", <input type="date" value={mf.effDate || ""} onChange={(e) => mset("effDate", e.target.value)} style={inp} />)}
                {R("Insert Position", <select value={mf.pos} onChange={(e) => mset("pos", e.target.value)} style={inp}><option value="end">ท้ายสุด</option><option value="before">ก่อน row ที่เลือก</option><option value="after">หลัง row ที่เลือก</option></select>)}
              </>}
              {modal === "subbom" && <>
                <div style={{ fontSize: 11.5, background: "#eff6ff", color: "#1d4ed8", padding: "8px 10px", borderRadius: 6 }}>ระบบ inherit BOM ของ SF item อัตโนมัติหาก SF มี BOM แล้ว</div>
                {R("SF Item Code", <input value={mf.item || ""} onChange={(e) => mset("item", e.target.value)} placeholder="SF-XXXX" style={inp} />)}
                {R("Quantity", <input type="number" step="0.001" value={mf.qty || ""} onChange={(e) => mset("qty", e.target.value)} style={inp} />)}
                {R("Scrap %", <input type="number" step="0.1" value={mf.scrap || ""} onChange={(e) => mset("scrap", e.target.value)} style={inp} />)}
                {R("Issue Method", <select value={mf.issue} onChange={(e) => mset("issue", e.target.value)} style={inp}><option value="BF">Backflush</option><option value="MN">Manual</option></select>)}
                {R("Operation Link", <select value={mf.op} onChange={(e) => mset("op", e.target.value)} style={inp}>{OP_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}</select>)}
              </>}
              {modal === "phantom" && <>
                <div style={{ fontSize: 11.5, background: "#f0fdfa", color: "#0f766e", padding: "8px 10px", borderRadius: 6 }}>Phantom = sub-assembly ไม่มี stock จริง ระบบ explode ลง level ถัดไปโดยตรง</div>
                {R("Phantom Code", <input value={mf.item || ""} onChange={(e) => mset("item", e.target.value)} placeholder="PH-XXXX" style={inp} />)}
                {R("Description", <input value={mf.desc || ""} onChange={(e) => mset("desc", e.target.value)} placeholder="Virtual Assembly..." style={inp} />)}
                {R("Quantity", <input type="number" step="0.001" value={mf.qty || ""} onChange={(e) => mset("qty", e.target.value)} style={inp} />)}
                {R("Operation Link", <select value={mf.op} onChange={(e) => mset("op", e.target.value)} style={inp}>{OP_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}</select>)}
              </>}
              {modal === "coby" && <>
                <div style={{ fontSize: 11.5, background: "#fffbeb", color: "#b45309", padding: "8px 10px", borderRadius: 6 }}>By-product = ผลพลอยได้ (ลด cost FG) | Co-product = สินค้าร่วม (มีมูลค่า+)</div>
                {R("Item Code", <input value={mf.item || ""} onChange={(e) => mset("item", e.target.value)} placeholder="BY-XXXX / CO-XXXX" style={inp} />)}
                {R("Product Type", <select value={mf.prodType} onChange={(e) => mset("prodType", e.target.value)} style={inp}><option>By-Product (deduct FG cost)</option><option>Co-Product (produced together)</option></select>)}
                {R("Qty per batch", <input type="number" step="0.001" value={mf.qty || ""} onChange={(e) => mset("qty", e.target.value)} style={inp} />)}
                {R("UoM", <select value={mf.uom} onChange={(e) => mset("uom", e.target.value)} style={inp}><option>KG</option><option>PCS</option></select>)}
                {R("Valuation", <select value={mf.valuation} onChange={(e) => mset("valuation", e.target.value)} style={inp}><option>Residual Value</option><option>Sales Price</option><option>No Value</option></select>)}
                {R("Op Link", <select value={mf.op} onChange={(e) => mset("op", e.target.value)} style={inp}>{OP_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}</select>)}
              </>}
              {modal === "edit" && <>
                {R("Item Code", <ProductItemInput value={mf.item || ""} onChange={(name) => mset("item", name)} onPick={(p) => setMf((s) => ({ ...s, item: p.name, code: p.code, desc: s.desc || p.name, unitCost: p.price || s.unitCost }))} placeholder="ค้นหา/พิมพ์รหัสส่วนประกอบ" />)}
                {R("Description", <input value={mf.desc || ""} onChange={(e) => mset("desc", e.target.value)} placeholder="ชื่อ component" style={inp} />)}
                {R("Item Type", <select value={mf.type} onChange={(e) => mset("type", e.target.value)} style={inp}>{COMP_TYPES.map((tp) => <option key={tp} value={tp}>{TYPE_LABEL[tp] || tp}</option>)}</select>)}
                {R("Qty per 1 FG", <input type="number" step="0.001" value={mf.qty || ""} onChange={(e) => mset("qty", e.target.value)} style={{ ...inp, textAlign: "right" }} />)}
                {R("Unit of Measure", <select value={mf.uom} onChange={(e) => mset("uom", e.target.value)} style={inp}>{BOM_UOMS.map((o) => <option key={o} value={o}>{o}</option>)}</select>)}
                {R("Scrap %", <input type="number" step="0.1" min="0" value={mf.scrap || ""} onChange={(e) => mset("scrap", e.target.value)} style={{ ...inp, textAlign: "right" }} />)}
                {R("Issue Method", <select value={mf.issue} onChange={(e) => mset("issue", e.target.value)} style={inp}>{ISSUE_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}</select>)}
                {R("Operation Link", <select value={mf.op} onChange={(e) => mset("op", e.target.value)} style={inp}>{OP_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}</select>)}
                {R("Effective Date", <input type="date" value={mf.effDate || ""} onChange={(e) => mset("effDate", e.target.value)} style={inp} />)}
                {R("Unit Cost", <input type="number" step="0.01" value={mf.unitCost || ""} onChange={(e) => mset("unitCost", e.target.value)} style={{ ...inp, textAlign: "right" }} />)}
              </>}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "12px 16px", borderTop: "1px solid var(--line)" }}>
              <button type="button" className="btn" onClick={() => setModal("")}>ยกเลิก</button>
              <button type="button" className="btn primary" onClick={confirmAdd}>{modal === "edit" ? "บันทึก" : "Add"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
