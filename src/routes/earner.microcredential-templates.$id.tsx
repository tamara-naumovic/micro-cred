import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, FileDown } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { TemplateBlockchainProofCard } from "@/components/TemplateBlockchainProofCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

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

export const Route = createFileRoute("/earner/microcredential-templates/$id")({
  head: () => ({ meta: [{ title: "Micro-credential — MicroCred" }] }),
  component: () => (
    <RoleGuard role="earner">
      <Detail />
    </RoleGuard>
  ),
});

function Detail() {
  const { id } = Route.useParams();
  const { activeUser, templates, earnerInstitutions } = useStore();
  const navigate = useNavigate();
  const tpl = templates.find((t) => t.id === id);

  const allowed = useMemo(() => {
    if (!activeUser || !tpl) return false;
    if (tpl.status !== "active") return false;
    const myOrgIds = new Set(
      earnerInstitutions.filter((ei) => ei.earnerId === activeUser.id).map((ei) => ei.organizationId),
    );
    return myOrgIds.has(tpl.issuerId);
  }, [activeUser, tpl, earnerInstitutions]);

  if (!activeUser) return null;

  if (!tpl) {
    return (
      <PageShell title="Micro-credential not found">
        <Button variant="outline" onClick={() => navigate({ to: "/earner/apply" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />Back
        </Button>
      </PageShell>
    );
  }

  if (!allowed) return <Navigate to="/earner/apply" replace />;

  const paths =
    tpl.qaDocumentPaths && tpl.qaDocumentPaths.length > 0
      ? tpl.qaDocumentPaths
      : tpl.qaDocumentPath
        ? [tpl.qaDocumentPath]
        : [];

  return (
    <PageShell
      title={tpl.title}
      description={tpl.description}
      actions={
        <Button variant="outline" asChild>
          <Link to="/earner/apply"><ArrowLeft className="mr-2 h-4 w-4" />Back to apply</Link>
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
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
              <ul className="list-disc space-y-1 pl-5">{tpl.outcomes.map((o) => <li key={o}>{o}</li>)}</ul>
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
    </PageShell>
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
