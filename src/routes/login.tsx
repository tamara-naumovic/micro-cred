import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Award, Boxes, GraduationCap, Loader2, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { mockUsers, useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — MicroCred" },
      { name: "description", content: "Sign in or continue as a demo persona." },
    ],
  }),
  component: LoginPage,
});

const ROLE_META: Record<Role, { label: string; icon: typeof GraduationCap; tint: string; home: string }> = {
  earner: { label: "Earner / Student", icon: GraduationCap, tint: "bg-info/15 text-info-foreground", home: "/earner" },
  issuer: { label: "Issuer / Awarding Body", icon: Award, tint: "bg-primary/10 text-primary", home: "/issuer" },
  verifier: { label: "Verifier / Employer", icon: ShieldQuestion, tint: "bg-success/15 text-success-foreground", home: "/issuers" },
  admin: { label: "System Admin", icon: Boxes, tint: "bg-warning/20 text-warning-foreground", home: "/admin" },
};

function LoginPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Welcome to MicroCred
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to your account, create one, or explore the demo personas.
        </p>
      </div>

      <Tabs defaultValue="signin" className="mx-auto max-w-md">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="signup">Sign up</TabsTrigger>
          <TabsTrigger value="demo">Demo</TabsTrigger>
        </TabsList>

        <TabsContent value="signin" className="mt-6">
          <SignInForm />
        </TabsContent>
        <TabsContent value="signup" className="mt-6">
          <SignUpForm />
        </TabsContent>
        <TabsContent value="demo" className="mt-6">
          <DemoPersonas />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function SignInForm() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
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
    navigate({ to: "/earner" });
  }

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
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
  const navigate = useNavigate();
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
    navigate({ to: "/earner" });
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
        New accounts start as <span className="font-medium">Earner</span>. Organizations can be added by admins.
      </p>
    </Card>
  );
}

function DemoPersonas() {
  const { setActiveUser } = useStore();
  const navigate = useNavigate();

  const grouped = (["earner", "issuer", "verifier", "admin"] as Role[]).map((r) => ({
    role: r,
    users: mockUsers.filter((u) => u.role === r),
  }));

  return (
    <div className="space-y-8">
      <p className="text-center text-xs text-muted-foreground">
        Demo mode — these personas use mock data without authentication.
      </p>
      {grouped.map(({ role, users }) => {
        const meta = ROLE_META[role];
        const Icon = meta.icon;
        return (
          <section key={role}>
            <div className="mb-3 flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-md ${meta.tint}`}>
                <Icon className="h-4 w-4" />
              </div>
              <h2 className="font-display text-sm font-semibold">{meta.label}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {users.map((u) => (
                <Card
                  key={u.id}
                  className="cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow"
                  onClick={() => {
                    setActiveUser(u);
                    navigate({ to: meta.home });
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{u.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                      {u.organization && (
                        <div className="mt-1 truncate text-xs text-muted-foreground">{u.organization}</div>
                      )}
                    </div>
                    <Badge variant="secondary" className="capitalize">{role}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
