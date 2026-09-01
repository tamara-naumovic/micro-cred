import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { useSignOut } from "@/lib/use-sign-out";

const IDLE_MS = 45 * 60 * 1000;
const CHECK_MS = 15 * 1000;
const STORAGE_KEY = "credseal:lastActivity";

export function useIdleLogout() {
  const { activeUser } = useStore();
  const signOut = useSignOut();
  const signedOutRef = useRef(false);

  useEffect(() => {
    if (!activeUser || typeof window === "undefined") return;

    signedOutRef.current = false;

    const updateActivity = () => {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    };

    // Mark activity immediately on mount / auth change
    updateActivity();

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    let throttleTimer: number | null = null;

    const throttledUpdate = () => {
      if (throttleTimer) return;
      throttleTimer = window.setTimeout(() => {
        throttleTimer = null;
        updateActivity();
      }, 1000);
    };

    events.forEach((event) => {
      window.addEventListener(event, throttledUpdate, { passive: true });
    });

    const checkIdle = () => {
      const last = parseInt(localStorage.getItem(STORAGE_KEY) ?? "0", 10);
      if (last && Date.now() - last > IDLE_MS && !signedOutRef.current) {
        signedOutRef.current = true;
        signOut({ reason: "idle" });
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkIdle();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    const interval = window.setInterval(checkIdle, CHECK_MS);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, throttledUpdate);
      });
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
      if (throttleTimer) window.clearTimeout(throttleTimer);
    };
  }, [activeUser, signOut]);
}
