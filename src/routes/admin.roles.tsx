import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ROLES = [
  { name: "Earner", scope: "Apply for credentials, manage wallet & sharing", perms: ["apply", "wallet:manage", "share:public-link", "evidence:upload"] },
  { name: "Course Provider", scope: "Validate evidence and forward applications", perms: ["evidence:review", "application:forward", "application:reject"] },
  { name: "Issuer", scope: "Sign credentials, manage templates and revocations", perms: ["template:manage", "credential:sign", "credential:revoke", "provider:assign"] },
  { name: "Verifier", scope: "Look up credentials publicly", perms: ["credential:verify-public"] },
  { name: "System Admin", scope: "Platform governance and oversight", perms: ["org:manage", "user:manage", "registration:approve", "audit:read"] },
];

export const Route = createFileRoute("/admin/roles")({
  head: () => ({ meta: [{ title: "Roles & Permissions — MicroCred Admin" }] }),
  component: () => (
    <RoleGuard role="admin">
      <Roles />
    </RoleGuard>
  ),
});

function Roles() {
  return (
    <PageShell title="Roles & Permissions" description="Capability mapping for each role on the platform.">
      <div className="grid gap-4 md:grid-cols-2">
        {ROLES.map((r) => (
          <Card key={r.name}>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" />{r.name}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{r.scope}</p>
              <div className="flex flex-wrap gap-1.5">
                {r.perms.map((p) => <Badge key={p} variant="outline" className="font-mono text-[10px]">{p}</Badge>)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
