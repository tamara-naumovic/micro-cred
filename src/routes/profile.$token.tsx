import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, GraduationCap, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CredentialCard } from "@/components/CredentialCard";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/profile/$token")({
  head: () => ({
    meta: [
      { title: "Shared earner profile — MicroCred" },
      { name: "description", content: "Publicly shared earner profile." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharedProfile,
});

function SharedProfile() {
  const { token } = Route.useParams();
  const { credentials, users } = useStore();

  // resolve token: any credential whose shareToken matches → use that earnerId
  const sample = credentials.find((c) => c.shareToken === token);
  if (!sample) throw notFound();
  const earner = users.find((u) => u.id === sample.earnerId);
  if (!earner) throw notFound();

  const visible = credentials.filter(
    (c) => c.earnerId === earner.id && c.sharing.isPublic && c.status !== "revoked",
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to home
        </Link>
      </Button>

      <Card>
        <CardContent className="flex flex-wrap items-start gap-4 p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <GraduationCap className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-semibold leading-tight">{earner.name}</h1>
            {earner.organization && (
              <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {earner.organization}
              </div>
            )}
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              Public credential profile shared by {earner.name}. Showing {visible.length} credential(s)
              with the visibility settings the earner enabled.
            </p>
          </div>
        </CardContent>
      </Card>

      <h2 className="mt-8 mb-4 font-display text-xl font-semibold">Credentials</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((c) => (
          <CredentialCard key={c.id} credential={c} detailHref={c.verificationLink} />
        ))}
        {visible.length === 0 && <p className="text-sm text-muted-foreground">No public credentials.</p>}
      </div>
    </main>
  );
}
