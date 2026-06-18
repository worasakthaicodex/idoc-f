import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart } from "../../shared/icons";
import { getSession } from "../../shared/session";
import { apiFetch } from "../../shared/api";
import "./tools.css";

/**
 * ประวัติการขาย — ดึงเอกสารจริง FO/CL/QT/SO ของลูกค้ารายนี้มาแสดง
 * กดแถวเพื่อเปิดเอกสารจริง "หน้าใหม่" (อ่าน/ตรวจของจริง)
 * ดึงตรงจาก /sales-docs (ไม่ผูกโค้ดข้ามโมดูล) · กรองด้วย values.customerRef = รหัสลูกค้า
 */
const DOCS = ["CL", "FO", "QT", "SO"] as const;
type DocType = (typeof DOCS)[number];

type Doc = { code: string; title?: string; telesale?: string; phase?: string; savedAt?: number; values?: Record<string, string>; _doc?: DocType };

const DOC_LABEL: Record<DocType, { th: string; en: string; tone: string }> = {
  FO: { th: "ใบเปิดการขาย", en: "Opportunity", tone: "blue" },
  CL: { th: "รายชื่อโทร", en: "Call list", tone: "gray" },
  QT: { th: "ใบเสนอราคา", en: "Quotation", tone: "amber" },
  SO: { th: "ใบสั่งขาย", en: "Sales order", tone: "green" },
};
const PHASE_LABEL: Record<string, { th: string; en: string }> = {
  RECEIVE: { th: "รอรับ", en: "Inbox" },
  PROCESS: { th: "ดำเนินการ", en: "In progress" },
  EXPORT: { th: "ส่งออก", en: "Sent" },
  DONE: { th: "เสร็จสิ้น", en: "Done" },
};

const num = (v?: string) => { const n = parseFloat((v || "").replace(/,/g, "")); return isNaN(n) ? 0 : n; };
function qtNet(values?: Record<string, string>): number {
  try {
    const items = values?.items ? JSON.parse(values.items) : [];
    if (Array.isArray(items) && items.length > 0) {
      const after = items.reduce((a: number, it: { price?: string; qty?: string; discount?: string }) => a + num(it.price) * num(it.qty) - num(it.discount), 0);
      return after * 1.07;
    }
  } catch { /* fall through */ }
  // ไม่มี line items (เช่นข้อมูลย้ายที่ราคาอยู่ใน header) → ใช้ยอดรวมจากหัวเอกสาร
  return num(values?.grandTotal) || num(values?.netAmount) || 0;
}
const urlFor = (doc: DocType, code: string) => {
  const c = encodeURIComponent(code);
  return doc === "QT" ? `/sales/qt/${c}` : `/sales/${doc.toLowerCase()}/d/${c}`;
};

