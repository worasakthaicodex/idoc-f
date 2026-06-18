import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, Building, ArrowLeft, X, Lock, Box, Check } from "../../shared/icons";
import CrmHelpButton from "./CrmHelpButton";
import LangSwitcher from "../../shared/LangSwitcher";
import CustomerSide from "./CustomerSide";
import { getReadiness } from "./customerReadinessConfig";
import { readinessActive } from "./customerReadiness";
import { fetchUnavailableDeps } from "../../shared/moduleRegistry";
import { listBaskets, addToBasket, removeFromBasket, currentOwner, type Basket, type AddBasketBody } from "./basketStore";
import "./customer.css";

type GC = { value: string | null; count: number };
type Counts = Record<"groupName" | "grade" | "businessType", GC[]>;
type Member = { code: string; name: string; lastContact?: string | null; groupValue?: string | null; followUp?: string | null };
type Popup = {
  title: string; valueLabel: string; mode: "members" | "breakdown";
  viewAll?: () => void; onBack?: () => void; onDrill?: (value: string | null) => void;
  addBody?: AddBasketBody;   // เกณฑ์สำหรับ "ใส่ตะกร้า" (ยกก้อน)
  loading: boolean; total: number; head: Member[]; tail: Member[]; breakdown: GC[];
};
type YC = { year: number; count: number };
type Buckets = { fo: YC[]; qt: YC[]; so: YC[]; contactedNotClosed: number; neverContacted: number; calendarAhead: number };
const EMPTY: Counts = { groupName: [], grade: [], businessType: [] };
const SECTIONS: (keyof Counts)[] = ["groupName", "grade", "businessType"];

