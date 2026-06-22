import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import i18n from "@/i18n";

const storageKey = (userId: string) => `tour:earner:${userId}`;

function buildSteps(): DriveStep[] {
  const t = (key: string) => i18n.t(key, { ns: "tour" });
  return [
    { popover: { title: t("earner.welcome.title"), description: t("earner.welcome.description") } },
    {
      element: '[data-tour="nav-dashboard"]',
      popover: { title: t("earner.dashboard.title"), description: t("earner.dashboard.description"), side: "right" },
    },
    {
      element: '[data-tour="dash-metrics"]',
      popover: { title: t("earner.metrics.title"), description: t("earner.metrics.description"), side: "bottom" },
    },
    {
      element: '[data-tour="nav-my-credentials"]',
      popover: { title: t("earner.myCredentials.title"), description: t("earner.myCredentials.description"), side: "right" },
    },
    {
      element: '[data-tour="nav-applications"]',
      popover: { title: t("earner.applications.title"), description: t("earner.applications.description"), side: "right" },
    },
    {
      element: '[data-tour="nav-apply"]',
      popover: { title: t("earner.apply.title"), description: t("earner.apply.description"), side: "right" },
    },
    {
      element: '[data-tour="nav-profile"]',
      popover: { title: t("earner.profile.title"), description: t("earner.profile.description"), side: "right" },
    },
    {
      element: '[data-tour="nav-notifications"]',
      popover: { title: t("earner.notifications.title"), description: t("earner.notifications.description"), side: "right" },
    },
    {
      element: '[data-tour="nav-manual"]',
      popover: { title: t("earner.manual.title"), description: t("earner.manual.description"), side: "right" },
    },
    { popover: { title: t("earner.done.title"), description: t("earner.done.description") } },
  ];
}

export function startEarnerTour(userId: string, opts?: { force?: boolean }) {
  if (typeof window === "undefined") return;
  const key = storageKey(userId);
  if (!opts?.force && window.localStorage.getItem(key) === "1") return;

  const t = (k: string) => i18n.t(k, { ns: "tour" });
  const d = driver({
    showProgress: true,
    allowClose: true,
    nextBtnText: t("buttons.next"),
    prevBtnText: t("buttons.back"),
    doneBtnText: t("buttons.done"),
    steps: buildSteps(),
    onDestroyed: () => {
      try {
        window.localStorage.setItem(key, "1");
      } catch {
        // ignore
      }
    },
  });
  d.drive();
}

export function resetEarnerTour(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(userId));
}
