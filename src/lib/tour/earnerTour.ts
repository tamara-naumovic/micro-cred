import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const storageKey = (userId: string) => `tour:earner:${userId}`;

const steps: DriveStep[] = [
  {
    popover: {
      title: "Welcome to MicroCred!",
      description:
        "A quick tour of the key parts of the platform. You can skip it and re-launch it later from the <b>Manual</b> page.",
    },
  },
  {
    element: '[data-tour="nav-dashboard"]',
    popover: {
      title: "Dashboard",
      description: "Overview of your credentials, applications and notifications.",
      side: "right",
    },
  },
  {
    element: '[data-tour="dash-metrics"]',
    popover: {
      title: "Your key metrics",
      description: "Active credentials, pending applications and credentials expiring soon.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="nav-my-credentials"]',
    popover: {
      title: "My Credentials",
      description: "All of your issued credentials — details, blockchain proof and sharing options.",
      side: "right",
    },
  },
  {
    element: '[data-tour="nav-applications"]',
    popover: {
      title: "Applications",
      description: "Track application status (In review, Evidence collected, Verified, Issued, Rejected).",
      side: "right",
    },
  },
  {
    element: '[data-tour="nav-apply"]',
    popover: {
      title: "Apply for Credential",
      description: "Browse available micro-credential templates and submit an application.",
      side: "right",
    },
  },
  {
    element: '[data-tour="nav-profile"]',
    popover: {
      title: "Public Profile",
      description: "Your public profile that you can share with employers and institutions.",
      side: "right",
    },
  },
  {
    element: '[data-tour="nav-notifications"]',
    popover: {
      title: "Notifications",
      description: "Updates on status changes, expirations and newly issued credentials.",
      side: "right",
    },
  },
  {
    element: '[data-tour="nav-manual"]',
    popover: {
      title: "Manual",
      description: "Detailed guidance for every part of the platform — always available here.",
      side: "right",
    },
  },
  {
    popover: {
      title: "You're all set!",
      description: "Good luck collecting your credentials. You can re-launch this tour anytime from the Manual page.",
    },
  },
];

export function startEarnerTour(userId: string, opts?: { force?: boolean }) {
  if (typeof window === "undefined") return;
  const key = storageKey(userId);
  if (!opts?.force && window.localStorage.getItem(key) === "1") return;

  const d = driver({
    showProgress: true,
    allowClose: true,
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    steps,
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
