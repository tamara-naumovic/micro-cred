import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/set-password")({
  head: () => ({
    meta: [
      { title: "Set your password — MicroCred" },
      { name: "description", content: "Choose a password for your new MicroCred account." },
    ],
  }),
  component: SetPasswordPage,
});

function parseHash(hash: string): Record<string, string> {
  const out: Record<string, string> = {};
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const part of h.split("&")) {
    if (!part) continue;
    const [k, v = ""] = part.split("=");
    out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
}

function SetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const flowType = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = parseHash(window.location.hash);
    return params.type ?? null; // "invite" | "recovery" | ...
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Supabase client auto-detects session from URL hash on load.
      // Give it a tick, then check.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setHasSession(true);
        setReady(true);
        return;
      }
      // Fall back: listen briefly for SIGNED_IN from URL parsing.
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
          setHasSession(true);
          setReady(true);
          sub.subscription.unsubscribe();
        }
      });
      setTimeout(() => {
        if (cancelled) return;
        setReady(true);
        sub.subscription.unsubscribe();
      }, 1500);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      setErrorMsg(error.message);
      return;
    }
    await supabase.auth.signOut();
    setBusy(false);
    toast.success("Password set. Please sign in.");
    navigate({ to: "/login" });
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10 md:px-8 md:py-14">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Set your password
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {flowType === "recovery"
            ? "Choose a new password for your account."
            : "Welcome! Choose a password to activate your MicroCred account."}
        </p>
      </div>

      <Card className="p-6">
        {!ready ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Preparing…
          </div>
        ) : !hasSession ? (
          <div className="space-y-3 text-sm">
            <p className="font-medium text-foreground">This link is invalid or has expired.</p>
            <p className="text-muted-foreground">
              Ask your administrator to resend the invitation, or return to the sign in page.
            </p>
            <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/login" })}>
              Go to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sp-pw">New password</Label>
              <Input
                id="sp-pw"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sp-pw2">Confirm new password</Label>
              <Input
                id="sp-pw2"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {errorMsg && (
              <p className="text-sm text-destructive" role="alert">
                {errorMsg}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Set password
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
