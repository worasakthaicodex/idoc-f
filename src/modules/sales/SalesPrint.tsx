import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { settingsGet, settingsSet, settingsSetAwait } from "../../shared/settingsStore";
import { apiFetch } from "../../shared/api";
import { listAttachments, attachmentDownloadUrl } from "../../shared/attachments";
import { getClDoc, syncSalesDocs, type ClDoc } from "./clRequests";
import QtPrintCustom, { type QtCustomData } from "./QtPrintCustom";
import "./salesPrint.css";

type LineItem = { name: string; serviceType: string; price: string; discount: string; qty: string; unit: string };
const parseItems = (s?: string): LineItem[] => { try { const a = s ? JSON.parse(s) : []; return Array.isArray(a) ? a : []; } catch { return []; } };
const num = (v?: string) => { const n = parseFloat((v || "").replace(/,/g, "")); return isNaN(n) ? 0 : n; };
const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rowTotal = (it: LineItem) => num(it.price) * num(it.qty) - num(it.discount);
const enc = encodeURIComponent;

const DOC_TITLE: Record<string, { th: string; en: string }> = {
  QT: { th: "ใบเสนอราคา", en: "QUOTATION" },
  SO: { th: "ใบสั่งขาย", en: "SALES ORDER" },
  FO: { th: "ใบเปิดโอกาสการขาย", en: "SALES OPPORTUNITY" },
};

type Cust = { code: string; name: string; contact: string; address: string; phone: string; email: string };
const emptyCust: Cust = { code: "", name: "", contact: "", address: "", phone: "", email: "" };
type Profile = { legalName?: string; address?: string; phone?: string; note?: string };
type Deco = { code?: string; remark: string }; // "แม่แบบ" ที่ใช้ซ้ำต่อใบ (เก็บใน DB)

