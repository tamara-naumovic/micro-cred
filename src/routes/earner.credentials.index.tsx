import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { CredentialCard } from "@/components/CredentialCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";
import type { CredentialStatus } from "@/lib/types";

export const Route = createFileRoute("/earner/credentials/")({
  head: () => ({ meta: [{ title: "My credentials — MicroCred" }] }),
  component: () => (
    <RoleGuard role="earner">
      <List />
    </RoleGuard>
  ),
});

const TABS: { value: CredentialStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
];

function List() {
  const { activeUser, credentials } = useStore();
  const [src, setSrc] = useState<"all" | "formal" | "non_formal">("all");
  if (!activeUser) return null;
  const mine = credentials.filter((c) => c.earnerId === activeUser.id);

  return (
    <PageShell title="My credentials" description="All micro-credentials issued to you, grouped by lifecycle status.">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Source:</span>
        {(["all", "formal", "non_formal"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSrc(s)}
            className={`rounded-full border px-3 py-1 text-xs ${src === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
          >
            {s === "all" ? "All" : s === "formal" ? "Formal" : "Non-formal"}
          </button>
        ))}
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => {
          const items = mine.filter(
            (c) => (t.value === "all" || c.status === t.value) && (src === "all" || c.source === src),
          );
          return (
            <TabsContent key={t.value} value={t.value} className="mt-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.map((c) => (
                  <CredentialCard
                    key={c.id}
                    credential={c}
                    detailHref={`/earner/credentials/${c.id}`}
                    shareHref={c.shareToken ? `/profile/${c.shareToken}` : undefined}
                  />
                ))}
                {items.length === 0 && (
                  <p className="text-sm text-muted-foreground">No credentials in this view.</p>
                )}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </PageShell>
  );
}
