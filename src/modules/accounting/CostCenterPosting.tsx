import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { FileText, ArrowLeft, Building, Search } from "../../shared/icons";
import AccTopbar from "./AccTopbar";
import CostCenterSide from "./CostCenterSide";
import "../customer/customer.css";

/** แหล่งที่ Post อัตโนมัติจากโมดูลอื่น */
type AutoSrc = "FI" | "MM" | "PP" | "MANUAL";
const SRC: Record<AutoSrc, { th: string; en: string; tone: string }> = {
  FI: { th: "FI · ใบแจ้งหนี้", en: "FI · Invoice", tone: "blue" },
  MM: { th: "MM · รับเข้าสินค้า", en: "MM · Goods Receipt", tone: "green" },
  PP: { th: "PP · ยืนยันผลิต", en: "PP · Production Confirm", tone: "amber" },
  MANUAL: { th: "Manual · บันทึกเอง", en: "Manual posting", tone: "gray" },
};

/** mock — ค่าใช้จ่ายจริงที่ Post เข้า Cost Center (อัตโนมัติจากโมดูลอื่น + บันทึกเอง) */
const ROWS: { date: string; src: AutoSrc; ref: string; cc: string; ce: string; descTh: string; descEn: string; amount: number }[] = [
  { date: "2026-06-11", src: "FI", ref: "INV-2026-0451", cc: "1001", ce: "400000", descTh: "ค่าวัตถุดิบ — PO 4500012", descEn: "Raw material — PO 4500012", amount: 530000 },
  { date: "2026-06-11", src: "MM", ref: "GR-2026-1183", cc: "1001", ce: "410000", descTh: "รับเข้า Chemical Additive", descEn: "GR Chemical Additive", amount: 72000 },
  { date: "2026-06-10", src: "PP", ref: "PC-2026-0907", cc: "1001", ce: "620000", descTh: "ยืนยันผลิต Order 1000234 (แรงงาน)", descEn: "Prod. confirm 1000234 (labour)", amount: 260000 },
  { date: "2026-06-10", src: "FI", ref: "INV-2026-0448", cc: "1001", ce: "640000", descTh: "ค่าไฟฟ้า เดือน พ.ค.", descEn: "Electricity — May", amount: 128000 },
  { date: "2026-06-09", src: "MANUAL", ref: "KB-2026-0033", cc: "1001", ce: "660000", descTh: "ปรับปรุงค่าซ่อม (บันทึกเอง)", descEn: "Maintenance adj. (manual)", amount: 12000 },
  { date: "2026-06-09", src: "MM", ref: "GR-2026-1170", cc: "1002", ce: "660000", descTh: "อะไหล่ซ่อมบำรุง", descEn: "Maintenance parts", amount: 45000 },
  { date: "2026-06-09", src: "PP", ref: "PC-2026-0901", cc: "1001", ce: "630000", descTh: "ยืนยันผลิต OT", descEn: "Prod. confirm overtime", amount: 35000 },
  { date: "2026-06-08", src: "FI", ref: "INV-2026-0440", cc: "1002", ce: "650000", descTh: "ค่าเสื่อมราคาเครื่องจักร", descEn: "Machine depreciation", amount: 120000 },
];

const fmt = (n: number) => n.toLocaleString("en-US");

