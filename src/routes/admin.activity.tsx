import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/admin/activity")({
  head: () => ({ meta: [{ title: "Activity — MicroCred Admin" }] }),
  component: () => (
    <RoleGuard role="admin">
      <Activity />
    </RoleGuard>
  ),
});

function Activity() {
  const { events } = useStore();
  return (
    <PageShell title="Platform Activity" description="Live stream of platform-wide events.">
      <Card>
        <CardContent className="space-y-2 p-4">
          {events.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3 text-sm">
              <div className="min-w-0">
                <Badge variant="outline" className="mr-2 capitalize">{e.type}</Badge>
                <span>{e.description}</span>
              </div>
              <div className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString()}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}
