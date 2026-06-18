import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { ChevronDown, Help, ArrowLeft, Grid, Save, Check } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import WorkflowSide from "./WorkflowSide";
import { rolesOf, roleName, activeDocTypes, getRoleBoxes, setRoleBoxes, docTypeName } from "./workflowConfig";
import "./workflow.css";

export default function WorkflowWorkboxPage() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const session = getSession();
  const [sp] = useSearchParams();
  const MODULE = sp.get("module") || "sales";

  const roles = rolesOf(MODULE);
  const docs = activeDocTypes(MODULE);
  const [boxes, setBoxes] = useState<Record<string, string[]>>(() => getRoleBoxes(MODULE));
  const [initial, setInitial] = useState<string>(() => JSON.stringify(getRoleBoxes(MODULE)));

  const dirty = JSON.stringify(boxes) !== initial;
  const has = (role: string, dc: string) => (boxes[role] ?? []).includes(dc);
  const toggle = (role: string, dc: string) => {
    setBoxes((b) => {
      const cur = b[role] ?? [];
      const next = cur.includes(dc) ? cur.filter((x) => x !== dc) : [...cur, dc];
      return { ...b, [role]: next };
    });
  };
  const save = () => { setRoleBoxes(MODULE, boxes); setInitial(JSON.stringify(boxes)); };

  if (!session) {
    return <div className="p-workflow"><div className="wf-body"><div className="banner err">{t("workflow.notLoggedIn", { defaultValue: "ยังไม่ได้เข้าสู่ระบบ" })}</div><button className="btn primary" onClick={() => nav("/login")}>{t("common.backHome")}</button></div></div>;
  }

  return (
    <div className="p-workflow">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex" }}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{MODULE === "product" ? t("product.title") : MODULE === "sales" ? t("home.tiles.sales.title") : t("customer.title")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="wf-main">
        <WorkflowSide module={MODULE} />
        <div className="wf-content">
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav(`/workflow?module=${MODULE}`)}><ArrowLeft /><span>{t("common.back")}</span></div>
            <div className="tbsep" />
            <div className="tbtn primary" onClick={save}><Save /><span>{t("common.save")}</span></div>
            {dirty && <span style={{ marginLeft: 12, fontSize: 12, color: "#b28600", whiteSpace: "nowrap" }}>● {t("empFields.unsaved")}</span>}
          </div>

          <div className="wf-body">
            <div className="wf-inner">
              <div className="set-head">{t("workflow.workbox.title")}</div>
              <div className="set-sub">{t("workflow.workbox.sub")}</div>

              {roles.length === 0 ? (
                <div className="banner err" style={{ marginTop: 12 }}>{t("workflow.workbox.noRoles", { defaultValue: "โมดูลนี้ยังไม่ได้กำหนดบทบาทผู้ทำงาน" })}</div>
              ) : (
                <div className="wf-rolebox">
                  {roles.map((r) => (
                    <div className="wf-rb-row" key={r.key}>
                      <div className="wf-rb-name">{roleName(r, lang)}</div>
                      <div className="wf-rb-docs" style={{ gridTemplateColumns: `repeat(${docs.length}, 1fr)` }}>
                        {docs.map((dc) => (
                          <button key={dc} className={`wf-rb-chip${has(r.key, dc) ? " on" : ""}`} onClick={() => toggle(r.key, dc)}>
                            <span className="rb-code">{has(r.key, dc) && <Check size={12} />}{dc}</span>
                            <span className="rb-nm">{docTypeName(dc, lang).replace(/\s*\([^)]*\)\s*$/, "")}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="set-hint" style={{ marginTop: 14, fontSize: 12.5, color: "var(--txt3)" }}>{t("workflow.workbox.note")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
