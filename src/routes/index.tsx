import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  
  GraduationCap,
  Hexagon,
  Search,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { getDashboardPath } from "@/components/DashboardHomeLink";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CredSeal — Verified skills, trusted credentials" },
      {
        name: "description",
        content:
          "Browse public issuer profiles, verify shared credentials and earner profiles. Blockchain-anchored on Bloxberg for higher education.",
      },
      { property: "og:title", content: "CredSeal — Higher Education Credentialing" },
      {
        property: "og:description",
        content:
          "Public verification surface for higher education micro-credentials issued by accredited bodies.",
      },
    ],
  }),
  component: Home,
});

const ROLES = [
  { icon: GraduationCap, label: "Earners", desc: "Apply, collect, share micro-credentials." },
  { icon: Award, label: "Issuers", desc: "Design templates, issue and revoke credentials." },
  { icon: ShieldQuestion, label: "Verifiers", desc: "Verify a credential or open a shared profile." },
];

function Home() {
  const { organizations, credentials, activeUser } = useStore();
  const issuers = organizations.filter((o) => o.type === "issuer");
  const issuedCount = credentials.length;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: "var(--gradient-soft)" }}
        />
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
          <Badge variant="outline" className="mb-5 gap-1 bg-card">
            <Hexagon className="h-3 w-3 text-purple" /> Bloxberg-anchored · W3C Verifiable Credentials
          </Badge>
          <h1 className="max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
            A trustworthy home for higher education{" "}
            <span className="bg-gradient-to-r from-primary via-purple to-success bg-clip-text text-transparent">
              micro-credentials
            </span>
            .
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            CredSeal lets accredited issuers design, award and revoke micro-credentials, and lets
            employers and verifiers check them in one click — with controlled visibility set by
            the earner.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/issuers">
                <Search className="mr-2 h-4 w-4" /> Browse issuers
              </Link>
            </Button>
            {activeUser ? (
              <Button size="lg" variant="outline" asChild>
                <Link to={getDashboardPath(activeUser.role)}>Go to your workspace</Link>
              </Button>
            ) : (
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">Sign in to a workspace</Link>
              </Button>
            )}
          </div>

        </div>
      </section>

      {/* Roles */}
      <section className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Roles</div>
          <h2 className="mt-2 font-display text-3xl font-semibold">One platform, three perspectives</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r) => {
            const Icon = r.icon;
            return (
              <Card key={r.label}>
                <CardContent className="p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-4 font-display font-semibold">{r.label}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Featured issuers */}
      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Issuers</div>
              <h2 className="mt-2 font-display text-3xl font-semibold">Featured awarding bodies</h2>
            </div>
            <Button variant="outline" asChild>
              <Link to="/issuers">
                View all <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {issuers.slice(0, 3).map((iss) => (
              <Card key={iss.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BadgeCheck className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                      {iss.country}
                    </Badge>
                  </div>
                  <div className="mt-4 font-display font-semibold leading-tight">{iss.name}</div>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{iss.about}</p>
                  <Button variant="ghost" size="sm" asChild className="mt-3 px-0">
                    <Link to="/issuers/$id" params={{ id: iss.id }}>
                      Open profile <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Blockchain strip */}
      <section className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Hexagon className="h-6 w-6" />
              </div>
              <div>
                <div className="font-display text-lg font-semibold">
                  Blockchain-anchored verification on Bloxberg
                </div>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Published templates and issued credentials are anchored to the Bloxberg network as
                  cryptographic proofs. Anyone can verify a credential's integrity, issuer and
                  lifecycle status on-chain — without exposing the learner's personal data.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3 w-3" /> Live on Bloxberg
            </Badge>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div className="font-display text-3xl font-semibold">{n}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
