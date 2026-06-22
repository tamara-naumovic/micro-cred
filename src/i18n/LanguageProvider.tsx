import { useEffect, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import i18n, { setAppLanguage, type AppLanguage } from "./index";

/**
 * Wraps the app with i18next and keeps the active language in sync with the
 * signed-in user's `profiles.language` value.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const { activeUser } = useStore();

  useEffect(() => {
    if (!activeUser?.id) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("language")
      .eq("id", activeUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const lang = (data?.language as AppLanguage | null | undefined) ?? null;
        if (lang === "en" || lang === "sr") {
          setAppLanguage(lang);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeUser?.id]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
