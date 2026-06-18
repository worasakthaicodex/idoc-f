import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Grid, ChevronDown, Help } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import { getSession } from "../../shared/session";

/** แถบบนใช้ร่วมทุกหน้าของพื้นที่บัญชี/Cost Center */
export default function AccTopbar() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();
  return (
    <div className="topbar">
      <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
      <div className="sep" />
      <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/accounting")}>
        <Grid size={16} /><span style={{ fontSize: 14 }}>{t("home.tiles.accounting.title")}</span><ChevronDown size={14} />
      </div>
      <div className="u-spacer" />
      <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
      <div className="ic"><Help /></div>
      <div className="me">{(session?.companyCode || "A").charAt(0)}</div>
    </div>
  );
}
