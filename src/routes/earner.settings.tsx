import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMyProfile, updateMyProfile, updateMyLanguage } from "@/lib/admin-users.functions";
import { setAppLanguage, type AppLanguage } from "@/i18n";

export const Route = createFileRoute("/earner/settings")({
  head: () => ({ meta: [{ title: "Settings — MicroCred" }] }),
  component: () => (
    <RoleGuard role="earner">
      <SettingsPage />
    </RoleGuard>
  ),
});

const MAX_ABOUT = 1000;

function SettingsPage() {
  const { t } = useTranslation(["earner", "common"]);
  return (
    <PageShell title={t("settings.title")} description={t("settings.description")}>
      <div className="space-y-6">
        <LanguageCard />
        <AboutForm />
        <ChangePasswordForm />
      </div>
    </PageShell>
  );
}

function LanguageCard() {
  const { t, i18n } = useTranslation(["common", "earner"]);
  const saveLang = useServerFn(updateMyLanguage);
  const fetchProfile = useServerFn(getMyProfile);
  const [lang, setLang] = useState<AppLanguage>((i18n.language as AppLanguage) || "en");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile()
      .then((p) => {
        if (p.language === "en" || p.language === "sr") {
          setLang(p.language);
        }
      })
      .catch(() => { /* ignore */ });
  }, [fetchProfile]);

  const onChange = async (next: AppLanguage) => {
    setLang(next);
    setSaving(true);
    try {
      await saveLang({ data: { language: next } });
      await setAppLanguage(next);
      toast.success(t("language.updated", { ns: "common" }));
    } catch (e) {
      toast.error((e as Error).message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.language.title", { ns: "earner" })}</CardTitle>
        <CardDescription>{t("settings.language.description", { ns: "earner" })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor="language">{t("language.label", { ns: "common" })}</Label>
        <Select value={lang} onValueChange={(v) => onChange(v as AppLanguage)} disabled={saving}>
          <SelectTrigger id="language" className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">{t("language.en", { ns: "common" })}</SelectItem>
            <SelectItem value="sr">{t("language.sr", { ns: "common" })}</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

function AboutForm() {
  const { t } = useTranslation(["earner", "common"]);
  const fetchProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateMyProfile);
  const [about, setAbout] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchProfile()
      .then((p) => {
        if (!cancelled) setAbout(p.about ?? "");
      })
      .catch((e) => {
        console.error("[earner.settings] load profile", e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchProfile]);

  const onSave = async () => {
    setSaving(true);
    try {
      await saveProfile({ data: { about } });
      toast.success(t("settings.about.saved"));
    } catch (e) {
      toast.error((e as Error).message || t("settings.about.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.about.title")}</CardTitle>
        <CardDescription>{t("settings.about.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor="about">{t("settings.about.label")}</Label>
        <Textarea
          id="about"
          rows={5}
          maxLength={MAX_ABOUT}
          placeholder={t("settings.about.placeholder")}
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          disabled={loading || saving}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {about.length}/{MAX_ABOUT}
          </span>
          <Button onClick={onSave} disabled={loading || saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t("actions.save", { ns: "common" })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
