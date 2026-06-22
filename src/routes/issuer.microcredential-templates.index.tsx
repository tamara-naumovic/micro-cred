import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { FilePlus2, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("issuer");
  const { activeUser, templates, templateAssignees, archiveTemplate } = useStore();
  const assignedIds = useMemo(
    () => new Set(templateAssignees.filter((a) => a.userId === activeUser?.id).map((a) => a.templateId)),
    [templateAssignees, activeUser?.id],
  );
  if (!activeUser) return null;
  const isStaff = activeUser.subRole === "staff";
  const mine = templates
    .filter((tmpl) => tmpl.issuerId === activeUser.organizationId)
    .filter((tmpl) => (isStaff ? assignedIds.has(tmpl.id) : true));

  return (
    <PageShell
      title={isStaff ? t("templates.index.titleStaff") : t("templates.index.title")}
      description={
        isStaff
          ? t("templates.index.descriptionStaff")
          : t("templates.index.description")
      }
      actions={
        !isStaff && (
          <Button asChild>
            <Link to="/issuer/microcredential-templates/new">
              <FilePlus2 className="mr-2 h-4 w-4" />
              {t("templates.index.createButton")}
            </Link>
          </Button>
        )
      }
    >
      {mine.length === 0 && (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground">
            {isStaff ? t("templates.index.emptyStaff") : t("templates.index.emptyAdmin")}
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {mine.map((tmpl) => (
          <Card key={tmpl.id} className="flex flex-col">
            <CardContent className="flex flex-1 flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="font-display text-lg font-semibold">{tmpl.title}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{tmpl.description}</p>
                </div>
                <StatusBadge status={tmpl.status} />
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Badge variant="outline">
                  {tmpl.source === "formal"
                    ? t("templates.index.card.sourceFormal")
                    : t("templates.index.card.sourceNonFormal")}
                </Badge>
                <Badge variant="outline">{tmpl.level}</Badge>
                {tmpl.ects != null && <Badge variant="outline">{tmpl.ects} ECTS</Badge>}
                <Badge variant="outline">v{tmpl.version}</Badge>
                {tmpl.participation && <Badge variant="outline">{tmpl.participation}</Badge>}
              </div>
              <div className="mt-auto flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link to="/issuer/microcredential-templates/$id" params={{ id: tmpl.id }}>
                    {t("templates.index.card.openButton")}
                  </Link>
                </Button>
                {!isStaff && tmpl.status !== "archived" && (
                  <Button size="sm" variant="ghost" onClick={() => archiveTemplate(tmpl.id)}>
                    {t("templates.index.card.archiveButton")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
