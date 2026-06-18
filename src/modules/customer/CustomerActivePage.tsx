import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../shared/api";
import { getSession, clearSession } from "../../shared/session";
import { Grid, ChevronDown, Refresh, Building, ArrowLeft, HomeIcon, Search } from "../../shared/icons";
import CrmHelpButton from "./CrmHelpButton";
import LangSwitcher from "../../shared/LangSwitcher";
import CustomerSide from "./CustomerSide";
import "./customer.css";

/** แถวลูกค้าที่เคลื่อนไหวล่าสุด — source = TOOL | CL | FO | QT | SO | CALENDAR */
type Movement = { id: string; code: string; name: string; status: string; movedAt: string; source: string; detail?: string | null };

/**
 * ลูกค้าที่เคลื่อนไหว — 200 รายล่าสุด (ACTIVE) ที่ถูกดำเนินการจาก Tool / เอกสาร CL·FO·QT·SO / ปฏิทิน
 * ค้นในรายการนี้ฝั่งหน้า (โหลดครั้งเดียว) · ระบุแหล่งที่มา + วันที่เคลื่อนไหว
 */
export default function CustomerActivePage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();
  const tenant = session?.companyId ?? "";

  const [moves, setMoves] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [moveQ, setMoveQ] = useState("");

  function fetchMoves() {
    if (!tenant) return;
    setLoading(true); setError("");
    apiFetch<Movement[]>(`/customers/recent-movements?limit=200`, { tenant })
      .then((rows) => setMoves(rows ?? []))
      .catch((e) => setError(t("customer.errLoad") + ": " + e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { fetchMoves(); /* eslint-disable-next-line */ }, [tenant]);

  // ป้ายกำกับ "เคลื่อนไหวจาก" + โทนสี ของแต่ละแหล่ง
  const SOURCE_META: Record<string, { label: string; tone: "green" | "gray" | "red" }> = {
    TOOL: { label: t("customer.move.tool", { defaultValue: "เครื่องมือ" }), tone: "gray" },
    CL: { label: "CL", tone: "green" }, FO: { label: "FO", tone: "green" }, QT: { label: "QT", tone: "green" }, SO: { label: "SO", tone: "green" },
    CALENDAR: { label: t("customer.move.calendar", { defaultValue: "ปฏิทิน" }), tone: "red" },
  };
  const moveDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  const moveDetail = (m: Movement) => ((m.source === "TOOL" || m.source === "CALENDAR") && m.detail ? m.detail : "");
  const movesFiltered = moves.filter((m) => {
    const s = moveQ.trim().toLowerCase();
    if (!s) return true;
    return [m.name, m.code, SOURCE_META[m.source]?.label ?? m.source, m.detail ?? ""].some((v) => v.toLowerCase().includes(s));
  });

  const logout = () => { clearSession(); nav("/login"); };

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
        <CustomerSide active="active" />

        <div className="crm-content">
          <div className="subbar">
            <div className="company-pick"><Building size={15} />{t("customer.menu.active", { defaultValue: "ลูกค้าที่เคลื่อนไหว" })}</div>
            <div className="u-spacer" />
            <div className="tb" title={t("common.refresh")} onClick={fetchMoves}><Refresh /></div>
            <div className="vsep" />
            <div className="fields" onClick={() => nav("/app")} title={t("common.backHome")}><HomeIcon size={16} />{t("customer.home")}</div>
            <div className="vsep" />
            <div className="fields" onClick={logout}><ArrowLeft size={16} />{t("common.logout")}</div>
          </div>

          <div className="crm-body">
            {error && <div className="banner err"><Building size={15} />{error}</div>}

            <div className="card">
              <div className="ch">
                <span>{t("customer.move.head", { defaultValue: "200 รายล่าสุดที่เคลื่อนไหว" })} <span className="muted">{t("customer.move.hint", { defaultValue: "ถูกดำเนินการจากเครื่องมือ เอกสาร (CL/FO/QT/SO) หรือปฏิทิน" })}</span></span>
              </div>

              {/* ค้นในรายการนี้ (ฝั่งหน้า) */}
              <div className="cust-search">
                <div className="req-search" style={{ flex: 1, maxWidth: 440 }}>
                  <Search size={15} />
                  <input value={moveQ} onChange={(e) => setMoveQ(e.target.value)} placeholder={t("customer.move.searchPh", { defaultValue: "ค้นชื่อ / รหัส / แหล่งที่มา…" })} />
                </div>
                <span className="muted" style={{ marginLeft: 4, fontSize: 12.5 }}>{movesFiltered.length}/{moves.length}</span>
              </div>

              <table className="data-grid">
                <thead><tr>
                  <th>{t("customer.col.name", { defaultValue: "ชื่อลูกค้า" })}</th>
                  <th>{t("customer.col.code")}</th>
                  <th>{t("customer.move.colSource", { defaultValue: "เคลื่อนไหวจาก" })}</th>
                  <th>{t("customer.move.colWhen", { defaultValue: "วันที่" })}</th>
                </tr></thead>
                <tbody>
                  {movesFiltered.length === 0 ? (
                    <tr className="empty-row"><td colSpan={4}>{loading ? t("common.loading", { defaultValue: "กำลังโหลด…" }) : t("customer.move.empty", { defaultValue: "ยังไม่มีการเคลื่อนไหว" })}</td></tr>
                  ) : movesFiltered.map((m) => (
                    <tr key={m.id} style={{ cursor: "pointer" }} onClick={() => nav(`/customer/${m.id}`)}>
                      <td>{m.name}</td>
                      <td className="docno">{m.code}</td>
                      <td>
                        <span className={`chip ${SOURCE_META[m.source]?.tone ?? "gray"}`}>{SOURCE_META[m.source]?.label ?? m.source}</span>
                        {moveDetail(m) && <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>{moveDetail(m)}</span>}
                      </td>
                      <td>{moveDate(m.movedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
