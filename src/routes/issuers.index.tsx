import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { BadgeCheck, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/issuers/")({
  head: () => ({
    meta: [
      { title: "Issuer directory — MicroCred" },
      { name: "description", content: "Browse all accredited issuers on the platform." },
    ],
  }),
  component: IssuerDirectory,
});

function IssuerDirectory() {
  const { organizations, templates, credentials } = useStore();
  const [q, setQ] = useState("");
  const [country, setCountry] = useState<string>("all");

  const issuers = organizations.filter((o) => o.type === "issuer");
  const countries = Array.from(new Set(issuers.map((i) => i.country)));

  const filtered = useMemo(() => {
    return issuers.filter((i) => {
      if (country !== "all" && i.country !== country) return false;
      if (q && !i.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [issuers, q, country]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 md:px-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Issuer directory
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Accredited bodies that can issue micro-credentials on MicroCred.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search issuers"
            className="pl-9"
          />
        </div>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((i) => {
          const tplCount = templates.filter((t) => t.issuerId === i.id && t.status === "active").length;
          const credCount = credentials.filter((c) => c.issuerId === i.id).length;
          return (
            <Link key={i.id} to="/issuers/$id" params={{ id: i.id }}>
              <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BadgeCheck className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                      {i.country}
                    </Badge>
                  </div>
                  <div>
                    <div className="font-display font-semibold leading-tight">{i.name}</div>
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{i.about}</p>
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{tplCount} active templates</Badge>
                    <Badge variant="secondary">{credCount} issued</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">No issuers match your filters.</p>
        )}
      </div>
    </main>
  );
}
