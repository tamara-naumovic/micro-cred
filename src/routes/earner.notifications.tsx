import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { NotificationsList } from "@/components/NotificationsList";

export const Route = createFileRoute("/earner/notifications")({
  head: () => ({ meta: [{ title: "Notifications — MicroCred" }] }),
  component: () => (
    <RoleGuard role="earner">
      <Page />
    </RoleGuard>
  ),
});

function Page() {
  const { t } = useTranslation("earner");
  return (
    <PageShell title={t("notifications.title")} description={t("notifications.description")}>
      <NotificationsList role="earner" />
    </PageShell>
  );
}
