import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { ChevronDown, Help, ArrowLeft, Grid, Save, Check } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import WorkflowSide from "./WorkflowSide";
import { docTypesOf, docTypeName, getIssueEvent, setIssueEvent, ISSUE_EVENTS, type IssueEvent } from "./workflowConfig";
import "./workflow.css";

export default function WorkflowNumberingPage() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const session = getSession();
  const [sp] = useSearchParams();
  const MODULE = sp.get("module") || "crm";
  const docTypes = docTypesOf(MODULE);
  const [docType, setDocType] = useState(docTypes[0].code);
  const [sel, setSel] = useState<IssueEvent>(() => getIssueEvent(docTypes[0].code));
  const [initial, setInitial] = useState<IssueEvent>(() => getIssueEvent(docTypes[0].code));

  const dirty = sel !== initial;

  const pickDocType = (dt: string) => { setDocType(dt); const e = getIssueEvent(dt); setSel(e); setInitial(e); };
  const save = () => { setIssueEvent(docType, sel); setInitial(sel); };

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
                  <div className="set-head">{t("workflow.numbering.title")}</div>
                  <div className="set-sub">{t("workflow.numbering.sub")}</div>
                </div>
                <div className="wf-docbar">
                  <span style={{ fontSize: 13, color: "var(--txt2)" }}>{t("workflow.stages.docType")}:</span>
                  <select value={docType} onChange={(e) => pickDocType(e.target.value)} className="wf-dt-select">
                    {docTypes.map((d) => <option key={d.code} value={d.code}>{docTypeName(d.code, lang)}</option>)}
                  </select>
                </div>
              </div>

              <div className="wf-issue-list">
                {ISSUE_EVENTS.map((ev, i) => (
                  <label className={`wf-issue-opt${sel === ev ? " on" : ""}`} key={ev}>
                    <input type="radio" name="issue" checked={sel === ev} onChange={() => setSel(ev)} />
                    <div className="wf-issue-no">{i + 1}</div>
                    <div className="wf-issue-txt">
                      <div className="wf-issue-t">{t(`workflow.numbering.event.${ev}`)}</div>
                      <div className="wf-issue-d">{t(`workflow.numbering.eventHint.${ev}`)}</div>
                    </div>
                    {sel === ev && <Check size={18} style={{ color: "var(--blue)", marginLeft: "auto", flex: "none" }} />}
                  </label>
                ))}
              </div>

              <div className="set-hint" style={{ marginTop: 14, fontSize: 12.5, color: "var(--txt3)" }}>
                {t("workflow.numbering.note")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
