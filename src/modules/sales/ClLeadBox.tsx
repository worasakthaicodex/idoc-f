import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";
import { Plus, X, Trash, Box, Download, Search } from "../../shared/icons";
import { getReadiness } from "../customer/customerReadinessConfig";
import { readinessActive } from "../customer/customerReadiness";
import { getSearchFields } from "../customer/customerSearchConfig";
import { isSelectField } from "../customer/customerFields";
import { getFieldOptions } from "../customer/customerFieldOptions";
import { listBaskets, type Basket } from "../customer/basketStore";
import { fetchClLeads, fetchClPullLog, resolveClLeads, saveClLeads, currentUser, type ClPullLog, type LeadPreview, type ResolveBody, type StagedLog } from "./clLeads";

type GC = { value: string | null; count: number };
type Counts = Record<"groupName" | "grade" | "businessType", GC[]>;
type YC = { year: number; count: number };
type Buckets = { fo: YC[]; qt: YC[]; so: YC[]; contactedNotClosed: number; neverContacted: number; calendarAhead: number };
type WL = { code: string; name: string; groupName?: string | null; lastContact?: string | null; usedCount?: number };
const FIELDS: (keyof Counts)[] = ["groupName", "grade", "businessType"];

export type ClLeadBoxHandle = { save: () => void };

