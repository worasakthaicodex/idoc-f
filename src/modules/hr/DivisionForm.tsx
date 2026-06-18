import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { ArrowLeft, Save, Help, Building } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import { hrMenu } from "./hrMenu";
import { isHrAdmin } from "./hrAccess";
import { getDivision, saveDivision } from "./orgStore";
import "./empform.css";

export default function DivisionForm() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { id } = useParams();
  const isNew = !id;
  const session = getSession();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNew) getDivision(id!).then((d) => { setName(d.name); setCode(d.code); }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save() {
    if (!name.trim()) { setError(t("divForm.errRequireName")); return; }
    try { await saveDivision(name.trim(), id); nav("/hr"); }
    catch (e) { setError((e as Error).message); }
  }

  if (!session) {
    return <div className="p-empform"><div className="ef-body"><div className="ef-banner err">{t("empForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("empForm.goLogin")}</button></div></div>;
  }

  return (
    <div className="p-empform">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="doctitle" style={{ paddingLeft: 14 }}>{isNew ? t("divForm.crumbNew") : t("divForm.crumbEdit", { code })}</div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="ef-main">
        <div className="ef-side">
          <div className="side-title">{t("hr.title")}</div>
          {hrMenu.map((m) => (
            <div key={m.key} className={`side-item${m.key === "core" ? " active" : ""}${m.enabled ? "" : " disabled"}`} onClick={() => { if (m.key === "core") nav("/hr"); }}>
              <m.Icon size={17} /><span>{t(`hr.menu.${m.key}`)}</span>{!m.enabled && <span className="soon">{t("common.soon")}</span>}
            </div>
          ))}
        </div>

        <div className="ef-content">
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav("/hr")}><ArrowLeft /><span>{t("common.back")}</span></div>
            <div className="tbsep" />
            {isHrAdmin() && <div className="tbtn primary" onClick={save}><Save /><span>{t("common.save")}</span></div>}
          </div>

          <div className="ef-body">
            <div className="ef-head">{isNew ? t("divForm.headNew") : t("divForm.headEdit", { code })}</div>
            {error && <div className="ef-banner err">{error}</div>}

            <div className="ef-card">
              <div className="sh"><Building size={15} />{t("divForm.sec")}</div>
              <div className="ef-grid">
                <div className="field-sm">
                  <label>{t("divForm.code")}</label>
                  <input value={isNew ? t("divForm.codeAuto") : code} readOnly disabled />
                </div>
                <div className="field-sm">
                  <label>{t("divForm.name")}</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("divForm.namePh")} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
