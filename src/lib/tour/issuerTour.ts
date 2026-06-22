import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { i18n } from "@/i18n";

const storageKey = (userId: string) => `tour:issuer:${userId}`;

type SubRole = "admin" | "staff";

function tt(key: string): string {
  return i18n.t(key, { ns: "tour" }) as string;
}

function buildSteps(subRole: SubRole): DriveStep[] {
  const isAdmin = subRole === "admin";
  const steps: DriveStep[] = [
    {
      popover: {
        title: tt("issuer.welcome.title"),
        description: tt("issuer.welcome.description"),
      },
    },
    {
      element: '[data-tour="nav-issuer-overview"]',
      popover: {
        title: tt("issuer.overview.title"),
        description: tt("issuer.overview.description"),
        side: "right",
      },
    },
    {
      element: '[data-tour="dash-issuer-metrics"]',
      popover: {
        title: tt("issuer.metrics.title"),
        description: tt("issuer.metrics.description"),
        side: "bottom",
      },
    },
    {
      element: '[data-tour="nav-issuer-templates"]',
      popover: {
        title: isAdmin ? tt("issuer.templatesAdmin.title") : tt("issuer.templatesStaff.title"),
        description: isAdmin ? tt("issuer.templatesAdmin.description") : tt("issuer.templatesStaff.description"),
        side: "right",
      },
    },
  ];

  if (isAdmin) {
    steps.push(
      {
        element: '[data-tour="nav-issuer-template-new"]',
        popover: {
          title: tt("issuer.templateNew.title"),
          description: tt("issuer.templateNew.description"),
          side: "right",
        },
      },
      {
        element: '[data-tour="nav-issuer-staff"]',
        popover: {
          title: tt("issuer.staff.title"),
          description: tt("issuer.staff.description"),
          side: "right",
        },
      },
      {
        element: '[data-tour="nav-issuer-earners"]',
        popover: {
          title: tt("issuer.earners.title"),
          description: tt("issuer.earners.description"),
          side: "right",
        },
      },
    );
  }

  steps.push(
    {
      element: '[data-tour="nav-issuer-requests"]',
      popover: { title: tt("issuer.requests.title"), description: tt("issuer.requests.description"), side: "right" },
    },
    {
      element: '[data-tour="nav-issuer-issue"]',
      popover: { title: tt("issuer.issue.title"), description: tt("issuer.issue.description"), side: "right" },
    },
    {
      element: '[data-tour="nav-issuer-bulk"]',
      popover: { title: tt("issuer.bulk.title"), description: tt("issuer.bulk.description"), side: "right" },
    },
    {
      element: '[data-tour="nav-issuer-credentials"]',
      popover: { title: tt("issuer.credentials.title"), description: tt("issuer.credentials.description"), side: "right" },
    },
  );

  if (isAdmin) {
    steps.push({
      element: '[data-tour="nav-issuer-revocations"]',
      popover: { title: tt("issuer.revocations.title"), description: tt("issuer.revocations.description"), side: "right" },
    });
  }

  steps.push({
    element: '[data-tour="nav-issuer-anchoring"]',
    popover: { title: tt("issuer.anchoring.title"), description: tt("issuer.anchoring.description"), side: "right" },
  });

  if (isAdmin) {
    steps.push({
      element: '[data-tour="nav-issuer-profile"]',
      popover: { title: tt("issuer.profile.title"), description: tt("issuer.profile.description"), side: "right" },
    });
  }

  steps.push(
    {
      element: '[data-tour="nav-issuer-notifications"]',
      popover: { title: tt("issuer.notifications.title"), description: tt("issuer.notifications.description"), side: "right" },
    },
    {
      element: '[data-tour="nav-issuer-manual"]',
      popover: { title: tt("issuer.manual.title"), description: tt("issuer.manual.description"), side: "right" },
    },
    {
      popover: { title: tt("issuer.done.title"), description: tt("issuer.done.description") },
    },
  );

  return steps;
}

export function startIssuerTour(
  userId: string,
  subRole: SubRole,
  opts?: { force?: boolean },
) {
  if (typeof window === "undefined") return;
  const key = storageKey(userId);
  if (!opts?.force && window.localStorage.getItem(key) === "1") return;

  const d = driver({
    showProgress: true,
    allowClose: true,
    nextBtnText: tt("buttons.next"),
    prevBtnText: tt("buttons.back"),
    doneBtnText: tt("buttons.done"),
    steps: buildSteps(subRole),
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

export function resetIssuerTour(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(userId));
}

// ============ Issued Credentials page tour ============

const credentialsStorageKey = (userId: string) =>
  `tour:issuer-credentials:${userId}`;

function buildCredentialsSteps(): DriveStep[] {
  return [
    {
      popover: {
        title: tt("issuer.credentialsPage.intro.title"),
        description: tt("issuer.credentialsPage.intro.description"),
      },
    },
    {
      element: '[data-tour="cred-filters"]',
      popover: {
        title: tt("issuer.credentialsPage.filters.title"),
        description: tt("issuer.credentialsPage.filters.description"),
        side: "bottom",
      },
    },
    {
      element: '[data-tour="cred-col-lifecycle"]',
      popover: {
        title: tt("issuer.credentialsPage.lifecycle.title"),
        description: tt("issuer.credentialsPage.lifecycle.description"),
        side: "bottom",
      },
    },
    {
      element: '[data-tour="cred-col-blockchain"]',
      popover: {
        title: tt("issuer.credentialsPage.blockchain.title"),
        description: tt("issuer.credentialsPage.blockchain.description"),
        side: "bottom",
      },
    },
    {
      element: '[data-tour="cred-col-actions"]',
      popover: {
        title: tt("issuer.credentialsPage.actions.title"),
        description: tt("issuer.credentialsPage.actions.description"),
        side: "left",
      },
    },
    {
      popover: {
        title: tt("issuer.credentialsPage.done.title"),
        description: tt("issuer.credentialsPage.done.description"),
      },
    },
  ];
}

export function startIssuerCredentialsTour(
  userId: string,
  opts?: { force?: boolean },
) {
  if (typeof window === "undefined") return;
  const key = credentialsStorageKey(userId);
  if (!opts?.force && window.localStorage.getItem(key) === "1") return;

  const d = driver({
    showProgress: true,
    allowClose: true,
    nextBtnText: tt("buttons.next"),
    prevBtnText: tt("buttons.back"),
    doneBtnText: tt("buttons.done"),
    steps: buildCredentialsSteps(),
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

export function resetIssuerCredentialsTour(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(credentialsStorageKey(userId));
}
