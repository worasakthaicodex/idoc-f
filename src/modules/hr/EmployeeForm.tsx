import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";
import { ArrowLeft, Save, Help, User, Phone, Building, FileText, Lock, Shield, Paperclip } from "../../shared/icons";
import AttachmentBox from "../../shared/AttachmentBox";
import LangSwitcher from "../../shared/LangSwitcher";
import { hrMenu } from "./hrMenu";
import { isHrAdmin } from "./hrAccess";
import { getEnabledFields } from "./employeeFieldConfig";
import { getFieldOptions } from "./fieldOptions";
import { EMP_FIELDS, GROUPS, COLUMN_KEYS, type EmpField, type FieldGroup } from "./employeeFields";
import ThaiAddressInput from "./ThaiAddressInput";
import "./empform.css";

type Pos = { id: string; name: string; modules: { module: string; level: string }[] };

const GROUP_ICON: Record<FieldGroup, typeof User> = {
  general: User,
  employment: Building,
  doc: FileText,
  contact: Phone,
  emergency: Shield,
  address: Building,
  statutory: FileText,
};

const isColumn = (k: string) => COLUMN_KEYS.includes(k);

export default function EmployeeForm() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { id } = useParams();
  const isNew = !id;
  const session = getSession();
  const tenant = session?.companyId ?? "";

  const [values, setValues] = useState<Record<string, string>>({});
  const [orig, setOrig] = useState<Record<string, unknown>>({});
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [positions, setPositions] = useState<Pos[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const moduleLabel = (m: string) => t(`hr.modules.${m}`, { defaultValue: m });

  // ฟิลด์ที่บริษัทเปิดใช้ (ตั้งค่า → ฟิลด์ข้อมูลพนักงาน)
  const enabled = getEnabledFields();
  const enabledSet = new Set(enabled);

  useEffect(() => {
    if (tenant) apiFetch<Pos[]>("/admin/positions", { tenant }).then(setPositions).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  useEffect(() => {
    if (!isNew && tenant) {
      apiFetch<Record<string, unknown>>(`/admin/employees/${id}`, { tenant })
        .then((e) => {
          setOrig(e);
          setCode(String(e.code ?? ""));
          setGoogleEnabled(Boolean(e.googleEnabled));
          const attrs = (e.attributes as Record<string, string>) ?? {};
          const next: Record<string, string> = {};
          EMP_FIELDS.forEach((f) => {
            next[f.key] = isColumn(f.key) ? String(e[f.key] ?? "") : String(attrs[f.key] ?? "");
          });
          setValues(next);
        })
        .catch((err) => setError(t("empForm.errLoad") + ": " + err.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));
  const val = (k: string) => values[k] ?? "";

  async function save() {
    if (!val("fullName").trim()) { setError(t("empForm.errRequireName")); return; }
    setError(""); setBusy(true);
    try {
      const body: Record<string, unknown> = {};

      // ฟิลด์ที่มีคอลัมน์จริง — เปิดอยู่: ส่งค่าใหม่ / ปิดอยู่: คงค่าเดิมไว้ (ไม่ล้าง)
      COLUMN_KEYS.forEach((k) => {
        if (enabledSet.has(k)) {
          const v = val(k).trim();
          body[k] = v ? val(k) : null;
        } else {
          body[k] = orig[k] ?? null;
        }
      });

      // ฟิลด์ configurable อื่น ๆ → attributes (JSONB) · คงค่าฟิลด์ที่ปิดไว้
      const attributes: Record<string, string> = { ...((orig.attributes as Record<string, string>) ?? {}) };
      EMP_FIELDS.forEach((f) => {
        if (isColumn(f.key) || !enabledSet.has(f.key)) return;
        const v = val(f.key).trim();
        if (v) attributes[f.key] = v; else delete attributes[f.key];
      });
      body.attributes = attributes;

      body.googleEnabled = googleEnabled;
      if (password.trim()) body.password = password;   // ตั้ง/เปลี่ยนรหัส (เพิ่มได้ทั้งตอนสร้างและแก้ไข) · เว้นว่าง = ไม่เปลี่ยน

      if (isNew) {
        await apiFetch("/admin/employees", { method: "POST", tenant, body });
      } else {
        await apiFetch(`/admin/employees/${id}`, { method: "PUT", tenant, body });
      }
      nav(isNew ? "/hr" : `/hr/employee/${id}`);
    } catch (e) {
      setError(t("empForm.errSave") + ": " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const selectedPos = positions.find((p) => p.name === val("position"));

  if (!session) {
    return <div className="p-empform"><div className="ef-body"><div className="ef-banner err">{t("empForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("empForm.goLogin")}</button></div></div>;
  }

  function positionField() {
    return (
      <div className="field-sm wide" key="position">
        <label>{t("empForm.position")}</label>
        <select value={val("position")} onChange={(e) => set("position", e.target.value)}>
          <option value="">{t("empForm.pickPosition")}</option>
          {positions.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
        <div className="perm-chips" style={{ marginTop: 8 }}>
          {selectedPos
            ? (selectedPos.modules.length
                ? selectedPos.modules.map((mp) => <span key={mp.module} className="chip blue">{moduleLabel(mp.module)} · {t(`hr.access.${mp.level}`, { defaultValue: mp.level })}</span>)
                : <span className="ef-hint">{t("empForm.noPermYet")}</span>)
            : <span className="ef-hint">{t("empForm.pickToSeePerm")}</span>}
        </div>
        <div className="ef-hint">{t("empForm.permHint")}{positions.length === 0 ? t("empForm.permHintNoPos") : ""}</div>
      </div>
    );
  }

  function renderField(f: EmpField) {
    if (f.key === "position") return positionField();
    const label = t(`empFields.${f.key}`, { defaultValue: f.key }) + (f.core ? " *" : "");
    const type = f.type ?? "text";
    const wide = type === "textarea" || type === "address";

    let control;
    if (type === "address") {
      control = <ThaiAddressInput value={val(f.key)} onChange={(v) => set(f.key, v)} placeholder={t("empForm.addressFullPh")} />;
    } else if (type === "textarea") {
      control = <textarea value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} />;
    } else if (type === "date") {
      control = <input type="date" value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} />;
    } else if (type === "select") {
      control = (
        <select value={val(f.key)} onChange={(e) => set(f.key, e.target.value)}>
          <option value="">{t("empForm.pickOne")}</option>
          {getFieldOptions(f.key).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    } else {
      control = <input type="text" value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} />;
    }

    return (
      <div className={`field-sm${wide ? " wide" : ""}`} key={f.key}>
        <label>{label}</label>
        {control}
      </div>
    );
  }

  // จัดกลุ่มฟิลด์ที่เปิดใช้ตาม catalog
  const groups = GROUPS
    .map((g) => ({ g, fields: EMP_FIELDS.filter((f) => f.group === g && enabledSet.has(f.key)) }))
    .filter((x) => x.fields.length > 0);

  return (
    <div className="p-empform">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="doctitle" style={{ paddingLeft: 14 }}>{t("empForm.crumb", { name: isNew ? t("empForm.addNew") : (code || t("empForm.edit")) })}</div>
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
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav(isNew ? "/hr" : `/hr/employee/${id}`)}><ArrowLeft /><span>{t("empForm.back")}</span></div>
            <div className="tbsep" />
            {isHrAdmin() && <div className="tbtn primary" onClick={save}><Save /><span>{busy ? t("empForm.saving") : t("empForm.save")}</span></div>}
          </div>

          <div className="ef-body">
            <div className="ef-head">{isNew ? t("empForm.headNew") : t("empForm.headEdit", { code })}</div>
            <div className="ef-sub">{t("empForm.sub", { code: session.companyCode, name: session.companyName })}{!isNew && code ? " · " + t("empForm.idLabel", { code }) : ""}</div>
            {error && <div className="ef-banner err">{error}</div>}

            {groups.map(({ g, fields }) => {
              const Icon = GROUP_ICON[g];
              return (
                <div className="ef-card" key={g}>
                  <div className="sh"><Icon size={15} />{t(`empFields.group.${g}`, { defaultValue: g })}</div>
                  <div className="ef-grid">
                    {fields.map(renderField)}
                  </div>
                </div>
              );
            })}

            {/* การเข้าสู่ระบบ */}
            <div className="ef-card">
              <div className="sh"><Lock size={15} />{t("empForm.sec.login")}</div>
              <div className="ef-grid">
                <div className="field-sm">
                  <label>{t("empForm.password")}</label>
                  <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t(isNew ? "empForm.passwordPh" : "empForm.passwordEditPh")} />
                </div>
                <div className="field-sm wide">
                  <label>{t("empForm.gmailLabel")}</label>
                  <label className="gl-toggle">
                    <input type="checkbox" checked={googleEnabled} onChange={(e) => setGoogleEnabled(e.target.checked)} />
                    {t("empForm.gmailToggle")}
                  </label>
                </div>
              </div>
              <div className="ef-note">
                {t("empForm.notePassword")}{t("empForm.noteGmail")}
              </div>
            </div>

            {/* รูปภาพ & ลายเซ็น */}
            <div className="ef-card">
              <div className="sh"><Paperclip size={15} />{t("empForm.sec.media", { defaultValue: "รูปภาพ & ลายเซ็น" })}</div>
              {isNew ? (
                <div className="ef-note">{t("empForm.mediaSaveFirst", { defaultValue: "บันทึกพนักงานก่อน จึงแนบรูป/ลายเซ็นได้" })}</div>
              ) : (
                <div className="ef-grid">
                  <div className="field-sm"><label>{t("empForm.photo", { defaultValue: "รูปภาพ" })}</label>
                    <AttachmentBox ownerType="EMPLOYEE_PHOTO" ownerId={id || ""} accept="image/*" image single />
                  </div>
                  <div className="field-sm"><label>{t("empForm.signature", { defaultValue: "ลายเซ็น" })}</label>
                    <AttachmentBox ownerType="EMPLOYEE_SIGN" ownerId={id || ""} accept="image/*" image single />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
