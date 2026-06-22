import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, Bell, ClipboardList, FilePlus2, Share2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { MetricCard } from "@/components/MetricCard";
import { CredentialCard } from "@/components/CredentialCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { useStore } from "@/lib/store";
import { startEarnerTour } from "@/lib/tour/earnerTour";

export const Route = createFileRoute("/earner/")({
  head: () => ({ meta: [{ title: "Earner Dashboard — MicroCred" }] }),
  component: () => (
    <RoleGuard role="earner">
      <Dash />
    </RoleGuard>
  ),
});

function Dash() {
  const { activeUser, credentials, applications } = useStore();
  const { t } = useTranslation("earner");
  useEffect(() => {
    if (!activeUser) return;
    const tm = window.setTimeout(() => startEarnerTour(activeUser.id), 400);
    return () => window.clearTimeout(tm);
  }, [activeUser]);
  if (!activeUser) return null;
  const mine = credentials.filter((c) => c.earnerId === activeUser.id);
  const myApps = applications.filter((a) => a.earnerId === activeUser.id);
  const active = mine.filter((c) => c.status === "active").length;
  const pending = myApps.filter((a) => a.status !== "issued" && a.status !== "rejected").length;
  const expiringSoon = mine.filter(
    (c) => c.expiresAt && new Date(c.expiresAt).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 90 && c.status === "active",
  ).length;
  const shared = mine.filter((c) => c.sharing.isPublic).length;

  return (
    <PageShell
      title={t("dashboard.title", { name: activeUser.name.split(" ")[0] })}
      description={t("dashboard.description")}
      actions={
        <>
          <Button asChild>
            <Link to="/earner/apply">
              <FilePlus2 className="mr-2 h-4 w-4" /> {t("dashboard.actions.apply")}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/earner/profile">
              <Share2 className="mr-2 h-4 w-4" /> {t("dashboard.actions.publicProfile")}
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-tour="dash-metrics">
        <MetricCard label={t("dashboard.metrics.active")} value={active} icon={<Award className="h-5 w-5" />} tone="success" />
        <MetricCard label={t("dashboard.metrics.pending")} value={pending} icon={<ClipboardList className="h-5 w-5" />} tone="warning" />
        <MetricCard label={t("dashboard.metrics.expiring")} value={expiringSoon} icon={<Bell className="h-5 w-5" />} tone="info" />
        <MetricCard label={t("dashboard.metrics.public")} value={shared} icon={<ShieldCheck className="h-5 w-5" />} tone="purple" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.recentCredentials")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {mine.slice(0, 4).map((c) => (
                <CredentialCard
                  key={c.id}
                  credential={c}
                  detailHref={`/earner/credentials/${c.id}`}
                />
              ))}
              {mine.length === 0 && <p className="text-sm text-muted-foreground">{t("dashboard.emptyCredentials")}</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.recentApplications")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myApps.slice(0, 5).map((a) => (
              <Link
                key={a.id}
                to="/earner/applications"
                className="flex items-center justify-between rounded-md border border-border p-2 text-sm hover:bg-muted"
              >
                <span className="truncate">{a.templateTitle}</span>
                <StatusBadge status={a.status} />
              </Link>
            ))}
            {myApps.length === 0 && <p className="text-sm text-muted-foreground">{t("dashboard.emptyApplications")}</p>}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

