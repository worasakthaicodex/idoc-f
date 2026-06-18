import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Hexagon, GoogleIcon, Mail, Lock, Check2, ArrowLeft } from "../../shared/icons";
import { apiFetch, ApiError } from "../../shared/api";
import { setSession } from "../../shared/session";
import LangSwitcher from "../../shared/LangSwitcher";
import "./site.css";

// รองรับสิทธิ์ 3 ระดับ — เจ้าของระบบไม่มีบริษัท (company* / employeeCode = null)
type AuthResponse = {
  role: string;                 // PLATFORM_OWNER | COMPANY_OWNER | STAFF
  accountId: string;
  fullName: string;
  email: string | null;
  companyId: string | null;
  companyCode: string | null;
  companyName: string | null;
  employeeCode: string | null;
  modules?: Record<string, string> | null;
};

export default function Login() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // แปล error จาก backend: ใช้ code (แปลตามภาษา) ถ้าไม่มีค่อย fallback เป็น message
  const errText = (err: unknown, fallbackKey: string) => {
    const e = err as ApiError;
    if (e?.code) return t(`errors.${e.code}`, { defaultValue: e.message });
    return e?.message || t(fallbackKey);
  };

  async function login(e?: React.FormEvent) {
    e?.preventDefault();
    setError(""); setBusy(true);
    try {
      const r = await apiFetch<AuthResponse>("/auth/login", { method: "POST", body: { email, password } });
      applyAuth(r);
    } catch (err) {
      setError(errText(err, "errors.auth.login_failed"));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(""); setBusy(true);
    try {
      const r = await apiFetch<AuthResponse>("/auth/google", { method: "POST", body: { email } });
      applyAuth(r);
    } catch (err) {
      setError(errText(err, "errors.auth.google_failed"));
    } finally {
      setBusy(false);
    }
  }

  function applyAuth(r: AuthResponse) {
    setSession({
      companyId: r.companyId ?? "",
      companyCode: r.companyCode ?? "",
      companyName: r.companyName ?? "",
      fullName: r.fullName,
      email: r.email ?? email.trim().toLowerCase(),
      role: r.role,
      employeeCode: r.employeeCode ?? undefined,
      modules: r.modules ?? undefined,
    });
    nav("/app");
  }

  return (
    <div className="p-login">
      <div className="login-brand">
        <div className="top"><Hexagon size={24} />{t("common.appName")}</div>
        <div className="mid">
          <h2>{t("auth.welcomeTitle")}</h2>
          <p>{t("auth.welcomeSub")}</p>
          <div className="feat">
            <div><Check2 size={16} />{t("auth.feature1")}</div>
            <div><Check2 size={16} />{t("auth.feature2")}</div>
            <div><Check2 size={16} />{t("auth.feature3")}</div>
          </div>
        </div>
        <div className="bot">{t("auth.brandFooter")}</div>
      </div>

      <div className="login-main">
        <div className="login-card">
          <div className="lc-top">
            <div className="lc-back" onClick={() => nav("/")}><ArrowLeft size={15} />{t("auth.backHome")}</div>
            <LangSwitcher />
          </div>
          <div className="lc-title">{t("auth.title")}</div>
          <div className="lc-sub">{t("auth.subtitle")}</div>

          {error && <div className="lc-error">{error}</div>}

          <button className="gbtn" onClick={google} disabled={busy}>
            <GoogleIcon size={18} />{t("auth.googleLogin")}
          </button>

          <div className="lc-or">{t("auth.or")}</div>

          <form onSubmit={login}>
            <div className="lc-field">
              <label>{t("auth.email")}</label>
              <div className="inp"><Mail size={16} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></div>
            </div>
            <div className="lc-field">
              <label>{t("auth.password")}</label>
              <div className="inp"><Lock size={16} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></div>
            </div>
            <div className="lc-row">
              <label><input type="checkbox" defaultChecked />{t("auth.remember")}</label>
              <a>{t("auth.forgot")}</a>
            </div>
            <button type="submit" className="lc-submit" disabled={busy}>{busy ? t("auth.submitting") : t("auth.submit")}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
