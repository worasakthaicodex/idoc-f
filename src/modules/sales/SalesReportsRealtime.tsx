import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, Help, Building, ArrowLeft, BarChart, Refresh } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import NotifBell from "../../shared/NotifBell";
import SalesSide from "./SalesSide";
import { loadClDocs, syncSalesDocs, type ClDoc } from "./clRequests";
import { Donut, MultiChart, palette, baht, num, type Bar } from "./salesCharts";
import "../customer/customer.css";
import "./sales.css";

const parseItems = (s?: string): { serviceType?: string; price?: string; discount?: string; qty?: string }[] => { try { const a = s ? JSON.parse(s) : []; return Array.isArray(a) ? a : []; } catch { return []; } };
const isHeld = (r: ClDoc) => r.phase === "PROCESS";
const holderOf = (r: ClDoc) => (r.received?.by || r.values?.salesperson || r.telesale || "").trim() || "(ไม่ระบุ)";
const qtAmount = (r: ClDoc) => { const n = num(r.values?.netAmount); if (n > 0) return n; const its = parseItems(r.values?.items); const before = its.reduce((a, it) => a + num(it.price) * num(it.qty), 0); const disc = its.reduce((a, it) => a + num(it.discount), 0); return (before - disc) * 1.07; };
const STATUS_TONE: Record<string, string> = { HOT: "#dc2626", Warm: "#f59e0b", Cold: "#2563eb" };

