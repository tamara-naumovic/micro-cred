import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Send } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { EbsiPlaceholderCard } from "@/components/EbsiPlaceholderCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/issuer/templates/$id")({
  head: () => ({ meta: [{ title: "Template — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <Detail />
    </RoleGuard>
  ),
});

function Detail() {
  const { id } = Route.useParams();
  const { templates } = useStore();
  const navigate = useNavigate();
  const tpl = templates.find((t) => t.id === id);

  if (!tpl) {
    return (
      <PageShell title="Template not found">
        <Button variant="outline" onClick={() => navigate({ to: "/issuer/templates" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />Back to templates
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
            <Link to="/issuer/templates"><ArrowLeft className="mr-2 h-4 w-4" />All templates</Link>
          </Button>
          <Button asChild>
            <Link to="/issuer/issue"><Send className="mr-2 h-4 w-4" />Issue with this template</Link>
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
          <EbsiPlaceholderCard compact />
        </div>
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
