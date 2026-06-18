import { useTranslation } from "react-i18next";
import { LANGS } from "../i18n";

/** ปุ่มสลับภาษา (TH / EN) — วางได้ทุก topbar; จำค่าที่เลือกไว้ใน localStorage */
export default function LangSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage;
  return (
    <div className="lang-switch">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          className={current === l.code ? "on" : ""}
          onClick={() => i18n.changeLanguage(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
