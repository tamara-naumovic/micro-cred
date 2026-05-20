import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — MicroCred" },
      { name: "description", content: "Sign in or create a MicroCred account." },
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
  const [submitted, setSubmitted] = useState(false);

  // Redirect any time activeUser becomes available (handles existing session + post-login)
  useEffect(() => {
    if (activeUser) {
      navigate({ to: ROLE_HOME[activeUser.role] ?? "/earner" });
    }
  }, [activeUser, navigate]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Welcome to MicroCred
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to your account or create a new one.
        </p>
      </div>

      <Tabs defaultValue="signin" className="mx-auto max-w-md">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="signup">Sign up</TabsTrigger>
        </TabsList>

        <TabsContent value="signin" className="mt-6">
          <SignInForm onSubmitted={() => setSubmitted(true)} waiting={submitted && !activeUser} />
        </TabsContent>
        <TabsContent value="signup" className="mt-6">
          <SignUpForm />
        </TabsContent>
      </Tabs>

      <Card className="mx-auto mt-6 max-w-md p-4 text-xs text-muted-foreground">
        <p className="mb-2 font-medium text-foreground">Test accounts (password: Test1234)</p>
        <ul className="space-y-1 font-mono">
          <li>earner@test.com — Earner</li>
          <li>issuer@test.com — Issuer</li>
          <li>admin@test.com — Admin</li>
        </ul>
      </Card>
    </main>
  );
}

function SignInForm({ onSubmitted, waiting }: { onSubmitted: () => void; waiting: boolean }) {
  const { signIn, signInWithGoogle } = useAuth();
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
    // Redirect happens via useEffect in LoginPage when activeUser is populated
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
      <Separator className="my-4" />
      <Button variant="outline" className="w-full" onClick={() => signInWithGoogle()}>
        Continue with Google
      </Button>
    </Card>
  );
}

function SignUpForm() {
  const { signUp, signInWithGoogle } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    const { error } = await signUp(email, password, name);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Account created");
    // Redirect handled by LoginPage useEffect once session + activeUser bridge complete
  }

  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="su-name">Display name</Label>
          <Input id="su-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="su-email">Email</Label>
          <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="su-pw">Password</Label>
          <Input id="su-pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create account
        </Button>
      </form>
      <Separator className="my-4" />
      <Button variant="outline" className="w-full" onClick={() => signInWithGoogle()}>
        Continue with Google
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        New accounts start as <span className="font-medium">Earner</span>.
      </p>
    </Card>
  );
}
