import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, Users, FileDown } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { EbsiPlaceholderCard } from "@/components/EbsiPlaceholderCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StaffPicker } from "@/components/StaffPicker";
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

export const Route = createFileRoute("/issuer/microcredential-templates/$id")({
  head: () => ({ meta: [{ title: "Micro-credential — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <Detail />
    </RoleGuard>
  ),
});

function Detail() {
  const { id } = Route.useParams();
  const { activeUser, templates, templateAssignees } = useStore();
  const navigate = useNavigate();
  const tpl = templates.find((t) => t.id === id);
  const isStaff = activeUser?.subRole === "staff";
  const assignedToMe = useMemo(
    () => templateAssignees.some((a) => a.templateId === id && a.userId === activeUser?.id),
    [templateAssignees, id, activeUser?.id],
  );

  if (!activeUser) return null;
  // Staff may only open templates assigned to them
  if (isStaff && tpl && !assignedToMe) return <Navigate to="/issuer/microcredential-templates" />;

  if (!tpl) {
    return (
      <PageShell title="Micro-credential not found">
        <Button variant="outline" onClick={() => navigate({ to: "/issuer/microcredential-templates" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />Back
        </Button>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={tpl.title}
      description={tpl.description}
      actions={
        <Button variant="outline" asChild>
          <Link to="/issuer/microcredential-templates"><ArrowLeft className="mr-2 h-4 w-4" />All micro-credentials</Link>
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
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Specification</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <Field label="Learning outcomes">
              <ul className="list-disc space-y-1 pl-5">{tpl.outcomes.map((o) => <li key={o}>{o}</li>)}</ul>
            </Field>
            <Field label="Skills">{tpl.skills.join(", ")}</Field>
            <Field label="Assessment">{tpl.assessment}</Field>
            <Field label="Quality assurance">
              <div className="space-y-1">
                <div>{QA_LABEL[tpl.qaType] ?? tpl.qualityAssurance}</div>
                {tpl.qaDocumentPath && (
                  <Button size="sm" variant="outline" onClick={() => openQaDocument(tpl.qaDocumentPath!)}>
                    <FileDown className="mr-2 h-4 w-4" />Open QA document
                  </Button>
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
        <div className="space-y-4">
          <AssigneesCard
            templateId={tpl.id}
            isStaff={!!isStaff}
            orgId={activeUser.organizationId}
          />
          <EbsiPlaceholderCard compact />
        </div>
      </div>
    </PageShell>
  );
}

function AssigneesCard({
  templateId,
  isStaff,
  orgId,
}: {
  templateId: string;
  isStaff: boolean;
  orgId?: string;
}) {
  const { users, templateAssignees, assignTemplateUsers } = useStore();
  const staffUsers = useMemo(
    () =>
      users.filter(
        (u) => u.role === "issuer" && u.subRole === "staff" && u.organizationId === orgId,
      ),
    [users, orgId],
  );
  const currentIds = useMemo(
    () =>
      templateAssignees.filter((a) => a.templateId === templateId).map((a) => a.userId),
    [templateAssignees, templateId],
  );
  const [selected, setSelected] = useState<string[]>(currentIds);
  useEffect(() => setSelected(currentIds), [currentIds.join(",")]);
  const [busy, setBusy] = useState(false);
  const dirty =
    selected.length !== currentIds.length ||
    selected.some((id) => !currentIds.includes(id));

  if (isStaff) {
    const names = staffUsers.filter((u) => currentIds.includes(u.id)).map((u) => u.name);
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Assigned staff</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {names.length === 0 ? (
            <p className="text-muted-foreground">No staff currently assigned.</p>
          ) : (
            <ul className="space-y-1">{names.map((n) => <li key={n}>{n}</li>)}</ul>
          )}
        </CardContent>
      </Card>
    );
  }

  const save = async () => {
    setBusy(true);
    try {
      await assignTemplateUsers(templateId, selected);
      toast.success("Assignments updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Assigned staff</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {staffUsers.length === 0 && (
          <p className="text-muted-foreground">
            No staff yet. <Link to="/issuer/staff" className="text-primary underline">Add staff</Link>.
          </p>
        )}
        {staffUsers.length > 0 && (
          <StaffPicker
            staff={staffUsers}
            selected={selected}
            onChange={setSelected}
            placeholder="Search staff by name or email"
          />
        )}
        {staffUsers.length > 0 && (
          <Button size="sm" disabled={!dirty || busy} onClick={save}>Save assignments</Button>
        )}
      </CardContent>
    </Card>
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
