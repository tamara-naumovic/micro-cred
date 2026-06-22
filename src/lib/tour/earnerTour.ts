import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const storageKey = (userId: string) => `tour:earner:${userId}`;

const steps: DriveStep[] = [
  {
    popover: {
      title: "Dobrodošli na MicroCred!",
      description:
        "Brzi obilazak će vam pokazati ključne delove platforme. Možete ga preskočiti i kasnije pokrenuti iz stranice <b>Manual</b>.",
    },
  },
  {
    element: '[data-tour="nav-dashboard"]',
    popover: {
      title: "Dashboard",
      description: "Pregled vaših kredencijala, aplikacija i obaveštenja.",
      side: "right",
    },
  },
  {
    element: '[data-tour="dash-metrics"]',
    popover: {
      title: "Vaši ključni pokazatelji",
      description: "Aktivni kredencijali, aplikacije u toku i oni koji uskoro ističu.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="nav-my-credentials"]',
    popover: {
      title: "My Credentials",
      description: "Svi vaši izdati kredencijali — detalji, blockchain dokaz i opcije deljenja.",
      side: "right",
    },
  },
  {
    element: '[data-tour="nav-applications"]',
    popover: {
      title: "Applications",
      description: "Pratite status aplikacija (In review, Evidence collected, Verified, Issued, Rejected).",
      side: "right",
    },
  },
  {
    element: '[data-tour="nav-apply"]',
    popover: {
      title: "Apply for Credential",
      description: "Pretražite dostupne micro-credential template-e i pošaljite aplikaciju.",
      side: "right",
    },
  },
  {
    element: '[data-tour="nav-profile"]',
    popover: {
      title: "Public Profile",
      description: "Vaš javni profil koji možete podeliti sa poslodavcima i institucijama.",
      side: "right",
    },
  },
  {
    element: '[data-tour="nav-notifications"]',
    popover: {
      title: "Notifications",
      description: "Obaveštenja o promenama statusa, isteku i novim kredencijalima.",
      side: "right",
    },
  },
  {
    element: '[data-tour="nav-manual"]',
    popover: {
      title: "Manual",
      description: "Detaljna uputstva za sve delove platforme — uvek dostupna ovde.",
      side: "right",
    },
  },
  {
    popover: {
      title: "Spremni ste!",
      description: "Srećno sa prikupljanjem kredencijala. Tour možete ponovo pokrenuti iz Manual stranice.",
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
