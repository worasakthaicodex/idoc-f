import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { rolesOf, roleName } from "../workflow/workflowConfig";
import { loadClDocs, syncSalesDocsDaily, SALES_DOCS_EVENT } from "./clRequests";
import { ageInfo, ageStartMs } from "./salesAge";
import { getSession } from "../../shared/session";

const stages = [
  { code: "CL", name: "ลูกค้ามุ่งหวัง", qty: 42 },
  { code: "FO", name: "ใบเปิดโอกาส", qty: 28 },
  { code: "QT", name: "ใบเสนอราคา", qty: 63 },
  { code: "SO", name: "ใบสั่งขาย", qty: 37 },
];

/**
 * แถบเลือกขั้นตอนเอกสาร (ซ้าย)
 *  - docs = จำกัดให้เห็นเฉพาะกล่องที่บทบาทนี้ได้ (ตั้งใน /workflow/workbox) · ไม่ส่ง = เห็นทุกกล่อง
 *  - role = บทบาทที่เข้ามา (พาไปต่อโดยคงบทบาทไว้)
 */
export default function StagePicker({ active, docs, role }: { active: string; docs?: string[]; role?: string }) {
  const nav = useNavigate();
  const { i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const shown = docs ? stages.filter((s) => docs.includes(s.code)) : stages;
  const go = (code: string) => nav(`/sales/${code.toLowerCase()}${role ? `?role=${role}` : ""}`);
  const roleObj = role ? rolesOf("sales").find((r) => r.key === role) : null;

  // เลขจริง CL/FO = เฉพาะที่ต้องลงมือ (รอรับของฉัน + กำลังดำเนินการ) · อัปเดตเมื่อ sync
  const [tick, setTick] = useState(0);
  useEffect(() => {
    ["CL", "FO", "QT", "SO"].forEach((d) => syncSalesDocsDaily(d, 0).catch(() => {}));   // นับงาน active เท่านั้น · วันละครั้ง ไม่ยิงทุกหน้า
    const h = (e: Event) => { const d = (e as CustomEvent).detail; if (["CL", "FO", "QT", "SO"].includes(d)) setTick((n) => n + 1); };
    window.addEventListener(SALES_DOCS_EVENT, h);
    return () => window.removeEventListener(SALES_DOCS_EVENT, h);
  }, []);
  const me = (() => { const s = getSession(); return s?.fullName || s?.email || s?.companyCode || ""; })();
  // นับให้ตรงกับ "กล่อง" จริง (SalesDocuments.inPhase): รอรับของฉัน + รอดำเนินการของฉัน
  type Doc = ReturnType<typeof loadClDocs>[number];
  const ownerOf = (r: Doc) => r.values?.createdBy || r.telesale || r.values?.salesperson || "";
  const inReceive = (r: Doc) => { const rc = r.sent?.recipients; const see = !rc || rc.length === 0 || rc.includes(me); return r.phase === "RECEIVE" && !r.received && see; };
  const inProcess = (r: Doc) => r.phase === "PROCESS" && (r.received ? r.received.by === me : (!r.sent && (ownerOf(r) ? ownerOf(r) === me : true)));
  // ตัด "หมดอายุ" ออกเหมือนตัวเลขกล่อง (SalesDocuments.tabCount = inPhase && !isExpired) · CL ใช้ค่าจากฟอร์ม timeframeCL
  const isExpired = (r: Doc, d: string) => ageInfo(d, ageStartMs(r), d === "CL" ? (Number(r.values?.timeframeCL) || undefined) : undefined).expired;
  const workCount = (d: string) => loadClDocs(d).filter((r) => (inReceive(r) || inProcess(r)) && !isExpired(r, d)).length;
  const clCount = useMemo(() => workCount("CL"), [tick, me]);
  const foCount = useMemo(() => workCount("FO"), [tick, me]);
  const qtCount = useMemo(() => workCount("QT"), [tick, me]);
  const soCount = useMemo(() => workCount("SO"), [tick, me]);

  return (
    <div className="picker">
      <div className="ph">{roleObj ? roleName(roleObj, i18n.language) : (th ? "เลือกขั้นตอน:" : "Pick a stage:")}</div>
      <div className="plist">
        {shown.map((s) => (
          <div
            key={s.code}
            className={`pitem${active === s.code ? " sel" : ""}`}
            onClick={() => go(s.code)}
          >
            <span className="pc">{s.code}</span>
            <span className="pn">{s.name}</span>
            <span className="pq">{s.code === "CL" ? clCount : s.code === "FO" ? foCount : s.code === "QT" ? qtCount : s.code === "SO" ? soCount : s.qty}</span>
          </div>
        ))}
        {shown.length === 0 && <div className="ph" style={{ padding: "10px 14px", color: "var(--txt3)" }}>{th ? "บทบาทนี้ยังไม่มีกล่องงาน" : "No boxes for this role"}</div>}
      </div>
    </div>
  );
}
