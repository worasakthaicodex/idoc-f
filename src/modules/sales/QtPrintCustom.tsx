import { useEffect, useRef } from "react";

/** เทมเพลตใบเสนอราคา "แบบเจ้าของบริษัท" — ตารางเดียว border-collapse (เส้น 1px เท่ากันทุกจุด)
 *  8 คอลัมน์: แยก "ลำดับ" (แคบ) ออกจาก "โลโก้/ป้าย" (กว้าง) เพื่อให้ลำดับไม่บานตาม */
type LineItem = { name: string; serviceType: string; price: string; discount: string; qty: string; unit: string };
const num = (v?: string) => { const n = parseFloat((v || "").replace(/,/g, "")); return isNaN(n) ? 0 : n; };
const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type QtCustomData = {
  logoUrl?: string; signUrl?: string;
  company: { name: string; address: string; phone: string };
  doc: { code: string; rev: string; date: string; foRef: string };
  customer: { code: string; name: string; contact: string; address: string; phone: string; email: string };
  salesperson: string;
  items: LineItem[];
  promotionInfo: string;
  paymentTerms: string;
  lastPayment?: string;   // งวดสุดท้าย: "ก่อนส่งมอบงาน" / "เมื่อสิ้นสุดการทำงาน MD สุดท้าย" / "-"
  money: { sub: number; discount: number; afterDiscount: number; vat: number; net: number };
  remark: string;
  signPos?: { x: number; y: number };          // ตำแหน่งลายเซ็น (จำแยกตามพนักงาน)
  onSignPos?: (p: { x: number; y: number }) => void; // เรียกเมื่อลาก/รีเซ็ตเสร็จ → ให้บันทึกลง DB
};

/** คำนวณเงื่อนไขการชำระเงินแบบแตกงวด (port จากระบบเดิม) — คืนเป็นบรรทัด */
function paymentLines(type: string, net: number, mdTotal: number, lastPayment: string | undefined, th: boolean): string[] {
  const f = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const amt = th ? "จำนวน " : "Amount ";
  const vat = (p: string) => (th ? ` บาท(รวม vat) ${p}` : ` Baht (inc. VAT) ${p}`);
  const before = th ? " ก่อนเริ่มดำเนินกิจกรรม" : " Before starting activities.";
  const footer = !lastPayment || lastPayment === "-" ? "" : lastPayment === "ก่อนส่งมอบงาน" ? (th ? "ก่อนส่งมอบงาน" : "Before delivery") : (th ? "เมื่อสิ้นสุดการทำงาน MD สุดท้าย" : "Upon completion of the last MD");
  const L: string[] = [];
  const head3 = th ? "*** การชำระเงินเเบ่งออกเป็น 3 งวดดังนี้ ***" : "*** Payment is divided into 3 installments as follows: ***";
  const head2 = th ? "*** การชำระเงินเเบ่งออกเป็น 2 งวดดังนี้ ***" : "*** Payment is divided into 2 installments as follows: ***";
  const head4 = th ? "*** การชำระเงินเเบ่งออกเป็น 4 งวดดังนี้ ***" : "*** Payment is divided into 4 installments as follows: ***";
  switch ((type || "").trim()) {
    case "ชำระเงินก่อนเริ่มดำเนินกิจกรรม ไม่เกิน 7 วัน":
      L.push(th ? "ชำระเงินก่อนเริ่มดำเนินกิจกรรม ไม่เกิน 7 วัน" : "Payment before starting activities, not exceeding 7 days");
      L.push(`1. ${amt}${f(net)}${vat("100%")}`);
      break;
    case "เเบ่งจ่าย 3 งวด": {
      L.push(head3);
      L.push(`1. ${amt}${f(net * 0.4)}${vat("40%")}${before}`);
      let l2 = `2. ${amt}${f(net * 0.4)}${vat("40%")}`;
      if (mdTotal > 1) l2 += " " + (th ? `ระหว่างดำเนินกิจกรรม Manday ที่ ${Math.floor(mdTotal / 2)}` : `During Manday activity No. ${Math.floor(mdTotal / 2)}`);
      L.push(l2);
      L.push(`3. ${amt}${f(net * 0.2)}${vat("20%")} ${footer}`);
      break;
    }
    case "เเบ่งจ่าย 2 งวด":
      L.push(head2);
      L.push(`1. ${amt}${f(net / 2)}${vat("50%")}${before}`);
      L.push(`2. ${amt}${f(net / 2)}${vat("50%")} ${footer}`);
      break;
    case "เเบ่งจ่าย 2 งวด  (70/30)":
      L.push(head2);
      L.push(`1. ${amt}${f(net * 0.7)}${vat("70%")}${before}`);
      L.push(`2. ${amt}${f(net * 0.3)}${vat("30%")} ${footer}`);
      break;
    case "เเบ่งจ่าย 4 งวด": {
      L.push(head4);
      for (let i = 1; i <= 3; i++) L.push(`${i}. ${amt}${f(net * 0.25)}${vat("25%")}${before}`);
      L.push(`4. ${amt}${f(net * 0.25)}${vat("25%")} ${footer}`);
      break;
    }
    case "เเบ่งจ่าย 4 งวด ( แบบไตรมาส )": {
      L.push(head4);
      const q = ["1-3", "4-6", "7-9", "10-13"];
      for (let i = 0; i < 4; i++) L.push(`${i + 1}. ${amt}${f(net * 0.25)}${th ? ` บาท(รวมvat)25% ก่อนเริ่มดำเนินกิจกรรม Manday ที่ ${q[i]}` : ` Baht(inc. VAT)25% Before starting Manday activities ${q[i]}`}`);
      break;
    }
    default:
      if (type) L.push(type);
  }
  return L;
}

