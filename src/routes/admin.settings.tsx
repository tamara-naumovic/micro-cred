import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Platform Settings — CredSeal Admin" },
      { name: "description", content: "Global configuration and prototype controls for the CredSeal platform." },
      { property: "og:title", content: "Platform Settings — CredSeal Admin" },
      { property: "og:description", content: "Global configuration and prototype controls for the CredSeal platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGuard role="admin">
      <Settings />
    </RoleGuard>
  ),
});

function Settings() {
  const { reset } = useStore();
  const { t } = useTranslation("admin");
  return (
    <PageShell title={t("settings.title")} description={t("settings.description")}>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("settings.issuancePolicy")}</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Toggle label={t("settings.toggles.providerSignOff")} defaultChecked />
            <Toggle label={t("settings.toggles.directIssuance")} defaultChecked />
            <Toggle label={t("settings.toggles.bulkIssuance")} defaultChecked />
            <Toggle label={t("settings.toggles.autoAnchor")} defaultChecked />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("settings.prototypeData")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("settings.prototypeHint")}</p>
            <Button variant="outline" onClick={() => { reset(); toast.success(t("settings.resetDone")); }}>
              <RotateCcw className="mr-2 h-4 w-4" />{t("settings.resetButton")}
            </Button>
          </CardContent>
        </Card>
        <ChangePasswordForm />
      </div>
    </PageShell>
  );
}

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="font-normal">{label}</Label>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
