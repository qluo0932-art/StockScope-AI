import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import zhCN from "./locales/zh-CN";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "zh-CN": { translation: zhCN },
      en: { translation: en },
    },
    fallbackLng: "en",
    supportedLngs: ["zh-CN", "en"],
    nonExplicitSupportedLngs: false,
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "stockscope-language",
      caches: ["localStorage"],
      convertDetectedLanguage: (language) =>
        language.toLowerCase().startsWith("zh") ? "zh-CN" : "en",
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
