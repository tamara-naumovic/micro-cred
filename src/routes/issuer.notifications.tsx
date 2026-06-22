import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { NotificationsList } from "@/components/NotificationsList";

function IssuerNotifications() {
  const { t } = useTranslation("issuer");
  return (
    <PageShell title={t("notifications.title")} description={t("notifications.description")}>
      <NotificationsList role="issuer" />
    </PageShell>
  );
}

export const Route = createFileRoute("/issuer/notifications")({
  head: () => ({ meta: [{ title: "Notifications — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <IssuerNotifications />
    </RoleGuard>
  ),
});
