import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ExternalLink, BadgeCheck, Globe } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/issuer/profile")({
  head: () => ({ meta: [{ title: "Public Profile — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <Profile />
    </RoleGuard>
  ),
});

function Profile() {
  const { t } = useTranslation("issuer");
  const { activeUser, organizations, templates, credentials } = useStore();
  if (!activeUser) return null;
  const org = organizations.find((o) => o.id === activeUser.organizationId);
  if (!org) return <PageShell title={t("profile.noOrg")}>{null}</PageShell>;
  const tpls = templates.filter((tpl) => tpl.issuerId === org.id);
  const issued = credentials.filter((c) => c.issuerId === org.id).length;

  return (
    <PageShell
      title={t("profile.title")}
      description={t("profile.description")}
      actions={
        <Button asChild variant="outline">
          <Link to="/issuers/$id" params={{ id: org.id }}>
            <ExternalLink className="mr-2 h-4 w-4" />{t("profile.shareBtn")}
          </Link>
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BadgeCheck className="h-4 w-4 text-primary" />{org.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{org.about ?? "—"}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{org.country}</Badge>
              {org.accreditations?.map((a) => <Badge key={a} variant="outline">{a}</Badge>)}
            </div>
            {org.website && (
              <a
                href={org.website.startsWith("http") ? org.website : `https://${org.website}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-primary hover:underline"
              >
                <Globe className="mr-1 h-4 w-4" />{org.website}
              </a>
            )}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="text-xs uppercase text-muted-foreground">{t("profile.stats.templates")}</div>
              <div className="font-display text-3xl font-semibold">{tpls.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="text-xs uppercase text-muted-foreground">{t("profile.stats.credentialsIssued")}</div>
              <div className="font-display text-3xl font-semibold">{issued}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