/** รายงานเรียลไทม์ — ภาพรวมเอกสารที่ "ถือครองอยู่ตอนนี้" (อยู่กล่องรอดำเนินการ) */
export default function SalesReportsRealtime() {
  const nav = useNavigate();
  const { i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const session = getSession();
  const [tick, setTick] = useState(0);

  const reload = () => { Promise.all(["CL", "FO", "QT"].map((d) => syncSalesDocs(d).catch(() => {}))).then(() => setTick((n) => n + 1)); };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const rt = useMemo(() => {
    void tick;
    const cl = loadClDocs("CL").filter(isHeld), fo = loadClDocs("FO").filter(isHeld), qt = loadClDocs("QT").filter(isHeld);
    const perPerson = new Map<string, { cl: number; fo: number; qt: number }>();
    const bump = (who: string, k: "cl" | "fo" | "qt") => { const o = perPerson.get(who) || { cl: 0, fo: 0, qt: 0 }; o[k]++; perPerson.set(who, o); };
    cl.forEach((r) => bump(holderOf(r), "cl")); fo.forEach((r) => bump(holderOf(r), "fo")); qt.forEach((r) => bump(holderOf(r), "qt"));
    const personRows = [...perPerson.entries()].map(([who, o]) => ({ who, ...o, total: o.cl + o.fo + o.qt })).sort((a, b) => b.total - a.total);

    const tallyStatus = (docs: ClDoc[], key: string): Bar[] => {
      const m = new Map<string, number>();
      docs.forEach((r) => { const v = (r.values?.[key] || "").trim() || "(ไม่ระบุ)"; m.set(v, (m.get(v) || 0) + 1); });
      return ["HOT", "Warm", "Cold"].filter((s) => m.has(s)).map((s) => ({ label: s, value: m.get(s)!, tone: STATUS_TONE[s] }))
        .concat(m.has("(ไม่ระบุ)") ? [{ label: "(ไม่ระบุ)", value: m.get("(ไม่ระบุ)")!, tone: "#94a3b8" }] : []);
    };
    const teleStatus = tallyStatus(fo, "teleDocStatus");
    const saleStatus = tallyStatus([...fo, ...qt], "saleDocStatus");

    const svc = new Map<string, number>();
    qt.forEach((r) => { const types = new Set(parseItems(r.values?.items).map((it) => (it.serviceType || "").trim()).filter(Boolean)); if (types.size === 0) svc.set("(ไม่ระบุบริการ)", (svc.get("(ไม่ระบุบริการ)") || 0) + 1); else types.forEach((tn) => svc.set(tn, (svc.get(tn) || 0) + 1)); });
    const svcItems: Bar[] = [...svc.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

    const amtPerson = new Map<string, { count: number; amt: number }>(); let amtTotal = 0;
    qt.forEach((r) => { const a = qtAmount(r); amtTotal += a; const who = holderOf(r); const o = amtPerson.get(who) || { count: 0, amt: 0 }; o.count++; o.amt += a; amtPerson.set(who, o); });
    const amtRows = [...amtPerson.entries()].map(([who, o]) => ({ who, ...o })).sort((a, b) => b.amt - a.amt);

    return { personRows, teleStatus, saleStatus, svcItems, amtRows, amtTotal, qtCount: qt.length, clN: cl.length, foN: fo.length, qtN: qt.length };
  }, [tick]);

  if (!session) return <div className="p-crm"><div className="crm-body"><div className="banner err"><Building size={15} />{th ? "กรุณาเข้าสู่ระบบ" : "Please log in"}</div><button className="btn primary" onClick={() => nav("/login")}><ArrowLeft size={15} />{th ? "ไปหน้าเข้าสู่ระบบ" : "Login"}</button></div></div>;

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title="กลับหน้าหลัก" onClick={() => nav("/app")}>iDoc ERP</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{th ? "งานขาย" : "Sales"}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <NotifBell />
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <SalesSide active="reports" />
        <div className="crm-content">
          <div className="subbar">
            <div className="tb" title={th ? "กลับสารบัญ" : "Back"} style={{ cursor: "pointer" }} onClick={() => nav("/sales/reports")}><ArrowLeft /></div>
            <div className="company-pick"><BarChart size={15} />{th ? "เรียลไทม์ — ถือครองตอนนี้" : "Realtime — held now"}</div>
            <div className="u-spacer" />
            <div className="tb" title={th ? "รีเฟรช" : "Refresh"} style={{ cursor: "pointer" }} onClick={reload}><Refresh /></div>
          </div>

          <div className="crm-body">
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{th ? "เอกสารที่ถือครองอยู่ตอนนี้ (อยู่ในกล่องรอดำเนินการ)" : "Documents currently held"}</div>

            <div className="card">
              <div className="sh">{th ? "ถือครองแต่ละคน (CL / FO / QT)" : "Held per person"}<span className="muted" style={{ fontWeight: 400, fontSize: 12, marginLeft: 8 }}>CL {rt.clN} · FO {rt.foN} · QT {rt.qtN}</span></div>
              <div className="rp-body">
                <MultiChart type="bar" periods={rt.personRows.map((r) => r.who)} empty={th ? "ไม่มีเอกสารที่ถือครอง" : "Nothing held"}
                  series={[
                    { name: "CL", color: palette[0], values: rt.personRows.map((r) => r.cl) },
                    { name: "FO", color: palette[2], values: rt.personRows.map((r) => r.fo) },
                    { name: "QT", color: palette[1], values: rt.personRows.map((r) => r.qt) },
                  ]} />
              </div>
            </div>

            <div className="card">
              <div className="sh">{th ? "ถือครองแยกตามสถานะเอกสาร (H-W-C)" : "Held by status (H-W-C)"}</div>
              <div className="rp-body" style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
                <div style={{ flex: 1, minWidth: 280 }}><div className="rp-grade-title">{th ? "Telesale · FO" : "Telesale · FO"}</div><Donut items={rt.teleStatus} unit="FO" /></div>
                <div style={{ flex: 1, minWidth: 280 }}><div className="rp-grade-title">{th ? "Sale · FO+QT" : "Sale · FO+QT"}</div><Donut items={rt.saleStatus} unit="FO+QT" /></div>
              </div>
            </div>

            <div className="card"><div className="sh">{th ? "QT ที่ถือครอง แยกตามบริการ" : "Held QT by service"}</div><div className="rp-body"><Donut items={rt.svcItems} unit="QT" /></div></div>

            <div className="card">
              <div className="sh">{th ? "มูลค่า QT ที่ถือครอง" : "Held QT value"}<span className="ff-count" style={{ marginLeft: 8 }}>฿{baht(rt.amtTotal)}</span><span className="muted" style={{ fontWeight: 400, fontSize: 12, marginLeft: 6 }}>{rt.qtCount} {th ? "ใบ" : "docs"}</span></div>
              <div className="rp-body">
                <MultiChart type="bar" periods={rt.amtRows.map((r) => r.who)} empty={th ? "ไม่มี QT ที่ถือครอง" : "No held QT"}
                  series={[{ name: th ? "มูลค่า QT (บาท)" : "QT value (THB)", color: palette[1], values: rt.amtRows.map((r) => Math.round(r.amt)) }]} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
