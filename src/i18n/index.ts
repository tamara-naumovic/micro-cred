import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import enEarner from "./locales/en/earner.json";
import enTour from "./locales/en/tour.json";
import enManual from "./locales/en/manual.json";
import srCommon from "./locales/sr/common.json";
import srEarner from "./locales/sr/earner.json";
import srTour from "./locales/sr/tour.json";
import srManual from "./locales/sr/manual.json";

export type AppLanguage = "en" | "sr";

const LS_KEY = "mc-language";

function detectInitial(): AppLanguage {
  if (typeof window === "undefined") return "en";
  try {
    const v = window.localStorage.getItem(LS_KEY);
    if (v === "en" || v === "sr") return v;
  } catch {
    // ignore
  }
  return "en";
}

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      lng: detectInitial(),
      fallbackLng: "en",
      supportedLngs: ["en", "sr"],
      defaultNS: "common",
      ns: ["common", "earner", "tour", "manual"],
      resources: {
        en: { common: enCommon, earner: enEarner, tour: enTour, manual: enManual },
        sr: { common: srCommon, earner: srEarner, tour: srTour, manual: srManual },
      },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
}

export function persistLanguage(lang: AppLanguage) {
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(LS_KEY, lang); } catch { /* ignore */ }
  }
}

export async function setAppLanguage(lang: AppLanguage) {
  persistLanguage(lang);
  if (i18n.language !== lang) {
    await i18n.changeLanguage(lang);
  }
}

export { i18n };
export default i18n;
