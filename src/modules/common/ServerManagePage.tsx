import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession, isPlatformOwner } from "../../shared/session";
import { Grid, ChevronDown, Help, ArrowLeft, Box, Refresh } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import NotifBell from "../../shared/NotifBell";
import { storageUsageAll, humanSize } from "../../shared/attachments";
import "./companyManage.css";

/** จัดการ server — เจ้าของระบบดูพื้นที่ Firebase รวมทั้งระบบ (กันเกินแพ็กเกจ/โดนเก็บเงิน) */
export default function ServerManagePage() {
  const nav = useNavigate();
  const { i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const session = getSession();
  const [usage, setUsage] = useState<{ usedBytes: number; quotaBytes: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); storageUsageAll().then(setUsage).catch(() => setUsage(null)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const L = (t: string, e: string) => (th ? t : e);
  if (!session) return <Navigate to="/login" replace />;
  if (!isPlatformOwner()) return <Navigate to="/app" replace />; // เฉพาะเจ้าของระบบ

  const pct = usage && usage.quotaBytes > 0 ? Math.min(100, (usage.usedBytes / usage.quotaBytes) * 100) : 0;
  const remain = usage ? Math.max(0, usage.quotaBytes - usage.usedBytes) : 0;
  const warn = pct >= 80;

  return (
    <div className="p-cm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} onClick={() => nav("/app")}>iDoc ERP</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{L("จัดการ server", "Server")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <NotifBell />
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="cm-toolbar">
        <div className="tbtn" onClick={() => nav("/app")}><ArrowLeft /><span>{L("กลับ", "Back")}</span></div>
        <div className="tbtn" onClick={load}><Refresh /><span>{L("รีเฟรช", "Refresh")}</span></div>
      </div>

      <div className="cm-body">
        <div className="cm-card">
          <div className="cm-h"><Box size={16} />{L("พื้นที่จัดเก็บไฟล์ (Firebase Storage) — รวมทั้งระบบ", "Storage (Firebase) — all companies")}</div>
          {loading ? (
            <div className="muted" style={{ fontSize: 12.5 }}>{L("กำลังโหลด…", "Loading…")}</div>
          ) : !usage ? (
            <div style={{ color: "var(--red)", fontSize: 13 }}>{L("โหลดข้อมูลพื้นที่ไม่สำเร็จ", "Failed to load usage")}</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6 }}>
                <span>{L("ใช้ไป", "Used")}: <b>{humanSize(usage.usedBytes)}</b> / {humanSize(usage.quotaBytes)}</span>
                <span style={{ color: warn ? "var(--red)" : "var(--green, #1f7a44)" }}>{L("เหลือ", "Left")} {humanSize(remain)} ({Math.round(100 - pct)}%)</span>
              </div>
              <div style={{ height: 14, borderRadius: 7, background: "var(--line)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: warn ? "var(--red)" : "var(--blue, #2563eb)", transition: "width .3s" }} />
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
                {L("รวมไฟล์แนบทุกบริษัท (รูป/ลายเซ็น/โลโก้/เอกสาร) เทียบโควตาแผนฟรี Firebase ~5GB", "All companies' attachments vs Firebase free quota ~5GB")}
                {warn && <div style={{ color: "var(--red)", fontWeight: 600 }}>{L("⚠ ใกล้เต็ม! ลบไฟล์เก่า หรืออัปแพ็กเกจ Firebase ก่อนโดนคิดเงิน", "⚠ Almost full — clean up or upgrade")}</div>}
              </div>
            </>
          )}
        </div>

        <div className="cm-card">
          <div className="cm-h"><Box size={16} />{L("ข้อมูล provider", "Provider info")}</div>
          <div className="cm-print-rows" style={{ fontSize: 13 }}>
            <div><b>Provider:</b> Firebase Storage (Google Cloud)</div>
            <div><b>Bucket:</b> idoc-3299c.firebasestorage.app</div>
            <div className="muted">{L("สลับ provider ได้ที่ backend (StoragePort) โดยไม่ต้องแก้หน้าจอ", "Swappable via backend StoragePort")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
