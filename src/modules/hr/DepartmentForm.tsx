import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSession } from "../../shared/session";
import { ArrowLeft, Save, Help, Building } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import { hrMenu } from "./hrMenu";
import { isHrAdmin } from "./hrAccess";
import { getDepartment, saveDepartment, listDivisions } from "./orgStore";
import "./empform.css";

export default function DepartmentForm() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { id } = useParams();
  const isNew = !id;
  const session = getSession();
  const [divisions, setDivisions] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState("");
  const [division, setDivision] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    listDivisions().then(setDivisions).catch(() => {});
    if (!isNew) getDepartment(id!).then((d) => { setName(d.name); setDivision(d.division ?? ""); setCode(d.code); }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save() {
    if (!name.trim()) { setError(t("deptForm.errRequireName")); return; }
    try { await saveDepartment(name.trim(), division, id); nav("/hr"); }
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
        <div className="doctitle" style={{ paddingLeft: 14 }}>{isNew ? t("deptForm.crumbNew") : t("deptForm.crumbEdit", { code })}</div>
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
            <div className="ef-head">{isNew ? t("deptForm.headNew") : t("deptForm.headEdit", { code })}</div>
            {error && <div className="ef-banner err">{error}</div>}

            <div className="ef-card">
              <div className="sh"><Building size={15} />{t("deptForm.sec")}</div>
              <div className="ef-grid">
                <div className="field-sm">
                  <label>{t("deptForm.code")}</label>
                  <input value={isNew ? t("deptForm.codeAuto") : code} readOnly disabled />
                </div>
                <div className="field-sm">
                  <label>{t("deptForm.name")}</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("deptForm.namePh")} />
                </div>
                <div className="field-sm">
                  <label>{t("deptForm.division")}</label>
                  <select value={division} onChange={(e) => setDivision(e.target.value)}>
                    <option value="">{t("deptForm.pickDivision")}</option>
                    {divisions.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
