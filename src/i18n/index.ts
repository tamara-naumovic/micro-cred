import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import enEarner from "./locales/en/earner.json";
import enTour from "./locales/en/tour.json";
import enManual from "./locales/en/manual.json";
import enIssuerCommon from "./locales/en/issuer/common.json";
import enIssuerOverview from "./locales/en/issuer/overview.json";
import enIssuerTemplates from "./locales/en/issuer/templates.json";
import enIssuerIssue from "./locales/en/issuer/issue.json";
import enIssuerRequests from "./locales/en/issuer/requests.json";
import enIssuerCredentials from "./locales/en/issuer/credentials.json";
import enIssuerRevocations from "./locales/en/issuer/revocations.json";
import enIssuerEarners from "./locales/en/issuer/earners.json";
import enIssuerStaff from "./locales/en/issuer/staff.json";
import enIssuerAnchoringQueue from "./locales/en/issuer/anchoringQueue.json";
import enIssuerSettings from "./locales/en/issuer/settings.json";
import enIssuerProfile from "./locales/en/issuer/profile.json";
import enIssuerNotifications from "./locales/en/issuer/notifications.json";
import enIssuerManual from "./locales/en/issuer/manual.json";

import srCommon from "./locales/sr/common.json";
import srEarner from "./locales/sr/earner.json";
import srTour from "./locales/sr/tour.json";
import srManual from "./locales/sr/manual.json";
import srIssuerCommon from "./locales/sr/issuer/common.json";
import srIssuerOverview from "./locales/sr/issuer/overview.json";
import srIssuerTemplates from "./locales/sr/issuer/templates.json";
import srIssuerIssue from "./locales/sr/issuer/issue.json";
import srIssuerRequests from "./locales/sr/issuer/requests.json";
import srIssuerCredentials from "./locales/sr/issuer/credentials.json";
import srIssuerRevocations from "./locales/sr/issuer/revocations.json";
import srIssuerEarners from "./locales/sr/issuer/earners.json";
import srIssuerStaff from "./locales/sr/issuer/staff.json";
import srIssuerAnchoringQueue from "./locales/sr/issuer/anchoringQueue.json";
import srIssuerSettings from "./locales/sr/issuer/settings.json";
import srIssuerProfile from "./locales/sr/issuer/profile.json";
import srIssuerNotifications from "./locales/sr/issuer/notifications.json";
import srIssuerManual from "./locales/sr/issuer/manual.json";

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

const enIssuer = {
  ...enIssuerCommon,
  ...enIssuerOverview,
  ...enIssuerTemplates,
  ...enIssuerIssue,
  ...enIssuerRequests,
  ...enIssuerCredentials,
  ...enIssuerRevocations,
  ...enIssuerEarners,
  ...enIssuerStaff,
  ...enIssuerAnchoringQueue,
  ...enIssuerSettings,
  ...enIssuerProfile,
  ...enIssuerNotifications,
  ...enIssuerManual,
};

const srIssuer = {
  ...srIssuerCommon,
  ...srIssuerOverview,
  ...srIssuerTemplates,
  ...srIssuerIssue,
  ...srIssuerRequests,
  ...srIssuerCredentials,
  ...srIssuerRevocations,
  ...srIssuerEarners,
  ...srIssuerStaff,
  ...srIssuerAnchoringQueue,
  ...srIssuerSettings,
  ...srIssuerProfile,
  ...srIssuerNotifications,
  ...srIssuerManual,
};

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      lng: detectInitial(),
      fallbackLng: "en",
      supportedLngs: ["en", "sr"],
      defaultNS: "common",
      ns: ["common", "earner", "tour", "manual", "issuer"],
      resources: {
        en: { common: enCommon, earner: enEarner, tour: enTour, manual: enManual, issuer: enIssuer },
        sr: { common: srCommon, earner: srEarner, tour: srTour, manual: srManual, issuer: srIssuer },
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