/** กลุ่มลูกค้า — By type (GROUP BY) + ตามงานขาย (FO/QT/SO รายปี + ติดต่อ/ใหม่/ปฏิทิน) · นับที่ DB ทั้งหมด */
export default function CustomerGroups() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const session = getSession();
  const tenant = session?.companyId ?? "";

  const [groupTab, setGroupTab] = useState<"byType" | "bySales">("byType");
  const [counts, setCounts] = useState<Counts>(EMPTY);
  const [buckets, setBuckets] = useState<Buckets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [readyFilter, setReadyFilter] = useState<"all" | "ready" | "notReady">("all");
  const [notInBasket, setNotInBasket] = useState(false);   // นับเฉพาะคนที่ยังไม่อยู่ในตะกร้าที่ฉันเห็น
  const [groupBy, setGroupBy] = useState<"" | "groupName" | "grade" | "businessType">("");
  const [popup, setPopup] = useState<Popup | null>(null);
  const [salesLocked, setSalesLocked] = useState(false);   // ไม่มีโมดูลงานขาย → ล็อกแท็บ By sales
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [curBasket, setCurBasket] = useState("");
  const [addQty, setAddQty] = useState(60);
  const [onlyNew, setOnlyNew] = useState(true);   // ยกก้อนเฉพาะที่ยังไม่อยู่ในตะกร้า
  const [addedSet, setAddedSet] = useState<Set<string>>(new Set());   // รหัสที่ใส่ตะกร้าแล้ว (ใน popup นี้)
  const popupReq = useRef(0);
  const rdActive = readinessActive();

  const refreshBaskets = () => listBaskets().then((bs) => { setBaskets(bs); setCurBasket((c) => (bs.some((b) => b.id === c) ? c : (bs[0]?.id ?? ""))); }).catch(() => {});
  useEffect(() => { refreshBaskets(); /* eslint-disable-next-line */ }, [tenant]);

  // ตัวกรองพร้อมใช้เป็น object (ใช้กับ add-to-basket)
  const readyObj = (): AddBasketBody => {
    const o: AddBasketBody = { ready: readyFilter };
    if (readyFilter !== "all") { const cfg = getReadiness(); if (cfg.sinceContact.on) o.sinceContactMonths = cfg.sinceContact.months; if (cfg.calendarDue.on) o.calendarDays = cfg.calendarDue.days; }
    return o;
  };
  const addBulk = async () => {
    if (!popup?.addBody || !curBasket) return;
    const r = await addToBasket(curBasket, { ...popup.addBody, limit: addQty || 60, onlyNew });
    await refreshBaskets();
    const skipped = r.conflicts?.length || 0;
    alert(th ? `ใส่ตะกร้า ${r.added} ราย${skipped ? ` · ข้าม ${skipped} ราย (มีคนถือไว้แล้ว)` : ""}` : `Added ${r.added}${skipped ? `, ${skipped} skipped (already held)` : ""}`);
  };
  // กดที่แถว → ใส่/เอาออกจากตะกร้า (มีสถานะ ✓ ชัดเจน)
  const toggleInBasket = async (code: string) => {
    if (!curBasket) { alert(th ? "เลือก/สร้างตะกร้าก่อน (เมนูตะกร้ารายชื่อ)" : "Pick a basket first"); return; }
    if (addedSet.has(code)) {
      await removeFromBasket(curBasket, code);
      setAddedSet((s) => { const n = new Set(s); n.delete(code); return n; });
    } else {
      const r = await addToBasket(curBasket, { codes: [code] });
      if (r.added > 0) setAddedSet((s) => new Set(s).add(code));
      else if (r.conflicts && r.conflicts.length > 0) {
        const c = r.conflicts[0];
        alert(th ? `หยิบไม่ได้ — อยู่ในตะกร้า “${c.basketName}” ของ ${c.owner} แล้ว` : `Can't add — held in “${c.basketName}” by ${c.owner}`);
      }
    }
    refreshBaskets();
  };

  // เช็คสิทธิ์โมดูลข้ามระบบ: "ตามงานขาย" ต้องมีโมดูลงานขาย
  useEffect(() => {
    if (!tenant) return;
    fetchUnavailableDeps("customer").then((d) => setSalesLocked(d.some((x) => x.key === "sales"))).catch(() => {});
  }, [tenant]);

  const readyParams = (qp: URLSearchParams) => {
    qp.set("ready", readyFilter);
    if (readyFilter !== "all") {
      const cfg = getReadiness();
      if (cfg.sinceContact.on) qp.set("sinceContactMonths", String(cfg.sinceContact.months));
      if (cfg.calendarDue.on) qp.set("calendarDays", String(cfg.calendarDue.days));
    }
    if (notInBasket) qp.set("notInBasketOf", currentOwner());   // ตัดคนที่อยู่ในตะกร้าที่ฉันเห็น
    return qp;
  };

  const fetchMembers = (cfg: { title: string; valueLabel: string; url: string; viewAll?: () => void; onBack?: () => void; addBody?: AddBasketBody }) => {
    const id = ++popupReq.current;
    setAddedSet(new Set());
    setPopup({ mode: "members", title: cfg.title, valueLabel: cfg.valueLabel, viewAll: cfg.viewAll, onBack: cfg.onBack, addBody: cfg.addBody, loading: true, total: 0, head: [], tail: [], breakdown: [] });
    apiFetch<{ total: number; head: Member[]; tail: Member[] }>(cfg.url, { tenant })
      .then((r) => { if (popupReq.current === id) setPopup((p) => (p ? { ...p, ...r, loading: false } : p)); })
      .catch(() => { if (popupReq.current === id) setPopup((p) => (p ? { ...p, loading: false } : p)); });
  };
  const openTypePopup = (field: string, value: string | null) => {
    if (!value) return;
    const fl = t(`custFields.${field}`, { defaultValue: field });
    const qp = readyParams(new URLSearchParams({ field, value }));
    fetchMembers({ title: `${value} · ${fl}`, valueLabel: fl, viewAll: () => goGroup(field, value), url: `/customers/group-members?${qp.toString()}`, addBody: { field, value, ...readyObj() } });
  };
  // เจาะลึก bucket → ขั้น 1: breakdown ตามกลุ่ม · ขั้น 2: รายชื่อของกลุ่มย่อย
  const openBreakdown = (bucket: string, year: number | null, label: string) => {
    const id = ++popupReq.current;
    setPopup({ mode: "breakdown", title: label, valueLabel: "", loading: true, total: 0, head: [], tail: [], breakdown: [], onDrill: (val) => drillBucket(bucket, year, label, val) });
    const qp = readyParams(new URLSearchParams({ bucket, field: groupBy }));
    if (year != null) qp.set("year", String(year));
    apiFetch<GC[]>(`/customers/bucket-breakdown?${qp.toString()}`, { tenant })
      .then((rows) => { if (popupReq.current === id) setPopup((p) => (p ? { ...p, breakdown: rows ?? [], total: (rows ?? []).reduce((a, b) => a + b.count, 0), loading: false } : p)); })
      .catch(() => { if (popupReq.current === id) setPopup((p) => (p ? { ...p, loading: false } : p)); });
  };
  const drillBucket = (bucket: string, year: number | null, baseLabel: string, value: string | null) => {
    if (value == null) return;
    const fl = t(`custFields.${groupBy}`, { defaultValue: groupBy });
    const qp = readyParams(new URLSearchParams({ bucket, field: groupBy, value }));
    if (year != null) qp.set("year", String(year));
    fetchMembers({ title: `${baseLabel} · ${value}`, valueLabel: fl, url: `/customers/bucket-members?${qp.toString()}`, onBack: () => openBreakdown(bucket, year, baseLabel), addBody: { bucket, year: year ?? undefined, field: groupBy, value, ...readyObj() } });
  };
  const openBucketPopup = (bucket: string, year: number | null, label: string) => {
    if (groupBy) { openBreakdown(bucket, year, label); return; }
    const qp = readyParams(new URLSearchParams({ bucket }));
    if (year != null) qp.set("year", String(year));
    fetchMembers({ title: label, valueLabel: year != null ? (th ? "ปี" : "Year") : "", url: `/customers/bucket-members?${qp.toString()}`, addBody: { bucket, year: year ?? undefined, ...readyObj() } });
  };

  // By type — นับต่อกลุ่ม
  useEffect(() => {
    if (!tenant) return;
    setLoading(true);
    const qp = readyParams(new URLSearchParams());
    apiFetch<Counts>(`/customers/group-counts?${qp.toString()}`, { tenant })
      .then((c) => { setCounts({ ...EMPTY, ...c }); setError(""); })
      .catch((e) => setError(t("customer.errLoad") + ": " + e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, readyFilter, notInBasket]);

  // ตามงานขาย — โหลดเมื่อเปิดแท็บ + เมื่อเปลี่ยนตัวกรองพร้อมใช้ (เฉพาะเมื่อมีโมดูลขาย)
  useEffect(() => {
    if (!tenant || groupTab !== "bySales" || salesLocked) return;
    const qp = readyParams(new URLSearchParams({ years: "5" }));
    apiFetch<Buckets>(`/customers/sales-buckets?${qp.toString()}`, { tenant })
      .then((b) => { setBuckets(b); setError(""); })
      .catch((e) => setError(t("customer.errLoad") + ": " + e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, groupTab, readyFilter, salesLocked, notInBasket]);

  const UNSPEC = t("customer.unspecified");
  const goGroup = (field: string, value: string | null) => { if (value) nav(`/customer?${field}=${encodeURIComponent(value)}`); };
  const fmtContact = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(th ? "th-TH" : "en", { dateStyle: "medium" }) : (th ? "ยังไม่ติดต่อ" : "never"));
  const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(th ? "th-TH" : "en", { dateStyle: "medium" }) : "—");
  const yLabel = (y: number) => (th ? y + 543 : y);

  const DOC_SALES: { key: "fo" | "qt" | "so"; code: string; label: string }[] = [
    { key: "fo", code: "FO", label: th ? "FO ที่เคยเปิด — รายปี" : "FO opened — by year" },
    { key: "qt", code: "QT", label: th ? "QT ที่เคยเปิด — รายปี" : "QT opened — by year" },
    { key: "so", code: "SO", label: th ? "SO ที่เคยเปิด — รายปี" : "SO opened — by year" },
  ];
  const lbl = {
    contactedNotClosed: th ? "เคยติดต่อ แต่ยังไม่ปิด (ไม่มี SO)" : "Contacted, not closed",
    neverContacted: th ? "ใหม่ — ยังไม่เคยติดต่อ" : "New — never contacted",
    calendarAhead: th ? "มีนัดในปฏิทินข้างหน้า" : "Scheduled ahead",
  };

  if (!session) {
    return (
      <div className="p-crm">
        <div className="topbar"><div className="app">{t("common.appName")}</div><div className="u-spacer" /><div className="me">A</div></div>
        <div className="crm-body">
          <div className="banner err"><Building size={15} />{t("customer.notLoggedIn")}</div>
          <button className="btn primary" onClick={() => nav("/login")}><ArrowLeft size={15} />{t("customer.goLogin")}</button>
        </div>
      </div>
    );
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
        <CustomerSide active="groups" />

        <div className="crm-content">
          <div className="subbar">
            <div className="company-pick"><Building size={15} />{t("customer.tabs.groups")}</div>
          </div>

          <div className="crm-body">
            {error && <div className="banner err"><Building size={15} />{error}</div>}

            <div className="tabs" style={{ marginBottom: 14 }}>
              <div className={`tab${groupTab === "byType" ? " active" : ""}`} onClick={() => setGroupTab("byType")}>{t("customer.byType")}</div>
              <div className={`tab${groupTab === "bySales" ? " active" : ""}${salesLocked ? " locked" : ""}`}
                onClick={() => { if (!salesLocked) setGroupTab("bySales"); }}
                title={salesLocked ? (th ? "ต้องเปิดโมดูลงานขายก่อน" : "Requires the Sales module") : undefined}>
                {th ? "ตามงานขาย" : "By sales"}{salesLocked && <Lock size={12} style={{ marginLeft: 5, verticalAlign: "-1px" }} />}
              </div>
            </div>

            <div className="rd-filter">
              <span className="rd-filter-lb">{t("customer.readyFilter.label", { defaultValue: "นับเฉพาะ" })}</span>
              <select className="rd-filter-sel" value={readyFilter} disabled={!rdActive} onChange={(e) => setReadyFilter(e.target.value as "all" | "ready" | "notReady")}>
                <option value="all">{t("customer.readyFilter.all", { defaultValue: "ทั้งหมด" })}</option>
                <option value="ready">{t("customer.readyFilter.ready", { defaultValue: "พร้อมใช้" })}</option>
                <option value="notReady">{t("customer.readyFilter.notReady", { defaultValue: "ยังไม่พร้อม" })}</option>
              </select>
              {!rdActive && <span className="rd-filter-hint">{t("customer.readyFilter.needConfig", { defaultValue: "— เปิดเงื่อนไข “พร้อมใช้” ที่ตั้งค่าก่อน" })}</span>}

              {!salesLocked || groupTab === "byType" ? (
                <label className="rd-basket-chk" title={th ? "ตัดคนที่อยู่ในตะกร้าของฉันหรือที่แชร์ให้ฉันออก — เหลือเท่าไรรอเอาไปใช้" : "Exclude customers already in my baskets (own or shared)"}>
                  <input type="checkbox" checked={notInBasket} onChange={(e) => setNotInBasket(e.target.checked)} />
                  {th ? "เฉพาะที่ยังไม่อยู่ในตะกร้าฉัน" : "Not in my baskets"}
                </label>
              ) : null}

              {groupTab === "bySales" && !salesLocked && (
                <>
                  <span className="rd-filter-lb" style={{ marginLeft: 12 }}>{th ? "แยกย่อยตาม" : "Break down by"}</span>
                  <select className="rd-filter-sel" value={groupBy} onChange={(e) => setGroupBy(e.target.value as "" | "groupName" | "grade" | "businessType")}>
                    <option value="">{th ? "ไม่แยก" : "None"}</option>
                    <option value="groupName">{t("custFields.groupName", { defaultValue: "กลุ่มลูกค้า" })}</option>
                    <option value="grade">{t("custFields.grade", { defaultValue: "เกรด" })}</option>
                    <option value="businessType">{t("custFields.businessType", { defaultValue: "ประเภทธุรกิจ" })}</option>
                  </select>
                </>
              )}
            </div>

            {groupTab === "byType" && (
              <>
                {loading ? (
                  <div className="card"><div style={{ padding: 18, color: "var(--txt3)" }}>{t("common.loading", { defaultValue: "กำลังโหลด…" })}</div></div>
                ) : SECTIONS.map((key) => {
                  const rows = counts[key] ?? [];
                  return (
                    <div className="card" key={key}>
                      <div className="sh">{t(`custFields.${key}`, { defaultValue: key })} <span className="ff-count" style={{ marginLeft: 6 }}>{rows.length}</span></div>
                      <div className="grp-chips">
                        {rows.length === 0 && <div className="muted" style={{ padding: 4 }}>{t("customer.unspecified")}</div>}
                        {rows.map((r) => (
                          <button type="button" key={r.value ?? "__u"} className={`grp-chip${r.value == null ? " muted" : ""}`} onClick={() => openTypePopup(key, r.value)} disabled={r.value == null}>
                            <span className="gc-name">{r.value ?? UNSPEC}</span>
                            <span className="gc-count">{r.count}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {groupTab === "bySales" && (
              salesLocked ? (
                <div className="card"><div style={{ padding: 18, color: "var(--txt2)", fontSize: 13.5, display: "flex", alignItems: "center", gap: 8 }}><Lock size={15} />{th ? "ต้องเปิดโมดูล “งานขาย” ของบริษัทก่อน จึงจะดูมุมมองตามงานขายได้" : "Enable the company's Sales module to use this view"}</div></div>
              ) : !buckets ? (
                <div className="card"><div style={{ padding: 18, color: "var(--txt3)" }}>{t("common.loading", { defaultValue: "กำลังโหลด…" })}</div></div>
              ) : (
                <>
                  {DOC_SALES.map((d) => (
                    <div className="card" key={d.key}>
                      <div className="sh">{d.label}</div>
                      <div className="grp-chips">
                        {buckets[d.key].map((y) => (
                          <button type="button" key={y.year} className="grp-chip" onClick={() => openBucketPopup(d.code, y.year, `${d.code} ${yLabel(y.year)}`)}>
                            <span className="gc-name">{yLabel(y.year)}</span>
                            <span className="gc-count">{y.count}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="card">
                    <div className="sh">{th ? "สถานะติดต่อ / แผน" : "Contact / plan"}</div>
                    <div className="grp-chips">
                      <button type="button" className="grp-chip" onClick={() => openBucketPopup("contactedNotClosed", null, lbl.contactedNotClosed)}>
                        <span className="gc-name">{lbl.contactedNotClosed}</span><span className="gc-count">{buckets.contactedNotClosed}</span>
                      </button>
                      <button type="button" className="grp-chip" onClick={() => openBucketPopup("neverContacted", null, lbl.neverContacted)}>
                        <span className="gc-name">{lbl.neverContacted}</span><span className="gc-count">{buckets.neverContacted}</span>
                      </button>
                      <button type="button" className="grp-chip" onClick={() => openBucketPopup("calendarAhead", null, lbl.calendarAhead)}>
                        <span className="gc-name">{lbl.calendarAhead}</span><span className="gc-count">{buckets.calendarAhead}</span>
                      </button>
                    </div>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      </div>

      {popup && (
        <div className="grp-pop-overlay" onClick={() => setPopup(null)}>
          <div className="grp-pop" onClick={(e) => e.stopPropagation()}>
            <div className="grp-pop-head">
              {popup.onBack && <button className="gp-x" onClick={popup.onBack} title={th ? "กลับ" : "Back"}><ArrowLeft size={16} /></button>}
              <div className="gp-title"><b>{popup.title}</b></div>
              <span className="gp-total">{popup.total.toLocaleString()} {th ? "ราย" : ""}</span>
              <button className="gp-x" onClick={() => setPopup(null)}><X size={16} /></button>
            </div>
            <div className="grp-pop-body">
              {popup.loading ? (
                <div className="muted" style={{ padding: 16 }}>{t("common.loading", { defaultValue: "กำลังโหลด…" })}</div>
              ) : popup.mode === "breakdown" ? (
                <div className="grp-chips" style={{ padding: 14 }}>
                  {popup.breakdown.length === 0 && <div className="muted" style={{ padding: 4 }}>{th ? "ไม่มีข้อมูล" : "No data"}</div>}
                  {popup.breakdown.map((r) => (
                    <button type="button" key={r.value ?? "__u"} className={`grp-chip${r.value == null ? " muted" : ""}`} disabled={r.value == null} onClick={() => popup.onDrill?.(r.value)}>
                      <span className="gc-name">{r.value ?? UNSPEC}</span><span className="gc-count">{r.count}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <div className="gp-row gp-hrow">
                    <span className="gp-name">{th ? "ชื่อลูกค้า" : "Customer"}</span>
                    {popup.valueLabel && <span className="gp-val">{popup.valueLabel}</span>}
                    <span className="gp-contact">{th ? "ติดต่อล่าสุด" : "Last contact"}</span>
                    <span className="gp-contact">{th ? "กำหนดติดตาม" : "Follow-up"}</span>
                    <span className="gp-code">{th ? "รหัส" : "Code"}</span>
                  </div>
                  {popup.head.map((m) => (
                    <div className="gp-row" key={m.code}>
                      <span className="gp-name">{m.name}</span>
                      {popup.valueLabel && <span className="gp-val">{m.groupValue ?? "—"}</span>}
                      <span className="gp-contact">{fmtContact(m.lastContact)}</span>
                      <span className="gp-contact">{fmtDate(m.followUp)}</span>
                      <span className="gp-code">{m.code}</span>
                      {curBasket && (addedSet.has(m.code)
                        ? <button className="row-x added" title={th ? "อยู่ในตะกร้าแล้ว · กดเพื่อเอาออก" : "In basket · click to remove"} onClick={() => toggleInBasket(m.code)}><Check size={13} /></button>
                        : <button className="row-x" title={th ? "ใส่ลงตะกร้า" : "Add to basket"} onClick={() => toggleInBasket(m.code)}><Box size={13} /></button>)}
                    </div>
                  ))}
                  {popup.tail.length > 0 && (<><div className="gp-gap">⋯</div><div className="gp-gap">⋯</div></>)}
                  {popup.tail.map((m) => (
                    <div className="gp-row" key={m.code}>
                      <span className="gp-name">{m.name}</span>
                      {popup.valueLabel && <span className="gp-val">{m.groupValue ?? "—"}</span>}
                      <span className="gp-contact">{fmtContact(m.lastContact)}</span>
                      <span className="gp-contact">{fmtDate(m.followUp)}</span>
                      <span className="gp-code">{m.code}</span>
                      {curBasket && (addedSet.has(m.code)
                        ? <button className="row-x added" title={th ? "อยู่ในตะกร้าแล้ว · กดเพื่อเอาออก" : "In basket · click to remove"} onClick={() => toggleInBasket(m.code)}><Check size={13} /></button>
                        : <button className="row-x" title={th ? "ใส่ลงตะกร้า" : "Add to basket"} onClick={() => toggleInBasket(m.code)}><Box size={13} /></button>)}
                    </div>
                  ))}
                </>
              )}
            </div>
            <div className="grp-pop-foot">
              {popup.mode === "members" && popup.addBody && (
                baskets.length === 0 ? (
                  <span className="muted" style={{ marginRight: "auto", fontSize: 12.5 }}>{th ? "สร้างตะกร้าก่อนที่เมนู “ตะกร้ารายชื่อ”" : "Create a basket first"}</span>
                ) : (
                  <div style={{ marginRight: "auto", display: "flex", gap: 6, alignItems: "center" }} title={th ? "ใส่ N รายแรกของรายการนี้ลงตะกร้า" : "Add first N to basket"}>
                    <select className="rd-filter-sel" value={curBasket} onChange={(e) => setCurBasket(e.target.value)}>
                      {baskets.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.count})</option>)}
                    </select>
                    <input type="number" min={1} value={addQty} onChange={(e) => setAddQty(Math.max(1, Number(e.target.value) || 1))} style={{ width: 64, padding: "6px 8px", border: "1px solid var(--field-bd)", borderRadius: 8, fontSize: 13 }} />
                    <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--txt2)", cursor: "pointer", whiteSpace: "nowrap" }}>
                      <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} />
                      {th ? "เฉพาะที่ยังไม่อยู่ในตะกร้า" : "Only not in basket"}
                    </label>
                    <button className="btn primary" onClick={addBulk}>{th ? "ใส่ N รายแรก" : "Add first N"}</button>
                  </div>
                )
              )}
              <button className="btn" onClick={() => setPopup(null)}>{th ? "ปิด" : "Close"}</button>
              {popup.viewAll && <button className="btn primary" onClick={popup.viewAll}>{th ? "ดูทั้งหมด" : "View all"}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
