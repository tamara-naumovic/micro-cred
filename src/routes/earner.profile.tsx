import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, GraduationCap, Share2, UserCircle } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShareDialog } from "@/components/ShareDialog";
import { CredentialCard } from "@/components/CredentialCard";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/earner/profile")({
  head: () => ({ meta: [{ title: "Public profile — MicroCred" }] }),
  component: () => (
    <RoleGuard role="earner">
      <Profile />
    </RoleGuard>
  ),
});

function Profile() {
  const { activeUser, credentials } = useStore();
  const { t } = useTranslation("earner");
  const [profileToken, setProfileToken] = useState<string | null>(null);

  const mine = useMemo(
    () => credentials.filter((c) => c.earnerId === activeUser?.id),
    [credentials, activeUser?.id],
  );
  const publicCreds = mine.filter((c) => c.sharing.isPublic && c.status !== "revoked");

  useEffect(() => {
    if (!activeUser?.id) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("share_token")
      .eq("id", activeUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfileToken((data?.share_token as string | null) ?? null);
      });
    return () => { cancelled = true; };
  }, [activeUser?.id]);

  const profileUrl = profileToken ? `/profile/${profileToken}` : null;

  if (!activeUser) return null;

  return (
    <PageShell
      title={t("profile.title")}
      description={t("profile.description")}
      actions={
        profileUrl && (
          <ShareDialog
            url={profileUrl}
            title={t("profile.shareTitle", { name: activeUser.name })}
            summary={t("profile.shareSummary", { name: activeUser.name })}
            qrId="qr-profile"
            trigger={
              <Button>
                <Share2 className="mr-1 h-4 w-4" /> {t("profile.shareBtn")}
              </Button>
            }
          />
        )
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-wrap items-start gap-4 p-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserCircle className="h-8 w-8" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-2xl font-semibold leading-tight">{activeUser.name}</div>
              <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <GraduationCap className="h-3.5 w-3.5" />
                {activeUser.organization ?? activeUser.email}
              </div>
              <div className="mt-3 flex flex-wrap gap-1 text-xs">
                <Badge variant="secondary">{t("profile.publicBadge", { count: publicCreds.length })}</Badge>
                <Badge variant="outline">{t("profile.totalBadge", { count: mine.length })}</Badge>
              </div>
            </div>
            {profileUrl && (
              <Button variant="outline" size="sm" asChild>
                <Link to={profileUrl}>
                  <ExternalLink className="mr-1 h-3 w-3" /> {t("profile.preview")}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("profile.howItWorks")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{t("profile.howIt1")}</p>
            <p>{t("profile.howIt2")}</p>
            <p>{t("profile.howIt3")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t("profile.publicCredentials")}</h2>
          <span className="text-xs text-muted-foreground">
            {t("profile.publicCount", { visible: publicCreds.length, total: mine.length })}
          </span>
        </div>
        {publicCreds.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              {t("profile.emptyPublic")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {publicCreds.map((c) => (
              <CredentialCard key={c.id} credential={c} detailHref={`/earner/credentials/${c.id}`} />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
