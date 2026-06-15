import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getMyProfile, updateMyProfile } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/earner/settings")({
  head: () => ({ meta: [{ title: "Settings — MicroCred" }] }),
  component: () => (
    <RoleGuard role="earner">
      <PageShell title="Settings" description="Manage your account preferences.">
        <div className="space-y-6">
          <AboutForm />
          <ChangePasswordForm />
        </div>
      </PageShell>
    </RoleGuard>
  ),
});

const MAX_ABOUT = 1000;

function AboutForm() {
  const fetchProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateMyProfile);
  const [about, setAbout] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchProfile()
      .then((p) => {
        if (!cancelled) setAbout(p.about ?? "");
      })
      .catch((e) => {
        console.error("[earner.settings] load profile", e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchProfile]);

  const onSave = async () => {
    setSaving(true);
    try {
      await saveProfile({ data: { about } });
      toast.success("About updated");
    } catch (e) {
      toast.error((e as Error).message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">About you</CardTitle>
        <CardDescription>
          A short bio shown on your public profile, next to your shared credentials.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor="about">About</Label>
        <Textarea
          id="about"
          rows={5}
          maxLength={MAX_ABOUT}
          placeholder="Tell visitors a bit about yourself — your background, interests, what you're learning…"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          disabled={loading || saving}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {about.length}/{MAX_ABOUT}
          </span>
          <Button onClick={onSave} disabled={loading || saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
