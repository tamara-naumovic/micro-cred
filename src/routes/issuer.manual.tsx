import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Award, BadgeCheck, Bell, BookOpen, FilePlus2, GraduationCap,
  Inbox, LayoutDashboard, Link2, PlayCircle, Send, Settings,
  UploadCloud, Users, XOctagon,
} from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { resetIssuerTour, startIssuerTour, resetIssuerCredentialsTour } from "@/lib/tour/issuerTour";

export const Route = createFileRoute("/issuer/manual")({
  head: () => ({ meta: [{ title: "Manual — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <Manual />
    </RoleGuard>
  ),
});

type SectionKey =
  | "overview" | "templates" | "templateNew" | "staff" | "earners"
  | "requests" | "issue" | "bulk" | "credentials" | "revocations"
  | "anchoring" | "profile" | "notifications" | "settings";

type SectionDef = {
  key: SectionKey;
  icon: typeof BookOpen;
  to: string;
  adminOnly?: boolean;
};

const SECTION_DEFS: SectionDef[] = [
  { key: "overview",      icon: LayoutDashboard, to: "/issuer" },
  { key: "templates",     icon: BookOpen,         to: "/issuer/microcredential-templates" },
  { key: "templateNew",   icon: FilePlus2,        to: "/issuer/microcredential-templates/new", adminOnly: true },
  { key: "staff",         icon: Users,            to: "/issuer/staff",           adminOnly: true },
  { key: "earners",       icon: GraduationCap,    to: "/issuer/earners",         adminOnly: true },
  { key: "requests",      icon: Inbox,            to: "/issuer/requests" },
  { key: "issue",         icon: Send,             to: "/issuer/issue" },
  { key: "bulk",          icon: UploadCloud,      to: "/issuer/issue/bulk" },
  { key: "credentials",   icon: Award,            to: "/issuer/credentials" },
  { key: "revocations",   icon: XOctagon,         to: "/issuer/revocations",     adminOnly: true },
  { key: "anchoring",     icon: Link2,            to: "/issuer/anchoring-queue" },
  { key: "profile",       icon: BadgeCheck,       to: "/issuer/profile",         adminOnly: true },
  { key: "notifications", icon: Bell,             to: "/issuer/notifications" },
  { key: "settings",      icon: Settings,         to: "/issuer/settings" },
];

function Manual() {
  const { t } = useTranslation("issuer");
  const { activeUser } = useStore();
  if (!activeUser) return null;
  const isStaff = activeUser.subRole === "staff";
  const sections = SECTION_DEFS.filter((s) => !(s.adminOnly && isStaff));

  return (
    <PageShell
      title={t("manual.title")}
      description={t("manual.description")}
      actions={
        <Button
          variant="outline"
          onClick={() => {
            const sub = activeUser.subRole ?? "admin";
            resetIssuerTour(activeUser.id);
            resetIssuerCredentialsTour(activeUser.id);
            startIssuerTour(activeUser.id, sub, { force: true });
          }}
        >
          <PlayCircle className="mr-2 h-4 w-4" /> {t("manual.restartTour")}
        </Button>
      }
    >
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t("manual.gettingStarted.title")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>{t("manual.gettingStarted.p1")}</p>
          <p>
            {t("manual.gettingStarted.p2")}
            {isStaff ? t("manual.gettingStarted.staffNote") : ""}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.to}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-primary" />
                  {t(`manual.sections.${s.key}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{t(`manual.sections.${s.key}.body`)}</p>
                <Button variant="link" asChild className="px-0">
                  <Link to={s.to}>{t(`manual.sections.${s.key}.linkLabel`)} →</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
