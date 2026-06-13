import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — MicroCred" },
      { name: "description", content: "Sign in to your MicroCred account." },
    ],
  }),
  component: LoginPage,
});

const ROLE_HOME: Record<Role, string> = {
  earner: "/earner",
  issuer: "/issuer",
  admin: "/admin",
};

function LoginPage() {
  const navigate = useNavigate();
  const { activeUser } = useStore();
  const { user, loading } = useAuth();
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!loading && user && activeUser) {
      navigate({ to: ROLE_HOME[activeUser.role] ?? "/earner" });
    }
  }, [activeUser, loading, navigate, user]);

  return (
    <main className="mx-auto max-w-md px-4 py-10 md:px-8 md:py-14">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Welcome to MicroCred
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to your account.
        </p>
      </div>

      <SignInForm onSubmitted={() => setSubmitted(true)} waiting={submitted && !!user && !activeUser} />

      <Card className="mt-6 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Need an account?</p>
        <p className="mt-1">
          Accounts on MicroCred are created by administrators. Contact your institution
          admin or the platform admin to be added.
        </p>
      </Card>
    </main>
  );
}

function SignInForm({ onSubmitted, waiting }: { onSubmitted: () => void; waiting: boolean }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Signed in");
    onSubmitted();
  }

  const disabled = busy || waiting;
  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="si-email">Email</Label>
          <Input id="si-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="si-pw">Password</Label>
          <Input id="si-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={disabled}>
          {disabled && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign in
        </Button>
      </form>
    </Card>
  );
}
