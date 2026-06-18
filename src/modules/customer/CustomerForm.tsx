import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, ArrowLeft, Save, CheckCircle, User, Hexagon, Phone, Building, Dollar, Shield, FileText } from "../../shared/icons";
import CrmHelpButton from "./CrmHelpButton";
import LangSwitcher from "../../shared/LangSwitcher";
import ThaiAddressInput from "../hr/ThaiAddressInput";
import CustomerSide from "./CustomerSide";
import { getEnabledFields } from "./customerFieldConfig";
import { getFieldOptions } from "./customerFieldOptions";
import { getEnabledStatuses, getStatusOverride } from "./customerStatusConfig";
import { isCrmAdmin } from "./crmAccess";
import { CUST_FIELDS, GROUPS, COLUMN_KEYS, type CustField, type FieldGroup } from "./customerFields";
import "./customer.css";

const GROUP_ICON: Record<FieldGroup, typeof User> = {
  general: User,
  classify: Hexagon,
  contact: Phone,
  address: Building,
  finance: Dollar,
  approver: Shield,
  note: FileText,
};

const isColumn = (k: string) => COLUMN_KEYS.includes(k);

export default function CustomerForm() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { id } = useParams();
  const isNew = !id;
  const session = getSession();
  const tenant = session?.companyId ?? "";

  const [values, setValues] = useState<Record<string, string>>({});
  const [orig, setOrig] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState("ACTIVE");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const enabled = getEnabledFields();
  const enabledSet = new Set(enabled);

  useEffect(() => {
    if (!isNew && tenant) {
      apiFetch<Record<string, unknown>>(`/customers/${id}`, { tenant })
        .then((c) => {
          setOrig(c);
          setCode(String(c.code ?? ""));
          setStatus(String(c.status ?? "ACTIVE"));
          const attrs = (c.attributes as Record<string, string>) ?? {};
          const next: Record<string, string> = {};
          CUST_FIELDS.forEach((f) => {
            next[f.key] = isColumn(f.key) ? String(c[f.key] ?? "") : String(attrs[f.key] ?? "");
          });
          setValues(next);
        })
        .catch((err) => setError(t("custForm.errLoad") + ": " + err.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));
  const val = (k: string) => values[k] ?? "";

  async function save() {
    if (!val("name").trim()) { setError(t("custForm.errRequireName")); return; }
    setError(""); setBusy(true);
    try {
      const body: Record<string, unknown> = {};
      COLUMN_KEYS.forEach((k) => {
        if (enabledSet.has(k)) {
          const v = val(k).trim();
          body[k] = v ? val(k) : null;
        } else {
          body[k] = orig[k] ?? null;
        }
      });
      const attributes: Record<string, string> = { ...((orig.attributes as Record<string, string>) ?? {}) };
      CUST_FIELDS.forEach((f) => {
        if (isColumn(f.key) || !enabledSet.has(f.key)) return;
        const v = val(f.key).trim();
        if (v) attributes[f.key] = v; else delete attributes[f.key];
      });
      body.attributes = attributes;
      body.status = status;
      body.changedBy = session?.fullName || session?.email || session?.companyCode || "";   // ผู้เพิ่ม/ผู้แก้ (ลงประวัติ + รายงาน)

      if (isNew) {
        await apiFetch("/customers", { method: "POST", tenant, body });
        nav("/customer");
      } else {
        await apiFetch(`/customers/${id}`, { method: "PUT", tenant, body });
        nav(`/customer/${id}`);
      }
    } catch (e) {
      setError(t("custForm.errSave") + ": " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err">{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("custForm.goLogin")}</button></div></div>;
  }

  function renderField(f: CustField) {
    const label = t(`custFields.${f.key}`, { defaultValue: f.key }) + (f.core ? " *" : "");
    const type = f.type ?? "text";
    const wide = type === "textarea" || type === "address" || f.key === "name";
    let control;
    if (type === "address") {
      control = <ThaiAddressInput value={val(f.key)} onChange={(v) => set(f.key, v)} placeholder={t("custForm.addressFullPh")} />;
    } else if (type === "textarea") {
      control = <textarea value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} />;
    } else if (type === "date") {
      control = <input type="date" value={val(f.key)} onChange={(e) => set(f.key, e.target.value)} />;
    } else if (type === "select") {
      control = (
        <select value={val(f.key)} onChange={(e) => set(f.key, e.target.value)}>
          <option value="">{t("custForm.pickOne")}</option>
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

  const groups = GROUPS
    .map((g) => ({ g, fields: CUST_FIELDS.filter((f) => f.group === g && enabledSet.has(f.key)) }))
    .filter((x) => x.fields.length > 0);

  return (
    <div className="p-crm">
      <div className="topbar">
        <div className="app" style={{ cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>{t("common.appName")}</div>
        <div className="sep" />
        <div className="ic" style={{ width: "auto", padding: "0 14px", gap: 8, display: "flex", cursor: "pointer" }} title={t("common.backHome")} onClick={() => nav("/app")}>
          <Grid size={16} /><span style={{ fontSize: 14 }}>{t("customer.title")}</span><ChevronDown size={14} />
        </div>
        <div className="u-spacer" />
        <div style={{ padding: "0 10px" }}><LangSwitcher /></div>
        <CrmHelpButton />
        <div className="me">{session.companyCode.charAt(0)}</div>
      </div>

      <div className="crm-main">
        <CustomerSide active="core" />

        <div className="crm-content">
          <div className="toolbar">
            <div className="tbtn" onClick={() => nav(isNew ? "/customer" : `/customer/${id}`)}><ArrowLeft /><span>{t("custForm.back")}</span></div>
            <div className="tbsep" />
            {isCrmAdmin() && <div className="tbtn primary" onClick={save}><Save /><span>{busy ? t("custForm.saving") : t("custForm.save")}</span></div>}
          </div>

          <div className="crm-body">
            <div className="form-head">{isNew ? t("custForm.headNew") : t("custForm.headEdit", { code })}</div>
            <div className="form-sub">{t("custForm.sub", { code: session.companyCode, name: session.companyName })}{!isNew && code ? " · " + t("custForm.idLabel", { code }) : ""}</div>
            {error && <div className="banner err">{error}</div>}

            {/* สถานะหลัก (configurable: เปิด/ปิด + เปลี่ยนคำ ที่ตั้งค่า CRM) */}
            <div className="card">
              <div className="sh"><CheckCircle size={15} />{t("custStatus.title")}</div>
              <div className="crm-grid">
                <div className="field-sm">
                  <label>{t("customer.col.status")}</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    {[...new Set([status, ...getEnabledStatuses()])].map((code) => (
                      <option key={code} value={code}>{getStatusOverride(code) || t(`custStatus.${code}`, { defaultValue: code })}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {groups.map(({ g, fields }) => {
              const Icon = GROUP_ICON[g];
              return (
                <div className="card" key={g}>
                  <div className="sh"><Icon size={15} />{t(`custFields.group.${g}`, { defaultValue: g })}</div>
                  <div className="crm-grid">{fields.map(renderField)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
