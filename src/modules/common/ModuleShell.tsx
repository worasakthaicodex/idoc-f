import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Grid, ChevronDown, Help, BarChart, Shield, Box } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import { getSession } from "../../shared/session";
import CostCenterPanel from "./CostCenterPanel";
import "../customer/customer.css";

/**
 * โครงหน้าโมดูลใหม่ (บัญชี/การเงิน/PP/การผลิต) — เลย์เอาต์เดียวกับ /sales
 * เมนูซ้ายมีแค่ "รายงาน" + "ตั้งค่า" ไปก่อน · เนื้อหายังเป็น placeholder
 */
export default function ModuleShell({ titleKey, base, active }: { titleKey: string; base: string; active: "reports" | "settings" | "cost-center" }) {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const th = i18n.language.startsWith("th");
  const session = getSession();
  const title = t(`home.tiles.${titleKey}.title`);
  const label = active === "reports" ? (th ? "รายงาน" : "Reports") : (th ? "ตั้งค่า" : "Settings");

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{title}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{(session?.companyCode || "A").charAt(0)}</div>
      </div>

      <div className="crm-main">
        <div className="crm-side">
          <div className="side-title">{title}</div>
          {base === "/accounting" && (
            <div className={`side-item${active === "cost-center" ? " active" : ""}`} onClick={() => nav(`${base}/cost-center`)}>
              <Box size={17} /><span>Cost center</span>
            </div>
          )}
          <div className={`side-item${active === "reports" ? " active" : ""}`} onClick={() => nav(base)}>
            <BarChart size={17} /><span>{th ? "รายงาน" : "Reports"}</span>
          </div>
          <div className="side-divider" />
          <div className={`side-item${active === "settings" ? " active" : ""}`} onClick={() => nav(`${base}/settings`)}>
            <Shield size={17} /><span>{th ? "ตั้งค่า" : "Settings"}</span>
          </div>
        </div>

        <div className="crm-content">
          {active === "cost-center" ? (
            <div className="crm-body"><CostCenterPanel /></div>
          ) : (
          <div className="crm-body">
            <div style={{ display: "grid", placeItems: "center", padding: "72px 20px", textAlign: "center" }}>
              <div style={{ maxWidth: 420 }}>
                <div style={{ display: "inline-flex", padding: 18, borderRadius: 16, background: "var(--sel, #eef2ff)", color: "var(--blue)", marginBottom: 14 }}>
                  {active === "reports" ? <BarChart size={40} /> : <Shield size={40} />}
                </div>
                <h2 style={{ margin: "0 0 6px" }}>{title} · {label}</h2>
                <p style={{ color: "var(--txt3)", fontSize: 13 }}>{t("common.soon")}</p>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
