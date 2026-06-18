import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch, ApiError } from "../../shared/api";
import { getSession } from "../../shared/session";
import { ArrowLeft, Save, Help, Building, Grid, Plus } from "../../shared/icons";
import LangSwitcher from "../../shared/LangSwitcher";
import { hrMenu } from "./hrMenu";
import { isHrAdmin } from "./hrAccess";
import { listModules, type AppModule } from "./modules";
import "./empform.css";

// ตัวเลือกแผนก/ฝ่าย (mock ไปก่อน — รอ backend แผนก/ฝ่ายจริง)
const DEPARTMENTS = ["ขายในประเทศ", "ขายต่างประเทศ", "การตลาด", "คลังสินค้า", "จัดซื้อ", "บัญชี", "ทรัพยากรบุคคล", "ไอที"];
const DIVISIONS = ["การขาย", "การตลาด", "ปฏิบัติการ", "บัญชีและการเงิน", "บุคคล", "เทคโนโลยี"];

type PositionResp = {
  id: string; code: string; name: string; description: string | null;
  modules: { module: string; level: string }[]; department: string | null; division: string | null;
};

const LEVELS = ["USER", "ADMIN", "SUPER_ADMIN"];

export default function PositionForm() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const isNew = !id;
  const session = getSession();
  const tenant = session?.companyId ?? "";

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [perms, setPerms] = useState<Record<string, string>>({});
  const [department, setDepartment] = useState("");
  const [division, setDivision] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<AppModule[]>([]);

  useEffect(() => { listModules().then(setCatalog).catch(() => {}); }, []);

  const modLabel = (m: AppModule) => (i18n.language.startsWith("en") && m.nameEn ? m.nameEn : m.name);
  const labelOf = (code: string) => { const m = catalog.find((x) => x.code === code); return m ? modLabel(m) : code; };
  const setLevel = (m: string, level: string) =>
    setPerms((p) => { const n = { ...p }; if (level) n[m] = level; else delete n[m]; return n; });
  const addMod = (code: string) => setPerms((p) => ({ ...p, [code]: "USER" }));

  const errText = (e: unknown) => {
    const a = e as ApiError;
    return a?.code ? t(`errors.${a.code}`, { defaultValue: a.message }) : (a?.message || t("errors.generic"));
  };

  useEffect(() => {
    if (!isNew && tenant) {
      apiFetch<PositionResp>(`/admin/positions/${id}`, { tenant })
        .then((p) => {
          setCode(p.code);
          setName(p.name);
          setDescription(p.description ?? "");
          setPerms(Object.fromEntries((p.modules ?? []).map((mp) => [mp.module, mp.level])));
          setDepartment(p.department ?? "");
          setDivision(p.division ?? "");
        })
        .catch((e) => setError(t("posForm.errLoad") + ": " + errText(e)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save() {
    if (!name.trim()) { setError(t("posForm.errRequireName")); return; }
    setError(""); setBusy(true);
    try {
      const body = { name: name.trim(), description: description.trim() || null, modules: catalog.filter((m) => perms[m.code]).map((m) => ({ module: m.code, level: perms[m.code] })), department: department.trim() || null, division: division.trim() || null };
      if (isNew) {
        await apiFetch("/admin/positions", { method: "POST", tenant, body });
      } else {
        await apiFetch(`/admin/positions/${id}`, { method: "PUT", tenant, body });
      }
      nav("/hr");
    } catch (e) {
      setError(t("posForm.errSave") + ": " + errText(e));
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return <div className="p-empform"><div className="ef-body"><div className="ef-banner err">{t("empForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("empForm.goLogin")}</button></div></div>;
  }

  return (
    <div className="p-empform">
      {/* top bar */}
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="doctitle" style={{ paddingLeft: 14 }}>{isNew ? t("posForm.crumbNew") : t("posForm.crumbEdit", { code })}</div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <div className="ic"><Help /></div>
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="ef-main">
        <div className="ef-side">
          <div className="side-title">{t("hr.title")}</div>
          {hrMenu.map((m) => (
            <div
              key={m.key}
              className={`side-item${m.key === "core" ? " active" : ""}${m.enabled ? "" : " disabled"}`}
              onClick={() => { if (m.key === "core") nav("/hr"); }}
            >
              <m.Icon size={17} />
              <span>{t(`hr.menu.${m.key}`)}</span>
              {!m.enabled && <span className="soon">{t("common.soon")}</span>}
            </div>
          ))}
        </div>

        <div className="ef-content">
          {/* toolbar */}
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav("/hr")}><ArrowLeft /><span>{t("posForm.back")}</span></div>
            <div className="tbsep" />
            {isHrAdmin() && <div className="tbtn primary" onClick={save}><Save /><span>{busy ? t("posForm.saving") : t("posForm.save")}</span></div>}
          </div>

          <div className="ef-body">
            <div className="ef-head">{isNew ? t("posForm.headNew") : t("posForm.headEdit", { code })}</div>
            {error && <div className="ef-banner err">{error}</div>}

            {/* position info */}
            <div className="ef-card">
              <div className="sh"><Building size={15} />{t("posForm.secInfo")}</div>
              <div className="ef-grid">
                <div className="field-sm">
                  <label>{t("posForm.code")}</label>
                  <input value={isNew ? t("posForm.codeAuto") : code} readOnly disabled />
                </div>
                <div className="field-sm">
                  <label>{t("posForm.name")}</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("posForm.namePh")} />
                </div>
                <div className="field-sm">
                  <label>{t("posForm.department")}</label>
                  <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                    <option value="">{t("posForm.pickDepartment")}</option>
                    {(department && !DEPARTMENTS.includes(department) ? [department, ...DEPARTMENTS] : DEPARTMENTS).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="field-sm">
                  <label>{t("posForm.division")}</label>
                  <select value={division} onChange={(e) => setDivision(e.target.value)}>
                    <option value="">{t("posForm.pickDivision")}</option>
                    {(division && !DIVISIONS.includes(division) ? [division, ...DIVISIONS] : DIVISIONS).map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="field-sm wide">
                  <label>{t("posForm.description")}</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("posForm.descriptionPh")} />
                </div>
              </div>
            </div>

            {/* module access */}
            <div className="ef-card">
              <div className="sh"><Grid size={15} />{t("posForm.secModules")}</div>
              <div className="ef-grid">
                <div className="field-sm wide">
                  <div className="perm-add">
                    <Plus size={15} />
                    <select value="" onChange={(e) => { if (e.target.value) addMod(e.target.value); }}>
                      <option value="">{t("posForm.addModule", { defaultValue: "+ เพิ่มโมดูล" })}</option>
                      {catalog.filter((m) => !perms[m.code]).map((m) => <option key={m.code} value={m.code}>{modLabel(m)}</option>)}
                    </select>
                  </div>
                  <div className="perm-rows">
                    {Object.keys(perms).length === 0 && (
                      <div className="ef-hint">{t("posForm.noModuleYet", { defaultValue: "ยังไม่ได้เพิ่มโมดูล — เลือกเพิ่มด้านล่าง" })}</div>
                    )}
                    {catalog.filter((m) => perms[m.code]).map((m) => (
                      <div key={m.code} className="perm-row">
                        <span className="perm-mod">{modLabel(m)}</span>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <select value={perms[m.code]} onChange={(e) => setLevel(m.code, e.target.value)}>
                            {LEVELS.map((lv) => <option key={lv} value={lv}>{t(`hr.access.${lv}`)}</option>)}
                          </select>
                          <button type="button" className="perm-x" title={t("posForm.removeModule", { defaultValue: "ลบโมดูล" })} onClick={() => setLevel(m.code, "")}>×</button>
                        </div>
                      </div>
                    ))}
                    {/* perm ที่ไม่อยู่ใน catalog แล้ว (โมดูลถูกปิด) — ยังเห็น/ลบได้ */}
                    {Object.keys(perms).filter((c) => !catalog.some((m) => m.code === c)).map((c) => (
                      <div key={c} className="perm-row">
                        <span className="perm-mod">{labelOf(c)}</span>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <select value={perms[c]} onChange={(e) => setLevel(c, e.target.value)}>
                            {LEVELS.map((lv) => <option key={lv} value={lv}>{t(`hr.access.${lv}`)}</option>)}
                          </select>
                          <button type="button" className="perm-x" onClick={() => setLevel(c, "")}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="ef-hint">{t("posForm.modulesHint")}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