const F = "THSarabunNew";
const B = "1px solid #000";
const SZ = 15.5;
// c1 ลำดับ | c2-c3 รายการ | c4 จำนวน | c5 หน่วย | c6 ราคา/หน่วย | c7 ส่วนลด | c8 รวม
const COLS = ["6%", "8%", "38%", "9%", "7%", "11%", "9%", "12%"];

const tableSt: React.CSSProperties = { width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontFamily: F, border: B };
const gray: React.CSSProperties = { fontFamily: F, background: "#e6e6e6", color: "#666", fontWeight: 700, textAlign: "center", border: B, padding: "3px 4px", fontSize: SZ, verticalAlign: "middle" };
const box: React.CSSProperties = { fontFamily: F, border: B, color: "#444", padding: "3px 6px", fontSize: SZ, textAlign: "center", verticalAlign: "middle" };
const cell: React.CSSProperties = { fontFamily: F, color: "#444", padding: "3px 6px", fontSize: SZ, verticalAlign: "top" };
const vL: React.CSSProperties = { borderLeft: B }; // เส้นแนวตั้งคั่นคอลัมน์

export default function QtPrintCustom(d: QtCustomData) {
  const its = d.items.filter((it) => (it.name || "").trim() || num(it.price));
  const ordered = [...its.filter((it) => (it.serviceType || "").trim()), ...its.filter((it) => !(it.serviceType || "").trim())];
  const m = d.money;
  const mdTotal = its.reduce((a, it) => a + ((it.unit || "").toUpperCase() === "MD" ? num(it.qty) : 0), 0);
  const payLines = paymentLines(d.paymentTerms, m.net, mdTotal, d.lastPayment, true);
  // ป้ายซ้าย (c1-c2) · ค่าเริ่ม c3 (ตรงแนวชื่อบริษัท)
  const hv = (label: string, value: string) => <><td style={{ ...cell, padding: "0 6px", fontWeight: 700, whiteSpace: "nowrap" }} colSpan={2}>{label}</td><td style={{ ...cell, padding: "0 6px" }} colSpan={2}>{value}</td></>;
  // แถวรายการว่าง (เส้นแนวตั้งครบ)
  const blankItemTail = () => <><td style={{ ...cell, ...vL }} /><td style={{ ...cell, ...vL }} /><td style={{ ...cell, ...vL }} /><td style={{ ...cell, ...vL }} /><td style={{ ...cell, ...vL }} /></>;

  // ===== ลากปรับตำแหน่งรูปลายเซ็น — แก้ DOM ตรง ๆ (ไม่ใช้ state) เพื่อไม่ให้ re-render ล้างข้อความที่แก้แบบ Word =====
  // ตำแหน่งลายเซ็น: ค่าเริ่มต้นจาก props (เก็บแยกตามพนักงานใน DB) แล้วแจ้งกลับเมื่อลาก/รีเซ็ตเสร็จ
  const imgRef = useRef<HTMLImageElement>(null);
  const off = useRef<{ x: number; y: number }>({ x: d.signPos?.x ?? 0, y: d.signPos?.y ?? 0 });
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const applyPos = () => { if (imgRef.current) imgRef.current.style.transform = `translate(calc(-50% + ${off.current.x}px), calc(-50% + ${off.current.y}px))`; };
  const onMove = (e: PointerEvent) => { if (!drag.current) return; off.current = { x: drag.current.ox + (e.clientX - drag.current.sx), y: drag.current.oy + (e.clientY - drag.current.sy) }; applyPos(); };
  const onUp = () => { drag.current = null; window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); d.onSignPos?.({ ...off.current }); };
  const onDown = (e: React.PointerEvent) => { e.preventDefault(); e.stopPropagation(); drag.current = { sx: e.clientX, sy: e.clientY, ox: off.current.x, oy: off.current.y }; window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); };
  const resetPos = () => { off.current = { x: 0, y: 0 }; applyPos(); d.onSignPos?.({ x: 0, y: 0 }); };
  // ตำแหน่งโหลดแบบ async (จาก DB) — เมื่อมาถึงให้ขยับรูปไปตามค่าที่จำไว้
  useEffect(() => { off.current = { x: d.signPos?.x ?? 0, y: d.signPos?.y ?? 0 }; applyPos(); }, [d.signPos?.x, d.signPos?.y]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <table style={tableSt}>
      <colgroup>{COLS.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
      <tbody>
        {/* ===== หัวเอกสาร: โลโก้ c1-2 ชิดซ้าย · บริษัท/ค่า c3-5 · กล่องขวา c6-8 ===== */}
        <tr>
          <td style={{ ...cell, textAlign: "left", verticalAlign: "middle" }} colSpan={2} rowSpan={2}>{d.logoUrl ? <img src={d.logoUrl} alt="logo" style={{ maxHeight: 40, maxWidth: "100%", objectFit: "contain" }} /> : null}</td>
          <td style={{ ...cell, verticalAlign: "middle" }} colSpan={2} rowSpan={2}><b style={{ fontSize: 16 }}>{d.company.name}</b><br /><span style={{ fontSize: 13 }}>{d.company.address}{d.company.phone ? ` โทร ${d.company.phone}` : ""}</span></td>
          <td style={{ ...gray, height: 26 }} colSpan={2} rowSpan={2}>Quotation</td>
          <td style={box} colSpan={2} rowSpan={2}>{d.doc.code}</td>
        </tr>
        <tr></tr>
        <tr>
          {hv("รหัสลูกค้า", d.customer.code)}
          <td style={{ ...gray, height: 26 }} colSpan={2} rowSpan={2}>Revision</td><td style={box} colSpan={2} rowSpan={2}>{d.doc.rev}</td>
        </tr>
        <tr>{hv("บริษัทลูกค้า", d.customer.name)}</tr>
        <tr>
          {hv("นามลูกค้า", d.customer.contact)}
          <td style={{ ...gray, height: 26 }} colSpan={2} rowSpan={2}>Date</td><td style={box} colSpan={2} rowSpan={2}>{d.doc.date}</td>
        </tr>
        <tr>{hv("ที่อยู่", d.customer.address)}</tr>
        <tr>
          {hv("โทรศัพท์", d.customer.phone)}
          <td style={gray} colSpan={2}>FO</td><td style={box} colSpan={2}>{d.doc.foRef}</td>
        </tr>
        <tr>
          {hv("อีเมล์", d.customer.email)}
          <td style={gray} colSpan={2}>พนักงานขาย</td><td style={box} colSpan={2}>{d.salesperson}</td>
        </tr>

        {/* ===== หัวตารางรายการ ===== */}
        <tr>
          <td style={gray}>ลำดับ</td><td style={gray} colSpan={2}>รายการ</td><td style={gray}>จำนวนหน่วย</td>
          <td style={gray}>หน่วย</td><td style={gray}>ราคาต่อหน่วย</td><td style={gray}>ส่วนลด</td><td style={gray}>ราคารวม</td>
        </tr>
        {(() => {
          const rows: React.ReactNode[] = [];
          let cur = ""; let n = 0;
          ordered.forEach((it, idx) => {
            const svc = (it.serviceType || "").trim();
            if (svc && svc !== cur) {
              cur = svc;
              rows.push(<tr key={`h${idx}`}><td style={cell} /><td style={{ ...cell, ...vL, fontWeight: 700 }} colSpan={2}>{svc}</td>{blankItemTail()}</tr>);
            }
            n += 1;
            const tot = num(it.price) * num(it.qty) - num(it.discount);
            rows.push(
              <tr key={idx}>
                <td style={{ ...cell, textAlign: "center" }}>{n}</td>
                <td style={{ ...cell, ...vL }} colSpan={2}>{it.name}</td>
                <td style={{ ...cell, ...vL, textAlign: "center" }}>{it.qty || ""}</td>
                <td style={{ ...cell, ...vL, textAlign: "center" }}>{it.unit || ""}</td>
                <td style={{ ...cell, ...vL, textAlign: "right" }}>{it.price ? baht(num(it.price)) : ""}</td>
                <td style={{ ...cell, ...vL, textAlign: "right" }}>{num(it.discount) ? baht(num(it.discount)) : ""}</td>
                <td style={{ ...cell, ...vL, textAlign: "right" }}>{tot < 0 ? "" : baht(tot)}</td>
              </tr>,
            );
          });
          return rows;
        })()}
        {its.length === 0 && <tr><td style={{ ...cell, textAlign: "center", color: "#999", padding: 14 }} colSpan={8}>— ไม่มีรายการ —</td></tr>}
        {d.promotionInfo && <tr><td style={cell} /><td style={{ ...cell, ...vL, whiteSpace: "pre-wrap" }} colSpan={2}>{d.promotionInfo}</td>{blankItemTail()}</tr>}
        <tr><td style={cell} /><td style={{ ...cell, ...vL, whiteSpace: "nowrap" }} colSpan={2}>( กรุณาระบุวันที่ต้องการเข้าดำเนินกิจกรรม..........................)</td>{blankItemTail()}</tr>
        {payLines.length > 0 && <tr><td style={cell} /><td style={{ ...cell, ...vL, fontWeight: 700 }} colSpan={2}>{payLines.map((ln, i) => <div key={i}>{ln}</div>)}</td>{blankItemTail()}</tr>}
        <tr><td style={{ ...cell, height: 8 }} /><td style={{ ...cell, ...vL }} colSpan={2} />{blankItemTail()}</tr>

        {/* ===== Remark + ยอดรวม ===== */}
        <tr>
          <td className="qt-remark" style={{ ...cell, fontSize: 11.5, whiteSpace: "pre-wrap", borderTop: B }} colSpan={4} rowSpan={4}>{d.remark}</td>
          <td style={gray} colSpan={2}>ราคารวม</td><td style={{ ...box, textAlign: "right", fontWeight: 700 }} colSpan={2}>{baht(m.sub)}</td>
        </tr>
        <tr><td style={gray} colSpan={2}>ส่วนลด</td><td style={{ ...box, textAlign: "right", fontWeight: 700 }} colSpan={2}>{m.discount ? baht(m.discount) : ""}</td></tr>
        <tr><td style={gray} colSpan={2}>ราคาหลังหักส่วนลด</td><td style={{ ...box, textAlign: "right", fontWeight: 700 }} colSpan={2}>{baht(m.afterDiscount)}</td></tr>
        <tr><td style={gray} colSpan={2}>ภาษีมูลค่าเพิ่ม 7%</td><td style={{ ...box, textAlign: "right", fontWeight: 700 }} colSpan={2}>{baht(m.vat)}</td></tr>
        <tr>
          <td style={{ ...cell, fontSize: 10.5, fontWeight: 700 }} colSpan={4}>***เมื่อท่านลงนามในใบเสนอราคาหรือออกใบสั่งซื้อ ถือว่ายืนยันความถูกต้องของบริการ/ราคา/เงื่อนไข และยืนยันการสั่งซื้อ หากยกเลิกภายหลังบริษัทฯ ขอสงวนสิทธิ์คิดค่าใช้จ่าย 30%***</td>
          <td style={gray} colSpan={2}>เงินรวมสุทธิ</td><td style={{ ...box, textAlign: "right", fontWeight: 700, fontSize: 15 }} colSpan={2}>{baht(m.net)}</td>
        </tr>

        {/* ===== ลายเซ็น 2 ฝั่ง — ข้อความกึ่งกลาง ตัวหนา บรรทัดชิด · รูปลายเซ็นลอยทับ (ลากได้ ไม่จองพื้นที่) ===== */}
        <tr>
          <td style={{ ...cell, borderTop: B, textAlign: "center", fontWeight: 700, lineHeight: 1.9, padding: "10px 8px" }} colSpan={4}>
            ข้าพเจ้าตกลงซื้อสินค้า/บริการ ตามรายการและเงื่อนไขตามเอกสารฉบับนี้<br />
            ...........................................ลายเซ็นผู้มีอำนาจพร้อมประทับตรา<br />
            ...........................................ตำแหน่ง<br />
            ...........................................วันที่ (Date)
          </td>
          <td style={{ ...cell, borderTop: B, borderLeft: B, textAlign: "center", fontWeight: 700, lineHeight: 1.9, padding: "10px 8px", position: "relative" }} colSpan={4}>
            {d.company.name}<br />
            (For and behalf of company)<br />
            ...........................................ลายเซ็นผู้มีอำนาจ<br />
            วันที่ (Date) {d.doc.date}
            {d.signUrl ? (
              <>
                <img ref={imgRef} src={d.signUrl} alt="sign" draggable={false} contentEditable={false} onPointerDown={onDown}
                  style={{ maxHeight: 50, maxWidth: "60%", objectFit: "contain", position: "absolute", left: "50%", top: "50%", transform: `translate(calc(-50% + ${off.current.x}px), calc(-50% + ${off.current.y}px))`, cursor: "move", touchAction: "none", zIndex: 2 }} />
                <button type="button" className="no-print" contentEditable={false} onClick={resetPos} title="รีเซ็ตตำแหน่งลายเซ็น"
                  style={{ position: "absolute", top: 2, right: 2, fontSize: 10, padding: "1px 6px", border: "1px solid #999", borderRadius: 4, background: "#fff", color: "#444", cursor: "pointer", zIndex: 3, fontWeight: 400 }}>รีเซ็ตลายเซ็น</button>
              </>
            ) : null}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
