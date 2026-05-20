import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, GraduationCap, FileWarning } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { fetchPublicProfile } from "@/lib/credentials";

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

interface PublicCredItem {
  id: string;
  title: string;
  issuer_name: string;
  issued_at: string;
  level: string | null;
  ects: number | null;
  share_token: string;
  status: string;
  skills: string[];
}

function SharedProfile() {
  const { token } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["public-profile", token],
    queryFn: () => fetchPublicProfile(token),
    retry: false,
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 md:px-8">
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading profile…</CardContent></Card>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 md:px-8">
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <FileWarning className="mx-auto h-10 w-10 text-warning-foreground" />
            <h1 className="font-display text-xl font-semibold">Profile not found</h1>
            <p className="text-sm text-muted-foreground">No public profile matches this link.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const credentials: PublicCredItem[] = (data.credentials as PublicCredItem[] | null) ?? [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" /> Back to home</Link>
      </Button>

      <Card>
        <CardContent className="flex flex-wrap items-start gap-4 p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <GraduationCap className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-semibold leading-tight">{data.display_name}</h1>
            {data.country && <div className="mt-1 text-sm text-muted-foreground">{data.country}</div>}
            {data.about && <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{data.about}</p>}
            <p className="mt-3 text-xs text-muted-foreground">
              Showing {credentials.length} public credential(s).
            </p>
          </div>
        </CardContent>
      </Card>

      <h2 className="mt-8 mb-4 font-display text-xl font-semibold">Credentials</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {credentials.map((c) => (
          <Card key={c.id}>
            <CardContent className="space-y-2 p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-base font-semibold leading-tight">{c.title}</h3>
                <StatusBadge status={c.status as never} />
              </div>
              <div className="text-xs text-muted-foreground">
                {c.issuer_name} · {new Date(c.issued_at).toLocaleDateString()}
              </div>
              <div className="flex flex-wrap gap-1">
                {c.level && c.level !== "N/A" && <Badge variant="outline">{c.level}</Badge>}
                {c.ects && <Badge variant="outline">{c.ects} ECTS</Badge>}
                {c.skills?.slice(0, 3).map((s) => (
                  <Badge key={s} variant="secondary">{s}</Badge>
                ))}
              </div>
              <Link
                to="/verify/$id"
                params={{ id: c.share_token }}
                className="inline-block pt-1 text-sm text-primary hover:underline"
              >
                Verify →
              </Link>
            </CardContent>
          </Card>
        ))}
        {credentials.length === 0 && <p className="text-sm text-muted-foreground">No public credentials.</p>}
      </div>
    </main>
  );
}
