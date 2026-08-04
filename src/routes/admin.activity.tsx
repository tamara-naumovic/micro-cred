import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/admin/activity")({
  head: () => ({
    meta: [
      { title: "Platform Activity — CredSeal Admin" },
      { name: "description", content: "Live stream of platform-wide events on CredSeal." },
      { property: "og:title", content: "Platform Activity — CredSeal Admin" },
      { property: "og:description", content: "Live stream of platform-wide events on CredSeal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGuard role="admin">
      <Activity />
    </RoleGuard>
  ),
});

function Activity() {
  const { events } = useStore();
  const { t, i18n } = useTranslation("admin");
  return (
    <PageShell title={t("activity.title")} description={t("activity.description")}>
      <Card>
        <CardContent className="space-y-2 p-4">
          {events.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3 text-sm">
              <div className="min-w-0">
                <Badge variant="outline" className="mr-2 capitalize">{e.type}</Badge>
                <span>{e.description}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(e.at).toLocaleString(i18n.language)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}
