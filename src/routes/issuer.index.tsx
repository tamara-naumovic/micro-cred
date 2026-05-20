import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, BookOpen, Inbox, Send, ShieldCheck, ClipboardList } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/issuer/")({
  head: () => ({ meta: [{ title: "Issuer Overview — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <Overview />
    </RoleGuard>
  ),
});

function Overview() {
  const { activeUser, templates, credentials, applications } = useStore();
  if (!activeUser) return null;
  const orgId = activeUser.organizationId;
  const myTemplates = templates.filter((t) => t.issuerId === orgId);
  const myCreds = credentials.filter((c) => c.issuerId === orgId);
  const myApps = applications.filter((a) => a.issuerId === orgId);
  const ready = myApps.filter((a) => a.status === "verified_by_provider");
  const activeRequests = myApps.filter((a) => a.status !== "issued" && a.status !== "rejected").length;

  return (
    <PageShell
      title="Issuer Overview"
      description={`${activeUser.organization ?? "Issuer"} — manage templates, issuance and revocations.`}
      actions={
        <>
          <Button asChild><Link to="/issuer/issue"><Send className="mr-2 h-4 w-4" />Direct issue</Link></Button>
          <Button variant="outline" asChild><Link to="/issuer/templates/new"><BookOpen className="mr-2 h-4 w-4" />New template</Link></Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Active Micro-credentials" value={myTemplates.filter((t) => t.status === "active").length} icon={<BookOpen className="h-5 w-5" />} tone="primary" />
        <MetricCard label="Issued credentials" value={myCreds.length} icon={<Award className="h-5 w-5" />} tone="success" />
        <MetricCard label="Awaiting signature" value={ready.length} icon={<Inbox className="h-5 w-5" />} tone="warning" />
        <MetricCard label="Active requests" value={activeRequests} icon={<ClipboardList className="h-5 w-5" />} tone="primary" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Awaiting your signature</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {ready.length === 0 && <p className="text-sm text-muted-foreground">Nothing to sign right now.</p>}
            {ready.map((a) => (
              <Link key={a.id} to="/issuer/requests" className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-muted">
                <div className="min-w-0">
                  <div className="truncate font-medium">{a.templateTitle}</div>
                  <div className="text-xs text-muted-foreground">{a.earnerName}</div>
                </div>
                <StatusBadge status={a.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Recently issued</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {myCreds.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground">{c.earnerName} · {new Date(c.issuedAt).toLocaleDateString()}</div>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
            {myCreds.length === 0 && <p className="text-sm text-muted-foreground">No issued credentials yet.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" />
        EBSI anchoring is not yet active in this prototype — see <Link to="/issuer/ebsi" className="ml-1 underline">EBSI Integration</Link>.
      </div>
    </PageShell>
  );
}
