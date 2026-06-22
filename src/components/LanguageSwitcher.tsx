import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { setAppLanguage, type AppLanguage } from "@/i18n";
import { updateMyLanguage } from "@/lib/admin-users.functions";
import { useStore } from "@/lib/store";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation("common");
  const { activeUser } = useStore();
  const saveLang = useServerFn(updateMyLanguage);
  const current = (i18n.language?.startsWith("sr") ? "sr" : "en") as AppLanguage;

  const onPick = async (lang: AppLanguage) => {
    if (lang === current) return;
    await setAppLanguage(lang);
    if (activeUser) {
      try {
        await saveLang({ data: { language: lang } });
      } catch {
        // silently ignore
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 px-2"
          aria-label={t("language.selector")}
        >
          <Globe className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase">{current}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => onPick("en")}>
          <span className="mr-2 text-xs font-mono">EN</span>
          {t("language.en")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPick("sr")}>
          <span className="mr-2 text-xs font-mono">SR</span>
          {t("language.sr")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
