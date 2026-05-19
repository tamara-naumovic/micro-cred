import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/earner/notifications")({
  head: () => ({ meta: [{ title: "Notifications — MicroCred" }] }),
  component: () => (
    <RoleGuard role="earner">
      <PageShell title="Notifications" description="Section of the research prototype.">
        <Card><CardContent className="p-8 text-sm text-muted-foreground">Notifications — coming in next iteration.</CardContent></Card>
      </PageShell>
    </RoleGuard>
  ),
});
