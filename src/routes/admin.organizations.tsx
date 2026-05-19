import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/admin/organizations")({
  head: () => ({ meta: [{ title: "Organisations — MicroCred Admin" }] }),
  component: () => (
    <RoleGuard role="admin">
      <Orgs />
    </RoleGuard>
  ),
});

function Orgs() {
  const { organizations } = useStore();
  return (
    <PageShell title="Organisations" description="Issuers and course providers registered on the platform.">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {organizations.map((o) => (
          <Card key={o.id}>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground"><Building2 className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <div className="font-display text-base font-semibold">{o.name}</div>
                  <div className="text-xs text-muted-foreground">{o.country} · since {new Date(o.registeredAt).getFullYear()}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="capitalize">{o.type}</Badge>
                {o.accreditations?.map((a) => <Badge key={a} variant="outline">{a}</Badge>)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
