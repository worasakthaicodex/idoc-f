import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import th from "./locales/th.json";

/** ภาษาที่รองรับ — เพิ่มภาษาใหม่: เพิ่มไฟล์ locales/<code>.json แล้วลงทะเบียนที่นี่ */
export const LANGS = [
  { code: "th", label: "ไทย" },
  { code: "en", label: "EN" },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      th: { translation: th },
    },
    fallbackLng: "en", // English = ภาษาฐาน (ใช้เมื่อ key ขาดในภาษาอื่น)
    supportedLngs: ["th", "en"],
    detection: {
      // จำภาษาที่ผู้ใช้เลือกไว้ → ถ้าไม่มีดูจากเบราว์เซอร์
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "idoc.lang",
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
