import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { ChevronDown, Help, ArrowLeft, Grid, Save, ArrowRight, Lock } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import WorkflowSide from "./WorkflowSide";
import { routesOf, getRouteCuts, setRouteCuts, docTypeName } from "./workflowConfig";
import "./workflow.css";

export default function WorkflowRoutePage() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const session = getSession();
  const [sp] = useSearchParams();
  const MODULE = sp.get("module") || "crm";
  const routes = routesOf(MODULE);
  const [routeId, setRouteId] = useState(routes[0]?.id ?? "");
  const [cuts, setCuts] = useState<string[]>(() => getRouteCuts(routes[0]?.id ?? ""));
  const [initial, setInitial] = useState<string>(() => JSON.stringify(getRouteCuts(routes[0]?.id ?? "")));

  const route = useMemo(() => routes.find((r) => r.id === routeId), [routeId, routes]);
  const dirty = JSON.stringify(cuts) !== initial;

  const pickRoute = (id: string) => { setRouteId(id); const c = getRouteCuts(id); setCuts(c); setInitial(JSON.stringify(c)); };
  const toggle = (docType: string) => setCuts((c) => (c.includes(docType) ? c.filter((x) => x !== docType) : [...c, docType]));
  const save = () => { setRouteCuts(routeId, cuts); setInitial(JSON.stringify(cuts)); };

  const activeSteps = route ? route.steps.filter((s) => !cuts.includes(s.docType)) : [];

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
          <div className="wf-toprow">
            <div>
              <div className="set-head">{t("workflow.routes.title")}</div>
              <div className="set-sub">{t("workflow.routes.sub")}</div>
            </div>
            <div className="wf-docbar">
              <span style={{ fontSize: 13, color: "var(--txt2)" }}>{t("workflow.routes.route")}:</span>
              <select value={routeId} onChange={(e) => pickRoute(e.target.value)} className="wf-dt-select">
                {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          {!route && <div className="set-sub">{t("workflow.routes.none", { defaultValue: "โมดูลนี้เป็นเอกสารใบเดียว ไม่มีเส้นทางต่อ" })}</div>}
          {/* flow */}
          <div className="wf-flow">
            {(route?.steps ?? []).map((s, i) => {
              const cut = cuts.includes(s.docType);
              return (
                <div className="wf-step" key={s.docType}>
                  <div className="wf-step-row">
                    <div className={`wf-step-card${cut ? " cut" : ""}`}>
                      <div className="wf-step-code">{s.docType}</div>
                      <div className="wf-step-name">{docTypeName(s.docType, lang)}</div>
                      {s.removable ? (
                        <label className="wf-step-use">
                          <input type="checkbox" checked={!cut} onChange={() => toggle(s.docType)} />{t("workflow.routes.use")}
                        </label>
                      ) : (
                        <div className="wf-lock"><Lock size={10} />{t("workflow.routes.fixed")}</div>
                      )}
                    </div>
                    {i < (route?.steps.length ?? 0) - 1 && <span className="wf-arrow"><ArrowRight size={18} /></span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* active path preview */}
          <div className="wf-active">
            <span style={{ color: "var(--txt3)", fontSize: 12.5, marginRight: 8 }}>{t("workflow.routes.activePath")}:</span>
            {activeSteps.map((s, i) => (
              <span key={s.docType}>
                <b>{s.docType}</b>{i < activeSteps.length - 1 ? <span className="wf-arrow"> → </span> : null}
              </span>
            ))}
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
