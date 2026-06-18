import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import {
  ChevronDown, Help, Workflow, Grid, FileText, Shield, Filter, Box, Clock, ArrowRight, Hash,
} from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import WorkflowSide from "./WorkflowSide";
import "./workflow.css";

/** องค์ประกอบของระบบ workflow (ยังเป็น placeholder — ค่อยลงมือทีละตัว) */
const BLOCKS: { key: string; Icon: typeof FileText; color: string; to?: string }[] = [
  { key: "requests", Icon: FileText, color: "#0a84ff" },
  { key: "numbering", Icon: Hash, color: "#5e5ce6", to: "/workflow/numbering" },
  { key: "steps", Icon: Shield, color: "#34c759", to: "/workflow/stages" },
  { key: "routes", Icon: ArrowRight, color: "#0a84ff", to: "/workflow/routes" },
  { key: "authorities", Icon: Shield, color: "#5e5ce6", to: "/workflow/authorities" },
  { key: "conditions", Icon: Filter, color: "#ff9500" },
  { key: "integrations", Icon: Box, color: "#8e8e93" },
  { key: "tracking", Icon: Clock, color: "#ff375f" },
];

export default function WorkflowPage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const session = getSession();
  const [sp] = useSearchParams();
  const MODULE = sp.get("module") || "crm";
  const go = (to: string) => nav(`${to}?module=${MODULE}`);

  // งานขายมี "บทบาท" → แทน block แบบฟอร์มคำขอ ด้วย "กล่องงานของแต่ละ role"
  const blocks = MODULE === "sales"
    ? [{ key: "workbox", Icon: Box, color: "#0a84ff", to: "/workflow/workbox" }, ...BLOCKS.slice(1)]
    : BLOCKS;

  if (!session) {
    return <div className="p-workflow"><div className="wf-body"><div className="banner err">{t("workflow.notLoggedIn", { defaultValue: "ยังไม่ได้เข้าสู่ระบบ" })}</div><button className="btn primary" onClick={() => nav("/login")}>{t("common.backHome")}</button></div></div>;
  }

  return (
    <div className="p-workflow">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex" }}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{MODULE === "product" ? t("product.title") : MODULE === "sales" ? t("home.tiles.sales.title") : MODULE === "accounting" ? t("home.tiles.accounting.title") : t("customer.title")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="wf-main">
        <WorkflowSide module={MODULE} />
        <div className="wf-content">

      <div className="wf-body">
        <div className="wf-inner">
          <div className="wf-head">{t("workflow.title")}</div>
          <div className="wf-sub">{t("workflow.subtitle")}</div>

          <div className="wf-intro">
            <div className="ic-badge"><Workflow size={17} /></div>
            <div>{t("workflow.intro")}</div>
          </div>

          <div className="wf-section">{t("workflow.blocksSection")}</div>
          <div className="wf-grid">
            {blocks.map((b) => (
              <div className={`wf-card${b.to ? " link" : ""}`} key={b.key} onClick={b.to ? () => go(b.to!) : undefined}>
                <div className="wf-ic" style={{ background: b.color }}><b.Icon size={17} /></div>
                <div className="wf-t">{t(`workflow.block.${b.key}.t`)}{b.to ? <span className="chev" style={{ marginLeft: "auto", color: "var(--txt3)", fontSize: 18 }}>›</span> : <span className="wf-soon">{t("common.soon")}</span>}</div>
                <div className="wf-d">{t(`workflow.block.${b.key}.d`)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
