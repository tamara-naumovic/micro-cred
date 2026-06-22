import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const storageKey = (userId: string) => `tour:issuer:${userId}`;

type SubRole = "admin" | "staff";

function buildSteps(subRole: SubRole): DriveStep[] {
  const isAdmin = subRole === "admin";
  const steps: DriveStep[] = [
    {
      popover: {
        title: "Welcome to MicroCred for institutions!",
        description:
          "A quick tour of the key parts of the platform. You can skip it and re-launch it later from the <b>Manual</b> page.",
      },
    },
    {
      element: '[data-tour="nav-issuer-overview"]',
      popover: {
        title: "Overview",
        description:
          "Institution dashboard with KPIs, pending actions, blockchain status and recent activity.",
        side: "right",
      },
    },
    {
      element: '[data-tour="dash-issuer-metrics"]',
      popover: {
        title: "Key metrics",
        description:
          "Published micro-credentials, total issued, active learners and staff, pending actions and blockchain confirmation rate.",
        side: "bottom",
      },
    },
    {
      element: '[data-tour="nav-issuer-templates"]',
      popover: {
        title: isAdmin ? "Micro-credentials" : "My Micro-credentials",
        description: isAdmin
          ? "Catalog of all micro-credential templates for your institution — create, edit and publish."
          : "Micro-credential templates you are assigned to as staff.",
        side: "right",
      },
    },
  ];

  if (isAdmin) {
    steps.push(
      {
        element: '[data-tour="nav-issuer-template-new"]',
        popover: {
          title: "Create Micro-credential",
          description:
            "Define a new template — learning outcomes, level, evidence requirements, supervisors and quality-assurance documents.",
          side: "right",
        },
      },
      {
        element: '[data-tour="nav-issuer-staff"]',
        popover: {
          title: "Staff",
          description:
            "Manage staff members and assign them to specific micro-credentials they can issue.",
          side: "right",
        },
      },
      {
        element: '[data-tour="nav-issuer-earners"]',
        popover: {
          title: "Earners",
          description:
            "Directory of learners who have applied for or received credentials from your institution.",
          side: "right",
        },
      },
    );
  }

  steps.push(
    {
      element: '[data-tour="nav-issuer-requests"]',
      popover: {
        title: "Issuance Requests",
        description:
          "Incoming applications from earners. Review evidence, request changes, verify and issue.",
        side: "right",
      },
    },
    {
      element: '[data-tour="nav-issuer-issue"]',
      popover: {
        title: "Direct Issuance",
        description:
          "Issue a credential to a single earner without an application — useful for invited recipients.",
        side: "right",
      },
    },
    {
      element: '[data-tour="nav-issuer-bulk"]',
      popover: {
        title: "Bulk Issuance",
        description:
          "Upload a CSV to issue the same micro-credential to many earners at once.",
        side: "right",
      },
    },
    {
      element: '[data-tour="nav-issuer-credentials"]',
      popover: {
        title: "Issued Credentials",
        description:
          "All credentials your institution has issued, with search, filters and blockchain status.",
        side: "right",
      },
    },
  );

  if (isAdmin) {
    steps.push({
      element: '[data-tour="nav-issuer-revocations"]',
      popover: {
        title: "Revocations",
        description:
          "Revoke previously issued credentials with a reason — the revocation is anchored on chain.",
        side: "right",
      },
    });
  }

  steps.push({
    element: '[data-tour="nav-issuer-anchoring"]',
    popover: {
      title: "Blockchain Queue",
      description:
        "Anchoring status for issued credentials: pending, submitted, confirmed or failed. Retry failed anchors here.",
      side: "right",
    },
  });

  if (isAdmin) {
    steps.push({
      element: '[data-tour="nav-issuer-profile"]',
      popover: {
        title: "Public Profile",
        description:
          "Public page of your institution that learners and employers can visit to verify credentials.",
        side: "right",
      },
    });
  }

  steps.push(
    {
      element: '[data-tour="nav-issuer-notifications"]',
      popover: {
        title: "Notifications",
        description:
          "Updates on new applications, evidence submissions, anchoring failures and other events.",
        side: "right",
      },
    },
    {
      element: '[data-tour="nav-issuer-manual"]',
      popover: {
        title: "Manual",
        description:
          "Detailed guidance for every part of the platform — always available here.",
        side: "right",
      },
    },
    {
      popover: {
        title: "You're all set!",
        description:
          "You can re-launch this tour anytime from the Manual page.",
      },
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
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
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
