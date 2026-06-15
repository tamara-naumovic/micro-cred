import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { NotificationsList } from "@/components/NotificationsList";

export const Route = createFileRoute("/issuer/notifications")({
  head: () => ({ meta: [{ title: "Notifications — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <PageShell title="Notifications" description="Updates about applications, issuance and assignments.">
        <NotificationsList role="issuer" />
      </PageShell>
    </RoleGuard>
  ),
});
