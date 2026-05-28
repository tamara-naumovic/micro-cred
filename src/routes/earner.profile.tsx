import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
      title="Public profile"
      description="A single shareable page that aggregates all credentials you've made public. Share it on LinkedIn, by link, or via QR."
      actions={
        profileUrl && (
          <ShareDialog
            url={profileUrl}
            title={`${activeUser.name} — Verified credentials`}
            summary={`${activeUser.name}'s public micro-credential profile on MicroCred.`}
            qrId="qr-profile"
            trigger={
              <Button>
                <Share2 className="mr-1 h-4 w-4" /> Share profile
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
                <Badge variant="secondary">{publicCreds.length} public</Badge>
                <Badge variant="outline">{mine.length} total</Badge>
              </div>
            </div>
            {profileUrl && (
              <Button variant="outline" size="sm" asChild>
                <Link to={profileUrl}>
                  <ExternalLink className="mr-1 h-3 w-3" /> Preview
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">How sharing works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Toggle individual credentials as public from each credential's detail page.</p>
            <p>Your public profile shows only credentials you've explicitly enabled.</p>
            <p>Share via direct link, LinkedIn post, or downloadable QR code.</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Public credentials</h2>
          <span className="text-xs text-muted-foreground">
            {publicCreds.length} of {mine.length} visible
          </span>
        </div>
        {publicCreds.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              You haven't made any credentials public yet. Open a credential and toggle "Publicly verifiable".
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