/** บันทึกค่าใช้จ่าย Actual (view="actual" รวมทุกแหล่ง) · Automatic (view="auto" เฉพาะจากโมดูลอื่น) */
export default function CostCenterPosting({ view = "actual" }: { view?: "actual" | "auto" }) {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const thai = i18n.language.startsWith("th");
  const T = (a: string, b: string) => (thai ? a : b);
  const session = getSession();
  const auto = view === "auto";
  const [src, setSrc] = useState<"" | AutoSrc>("");
  const [q, setQ] = useState("");

  const base = useMemo(() => auto ? ROWS.filter((r) => r.src !== "MANUAL") : ROWS, [auto]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return base.filter((r) => (!src || r.src === src) && (!s || r.ref.toLowerCase().includes(s) || r.cc.includes(s) || r.ce.includes(s) || (thai ? r.descTh : r.descEn).toLowerCase().includes(s)));
  }, [base, src, q, thai]);
  const total = rows.reduce((a, r) => a + r.amount, 0);

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err"><Building size={15} />{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}><ArrowLeft size={15} />{t("custForm.goLogin")}</button></div></div>;
  }

  return (
    <div className="p-crm">
      <AccTopbar />
      <div className="crm-main">
        <CostCenterSide active={auto ? "posting-auto" : "posting-actual"} />
        <div className="crm-content">
          <div className="subbar">
            <div className="company-pick"><FileText size={15} />{auto ? T("บันทึกค่าใช้ Automatic", "Automatic postings") : T("บันทึกค่าใช้จ่าย Actual", "Post actual costs")} <span style={{ fontSize: 11.5, color: "var(--txt3)" }}>· CC03 ≈ KB11N / FI Posting</span></div>
          </div>

          <div className="crm-body">
            <div className="banner" style={{ background: "#eef5ff", color: "#1d4ed8", padding: "10px 14px", borderRadius: 8, marginBottom: 14, fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
              <Building size={15} />{auto
                ? T("รายการเหล่านี้ระบบ Post ให้อัตโนมัติจากโมดูลอื่น (FI Invoice · MM Goods Receipt · PP Production Confirmation) — ไม่ต้องบันทึกเอง ดูอย่างเดียว", "Auto-posted from other modules (FI Invoice · MM Goods Receipt · PP Production Confirmation) — view only")
                : T("ค่าใช้จ่ายจริงที่ Post เข้า Cost Center — อัตโนมัติจาก FI (Invoice), MM (GR), PP (Production) หรือ Manual Posting", "Actual costs posted to Cost Centers — auto from FI (Invoice), MM (GR), PP (Production) or manual posting")}
            </div>

            <div className="card">
              <div className="ch" style={{ gap: 10, flexWrap: "wrap" }}>
                <div className="req-search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("ค้นหา เลขที่/CC/CE/รายละเอียด", "Search ref/CC/CE/desc")} /></div>
                <select value={src} onChange={(e) => setSrc(e.target.value as "" | AutoSrc)} style={{ padding: "6px 8px", border: "1px solid var(--field-bd, #cbd3dd)", borderRadius: 7, fontSize: 12.5 }}>
                  <option value="">{T("ทุกแหล่ง", "All sources")}</option>
                  {(Object.keys(SRC) as AutoSrc[]).filter((s) => !auto || s !== "MANUAL").map((s) => <option key={s} value={s}>{thai ? SRC[s].th : SRC[s].en}</option>)}
                </select>
                <span className="muted" style={{ marginLeft: "auto" }}>{T("รวม", "Total")}: <b style={{ color: "var(--blue)" }}>฿ {fmt(total)}</b> · {rows.length} {T("รายการ", "items")}</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-grid" style={{ fontSize: 12.5 }}>
                  <thead><tr>
                    <th>{T("วันที่", "Date")}</th><th>{T("แหล่ง", "Source")}</th><th>{T("เลขที่อ้างอิง", "Ref. doc")}</th>
                    <th>Cost Center</th><th>CE</th><th>{T("รายละเอียด", "Description")}</th><th className="num">{T("จำนวนเงิน", "Amount")}</th>
                  </tr></thead>
                  <tbody>
                    {rows.length === 0 ? <tr className="empty-row"><td colSpan={7}>{T("ไม่มีรายการ", "No entries")}</td></tr> : rows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.date}</td>
                        <td><span className={`chip ${SRC[r.src].tone}`}>{thai ? SRC[r.src].th : SRC[r.src].en}</span></td>
                        <td className="docno">{r.ref}</td>
                        <td>{r.cc}</td><td>{r.ce}</td>
                        <td>{thai ? r.descTh : r.descEn}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{fmt(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
