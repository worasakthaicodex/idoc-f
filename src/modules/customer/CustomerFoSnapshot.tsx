import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { apiFetch } from "../../shared/api";
import { Building } from "../../shared/icons";

/**
 * ข้อมูลกิจการล่าสุดของลูกค้า — ดึงจาก "ใบ FO ล่าสุด" ที่บันทึกค่าพวกนี้ไว้
 * (ค่าที่เปลี่ยน/ต้องถามบ่อย เก็บกับเอกสารขาย ไม่ผูกเป็นฟิลด์ลูกค้า เพราะแก้ field config จะกระทบทุกราย)
 * บริการ: บริการที่นำเสนอ = QT · บริการที่ลูกค้าต้องการ/ความต้องการ = FO
 */
type Doc = { code: string; savedAt?: number; values?: Record<string, string> };
const SNAP: { key: string; th: string; en: string; money?: boolean }[] = [
  { key: "numEmployees", th: "จำนวนพนักงาน", en: "Employees" },
  { key: "machineHp", th: "แรงม้าเครื่องจักร", en: "Machine HP" },
  { key: "registeredCapital", th: "ทุนจดทะเบียน", en: "Registered capital", money: true },
  { key: "saleContactRole", th: "ความสำคัญของผู้ประสานงาน", en: "Coordinator role" },
  { key: "saleTraits", th: "ลักษณะลูกค้า", en: "Customer traits" },
];
// บริการ — src บอกว่าเอามาจากเอกสารชนิดไหน (QT = บริการที่นำเสนอ, FO = ที่ลูกค้าต้องการ/ความต้องการ)
const SERVICES: { key: string; th: string; en: string; src: "FO" | "QT" }[] = [
  { key: "servicesOffered", th: "บริการที่นำเสนอ", en: "Services offered", src: "QT" },
  { key: "servicesWanted", th: "บริการที่ลูกค้าต้องการ", en: "Services wanted", src: "FO" },
  { key: "customerNeed", th: "ความต้องการของลูกค้า (อธิบาย)", en: "Customer need", src: "FO" },
];

// เลือกใบล่าสุดที่ "มีค่าในฟิลด์ที่เราสนใจ" — ถ้าไม่มีเลย ใช้ใบล่าสุดสุด
function pickLatest(list: Doc[] | null, customerCode: string, keys: string[]): Doc | null {
  const mine = (list || [])
    .filter((d) => (d.values?.customerRef || d.values?.customerCode) === customerCode)
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  return mine.find((d) => keys.some((k) => (d.values?.[k] || "").trim())) || mine[0] || null;
}

export default function CustomerFoSnapshot({ customerCode = "", embed = false }: { customerCode?: string; embed?: boolean }) {
  const { i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const L = (t: string, e: string) => (th ? t : e);
  const tenant = getSession()?.companyId ?? "";
  const [doc, setDoc] = useState<Doc | null>(null);
  const [qtDoc, setQtDoc] = useState<Doc | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!tenant || !customerCode) { setLoaded(true); return; }
    let alive = true;
    // กรองที่ backend ด้วย customerRef — ดึงเฉพาะใบของลูกค้ารายนี้ ไม่ดึงทั้งตาราง FO/QT (กันหน้าลูกค้ากินแรมหนัก)
    const cr = encodeURIComponent(customerCode);
    Promise.all([
      apiFetch<Doc[]>(`/sales-docs?docType=FO&customerRef=${cr}`, { tenant }).catch(() => [] as Doc[]),
      apiFetch<Doc[]>(`/sales-docs?docType=QT&customerRef=${cr}`, { tenant }).catch(() => [] as Doc[]),
    ]).then(([foList, qtList]) => {
      if (!alive) return;
      setDoc(pickLatest(foList, customerCode, [...SNAP.map((s) => s.key), "servicesWanted", "customerNeed"]));
      setQtDoc(pickLatest(qtList, customerCode, ["servicesOffered"]));
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [tenant, customerCode]);

  if (!loaded) return null;
  const v = doc?.values || {};
  const has = SNAP.some((s) => (v[s.key] || "").trim());
  const fmtMoney = (s: string) => { const n = parseFloat(s.replace(/,/g, "")); return isNaN(n) ? s : n.toLocaleString("th-TH"); };
  const title = L("ข้อมูลกิจการล่าสุด (จากการขาย)", "Latest business info (from sales)");
  const items = SNAP.map((s) => { let val = (v[s.key] || "").trim(); if (s.money && val) val = fmtMoney(val) + " ฿"; return { label: th ? s.th : s.en, val }; });
  const srcOf = (src: "FO" | "QT") => (src === "QT" ? qtDoc : doc);
  const services = SERVICES.map((s) => ({ label: th ? s.th : s.en, val: (srcOf(s.src)?.values?.[s.key] || "").trim(), src: s.src }));
  const hasService = services.some((s) => s.val);
  const servicesTitle = L("บริการ", "Services");
  const emptyMsg = L("ยังไม่มีข้อมูลจากใบ FO — บันทึกในใบ FO แล้วจะแสดงค่าล่าสุดที่นี่", "No FO data yet — record it on an FO and the latest shows here");

  // โหมดฝังในแผงลูกค้า (FO/QT) — ใช้คลาสของแผง (ct-h / kv / r / k / v)
  if (embed) {
    return (
      <div style={{ marginBottom: 14 }}>
        <div className="ct-h">{servicesTitle}</div>
        <div className="kv">
          {!hasService ? <div className="r"><span className="v muted">—</span></div>
            : services.map((it) => <div className="r" key={it.label}><span className="k">{it.label}</span><span className={`v${it.val ? "" : " muted"}`}>{it.val || "—"}</span></div>)}
        </div>
        <div className="ct-h" style={{ marginTop: 12 }}>{title}{doc && <span className="muted" style={{ fontWeight: 400, fontSize: 11, marginLeft: 6 }}>· {L("จาก", "from")} {doc.code}</span>}</div>
        <div className="kv">
          {!has ? <div className="r"><span className="v muted">{emptyMsg}</span></div>
            : items.map((it) => <div className="r" key={it.label}><span className="k">{it.label}</span><span className={`v${it.val ? "" : " muted"}`}>{it.val || "—"}</span></div>)}
        </div>
      </div>
    );
  }

  // โหมดการ์ดในหน้าลูกค้า
  return (
    <>
      <div className="card">
        <div className="sh"><Building size={15} />{servicesTitle}</div>
        <div className="crm-dl">
          {!hasService ? (
            <div className="crm-row"><div className="dd muted">{L("ยังไม่มีข้อมูลบริการ", "No service data yet")}</div></div>
          ) : services.map((it) => (
            <div className="crm-row" key={it.label}>
              <div className="dt">{it.label}</div>
              <div className={`dd${it.val ? "" : " muted"}`}>{it.val || "—"}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="sh"><Building size={15} />{title}
          {doc && <span className="muted" style={{ fontWeight: 400, fontSize: 12, marginLeft: 6 }}>· {L("จาก", "from")} {doc.code}</span>}
        </div>
        <div className="crm-dl">
          {!has ? (
            <div className="crm-row"><div className="dd muted">{emptyMsg}</div></div>
          ) : items.map((it) => (
            <div className="crm-row" key={it.label}>
              <div className="dt">{it.label}</div>
              <div className={`dd${it.val ? "" : " muted"}`}>{it.val || "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
