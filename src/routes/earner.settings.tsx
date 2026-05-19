import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/earner/settings")({
  head: () => ({ meta: [{ title: "Settings — MicroCred" }] }),
  component: () => (
    <RoleGuard role="earner">
      <PageShell title="Settings" description="Section of the research prototype.">
        <Card><CardContent className="p-8 text-sm text-muted-foreground">Settings — coming in next iteration.</CardContent></Card>
      </PageShell>
    </RoleGuard>
  ),
});