export default function SalesHistoryPanel({ customerCode = "" }: { customerCode?: string }) {
  const { i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const L = (t: string, e: string) => (th ? t : e);
  const tenant = getSession()?.companyId ?? "";
  const [rows, setRows] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | DocType>("ALL");

  useEffect(() => {
    if (!tenant || !customerCode) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    Promise.all(DOCS.map((d) =>
      apiFetch<Doc[]>(`/sales-docs?docType=${d}&customerRef=${encodeURIComponent(customerCode)}`, { tenant })
        .then((list) => (list || []).map((x) => ({ ...x, _doc: d })))
        .catch(() => [] as Doc[]),
    )).then((res) => {
      if (!alive) return;
      const mine = res.flat().filter((d) => {
        const v = d.values || {};
        return v.customerRef === customerCode || v.customerCode === customerCode;
      }).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      setRows(mine);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [tenant, customerCode]);

  const open = (d: Doc) => window.open(urlFor(d._doc!, d.code), "_blank", "noopener,noreferrer");
  const dateStr = (ms?: number) => (ms ? new Date(ms).toLocaleDateString(th ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "—");
  const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const counts = DOCS.reduce((m, dt) => { m[dt] = rows.filter((r) => r._doc === dt).length; return m; }, {} as Record<DocType, number>);
  const shown = filter === "ALL" ? rows : rows.filter((r) => r._doc === filter);
  const totalSales = rows.filter((r) => r._doc === "SO").reduce((a, r) => a + qtNet(r.values), 0);   // ยอดขายรวม = ใบสั่งขาย (SO)
  const totalQuote = rows.filter((r) => r._doc === "QT").reduce((a, r) => a + qtNet(r.values), 0);   // มูลค่าใบเสนอราคารวม

  return (
    <div className="tp" data-customer={customerCode}>
      <div className="tp-card">
        <div className="tp-h"><BarChart size={15} />{L("ประวัติการขาย", "Sales history")}</div>

        {loading && <div className="sh-empty">{L("กำลังโหลด…", "Loading…")}</div>}
        {!loading && rows.length === 0 && <div className="sh-empty">{L("ยังไม่มีเอกสารการขายของลูกค้ารายนี้", "No sales documents for this customer yet")}</div>}

        {!loading && rows.length > 0 && (
          <div className="tp-seg sh-seg">
            <div className={`seg${filter === "ALL" ? " active" : ""}`} onClick={() => setFilter("ALL")}>{L("ทั้งหมด", "All")} <span className="cnt">{rows.length}</span></div>
            {DOCS.map((dt) => (
              <div key={dt} className={`seg${filter === dt ? " active" : ""}`} onClick={() => setFilter(dt)}>
                {th ? DOC_LABEL[dt].th : DOC_LABEL[dt].en} <span className="cnt">{counts[dt]}</span>
              </div>
            ))}
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="sh-sum">
            <div className="sh-sum-it"><span className="k">{L("ยอดขายรวม", "Total sales")}</span><span className="v big">฿{baht(totalSales)}</span><span className="sub">{L(`จาก SO ${counts.SO} ใบ`, `${counts.SO} SO`)}</span></div>
            <div className="sh-sum-it"><span className="k">{L("มูลค่าใบเสนอราคารวม", "Total quoted")}</span><span className="v">฿{baht(totalQuote)}</span><span className="sub">{L(`จาก QT ${counts.QT} ใบ`, `${counts.QT} QT`)}</span></div>
          </div>
        )}

        {!loading && shown.length > 0 && (
          <div className="sh-scroll">
          <table className="sh-table">
            <thead>
              <tr>
                <th>{L("ประเภท", "Type")}</th>
                <th>{L("เลขที่", "No.")}</th>
                <th>{L("บริการ", "Service")}</th>
                <th>{L("ผู้ดูแล", "Owner")}</th>
                <th>{L("สถานะ", "Status")}</th>
                <th className="r">{L("มูลค่า", "Amount")}</th>
                <th>{L("วันที่", "Date")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => {
                const meta = DOC_LABEL[d._doc!];
                const ph = d.phase ? PHASE_LABEL[d.phase] : null;
                const amt = (d._doc === "QT" || d._doc === "SO") ? qtNet(d.values) : 0;
                return (
                  <tr key={`${d._doc}-${d.code}`} className="sh-row" onClick={() => open(d)} title={L("เปิดเอกสารจริง (หน้าใหม่)", "Open document (new tab)")}>
                    <td><span className={`sh-badge ${meta.tone}`}>{th ? meta.th : meta.en}</span></td>
                    <td className="sh-code">{d.code}</td>
                    <td className="sh-subj">{(() => { const v = d.values || {}; const svc = d._doc === "SO" ? (v.closedService || v.servicesOffered) : d._doc === "FO" ? (v.servicesWanted || v.servicesOffered) : (v.servicesOffered || v.closedService); return svc || "—"; })()}</td>
                    <td>{d.telesale || d.values?.salesperson || "—"}</td>
                    <td>{(() => { const o = d.values?.outcome; if (!o) return ph ? (th ? ph.th : ph.en) : "—";
                      const c = o.includes("ไม่ได้") ? "#c23030" : o.startsWith("ปิดการขายได้") ? "#1f7a44" : o === "เปิดใบเสนอราคา" ? "#0a6ed1" : "#8a93a0";
                      return <span style={{ color: c, fontWeight: 600 }}>{o}</span>; })()}</td>
                    <td className="r">{amt ? `฿${baht(amt)}` : "—"}</td>
                    <td>{dateStr(d.savedAt)}</td>
                    <td className="sh-open">↗</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
