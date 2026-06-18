import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../shared/api";
import { getSession } from "../../shared/session";
import { Grid, ChevronDown, ArrowLeft, HomeIcon, Edit, User, Hexagon, Phone, Building, Dollar, Shield, FileText } from "../../shared/icons";
import CrmHelpButton from "./CrmHelpButton";
import LangSwitcher from "../../shared/LangSwitcher";
import CustomerSide from "./CustomerSide";
import ToolsPanel from "../activity/ToolsPanel";
import SalesHistoryPanel from "../activity/SalesHistoryPanel";
import CustomerHistoryPanel from "./CustomerHistoryPanel";
import AddToBasketButton from "./AddToBasketButton";
import CustomerFoSnapshot from "./CustomerFoSnapshot";
import { isCrmAdmin } from "./crmAccess";
import { getEnabledFields } from "./customerFieldConfig";
import { getStatusOverride } from "./customerStatusConfig";
import { statusTone } from "./customerStatus";
import { CUST_FIELDS, GROUPS, COLUMN_KEYS, type FieldGroup } from "./customerFields";
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

export default function CustomerDetail() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { id } = useParams();
  const session = getSession();
  const tenant = session?.companyId ?? "";

  const [cust, setCust] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"profile" | "contact" | "history" | "saleshistory" | "tools">("profile");

  const loadCustomer = () => {
    if (!tenant || !id) return;
    apiFetch<Record<string, unknown>>(`/customers/${id}`, { tenant })
      .then(setCust)
      .catch((err) => setError(t("custForm.errLoad") + ": " + err.message));
  };

  useEffect(() => {
    loadCustomer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tenant]);

  if (!session) {
    return <div className="p-crm"><div className="crm-body"><div className="banner err">{t("custForm.notLoggedIn")}</div><button className="btn primary" onClick={() => nav("/login")}>{t("custForm.goLogin")}</button></div></div>;
  }

  const code = String(cust?.code ?? "");
  const name = String(cust?.name ?? "");
  const status = String(cust?.status ?? "");
  const groupName = String(cust?.groupName ?? "");
  const attrs = (cust?.attributes as Record<string, string>) ?? {};
  const enabledSet = new Set(getEnabledFields());
  const initial = (name || code || "?").charAt(0).toUpperCase();

  const value = (key: string): string => {
    const raw = isColumn(key) ? cust?.[key] : attrs[key];
    return raw == null || raw === "" ? "" : String(raw);
  };

  // ฟิลด์ที่เปิดใช้ (เว้น name — โชว์ในหัวโปรไฟล์แล้ว)
  const groups = GROUPS
    .map((g) => ({ g, fields: CUST_FIELDS.filter((f) => f.group === g && enabledSet.has(f.key) && f.key !== "name") }))
    .filter((x) => x.fields.length > 0);

  const goEdit = () => nav(`/customer/${id}/edit`);

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
          <div className="subbar">
            <div className="fields" onClick={() => nav("/customer")} title={t("custForm.backList")}><ArrowLeft size={16} />{t("custForm.backList")}</div>
            <div className="vsep" />
            <div className="company-pick"><User size={15} /><b style={{ color: "var(--txt)" }}>{name || code}</b> · {code}</div>
            <div className="u-spacer" />
            <div className="fields" onClick={() => nav("/app")} title={t("common.backHome")}><HomeIcon size={16} />{t("customer.home")}</div>
          </div>

          <div className="crm-body">
            {error && <div className="banner err"><Building size={15} />{error}</div>}

            {cust && (
              <div className="crm-hero">
                <div className="crm-avatar">{initial}</div>
                <div className="crm-id">
                  <div className="crm-name">{name || t("custForm.noValue")}</div>
                  <div className="crm-metarow">
                    <span className="mi"><FileText size={14} />{code}</span>
                    {groupName && <span className="mi"><Hexagon size={14} />{groupName}</span>}
                    {value("phone") && <span className="mi"><Phone size={14} />{value("phone")}</span>}
                  </div>
                  <div className="crm-chips">
                    <span className={`chip ${statusTone(status || "ACTIVE")}`}>{getStatusOverride(status || "ACTIVE") || t(`custStatus.${status || "ACTIVE"}`, { defaultValue: status })}</span>
                    {value("grade") && <span className="chip gray">{t("custFields.grade")} {value("grade")}</span>}
                  </div>
                </div>
                <div className="crm-hero-act">
                  <AddToBasketButton code={code} name={name || code} />
                  {isCrmAdmin() && <button className="btn primary" onClick={goEdit}><Edit size={16} />{t("custForm.editBtn")}</button>}
                </div>
              </div>
            )}

            {cust && (
              <div className="tabs" style={{ marginBottom: 16, borderRadius: 8 }}>
                <div className={`tab${tab === "profile" ? " active" : ""}`} onClick={() => setTab("profile")}>{t("custForm.tabProfile")}</div>
                <div className={`tab${tab === "contact" ? " active" : ""}`} onClick={() => setTab("contact")}>{t("custFields.group.contact", { defaultValue: "ข้อมูลติดต่อ" })}</div>
                <div className={`tab${tab === "history" ? " active" : ""}`} onClick={() => setTab("history")}>{t("custForm.tabHistory")}</div>
                <div className={`tab${tab === "saleshistory" ? " active" : ""}`} onClick={() => setTab("saleshistory")}>{t("tools.saleshistory.title")}</div>
                <div className={`tab${tab === "tools" ? " active" : ""}`} onClick={() => setTab("tools")}>{t("custForm.tabTools")}</div>
              </div>
            )}

            {cust && tab === "profile" && <CustomerFoSnapshot customerCode={code} />}

            {cust && (tab === "profile" || tab === "contact") && groups
              .filter(({ g }) => (tab === "contact" ? g === "contact" : g !== "contact"))
              .map(({ g, fields }) => {
              const Icon = GROUP_ICON[g];
              return (
                <div className="card" key={g}>
                  <div className="sh"><Icon size={15} />{t(`custFields.group.${g}`, { defaultValue: g })}</div>
                  <div className="crm-dl">
                    {fields.map((f) => {
                      const v = value(f.key);
                      return (
                        <div className="crm-row" key={f.key}>
                          <div className="dt">{t(`custFields.${f.key}`, { defaultValue: f.key })}</div>
                          <div className={`dd${v ? "" : " muted"}`}>{v || t("custForm.noValue")}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {cust && tab === "contact" && !groups.some(({ g }) => g === "contact") && (
              <div className="card"><div className="crm-dl"><div className="crm-row"><div className="dd muted">{t("custForm.noValue")}</div></div></div></div>
            )}

            {cust && tab === "tools" && (
              <ToolsPanel context="customer" customerCode={code} />
            )}

            {cust && tab === "saleshistory" && (
              <SalesHistoryPanel customerCode={code} />
            )}

            {cust && tab === "history" && (
              <CustomerHistoryPanel customerId={id!} onReverted={loadCustomer} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
