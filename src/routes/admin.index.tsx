import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, Building2, FileCheck2, Mail, Users } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "System Admin — MicroCred" }] }),
  component: () => (
    <RoleGuard role="admin">
      <Dash />
    </RoleGuard>
  ),
});

function Dash() {
  const { users, organizations, registrations, credentials, audit, events } = useStore();
  const pendingReg = registrations.filter((r) => r.status === "pending").length;
  return (
    <PageShell title="System Administration" description="Oversee organisations, users and platform integrity.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Users" value={users.length} icon={<Users className="h-5 w-5" />} tone="primary" />
        <MetricCard label="Organisations" value={organizations.length} icon={<Building2 className="h-5 w-5" />} tone="info" />
        <MetricCard label="Pending registrations" value={pendingReg} icon={<Mail className="h-5 w-5" />} tone="warning" />
        <MetricCard label="Credentials issued" value={credentials.length} icon={<Award className="h-5 w-5" />} tone="success" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent platform activity</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {events.slice(0, 8).map((e) => (
              <div key={e.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-xs uppercase text-muted-foreground">{e.type}</span><span className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString()}</span></div>
                <div className="mt-1">{e.description}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileCheck2 className="h-4 w-4" />Audit trail (latest)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {audit.slice(0, 8).map((a) => (
              <div key={a.id} className="rounded-md border border-border p-3 text-sm">
                <div className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</div>
                <div className="mt-1"><span className="font-medium">{a.actor}</span> {a.action} <span className="font-mono text-xs">{a.target}</span></div>
              </div>
            ))}
            <Link to="/admin/audit" className="text-xs text-primary hover:underline">View full audit trail →</Link>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
