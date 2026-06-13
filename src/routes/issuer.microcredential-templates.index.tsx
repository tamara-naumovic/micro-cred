import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { FilePlus2, BookOpen } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/issuer/microcredential-templates/")({
  head: () => ({ meta: [{ title: "Micro-credentials — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <List />
    </RoleGuard>
  ),
});

function List() {
  const { activeUser, templates, templateAssignees, archiveTemplate } = useStore();
  const assignedIds = useMemo(
    () => new Set(templateAssignees.filter((a) => a.userId === activeUser?.id).map((a) => a.templateId)),
    [templateAssignees, activeUser?.id],
  );
  if (!activeUser) return null;
  const isStaff = activeUser.subRole === "staff";
  const mine = templates
    .filter((t) => t.issuerId === activeUser.organizationId)
    .filter((t) => (isStaff ? assignedIds.has(t.id) : true));

  return (
    <PageShell
      title={isStaff ? "My Micro-credentials" : "Micro-credentials"}
      description={
        isStaff
          ? "Micro-credentials assigned to you for issuance."
          : "Define what credentials your institution can issue and assign them to staff."
      }
      actions={
        !isStaff && (
          <Button asChild>
            <Link to="/issuer/templates/new"><FilePlus2 className="mr-2 h-4 w-4" />Create micro-credential</Link>
          </Button>
        )
      }
    >
      {mine.length === 0 && (
        <Card><CardContent className="p-8 text-sm text-muted-foreground">
          {isStaff ? "No micro-credentials are assigned to you yet." : "No micro-credentials yet for your institution."}
        </CardContent></Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {mine.map((t) => (
          <Card key={t.id} className="flex flex-col">
            <CardContent className="flex flex-1 flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="font-display text-lg font-semibold">{t.title}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                </div>
                <StatusBadge status={t.status} />
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Badge variant="outline">{t.source === "formal" ? "Formal" : "Non-formal"}</Badge>
                <Badge variant="outline">{t.level}</Badge>
                {t.ects != null && <Badge variant="outline">{t.ects} ECTS</Badge>}
                <Badge variant="outline">v{t.version}</Badge>
                {t.participation && <Badge variant="outline">{t.participation}</Badge>}
              </div>
              <div className="mt-auto flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link to="/issuer/templates/$id" params={{ id: t.id }}>Open</Link>
                </Button>
                {!isStaff && t.status !== "archived" && (
                  <Button size="sm" variant="ghost" onClick={() => archiveTemplate(t.id)}>Archive</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