/** หน้าพิมพ์เอกสารขาย — QT มี 2 แบบ: แบบเจ้าของบริษัท (ค่าเริ่มต้น) / แบบระบบ */
export default function SalesPrint() {
  const { doc = "qt", code = "" } = useParams();
  const nav = useNavigate();
  const { i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const DOC = doc.toUpperCase();
  const session = getSession();
  const [rec, setRec] = useState<ClDoc | null>(() => getClDoc(code, DOC));
  const [ready, setReady] = useState(false);
  const [tpl, setTpl] = useState<"custom" | "system">(() => DOC === "QT" ? (settingsGet<"custom" | "system">("sales.print.tpl", "custom")) : "system");

  // ข้อมูลเสริมสำหรับเทมเพลตเจ้าของบริษัท
  const [cust, setCust] = useState<Cust>(emptyCust);
  const [logoUrl, setLogoUrl] = useState("");
  const [signUrl, setSignUrl] = useState("");
  const [extraReady, setExtraReady] = useState(false);

  // ---- "แม่แบบ" ที่ใช้ซ้ำ (Remark ฯลฯ) เก็บถาวรใน DB: SAVE ใบไหน → ใบนั้นเป็นแม่แบบล่าสุด ·
  //      ใบใหม่หยิบแม่แบบมาใช้ · รีเฟรช = เอาใบที่ SAVE ล่าสุด "ที่ไม่ใช่ตัวเอง" กลับมา · ข้อมูลลูกค้า/รายการดึงสดเสมอ ----
  const DEFAULT_REMARK = "Remark:\n1. ใบเสนอราคานี้มีอายุ 30 วัน\n2. ราคานี้ยังไม่รวมค่าธรรมเนียมราชการ (ถ้ามี)\n3. กรุณาลงนามยืนยันและส่งกลับบริษัท";
  const DOC_KEY = `qtprint.${code}`;
  const MASTER_KEY = "qtprint.master";
  const PREV_KEY = "qtprint.prev";
  const docRef = useRef<HTMLDivElement>(null);
  const [remark, setRemark] = useState<string>(() => {
    const own = settingsGet<Deco | null>(DOC_KEY, null);
    if (own?.remark != null) return own.remark;
    const master = settingsGet<Deco | null>(MASTER_KEY, null);
    if (master?.remark != null) return master.remark;
    return DEFAULT_REMARK;
  });
  const [renderKey, setRenderKey] = useState(0);
  const [saveMsg, setSaveMsg] = useState("");
  // ตำแหน่งลายเซ็น — จำแยกตามพนักงาน (key = emp:<id> หรือ co:<tenant>)
  const [signPosKey, setSignPosKey] = useState("");
  const [signPos, setSignPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  useEffect(() => { if (signPosKey) setSignPos(settingsGet(`qtsignpos.${signPosKey}`, { x: 0, y: 0 })); }, [signPosKey]);

  const readRemark = () => {
    const el = docRef.current?.querySelector(".qt-remark") as HTMLElement | null;
    return el ? el.innerText.replace(/ /g, " ") : remark;
  };
  const doSave = async () => {
    const rk = readRemark();
    setSaveMsg("…");
    settingsSet(DOC_KEY, { code, remark: rk } as Deco);                 // เก็บของใบนี้
    const curMaster = settingsGet<Deco | null>(MASTER_KEY, null);
    if (curMaster && curMaster.code !== code) settingsSet(PREV_KEY, curMaster); // กันรีเฟรชวนกลับตัวเอง
    const ok = await settingsSetAwait(MASTER_KEY, { code, remark: rk } as Deco); // ใบนี้เป็นแม่แบบล่าสุด
    setRemark(rk);
    setSaveMsg(ok ? (th ? "บันทึกเป็นแม่แบบล่าสุดแล้ว ✓" : "Saved as latest master ✓") : (th ? "บันทึกไม่สำเร็จ" : "Save failed"));
    window.setTimeout(() => setSaveMsg(""), 3000);
  };
  const doReload = () => {
    const master = settingsGet<Deco | null>(MASTER_KEY, null);
    const src = (master && master.code !== code) ? master : settingsGet<Deco | null>(PREV_KEY, null);
    setRemark(src?.remark ?? DEFAULT_REMARK);
    setRenderKey((k) => k + 1); // remount เพื่อล้างที่แก้ค้างไว้ใน DOM
    setSaveMsg("");
    syncSalesDocs(DOC).then(() => setRec(getClDoc(code, DOC))).catch(() => {});
  };

  useEffect(() => {
    let alive = true;
    syncSalesDocs(DOC).then(() => { if (alive) { setRec(getClDoc(code, DOC)); setReady(true); } }).catch(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [DOC, code]);

  const v = rec?.values ?? {};
  const items = useMemo(() => parseItems(v.items), [v.items]);
  const sumBefore = items.reduce((a, it) => a + num(it.price) * num(it.qty), 0);
  const sumDiscount = items.reduce((a, it) => a + num(it.discount), 0);
  const afterDiscount = sumBefore - sumDiscount;
  const vatAmt = afterDiscount * 0.07;
  const netAmt = afterDiscount + vatAmt;

  // ดึงลูกค้า + โลโก้/ลายเซ็น (สำหรับแบบเจ้าของบริษัท)
  useEffect(() => {
    if (!rec) return;
    const vv = rec.values ?? {};
    const tenant = session?.companyId ?? "";
    const ref = vv.customerRef || vv.customerCode || "";
    const jobs: Promise<unknown>[] = [];
    if (ref && tenant) {
      jobs.push(apiFetch<{ content: { code: string; name?: string; attributes?: Record<string, string> }[] }>(`/customers?q=${enc(ref)}&size=10`, { tenant })
        .then((p) => { const c = p.content?.find((x) => x.code === ref) || p.content?.[0]; if (c) { const a = c.attributes || {}; setCust({ code: c.code, name: c.name || vv.customerName || "", contact: a.contactPerson || "", address: a.addressFull || a.address || "", phone: a.phone || "", email: a.email || "" }); } }).catch(() => {}));
    } else {
      setCust({ ...emptyCust, name: vv.customerName || "", code: vv.customerCode || "" });
    }
    if (tenant) {
      jobs.push(listAttachments("COMPANY_LOGO", tenant).then((a) => a[0] && attachmentDownloadUrl(a[0].id).then((u) => u && setLogoUrl(u))).catch(() => {}));
      // ลายเซ็น = ของพนักงานขาย (Sale) — หา employee จากชื่อ → EMPLOYEE_SIGN · ถ้าไม่มีค่อยใช้ลายเซ็นบริษัท
      const sp = (vv.salesperson || rec.telesale || "").trim();
      const signJob = (async () => {
        if (sp) {
          try {
            const r = await apiFetch<{ content: { id: string; fullName?: string; email?: string; employeeCode?: string }[] }>(`/admin/employees?size=300`, { tenant });
            const emp = r.content?.find((e) => (e.fullName || "").trim() === sp || (e.email || "").trim() === sp || (e.employeeCode || "").trim() === sp);
            if (emp?.id) {
              const a = await listAttachments("EMPLOYEE_SIGN", emp.id);
              if (a[0]) { const u = await attachmentDownloadUrl(a[0].id); if (u) { setSignUrl(u); setSignPosKey(`emp:${emp.id}`); return; } }
            }
          } catch { /* ignore */ }
        }
        // fallback: ลายเซ็นบริษัท
        try { const a = await listAttachments("COMPANY_SIGN", tenant); if (a[0]) { const u = await attachmentDownloadUrl(a[0].id); if (u) { setSignUrl(u); setSignPosKey(`co:${tenant}`); } } } catch { /* ignore */ }
      })();
      jobs.push(signJob);
    }
    Promise.allSettled(jobs).then(() => setExtraReady(true));
  }, [rec]); // eslint-disable-line react-hooks/exhaustive-deps

  // ไม่สั่งพิมพ์อัตโนมัติ — ให้ผู้ใช้แก้ข้อความในเอกสาร (แบบ Word) ก่อน แล้วค่อยกดพิมพ์เอง
  void extraReady;

  const title = DOC_TITLE[DOC] || { th: DOC, en: DOC };
  const L = (t: string, e: string) => (th ? t : e);
  const dateStr = (ms?: number) => ms ? new Date(ms).toLocaleDateString(th ? "th-TH" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";
  const docDate = v.closeDate || (rec?.savedAt ? dateStr(rec.savedAt) : "—");

  if (ready && !rec) {
    return <div className="pp-screen"><div className="pp-bar"><button className="btn" onClick={() => window.close()}>{L("ปิด", "Close")}</button></div>
      <div className="pp-page"><div style={{ padding: 40, textAlign: "center", color: "#777" }}>{L("ไม่พบเอกสาร", "Document not found")}: {DOC} {code}</div></div></div>;
  }

  const prof = settingsGet<Profile>("company.profile", {});
  const isQtCustom = DOC === "QT" && tpl === "custom";
  const customData: QtCustomData = {
    logoUrl, signUrl,
    company: { name: prof.legalName || session?.companyName || "—", address: prof.address || "", phone: prof.phone || "" },
    doc: { code: rec?.code || code, rev: String(Math.max(0, Number(v.revNo || 1) - 1)), date: v.followupDate || (rec?.savedAt ? new Date(rec.savedAt).toISOString().slice(0, 10) : ""), foRef: v.srcFo || v.documentRef || "" },
    customer: cust,
    salesperson: v.salesperson || rec?.telesale || "",
    items, promotionInfo: v.promotionInfo || "", paymentTerms: v.paymentTerms || "", lastPayment: v.lastPayment || "",
    money: { sub: sumBefore, discount: sumDiscount, afterDiscount, vat: vatAmt, net: netAmt },
    remark,
    signPos,
    onSignPos: (p) => { setSignPos(p); if (signPosKey) void settingsSetAwait(`qtsignpos.${signPosKey}`, p); },
  };

  return (
    <div className="pp-screen">
      <div className="pp-bar">
        {DOC === "QT" && (
          <div className="pp-seg">
            <button className={tpl === "custom" ? "on" : ""} onClick={() => setTpl("custom")}>{L("แบบเจ้าของบริษัท", "Custom")}</button>
            <button className={tpl === "system" ? "on" : ""} onClick={() => setTpl("system")}>{L("แบบระบบ", "System")}</button>
          </div>
        )}
        <span className="u-spacer" style={{ flex: 1 }} />
        {saveMsg && <span style={{ alignSelf: "center", color: "#7CFC8A", fontSize: 13 }}>{saveMsg}</span>}
        <button className="btn" onClick={doReload} title={L("ดึงแม่แบบล่าสุด (ที่ไม่ใช่ใบนี้) + ข้อมูลจริงจากระบบ", "Latest master (not this doc) + fresh data")}>↻</button>
        <button className="btn" onClick={doSave} title={L("บันทึก = ตั้งใบนี้เป็นแม่แบบล่าสุด", "Save = set this doc as latest master")}>💾 {L("บันทึก", "Save")}</button>
        <button className="btn primary" onClick={() => window.print()} title={L("พิมพ์ / บันทึก PDF", "Print / Save PDF")}>🖨 {L("พิมพ์", "Print")}</button>
        <button className="btn" onClick={() => { if (window.history.length > 1) nav(-1); else window.close(); }} title={L("ปิด", "Close")}>✕</button>
      </div>

      <div className="pp-page" key={renderKey} contentEditable suppressContentEditableWarning spellCheck={false} ref={docRef}>
        {isQtCustom ? <QtPrintCustom {...customData} /> : (
          <>
            <div className="pp-head">
              <div>
                <div className="pp-co-name">{prof.legalName || session?.companyName || session?.companyCode || "—"}</div>
                <div className="pp-co-sub">{prof.address || `${L("รหัสบริษัท", "Company")}: ${session?.companyCode || "—"}`}</div>
              </div>
              <div className="pp-title">
                <div className="t">{th ? title.th : title.en}</div>
                <div className="c">{rec?.code || code}{Number(v.revNo) > 1 ? ` (v${v.revNo})` : ""}</div>
                <div className="d">{L("วันที่", "Date")}: {docDate}</div>
              </div>
            </div>

            <div className="pp-meta">
              <div className="box">
                <div className="row"><div className="lb">{L("ลูกค้า", "Customer")}</div><div className="vl">{v.customerName || v.customerCode || "—"}</div></div>
                <div className="row"><div className="lb">{L("รหัสลูกค้า", "Customer code")}</div><div className="vl">{v.customerRef || v.customerCode || "—"}</div></div>
              </div>
              <div className="box">
                <div className="row"><div className="lb">{L("ผู้เสนอราคา / พนักงานขาย", "Salesperson")}</div><div className="vl">{v.salesperson || rec?.telesale || "—"}</div></div>
                {v.paymentTerms && <div className="row"><div className="lb">{L("เงื่อนไขการชำระเงิน", "Payment terms")}</div><div className="vl">{v.paymentTerms}</div></div>}
              </div>
            </div>

            {v.servicesOffered && <div className="pp-note" style={{ marginTop: 4, marginBottom: 8 }}><div className="lb">{L("บริการที่นำเสนอ", "Services offered")}</div><div className="vl">{v.servicesOffered}</div></div>}

            <table className="pp-items">
              <thead>
                <tr>
                  <th className="c" style={{ width: 36 }}>#</th>
                  <th>{L("รายการ", "Item")}</th>
                  <th style={{ width: 130 }}>{L("ประเภทบริการ", "Service type")}</th>
                  <th className="r" style={{ width: 70 }}>{L("จำนวน", "Qty")}</th>
                  <th className="c" style={{ width: 60 }}>{L("หน่วย", "Unit")}</th>
                  <th className="r" style={{ width: 95 }}>{L("ราคา/หน่วย", "Unit price")}</th>
                  <th className="r" style={{ width: 85 }}>{L("ส่วนลด", "Discount")}</th>
                  <th className="r" style={{ width: 105 }}>{L("จำนวนเงิน", "Amount")}</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && <tr><td colSpan={8} className="c" style={{ color: "#999", padding: 18 }}>{L("ไม่มีรายการ", "No items")}</td></tr>}
                {items.map((it, i) => (
                  <tr key={i}>
                    <td className="c">{i + 1}</td>
                    <td>{it.name || "—"}</td>
                    <td>{it.serviceType || "—"}</td>
                    <td className="r">{it.qty || "—"}</td>
                    <td className="c">{it.unit || "—"}</td>
                    <td className="r">{it.price ? baht(num(it.price)) : "—"}</td>
                    <td className="r">{num(it.discount) ? baht(num(it.discount)) : "—"}</td>
                    <td className="r">{rowTotal(it) < 0 ? "" : baht(rowTotal(it))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pp-totals">
              <div className="tr"><span>{L("รวมเป็นเงิน", "Subtotal")}</span><span>{baht(sumBefore)}</span></div>
              <div className="tr"><span>{L("ส่วนลดรวม", "Total discount")}</span><span>{baht(sumDiscount)}</span></div>
              <div className="tr"><span>{L("หลังหักส่วนลด", "After discount")}</span><span>{baht(afterDiscount)}</span></div>
              <div className="tr"><span>{L("ภาษีมูลค่าเพิ่ม 7%", "VAT 7%")}</span><span>{baht(vatAmt)}</span></div>
              <div className="tr grand"><span>{L("ยอดสุทธิ", "Grand total")}</span><span>฿{baht(netAmt)}</span></div>
            </div>

            {v.promotionInfo && <div className="pp-note"><div className="lb">{L("หมายเหตุ", "Notes")}</div><div className="vl">{v.promotionInfo}</div></div>}

            <div className="pp-sign">
              <div className="col"><div className="line">&nbsp;</div><div className="role">{L("ผู้เสนอราคา", "Issued by")}</div></div>
              <div className="col"><div className="line">&nbsp;</div><div className="role">{DOC === "SO" ? L("ผู้รับใบสั่งขาย", "Received by") : L("ผู้อนุมัติ / ลูกค้า", "Approved by / Customer")}</div></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
