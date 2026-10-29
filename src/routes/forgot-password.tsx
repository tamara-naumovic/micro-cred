import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — CredSeal" },
      { name: "description", content: "Request a password reset link for your CredSeal account." },
      { property: "og:title", content: "Forgot password — CredSeal" },
      { property: "og:description", content: "Request a password reset link for your CredSeal account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { i18n } = useTranslation();
  const sr = i18n.language?.startsWith("sr");
  const L = (en: string, s: string) => (sr ? s : en);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return setError(error.message);
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md p-6 space-y-4">
        <h1 className="text-2xl font-semibold">{L("Forgot your password?", "Zaboravili ste lozinku?")}</h1>
        {sent ? (
          <p className="text-sm text-muted-foreground">
            {L(
              "If an account exists for that email, a reset link has been sent. Check your inbox.",
              "Ako nalog sa tom email adresom postoji, poslat je link za resetovanje. Proverite poštu.",
            )}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {L("Enter your email and we'll send you a reset link.", "Unesite email i poslaćemo vam link za resetovanje.")}
            </p>
            <div className="space-y-2">
              <Label htmlFor="fp-email">Email</Label>
              <Input id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? L("Sending…", "Slanje…") : L("Send reset link", "Pošalji link")}
            </Button>
          </form>
        )}
        <Link to="/login" className="block text-sm text-primary hover:underline">
          {L("Back to sign in", "Nazad na prijavu")}
        </Link>
      </Card>
    </div>
  );
}