/** แท็บ "รายชื่อ" ของ CL — ร่างชุดในหน้า (ดึง/นำออก) จนกดบันทึกใน toolbar · 4 แหล่ง + ยืนยันตอนดึงจากตะกร้า */
const ClLeadBox = forwardRef<ClLeadBoxHandle, { code: string; onDirty?: (d: boolean) => void; readOnly?: boolean }>(({ code, onDirty, readOnly }, ref) => {
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const tenant = getSession()?.companyId ?? "";

  const [working, setWorking] = useState<WL[]>([]);     // ชุดร่างปัจจุบัน
  const [stagedLogs, setStagedLogs] = useState<StagedLog[]>([]);
  const [committedLog, setCommittedLog] = useState<ClPullLog[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  // แหล่งนำเข้า
  const [src, setSrc] = useState<"group" | "sales" | "filter" | "basket">("group");
  const [field, setField] = useState<keyof Counts>("groupName");
  const [counts, setCounts] = useState<Counts | null>(null);
  const [buckets, setBuckets] = useState<Buckets | null>(null);
  const [sel, setSel] = useState<{ kind: string; field?: keyof Counts; value?: string; bucket?: string; year?: number; label: string } | null>(null);
  const [fmode, setFmode] = useState<"quick" | "adv">("quick");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [selBasket, setSelBasket] = useState("");
  const [qty, setQty] = useState(60);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ rows: LeadPreview[]; from: string } | null>(null);
  const [found, setFound] = useState<LeadPreview[] | null>(null);   // ผลค้นหา (filter) — โชว์จำนวนก่อนเพิ่ม
  useEffect(() => { setFound(null); }, [q, filters, fmode, src, sel]);

  const rdActive = readinessActive();
  const fieldLabel = (k: string) => t(`custFields.${k}`, { defaultValue: k });
  const yLabel = (y: number) => (th ? y + 543 : y);
  const searchFields = getSearchFields();
  const dirty = stagedLogs.length > 0;

  const readyBody = (): Partial<ResolveBody> => {
    if (!rdActive) return { ready: "all" };
    const cfg = getReadiness();
    const o: Partial<ResolveBody> = { ready: "ready" };
    if (cfg.sinceContact.on) o.sinceContactMonths = cfg.sinceContact.months;
    if (cfg.calendarDue.on) o.calendarDays = cfg.calendarDue.days;
    return o;
  };

  const loadCommitted = () => {
    if (!tenant) return;
    fetchClLeads(code).then((rows) => setWorking(rows.map((r) => ({ code: r.code, name: r.name, groupName: r.groupName, lastContact: r.lastContact, usedCount: r.usedCount })))).catch(() => {});
    fetchClPullLog(code).then(setCommittedLog).catch(() => {});
  };
  useEffect(() => { loadCommitted(); setStagedLogs([]); /* eslint-disable-next-line */ }, [code, tenant]);
  useEffect(() => { onDirty?.(dirty); /* eslint-disable-next-line */ }, [dirty]);

  useEffect(() => {
    if (!showAdd || !tenant) return;
    const qp = new URLSearchParams(readyBody() as Record<string, string>);
    if (src === "group" && !counts) apiFetch<Counts>(`/customers/group-counts?${qp.toString()}`, { tenant }).then(setCounts).catch(() => {});
    if (src === "sales" && !buckets) { qp.set("years", "5"); apiFetch<Buckets>(`/customers/sales-buckets?${qp.toString()}`, { tenant }).then(setBuckets).catch(() => {}); }
    if (src === "basket" && baskets.length === 0) listBaskets().then(setBaskets).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdd, src, tenant]);

  const rows = counts?.[field] ?? [];
  const totalReady = useMemo(() => rows.reduce((a, r) => a + r.count, 0), [rows]);
  const has = (c: string) => working.some((w) => w.code === c);

  // เพิ่มรายการลงชุดร่าง + บันทึก log ค้าง
  const stage = (previews: LeadPreview[], method: string, detail: string) => {
    const add = previews.filter((p) => !has(p.code));
    if (add.length === 0) { alert(th ? "ไม่มีรายชื่อใหม่ (อาจอยู่ในชุดแล้ว)" : "No new leads"); return; }
    setWorking((w) => [...add.map((p) => ({ code: p.code, name: p.name, groupName: p.groupName, lastContact: p.lastContact, usedCount: p.usedCount })), ...w]);
    setStagedLogs((l) => [{ method, detail, cnt: add.length, by: currentUser() }, ...l]);
  };

  const doPull = async () => {
    setBusy(true);
    try {
      const lim = qty || 60;
      if (src === "basket") {
        if (!selBasket) { alert(th ? "เลือกตะกร้าก่อน" : "Pick a basket"); return; }
        const bname = baskets.find((b) => b.id === selBasket)?.name ?? selBasket;
        const prev = await resolveClLeads(code, { fromBasket: true, basketId: selBasket, ...readyBody() });
        const fresh = prev.filter((p) => !has(p.code));
        if (fresh.length === 0) { alert(th ? "ตะกร้านี้ไม่มีรายชื่อใหม่" : "No new leads in this basket"); return; }
        setConfirm({ rows: fresh, from: bname });
        return;
      }
      let body: ResolveBody = { ...readyBody(), limit: lim };
      let method = "GROUP", detail = "";
      if (src === "filter") {
        if (!found) { alert(th ? "กดค้นหาก่อน เพื่อดูจำนวนที่พบ" : "Press Search first"); return; }
        const add = found.slice(0, lim);
        if (add.length === 0) { alert(th ? "ไม่มีรายชื่อใหม่ตามที่ค้น" : "No new leads"); return; }
        const det = fmode === "quick" ? `${th ? "ค้น" : "Search"}: ${q.trim()}` : Object.entries(filters).filter(([, v]) => v && v.trim()).map(([k, v]) => `${fieldLabel(k)}=${v}`).join(", ");
        stage(add, "FILTER", det);
        return;
      } else if (sel?.kind === "all") { detail = th ? "ทั้งหมด (พร้อมใช้)" : "All (ready)"; method = "FILTER"; }
      else if (sel?.kind === "group") { body = { ...body, field: sel.field, value: sel.value }; detail = `${fieldLabel(sel.field!)}: ${sel.value}`; }
      else if (sel?.kind === "bucket") { body = { ...body, bucket: sel.bucket, year: sel.year }; detail = sel.label; }
      else { alert(th ? "เลือกเกณฑ์ก่อน" : "Pick a source first"); return; }
      const prev = await resolveClLeads(code, body);
      stage(prev, method, detail);
    } catch { alert(th ? "ดึงไม่สำเร็จ" : "Resolve failed"); }
    finally { setBusy(false); }
  };

  // ค้นหา (เฉพาะ filter) — โชว์จำนวนที่พบก่อนเพิ่มเข้าชุด
  const doSearch = async () => {
    setBusy(true);
    try {
      let body: ResolveBody = { ...readyBody(), limit: 1000 };
      if (fmode === "quick") { if (!q.trim()) { alert(th ? "พิมพ์คำค้นก่อน" : "Enter a keyword"); return; } body = { ...body, q: q.trim() }; }
      else { const f = Object.fromEntries(Object.entries(filters).filter(([, v]) => v && v.trim())); if (!Object.keys(f).length) { alert(th ? "กรอกตัวกรองก่อน" : "Set a filter"); return; } body = { ...body, filters: f }; }
      const prev = await resolveClLeads(code, body);
      setFound(prev.filter((p) => !has(p.code)));
    } catch { alert(th ? "ค้นหาไม่สำเร็จ" : "Search failed"); }
    finally { setBusy(false); }
  };

  // ยืนยันดึงจากตะกร้า ตามตัวเลือก
  const confirmBasket = (mode: "ready" | "usable" | "all") => {
    if (!confirm) return;
    const pick = confirm.rows.filter((r) => mode === "ready" ? (r.ready && !r.inOtherCl) : mode === "usable" ? !r.inOtherCl : true);
    const limited = pick.slice(0, qty || 60);
    const note = mode === "ready" ? (th ? "เฉพาะพร้อมใช้" : "ready only") : mode === "usable" ? (th ? "ไม่ติด CL อื่น" : "not in other CL") : (th ? "ทั้งหมด" : "all");
    if (limited.length === 0) { alert(th ? "ไม่มีรายชื่อตามที่เลือก" : "Nothing matches"); setConfirm(null); return; }
    stage(limited, "BASKET", `${th ? "ตะกร้า" : "Basket"} ${confirm.from} · ${note}`);
    setConfirm(null);
  };

  const onRemove = (c: string) => {
    setWorking((w) => w.filter((x) => x.code !== c));
    setStagedLogs((l) => [{ method: "REMOVE", detail: c, cnt: 1, by: currentUser() }, ...l]);
  };

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await saveClLeads(code, working.map((w) => w.code), stagedLogs, currentUser());
      setStagedLogs([]);
      loadCommitted();
      alert(th ? "บันทึกแล้ว" : "Saved");
    } catch { alert(th ? "บันทึกไม่สำเร็จ" : "Save failed"); }
    finally { setSaving(false); }
  };
  useImperativeHandle(ref, () => ({ save }));

  const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(th ? "th-TH" : "en", { dateStyle: "medium" }) : "—");
  const fmtDt = (iso: string) => new Date(iso).toLocaleString(th ? "th-TH" : "en", { dateStyle: "medium", timeStyle: "short" });
  const bChip = (bucket: string, year: number | undefined, label: string, count: number) => (
    <button className={`ms-chip${sel?.kind === "bucket" && sel.bucket === bucket && sel.year === year ? " on" : ""}`} onClick={() => setSel({ kind: "bucket", bucket, year, label })}>{label} · {count}</button>
  );
  const cReady = confirm ? confirm.rows.filter((r) => r.ready && !r.inOtherCl).length : 0;
  const cNotReady = confirm ? confirm.rows.filter((r) => !r.ready && !r.inOtherCl).length : 0;
  const cOther = confirm ? confirm.rows.filter((r) => r.inOtherCl).length : 0;
  const cUsed = confirm ? confirm.rows.filter((r) => r.usedCount > 0).length : 0;

  return (
    <div className="rpt cl-leadbox">
      <div className="cl-lead-cols">
        <div className="cl-lead-list">
          <div className="rpt-card">
            <div className="cl-lead-head">
              <span>{th ? "รายชื่อในชุด (ร่าง)" : "Leads (draft)"} · <b>{working.length}</b> {th ? "ราย" : ""}{dirty && <span className="cl-dirty">{th ? "ยังไม่บันทึก" : "unsaved"}</span>}</span>
              {!readOnly && <button className="btn primary" style={{ marginLeft: "auto", padding: "7px 14px" }} onClick={() => setShowAdd((s) => !s)}><Plus size={15} />{th ? "เพิ่มรายชื่อ" : "Add leads"}</button>}
            </div>
            <table className="data-grid">
              <thead><tr><th>{th ? "ชื่อลูกค้า" : "Customer"}</th><th>{th ? "รหัส" : "Code"}</th><th>{th ? "กลุ่ม" : "Group"}</th><th>{th ? "ติดต่อล่าสุด" : "Last contact"}</th><th>{th ? "เคยใช้ (รอบ)" : "Used"}</th><th></th></tr></thead>
              <tbody>
                {working.length === 0 ? (
                  <tr className="empty-row"><td colSpan={6}>{th ? "ยังไม่มีรายชื่อ — กด “เพิ่มรายชื่อ”" : "No leads yet — click “Add leads”"}</td></tr>
                ) : working.map((l) => (
                  <tr key={l.code}><td>{l.name}</td><td className="docno">{l.code}</td><td>{l.groupName || "—"}</td><td className="muted">{fmt(l.lastContact)}</td>
                    <td>{l.usedCount ? <span className="cl-used">{l.usedCount}</span> : <span className="muted">—</span>}</td>
                    <td>{!readOnly && <button className="row-x del" title={th ? "เอาออก" : "Remove"} onClick={() => onRemove(l.code)}><Trash size={13} /></button>}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          {(committedLog.length > 0 || stagedLogs.length > 0) && (
            <div className="rpt-card cl-pulllog">
              <div className="st"><Download size={14} />{th ? "ประวัติการดึง/นำออก" : "Pull / remove history"}</div>
              <table className="data-grid">
                <thead><tr><th>{th ? "เมื่อ" : "When"}</th><th>{th ? "วิธี" : "Method"}</th><th>{th ? "เงื่อนไข" : "Criteria"}</th><th>{th ? "จำนวน" : "Count"}</th><th>{th ? "โดย" : "By"}</th></tr></thead>
                <tbody>
                  {stagedLogs.map((g, i) => {
                    const rm = g.method === "REMOVE";
                    return <tr key={`s${i}`} className="cl-log-pending">
                      <td className="muted">{th ? "รอบันทึก" : "pending"}</td>
                      <td>{rm ? (th ? "นำออก" : "Removed") : g.method === "BASKET" ? (th ? "ดึง·ตะกร้า" : "Pull·basket") : g.method === "GROUP" ? (th ? "ดึง·กลุ่ม" : "Pull·group") : (th ? "ดึง·กรอง" : "Pull·filter")}</td>
                      <td>{g.detail || "—"}</td><td style={{ color: rm ? "var(--red)" : "var(--green)", fontWeight: 700 }}>{rm ? `−${g.cnt}` : `+${g.cnt}`}</td><td className="muted">{g.by || "—"}</td>
                    </tr>;
                  })}
                  {committedLog.map((g, i) => {
                    const rm = g.method === "REMOVE";
                    return <tr key={`c${i}`}><td className="muted">{fmtDt(g.at)}</td>
                      <td>{rm ? (th ? "นำออก" : "Removed") : g.method === "BASKET" ? (th ? "ดึง·ตะกร้า" : "Pull·basket") : g.method === "GROUP" ? (th ? "ดึง·กลุ่ม" : "Pull·group") : (th ? "ดึง·กรอง" : "Pull·filter")}</td>
                      <td>{g.detail || "—"}</td><td style={{ color: rm ? "var(--red)" : "var(--green)", fontWeight: 700 }}>{rm ? `−${g.cnt}` : `+${g.cnt}`}</td><td className="muted">{g.by || "—"}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showAdd && (
          <div className="cl-add-panel">
            <div className="cl-add-h"><span>{th ? "เพิ่มรายชื่อเข้าชุด" : "Add leads"}</span><button className="row-x" onClick={() => setShowAdd(false)}><X size={15} /></button></div>
            <div className="cl-src-tabs">
              <button className={src === "group" ? "on" : ""} onClick={() => { setSrc("group"); setSel(null); }}>{th ? "ตามกลุ่ม" : "Group"}</button>
              <button className={src === "sales" ? "on" : ""} onClick={() => { setSrc("sales"); setSel(null); }}>{th ? "งานขาย" : "Sales"}</button>
              <button className={src === "filter" ? "on" : ""} onClick={() => { setSrc("filter"); setSel(null); }}>{th ? "กรองเอง" : "Filter"}</button>
              <button className={src === "basket" ? "on" : ""} onClick={() => { setSrc("basket"); setSel(null); }}>{th ? "ตะกร้า" : "Basket"}</button>
            </div>
            <div className="cl-add-note"><Box size={13} />{rdActive ? (th ? "ดึงได้เฉพาะ “พร้อมใช้” (ยกเว้นจากตะกร้า เลือกได้)" : "Ready only (basket lets you choose)") : (th ? "ยังไม่ตั้งเกณฑ์พร้อมใช้ — ใช้ลูกค้าใช้งานทั้งหมด" : "Readiness not set")}</div>

            {src === "group" && (<>
              <div className="cl-add-row"><label>{th ? "หมวด" : "Category"}</label>
                <select value={field} onChange={(e) => { setField(e.target.value as keyof Counts); setSel(null); }}>{FIELDS.map((f) => <option key={f} value={f}>{fieldLabel(f)}</option>)}</select></div>
              <div className="cl-add-chips">
                <button className={`ms-chip${sel?.kind === "all" ? " on" : ""}`} onClick={() => setSel({ kind: "all", label: "all" })}>{th ? "ทั้งหมด (พร้อมใช้)" : "All (ready)"} · {totalReady}</button>
                {rows.filter((r) => r.value != null).map((r) => <button key={r.value} className={`ms-chip${sel?.kind === "group" && sel.value === r.value ? " on" : ""}`} onClick={() => setSel({ kind: "group", field, value: r.value!, label: r.value! })}>{r.value} · {r.count}</button>)}
                {rows.length === 0 && <span className="muted" style={{ fontSize: 12.5 }}>{th ? "ไม่มีข้อมูลกลุ่ม" : "No groups"}</span>}
              </div>
            </>)}

            {src === "sales" && (!buckets ? <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{t("common.loading", { defaultValue: "กำลังโหลด…" })}</div> : (
              <div>
                {([["fo", "FO"], ["qt", "QT"], ["so", "SO"]] as const).map(([k, lbl]) => (
                  <div key={k}><div className="cl-sales-lb">{lbl} {th ? "รายปี" : "by year"}</div>
                    <div className="cl-add-chips" style={{ marginBottom: 8 }}>{buckets[k].map((y) => bChip(lbl, y.year, `${lbl} ${yLabel(y.year)}`, y.count))}</div></div>
                ))}
                <div className="cl-sales-lb">{th ? "สถานะ/แผน" : "Status"}</div>
                <div className="cl-add-chips">
                  {bChip("contactedNotClosed", undefined, th ? "เคยติดต่อ ยังไม่ปิด" : "Contacted", buckets.contactedNotClosed)}
                  {bChip("neverContacted", undefined, th ? "ใหม่ ยังไม่ติดต่อ" : "New", buckets.neverContacted)}
                  {bChip("calendarAhead", undefined, th ? "มีนัดข้างหน้า" : "Scheduled", buckets.calendarAhead)}
                </div>
              </div>
            ))}

            {src === "filter" && (<>
              <div className="cl-src-tabs sub"><button className={fmode === "quick" ? "on" : ""} onClick={() => setFmode("quick")}>{th ? "แบบย่อ" : "Compact"}</button><button className={fmode === "adv" ? "on" : ""} onClick={() => setFmode("adv")}>{th ? "แบบเต็ม" : "Full"}</button></div>
              {fmode === "quick" ? (
                <div className="cl-add-row"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={th ? "ชื่อ / รหัส / กลุ่ม…" : "name / code…"} /></div>
              ) : (
                <div className="cl-adv">{searchFields.map((k) => (
                  <div className="cl-adv-fld" key={k}><label>{fieldLabel(k)}</label>
                    {isSelectField(k) ? (
                      <select value={filters[k] ?? ""} onChange={(e) => setFilters((s) => ({ ...s, [k]: e.target.value }))}><option value="">{th ? "— ทั้งหมด —" : "— Any —"}</option>{getFieldOptions(k).map((o) => <option key={o} value={o}>{o}</option>)}</select>
                    ) : (<input value={filters[k] ?? ""} onChange={(e) => setFilters((s) => ({ ...s, [k]: e.target.value }))} placeholder={th ? "พิมพ์เพื่อกรอง" : "filter"} />)}
                  </div>
                ))}{searchFields.length === 0 && <span className="muted" style={{ fontSize: 12.5 }}>{th ? "ยังไม่ได้ตั้งฟิลด์ค้น" : "No fields"}</span>}</div>
              )}
              <div className="cl-add-row" style={{ marginTop: 6, alignItems: "center", gap: 10 }}>
                <button className="btn" disabled={busy} onClick={doSearch}><Search size={14} />{busy ? "…" : (th ? "ค้นหา" : "Search")}</button>
                {found && <span className="muted" style={{ fontSize: 12.5 }}>{th ? `พบ ${found.length} รายชื่อใหม่` : `${found.length} new leads`}</span>}
              </div>
            </>)}

            {src === "basket" && (
              <div className="cl-add-row"><label>{th ? "ตะกร้า" : "Basket"}</label>
                <select value={selBasket} onChange={(e) => setSelBasket(e.target.value)}>
                  <option value="">{th ? "— เลือกตะกร้า —" : "— pick —"}</option>
                  {baskets.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.count})</option>)}
                </select></div>
            )}

            <div className="cl-add-row" style={{ marginTop: 4 }}>
              <label>{th ? "จำนวน" : "Quantity"}</label>
              <input type="number" min={1} max={500} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
              <span className="muted" style={{ fontSize: 12 }}>{th ? "เต็ม 60" : "full 60"}</span>
            </div>
            <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={busy} onClick={doPull}>{busy ? "…" : (th ? "เพิ่มเข้าชุด (ร่าง)" : "Add to draft")}</button>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{th ? "ยังไม่ลง DB จนกด “บันทึก” บน toolbar" : "Not saved until you press Save in the toolbar"}</div>
          </div>
        )}
      </div>

      {/* ยืนยันดึงจากตะกร้า */}
      {confirm && (
        <div className="cl-modal-overlay" onClick={() => setConfirm(null)}>
          <div className="cl-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="cl-add-h"><span>{th ? "ดึงจากตะกร้า" : "Pull from basket"}: {confirm.from}</span><button className="row-x" onClick={() => setConfirm(null)}><X size={15} /></button></div>
            {(() => {
              const hasIssue = cNotReady > 0 || cOther > 0;
              return (<>
                <div className="cl-confirm-stats">
                  <div><b>{cReady}</b> {th ? "พร้อมใช้" : "ready"}</div>
                  {cNotReady > 0 && <div className="warn"><b>{cNotReady}</b> {th ? "ไม่พร้อมใช้" : "not ready"}</div>}
                  {cOther > 0 && <div className="warn"><b>{cOther}</b> {th ? "อยู่ใน CL อื่น" : "in other CL"}</div>}
                  {cUsed > 0 && <div className="warn"><b>{cUsed}</b> {th ? "เคยใช้แล้ว" : "used before"}</div>}
                </div>
                {hasIssue && <div className="cl-confirm-warn">{th ? "พบบางรายชื่อที่ต้องตัดสินใจ — เลือกว่าจะดึงแบบไหน" : "Some leads need a decision — choose how to pull"}</div>}
                <div className="muted" style={{ fontSize: 12, margin: "6px 0 12px" }}>{th ? `ดึงสูงสุด ${qty || 60} ราย` : `Up to ${qty || 60}`}</div>
                <div className="cl-confirm-opts">
                  {!hasIssue ? (
                    <button className="btn primary" disabled={cReady === 0} onClick={() => confirmBasket("ready")}>{th ? `ดึงทั้งหมด (${cReady})` : `Pull all (${cReady})`}</button>
                  ) : (<>
                    <button className="btn primary" disabled={cReady === 0} onClick={() => confirmBasket("ready")}>{th ? `เอาเฉพาะพร้อมใช้ (${cReady})` : `Ready only (${cReady})`}</button>
                    {cNotReady > 0 && <button className="btn" onClick={() => confirmBasket("usable")}>{th ? `รวมไม่พร้อมใช้ (${cReady + cNotReady})` : `Incl. not-ready (${cReady + cNotReady})`}</button>}
                    {cOther > 0 && <button className="btn" onClick={() => confirmBasket("all")}>{th ? `เอาทั้งหมด รวมที่อยู่ CL อื่น (${confirm.rows.length})` : `All incl. other-CL (${confirm.rows.length})`}</button>}
                  </>)}
                  <button className="btn" onClick={() => setConfirm(null)}>{th ? "ยกเลิก" : "Cancel"}</button>
                </div>
              </>);
            })()}
          </div>
        </div>
      )}
    </div>
  );
});

export default ClLeadBox;
