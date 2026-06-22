import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Search, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { LifecycleTimeline } from "@/components/LifecycleTimeline";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { LIFECYCLE_STAGES, type RequestStatus } from "@/lib/types";

export const Route = createFileRoute("/issuer/requests")({
  head: () => ({ meta: [{ title: "Issuance Requests — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <Queue />
    </RoleGuard>
  ),
});

function nextLabel(status: RequestStatus): string | null {
  const idx = LIFECYCLE_STAGES.indexOf(status);
  if (idx < 0 || idx >= LIFECYCLE_STAGES.length - 1) return null;
  return LIFECYCLE_STAGES[idx + 1].replace(/_/g, " ");
}

function Queue() {
  const { t } = useTranslation("issuer");
  const {
    activeUser,
    applications,
    templates,
    templateAssignees,
    users,
    advanceApplicationStatus,
    rejectApplication,
  } = useStore();
  const [issueDialog, setIssueDialog] = useState<{
    appId: string;
    templateTitle: string;
    earnerName: string;
    defaultExpiry?: string;
  } | null>(null);
  const [grade, setGrade] = useState("");
  const [expiry, setExpiry] = useState("");
  const [earnerQuery, setEarnerQuery] = useState("");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  if (!activeUser) return null;
  const isStaff = activeUser.subRole === "staff";
  const assignedIds = new Set(
    templateAssignees.filter((a) => a.userId === activeUser.id).map((a) => a.templateId),
  );
  const baseQueue = applications
    .filter((a) => a.issuerId === activeUser.organizationId && a.status !== "issued" && a.status !== "rejected")
    .filter((a) => (isStaff ? assignedIds.has(a.templateId) : true));

  const templateOptions = useMemo(() => {
    const map = new Map<string, string>();
    baseQueue.forEach((a) => map.set(a.templateId, a.templateTitle));
    return Array.from(map, ([id, title]) => ({ id, title })).sort((a, b) =>
      a.title.localeCompare(b.title),
    );
  }, [baseQueue]);

  const statusOptions = useMemo(() => {
    const present = new Set(baseQueue.map((a) => a.status));
    return LIFECYCLE_STAGES.filter((s) => s !== "issued" && present.has(s));
  }, [baseQueue]);

  const q = earnerQuery.trim().toLowerCase();
  const queue = baseQueue.filter((a) => {
    if (q && !a.earnerName.toLowerCase().includes(q)) return false;
    if (templateFilter !== "all" && a.templateId !== templateFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  const filtersActive =
    q.length > 0 || templateFilter !== "all" || statusFilter !== "all";
  const clearFilters = () => {
    setEarnerQuery("");
    setTemplateFilter("all");
    setStatusFilter("all");
  };

  const openIssueDialog = (a: typeof queue[number]) => {
    const tpl = templates.find((t) => t.id === a.templateId);
    const defaultExpiry =
      tpl?.expiryMode === "fixed_date" ? tpl.expiryDate?.slice(0, 10) : undefined;
    setGrade("");
    setExpiry(defaultExpiry ?? "");
    setIssueDialog({
      appId: a.id,
      templateTitle: a.templateTitle,
      earnerName: a.earnerName,
      defaultExpiry,
    });
  };

  const confirmIssue = () => {
    if (!issueDialog) return;
    const u = advanceApplicationStatus(issueDialog.appId, {
      grade: grade.trim() || undefined,
      expiryDate: expiry ? new Date(expiry).toISOString() : undefined,
    });
    if (u) toast.success(t("requests.toasts.sentToEarner"));
    setIssueDialog(null);
  };

  return (
    <PageShell
      title={t("requests.title")}
      description={t("requests.description")}
    >
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px_220px_auto] md:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="earner-search" className="text-xs">
              {t("requests.filters.earnerLabel")}
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="earner-search"
                placeholder={t("requests.filters.earnerPlaceholder")}
                className="pl-8"
                value={earnerQuery}
                onChange={(e) => setEarnerQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">{t("requests.filters.templateLabel")}</Label>
            <Select value={templateFilter} onValueChange={setTemplateFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("requests.filters.allTemplates")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("requests.filters.allTemplates")}</SelectItem>
                {templateOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">{t("requests.filters.statusLabel")}</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("requests.filters.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("requests.filters.allStatuses")}</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {t("requests.filters.clearFilters")}
            </Button>
          )}
        </CardContent>
      </Card>

      {filtersActive && (
        <p className="text-xs text-muted-foreground">
          {t("requests.filters.showing", { count: queue.length, total: baseQueue.length })}
        </p>
      )}

      {queue.length === 0 && (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground">
            {filtersActive
              ? t("requests.empty.noMatch")
              : t("requests.empty.noActive")}
          </CardContent>
        </Card>
      )}
      <div className="space-y-4">
        {queue.map((a) => {
          const next = nextLabel(a.status);
          const isFinal = a.status === "verified_by_provider";
          const earner = users.find((u) => u.id === a.earnerId);
          const earnerToken = earner?.shareToken;
          return (
            <Card key={a.id}>
              <CardContent className="grid gap-4 p-5 md:grid-cols-3">
                <div className="md:col-span-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-semibold">{a.templateTitle}</span>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {t("requests.card.earner")}{" "}
                    {earnerToken ? (
                      <Link
                        to="/profile/$token"
                        params={{ token: earnerToken }}
                        className="text-foreground underline-offset-4 hover:underline"
                        title={t("requests.card.viewProfile")}
                      >
                        {a.earnerName}
                      </Link>
                    ) : (
                      <span className="text-foreground">{a.earnerName}</span>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {next && (
                      <Button
                        size="sm"
                        onClick={() => {
                          if (isFinal) {
                            openIssueDialog(a);
                            return;
                          }
                          const u = advanceApplicationStatus(a.id);
                          if (u) toast.success(t("requests.toasts.movedTo", { next }));
                        }}
                      >
                        {isFinal ? (
                          <>
                            <Send className="mr-2 h-4 w-4" />{t("requests.actions.issueSign")}
                          </>
                        ) : (
                          <>
                            <ArrowRight className="mr-2 h-4 w-4" />{t("requests.actions.advanceTo", { next })}
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        rejectApplication(a.id, "Rejected by issuer");
                        toast.info(t("requests.toasts.rejected"));
                      }}
                    >
                      <XCircle className="mr-2 h-4 w-4" />{t("requests.actions.reject")}
                    </Button>
                  </div>
                </div>
                <div>
                  <LifecycleTimeline events={a.timeline.slice(-4)} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!issueDialog} onOpenChange={(o) => !o && setIssueDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("requests.dialogs.issue.title")}</DialogTitle>
            <DialogDescription>
              {issueDialog ? (
                <>
                  {t("requests.dialogs.issue.description", {
                    templateTitle: "",
                    earnerName: "",
                  }).split("")[0]}
                  {/* Render with embedded spans */}
                  {"Finalize "}
                  <span className="font-medium text-foreground">{issueDialog.templateTitle}</span>{" "}
                  {"for "}
                  <span className="font-medium text-foreground">{issueDialog.earnerName}</span>.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="grade">{t("requests.dialogs.issue.gradeLabel")}</Label>
              <Input
                id="grade"
                placeholder={t("requests.dialogs.issue.gradePlaceholder")}
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expiry">{t("requests.dialogs.issue.expiryLabel")}</Label>
              <Input
                id="expiry"
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
              {issueDialog?.defaultExpiry && (
                <p className="text-xs text-muted-foreground">
                  {t("requests.dialogs.issue.templateDefault", { date: issueDialog.defaultExpiry })}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialog(null)}>
              {t("requests.dialogs.issue.cancel")}
            </Button>
            <Button onClick={confirmIssue}>
              <Send className="mr-2 h-4 w-4" />{t("requests.dialogs.issue.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
