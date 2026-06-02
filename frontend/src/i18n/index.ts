import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import es from "./locales/es.json";
import gu from "./locales/gu.json";
import hi from "./locales/hi.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
  { code: "gu", name: "ગુજરાતી", flag: "🇮🇳" },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      gu: { translation: gu },
      hi: { translation: hi },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "es", "gu", "hi"],
    interpolation: {
      escapeValue: false, // react already protects against XSS
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "fixora_lang",
    },
  });

export default i18n;
