import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ROLES = [
  { key: "earner", perms: ["apply", "wallet:manage", "share:public-link", "evidence:upload"] },
  { key: "provider", perms: ["evidence:review", "application:forward", "application:reject"] },
  { key: "issuer", perms: ["template:manage", "credential:sign", "credential:revoke", "provider:assign"] },
  { key: "verifier", perms: ["credential:verify-public"] },
  { key: "admin", perms: ["org:manage", "user:manage", "registration:approve", "audit:read"] },
];

export const Route = createFileRoute("/admin/roles")({
  head: () => ({
    meta: [
      { title: "Roles & Permissions — CredSeal Admin" },
      { name: "description", content: "Capability mapping for each role on the CredSeal platform." },
      { property: "og:title", content: "Roles & Permissions — CredSeal Admin" },
      { property: "og:description", content: "Capability mapping for each role on the CredSeal platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGuard role="admin">
      <Roles />
    </RoleGuard>
  ),
});

function Roles() {
  const { t } = useTranslation("admin");
  return (
    <PageShell title={t("roles.title")} description={t("roles.description")}>
      <div className="grid gap-4 md:grid-cols-2">
        {ROLES.map((r) => (
          <Card key={r.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {t(`roles.items.${r.key}.name`)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{t(`roles.items.${r.key}.scope`)}</p>
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
