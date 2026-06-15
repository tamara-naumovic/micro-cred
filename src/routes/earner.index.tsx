import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, Bell, ClipboardList, FilePlus2, Share2, ShieldCheck } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { MetricCard } from "@/components/MetricCard";
import { CredentialCard } from "@/components/CredentialCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { useStore } from "@/lib/store";

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
      title={`Welcome, ${activeUser.name.split(" ")[0]}`}
      description="Apply for new micro-credentials, track your applications and share your achievements."
      actions={
        <>
          <Button asChild>
            <Link to="/earner/apply">
              <FilePlus2 className="mr-2 h-4 w-4" /> Apply for credential
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/earner/profile">
              <Share2 className="mr-2 h-4 w-4" /> Public profile
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Active credentials" value={active} icon={<Award className="h-5 w-5" />} tone="success" />
        <MetricCard label="Pending applications" value={pending} icon={<ClipboardList className="h-5 w-5" />} tone="warning" />
        <MetricCard label="Expiring soon" value={expiringSoon} icon={<Bell className="h-5 w-5" />} tone="info" />
        <MetricCard label="Public credentials" value={shared} icon={<ShieldCheck className="h-5 w-5" />} tone="purple" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent credentials</CardTitle>
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
              {mine.length === 0 && <p className="text-sm text-muted-foreground">No credentials yet.</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent applications</CardTitle>
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
            {myApps.length === 0 && <p className="text-sm text-muted-foreground">No applications yet.</p>}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
