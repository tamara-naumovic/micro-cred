import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Award,
  Bell,
  BookOpen,
  ClipboardList,
  FilePlus2,
  LayoutDashboard,
  PlayCircle,
  Settings,
  UserCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { resetEarnerTour, startEarnerTour } from "@/lib/tour/earnerTour";

export const Route = createFileRoute("/earner/manual")({
  head: () => ({ meta: [{ title: "Manual — MicroCred" }] }),
  component: () => (
    <RoleGuard role="earner">
      <Manual />
    </RoleGuard>
  ),
});

type SectionDef = {
  key:
    | "dashboard"
    | "myCredentials"
    | "credentialDetails"
    | "applications"
    | "apply"
    | "profile"
    | "privacy"
    | "notifications"
    | "settings";
  icon: typeof BookOpen;
  to: string;
};

const SECTIONS: SectionDef[] = [
  { key: "dashboard", icon: LayoutDashboard, to: "/earner" },
  { key: "myCredentials", icon: Award, to: "/earner/credentials" },
  { key: "credentialDetails", icon: Award, to: "/earner/credentials" },
  { key: "applications", icon: ClipboardList, to: "/earner/applications" },
  { key: "apply", icon: FilePlus2, to: "/earner/apply" },
  { key: "profile", icon: UserCircle, to: "/earner/profile" },
  { key: "privacy", icon: Award, to: "/earner/credentials" },
  { key: "notifications", icon: Bell, to: "/earner/notifications" },
  { key: "settings", icon: Settings, to: "/earner/settings" },
];

function Manual() {
  const { activeUser } = useStore();
  const { t } = useTranslation("manual");
  if (!activeUser) return null;

  return (
    <PageShell
      title={t("title")}
      description={t("description")}
      actions={
        <Button
          variant="outline"
          onClick={() => {
            resetEarnerTour(activeUser.id);
            startEarnerTour(activeUser.id, { force: true });
          }}
        >
          <PlayCircle className="mr-2 h-4 w-4" /> {t("restartTour")}
        </Button>
      }
    >
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t("gettingStarted.title")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>{t("gettingStarted.p1")}</p>
          <p>{t("gettingStarted.p2")}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-primary" />
                  {t(`sections.${s.key}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{t(`sections.${s.key}.body`)}</p>
                <Button variant="link" asChild className="px-0">
                  <Link to={s.to}>{t(`sections.${s.key}.linkLabel`)} →</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
