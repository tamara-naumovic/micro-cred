import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FilePlus2, BookOpen, Search, X, Check, ChevronsUpDown, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { MicroCredentialTemplate } from "@/lib/types";

export const Route = createFileRoute("/issuer/microcredential-templates/")({
  head: () => ({ meta: [{ title: "Micro-credentials — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <List />
    </RoleGuard>
  ),
});

const LEVELS = ["Foundation", "Intermediate", "Advanced", "Expert", "N/A"] as const;

function List() {
  const { t } = useTranslation("issuer");
  const { t: tc } = useTranslation("common");
  const { activeUser, templates, templateAssignees, users, archiveTemplate } = useStore();

  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"formal" | "non_formal">("formal");

  const assignedIds = useMemo(
    () => new Set(templateAssignees.filter((a) => a.userId === activeUser?.id).map((a) => a.templateId)),
    [templateAssignees, activeUser?.id],
  );

  if (!activeUser) return null;
  const isStaff = activeUser.subRole === "staff";

  const orgStaff = useMemo(
    () =>
      users.filter(
        (u) => u.organizationId === activeUser.organizationId && u.subRole === "staff",
      ),
    [users, activeUser.organizationId],
  );

  const mine = useMemo(
    () =>
      templates
        .filter((tmpl) => tmpl.issuerId === activeUser.organizationId)
        .filter((tmpl) => (isStaff ? assignedIds.has(tmpl.id) : true)),
    [templates, activeUser.organizationId, isStaff, assignedIds],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mine.filter((tmpl) => {
      if (q && !tmpl.title.toLowerCase().includes(q)) return false;
      if (levelFilter !== "all" && tmpl.level !== levelFilter) return false;
      if (!isStaff && staffFilter !== "all") {
        const tmplAssignees = templateAssignees.filter((a) => a.templateId === tmpl.id);
        if (staffFilter === "__unassigned__") {
          if (tmplAssignees.length > 0) return false;
        } else if (!tmplAssignees.some((a) => a.userId === staffFilter)) {
          return false;
        }
      }
      return true;
    });
  }, [mine, search, levelFilter, staffFilter, isStaff, templateAssignees]);

  const formal = filtered.filter((t) => t.source === "formal");
  const nonFormal = filtered.filter((t) => t.source === "non_formal");

  const filtersActive =
    search.trim() !== "" || levelFilter !== "all" || staffFilter !== "all";
  const resetFilters = () => {
    setSearch("");
    setLevelFilter("all");
    setStaffFilter("all");
  };

  const renderGrid = (list: MicroCredentialTemplate[]) => {
    if (mine.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground">
            {isStaff ? t("templates.index.emptyStaff") : t("templates.index.emptyAdmin")}
          </CardContent>
        </Card>
      );
    }
    if (list.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground">
            {t("templates.index.filters.emptyFiltered")}
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((tmpl) => (
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
                <Badge variant="outline">
                  {tc(`templateLevel.${tmpl.level}`, { defaultValue: tmpl.level })}
                </Badge>
                {tmpl.ects != null && <Badge variant="outline">{tmpl.ects} ECTS</Badge>}
                <Badge variant="outline">v{tmpl.version}</Badge>
                {tmpl.participation && (
                  <Badge variant="outline">
                    {tc(`templateParticipation.${tmpl.participation}`, {
                      defaultValue: tmpl.participation,
                    })}
                  </Badge>
                )}
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
    );
  };

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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap">
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("templates.index.filters.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="md:w-48">
            <SelectValue placeholder={t("templates.index.filters.levelLabel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("templates.index.filters.levelAll")}</SelectItem>
            {LEVELS.map((lvl) => (
              <SelectItem key={lvl} value={lvl}>
                {tc(`templateLevel.${lvl}`, { defaultValue: lvl })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isStaff && (
          <Select value={staffFilter} onValueChange={setStaffFilter}>
            <SelectTrigger className="md:w-56">
              <SelectValue placeholder={t("templates.index.filters.staffLabel")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("templates.index.filters.staffAll")}</SelectItem>
              <SelectItem value="__unassigned__">
                {t("templates.index.filters.staffUnassigned")}
              </SelectItem>
              {orgStaff.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name || u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <X className="mr-1 h-4 w-4" />
            {t("templates.index.filters.resetButton")}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "formal" | "non_formal")}>
        <TabsList>
          <TabsTrigger value="formal">
            {t("templates.index.filters.tabFormal")} ({formal.length})
          </TabsTrigger>
          <TabsTrigger value="non_formal">
            {t("templates.index.filters.tabNonFormal")} ({nonFormal.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="formal" className="mt-4">
          {renderGrid(formal)}
        </TabsContent>
        <TabsContent value="non_formal" className="mt-4">
          {renderGrid(nonFormal)}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
