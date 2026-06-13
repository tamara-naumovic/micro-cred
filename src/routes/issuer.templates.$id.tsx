import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { EbsiPlaceholderCard } from "@/components/EbsiPlaceholderCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/issuer/templates/$id")({
  head: () => ({ meta: [{ title: "Micro-credential — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <Detail />
    </RoleGuard>
  ),
});

function Detail() {
  const { id } = Route.useParams();
  const { activeUser, templates, templateAssignees, users, assignTemplateUsers } = useStore();
  const navigate = useNavigate();
  const tpl = templates.find((t) => t.id === id);
  const isStaff = activeUser?.subRole === "staff";
  const assignedToMe = useMemo(
    () => templateAssignees.some((a) => a.templateId === id && a.userId === activeUser?.id),
    [templateAssignees, id, activeUser?.id],
  );

  if (!activeUser) return null;
  // Staff may only open templates assigned to them
  if (isStaff && tpl && !assignedToMe) return <Navigate to="/issuer/templates" />;

  if (!tpl) {
    return (
      <PageShell title="Micro-credential not found">
        <Button variant="outline" onClick={() => navigate({ to: "/issuer/templates" })}>
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
        <>
          <Button variant="outline" asChild>
            <Link to="/issuer/templates"><ArrowLeft className="mr-2 h-4 w-4" />All micro-credentials</Link>
          </Button>
          <Button asChild>
            <Link to="/issuer/issue"><Send className="mr-2 h-4 w-4" />Issue this micro-credential</Link>
          </Button>
        </>
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
            <Field label="Quality assurance">{tpl.qualityAssurance}</Field>
            <Field label="Prerequisites">{tpl.prerequisites}</Field>
            <Field label="Supervision">{tpl.supervision}</Field>
            <Field label="Stackability">{tpl.stackability}</Field>
            {tpl.expiryRule && <Field label="Expiry">{tpl.expiryRule}</Field>}
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

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

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
        {staffUsers.map((u) => (
          <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted">
            <Checkbox checked={selected.includes(u.id)} onCheckedChange={() => toggle(u.id)} />
            <div className="min-w-0">
              <div className="truncate font-medium">{u.name}</div>
              <div className="text-xs text-muted-foreground">{u.email}</div>
            </div>
          </label>
        ))}
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
