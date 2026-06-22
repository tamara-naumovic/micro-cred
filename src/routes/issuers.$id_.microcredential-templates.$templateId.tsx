import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { TemplateBlockchainProofCard } from "@/components/TemplateBlockchainProofCard";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";

const QA_LABEL: Record<string, string> = {
  internal: "Internal",
  external: "External",
  internal_and_external: "Internal and external",
  other: "Other",
  not_specified: "Not specified",
};
const SUPERVISION_LABEL: Record<string, string> = {
  unsupervised_no_id: "Unsupervised with no identity verification",
  supervised_no_id: "Supervised with no identity verification",
  supervised_online_with_id: "Supervised online with identity verification",
  supervised_onsite_with_id: "Supervised onsite with identity verification",
};
const STACKABILITY_LABEL: Record<string, string> = {
  stand_alone: "Stand-alone",
  independent_integrated: "Independent micro-credential / integrated",
  stackable: "Stackable towards another credential",
};

async function openQaDocument(path: string) {
  const { data, error } = await supabase.storage
    .from("qa-documents")
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    toast.error(error?.message ?? "Could not open document");
    return;
  }
  window.open(data.signedUrl, "_blank");
}

export const Route = createFileRoute("/issuers/$id_/microcredential-templates/$templateId")({
  head: () => ({ meta: [{ title: "Micro-credential — MicroCred" }] }),
  component: PublicTemplateDetail,
});

function PublicTemplateDetail() {
  const params = Route.useParams() as { id?: string; id_?: string; templateId: string };
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const pathIssuerId = pathname.match(/^\/issuers\/([^/]+)\/microcredential-templates\//)?.[1];
  const id = params.id ?? params.id_ ?? pathIssuerId;
  const { templateId } = params;
  const { organizations, templates, loading } = useStore();
  const issuer = organizations.find((o) => o.id === id && o.type === "issuer");
  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <p className="text-sm text-muted-foreground">Loading micro-credential…</p>
      </main>
    );
  }
  if (!issuer || !id) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/issuers">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to issuers
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Issuer not found.</p>
      </main>
    );
  }
  const tpl = templates.find((t) => t.id === templateId);

  if (!tpl || tpl.issuerId !== id || tpl.status === "archived") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/issuers/$id" params={{ id }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to issuer
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Micro-credential not found.</p>
      </main>
    );
  }

  const paths =
    tpl.qaDocumentPaths && tpl.qaDocumentPaths.length > 0
      ? tpl.qaDocumentPaths
      : tpl.qaDocumentPath
        ? [tpl.qaDocumentPath]
        : [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/issuers/$id" params={{ id }}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to {issuer.name}
        </Link>
      </Button>

      <div className="mb-4">
        <h1 className="font-display text-2xl font-semibold leading-tight">{tpl.title}</h1>
        {tpl.description && (
          <p className="mt-2 text-sm text-muted-foreground">{tpl.description}</p>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <StatusBadge status={tpl.status} />
        <Badge variant="outline">v{tpl.version}</Badge>
        <Badge variant="outline">{tpl.source === "formal" ? "Formal" : "Non-formal"}</Badge>
        <Badge variant="outline">{tpl.level}</Badge>
        {tpl.ects != null && <Badge variant="outline">{tpl.ects} ECTS</Badge>}
        <Badge variant="outline">{tpl.participation}</Badge>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Specification</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <Field label="Learning outcomes">
              <ul className="list-disc space-y-1 pl-5">
                {tpl.outcomes.map((o) => <li key={o}>{o}</li>)}
              </ul>
            </Field>
            <Field label="Skills">{tpl.skills.join(", ")}</Field>
            <Field label="Assessment">{tpl.assessment}</Field>
            <Field label="Quality assurance">
              <div className="space-y-2">
                <div>{QA_LABEL[tpl.qaType] ?? tpl.qualityAssurance}</div>
                {paths.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No documents uploaded.</p>
                ) : (
                  paths.map((p) => (
                    <div key={p}>
                      <Button size="sm" variant="outline" onClick={() => openQaDocument(p)}>
                        <FileDown className="mr-2 h-4 w-4" />{p.split("/").pop()}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Field>
            <Field label="Prerequisites">
              {tpl.prerequisitesNone ? "No prerequisites" : (tpl.prerequisites || "—")}
            </Field>
            <Field label="Supervision and identity verification">
              {tpl.supervisionType ? SUPERVISION_LABEL[tpl.supervisionType] : "—"}
            </Field>
            <Field label="Integration / Stackability">
              {tpl.stackabilityType ? STACKABILITY_LABEL[tpl.stackabilityType] : "—"}
            </Field>
            <Field label="Expiry">
              {tpl.expiryMode === "fixed_date" && tpl.expiryDate
                ? `Expires on ${new Date(tpl.expiryDate).toLocaleDateString()}`
                : "Does not expire"}
            </Field>
          </CardContent>
        </Card>
        <TemplateBlockchainProofCard templateId={tpl.id} canManage={false} />
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
