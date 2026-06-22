import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, BadgeCheck, ExternalLink, FileText, Globe2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import type { MicroCredentialTemplate } from "@/lib/types";

export const Route = createFileRoute("/issuers/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Issuer profile — MicroCred` },
      { name: "description", content: `Public issuer profile ${params.id}` },
    ],
  }),
  component: IssuerProfile,
});

function IssuerProfile() {
  const { id } = Route.useParams();
  const { organizations, templates, credentials } = useStore();
  const issuer = organizations.find((o) => o.id === id && o.type === "issuer");
  if (!issuer) throw notFound();
  const tpls = templates.filter((t) => t.issuerId === id && t.status !== "archived");
  const formal = tpls.filter((t) => t.source === "formal");
  const nonFormal = tpls.filter((t) => t.source === "non_formal");
  const issuedCount = credentials.filter((c) => c.issuerId === id).length;
  const registeredYear = issuer.registeredAt
    ? new Date(issuer.registeredAt).getFullYear()
    : null;

  const websiteHref = issuer.website
    ? issuer.website.startsWith("http")
      ? issuer.website
      : `https://${issuer.website}`
    : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/issuers">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to directory
        </Link>
      </Button>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BadgeCheck className="h-7 w-7" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-semibold leading-tight">{issuer.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Globe2 className="h-3.5 w-3.5" /> {issuer.country}
                  </span>
                  {registeredYear && <span>Registered since {registeredYear}</span>}
                  {websiteHref && (
                    <a
                      href={websiteHref}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Website <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{tpls.length} active templates</Badge>
              <Badge variant="secondary">{issuedCount} credentials issued</Badge>
            </div>
          </div>

          {issuer.about && (
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{issuer.about}</p>
          )}

          {issuer.accreditations && issuer.accreditations.length > 0 && (
            <div className="mt-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Accreditations</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {issuer.accreditations.map((a) => (
                  <Badge key={a} variant="outline">{a}</Badge>
                ))}
              </div>
            </div>
          )}

          {issuer.accreditationDocumentUrl && (
            <div className="mt-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Accreditation document
              </div>
              <div className="mt-2">
                <AccreditationDocLink path={issuer.accreditationDocumentUrl} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <TemplateSection title="Formal credentials" items={formal} issuerId={id} />
      <TemplateSection title="Non-formal credentials" items={nonFormal} issuerId={id} />

      {tpls.length === 0 && (
        <p className="mt-10 text-sm text-muted-foreground">No active templates.</p>
      )}
    </main>
  );
}

function TemplateSection({
  title,
  items,
  issuerId,
}: {
  title: string;
  items: MicroCredentialTemplate[];
  issuerId: string;
}) {
  if (items.length === 0) return null;
  return (
    <>
      <h2 className="mt-10 mb-4 font-display text-xl font-semibold">{title}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((t) => (
          <Link
            key={t.id}
            to="/issuers/$id_/microcredential-templates/$templateId"
            params={{ id: issuerId, templateId: t.id }}
            className="block transition hover:-translate-y-0.5"
          >
            <Card className="h-full hover:border-primary/40 hover:shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="line-clamp-3 text-muted-foreground">{t.description}</p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="capitalize">
                    {t.source === "formal" ? "Formal" : "Non-formal"}
                  </Badge>
                  {t.level !== "N/A" && <Badge variant="outline">{t.level}</Badge>}
                  {t.ects && <Badge variant="outline">{t.ects} ECTS</Badge>}
                  <Badge variant="outline" className="capitalize">
                    {t.participation.replace(/_/g, " ")}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}


function AccreditationDocLink({ path }: { path: string }) {
  const [loading, setLoading] = useState(false);

  const open = async () => {
    // If it's already a full URL, just open it
    if (/^https?:\/\//i.test(path)) {
      window.open(path, "_blank", "noreferrer");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .storage
        .from("accreditation-docs")
        .createSignedUrl(path, 60 * 60);
      if (error || !data?.signedUrl) {
        console.error("[accreditation doc]", error);
        return;
      }
      window.open(data.signedUrl, "_blank", "noreferrer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={open} disabled={loading}>
      <FileText className="mr-1 h-3.5 w-3.5" />
      {loading ? "Opening…" : "View document"}
    </Button>
  );
}
