import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — CredSeal" },
      { name: "description", content: "Set a new password for your CredSeal account." },
      { property: "og:title", content: "Reset password — CredSeal" },
      { property: "og:description", content: "Set a new password for your CredSeal account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { i18n } = useTranslation();
  const sr = i18n.language?.startsWith("sr");
  const L = (en: string, s: string) => (sr ? s : en);
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    const isRecovery = hash.includes("type=recovery");
    const hashErr = new URLSearchParams(hash.slice(1)).get("error_description");
    if (hashErr) setError(hashErr);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && (isRecovery || !hash)) setReady(true);
      setChecked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 6) return setError(L("Password must be at least 6 characters.", "Lozinka mora imati najmanje 6 karaktera."));
    if (pw !== pw2) return setError(L("Passwords do not match.", "Lozinke se ne poklapaju."));
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(error.message);
    toast.success(L("Password updated. Please sign in.", "Lozinka je promenjena. Prijavite se."));
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md p-6 space-y-4">
        <h1 className="text-2xl font-semibold">{L("Set a new password", "Postavite novu lozinku")}</h1>
        {!ready && checked ? (
          <p className="text-sm text-destructive">
            {error ?? L("This reset link is invalid or has expired. Ask an administrator for a new one.", "Link za resetovanje je nevažeći ili je istekao. Zatražite novi od administratora.")}
          </p>
        ) : !ready ? (
          <p className="text-sm text-muted-foreground">{L("Checking link…", "Provera linka…")}</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw">{L("New password", "Nova lozinka")}</Label>
              <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw2">{L("Confirm password", "Potvrdite lozinku")}</Label>
              <Input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? L("Saving…", "Čuvanje…") : L("Update password", "Promeni lozinku")}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
