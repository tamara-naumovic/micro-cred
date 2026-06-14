import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export const Route = createFileRoute("/issuer/settings")({
  head: () => ({ meta: [{ title: "Settings — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <PageShell title="Settings" description="Manage your account preferences.">
        <ChangePasswordForm />
      </PageShell>
    </RoleGuard>
  ),
});
