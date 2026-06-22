import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { startIssuerCredentialsTour } from "@/lib/tour/issuerTour";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CalendarClock, Check, Pencil, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import {
  BLOCKCHAIN_LABEL,
  BLOCKCHAIN_BADGE_CLASS,
  type BlockchainStatus,
} from "@/lib/status-labels";
import { resendCredential, discardRejectedCredential, renewCredential } from "@/lib/chain/anchor.functions";
import type { IssuedCredential } from "@/lib/types";

const RENEWAL_STEPS = [
  { key: "in_review", nextLabel: "Advance to evidence collected" },
  { key: "evidence_collected", nextLabel: "Advance to verified by provider" },
  { key: "verified_by_provider", nextLabel: "Issue & sign" },
  { key: "issued", nextLabel: null },
] as const;

export const Route = createFileRoute("/issuer/credentials")({
  head: () => ({ meta: [{ title: "Issued Credentials — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <List />
    </RoleGuard>
  ),
});

function List() {
  const { t } = useTranslation("issuer");
  const { activeUser, credentials, templateAssignees, templates, refresh } = useStore();
  const [q, setQ] = useState("");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("all");
  const [editTarget, setEditTarget] = useState<IssuedCredential | null>(null);
  const [grade, setGrade] = useState("");
  const [expiry, setExpiry] = useState("");
  const [discardTarget, setDiscardTarget] = useState<IssuedCredential | null>(null);
  const [renewTarget, setRenewTarget] = useState<IssuedCredential | null>(null);
  const [renewStep, setRenewStep] = useState(0);
  const [renewExpiry, setRenewExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const resend = useServerFn(resendCredential);
  const discard = useServerFn(discardRejectedCredential);
  const renew = useServerFn(renewCredential);

  useEffect(() => {
    if (!activeUser || activeUser.role !== "issuer") return;
    const timer = window.setTimeout(() => startIssuerCredentialsTour(activeUser.id), 400);
    return () => window.clearTimeout(timer);
  }, [activeUser]);

  if (!activeUser) return null;
  const isStaff = activeUser.subRole === "staff";
  const assignedIds = new Set(
    templateAssignees.filter((a) => a.userId === activeUser.id).map((a) => a.templateId),
  );
  const availableTemplates = templates
    .filter((tmpl) => tmpl.issuerId === activeUser.organizationId)
    .filter((tmpl) => (isStaff ? assignedIds.has(tmpl.id) : true));
  const mine = credentials
    .filter((c) => c.issuerId === activeUser.organizationId)
    .filter((c) => (isStaff ? (c.templateId ? assignedIds.has(c.templateId) : false) : true))
    .filter((c) => templateFilter === "all" || c.templateId === templateFilter)
    .filter((c) => lifecycleFilter === "all" || (c.lifecycle ?? "issued") === lifecycleFilter)
    .filter((c) =>
      !q ||
      c.title.toLowerCase().includes(q.toLowerCase()) ||
      c.earnerName.toLowerCase().includes(q.toLowerCase()) ||
      c.id.toLowerCase().includes(q.toLowerCase()),
    );

  const LIFECYCLE_OPTIONS: { value: string; labelKey: string }[] = [
    { value: "issued", labelKey: "credentials.filters.lifecycle.issued" },
    { value: "pending_earner_acceptance", labelKey: "credentials.filters.lifecycle.pending_earner_acceptance" },
    { value: "rejected", labelKey: "credentials.filters.lifecycle.rejected" },
    { value: "revoked", labelKey: "credentials.filters.lifecycle.revoked" },
    { value: "expired", labelKey: "credentials.filters.lifecycle.expired" },
    { value: "superseded", labelKey: "credentials.filters.lifecycle.superseded" },
    { value: "draft", labelKey: "credentials.filters.lifecycle.draft" },
  ];

  const openEdit = (c: IssuedCredential) => {
    setEditTarget(c);
    setGrade(c.grade ?? "");
    setExpiry(c.expiresAt ? c.expiresAt.slice(0, 10) : "");
  };

  const openRenew = (c: IssuedCredential) => {
    setRenewTarget(c);
    setRenewStep(0);
    setRenewExpiry(c.expiresAt ? c.expiresAt.slice(0, 10) : "");
  };

  const closeRenew = () => {
    setRenewTarget(null);
    setRenewStep(0);
    setRenewExpiry("");
  };

  const confirmResend = async () => {
    if (!editTarget) return;
    setBusy(true);
    try {
      await resend({
        data: {
          credentialId: editTarget.id,
          grade: grade.trim() || null,
          expiryDate: expiry ? new Date(expiry).toISOString() : null,
        },
      });
      toast.success(t("credentials.toasts.credentialResent"));
      await refresh();
      setEditTarget(null);
    } catch (e: any) {
      toast.error(e?.message ?? t("credentials.toasts.couldNotResend"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDiscard = async () => {
    if (!discardTarget) return;
    setBusy(true);
    try {
      await discard({ data: { credentialId: discardTarget.id } });
      toast.success(t("credentials.toasts.rejectedDeleted"));
      await refresh();
      setDiscardTarget(null);
    } catch (e: any) {
      toast.error(e?.message ?? t("credentials.toasts.couldNotDelete"));
    } finally {
      setBusy(false);
    }
  };

  const advanceRenewal = async () => {
    if (!renewTarget) return;
    if (renewStep < 2) {
      setRenewStep(renewStep + 1);
      const nextStepKey = RENEWAL_STEPS[renewStep + 1].key as string;
      const labelKey = `credentials.dialogs.renew.steps.${nextStepKey}` as const;
      toast.success(t("credentials.toasts.movedTo", { label: t(labelKey) }));
      return;
    }
    if (!renewExpiry) {
      toast.error(t("credentials.toasts.pickExpiryDate"));
      return;
    }
    setBusy(true);
    try {
      await renew({
        data: {
          credentialId: renewTarget.id,
          newExpiryDate: new Date(renewExpiry).toISOString(),
        },
      });
      toast.success(t("credentials.toasts.expiryExtended"));
      await refresh();
      closeRenew();
    } catch (e: any) {
      toast.error(e?.message ?? t("credentials.toasts.couldNotRenew"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell
      title={t("credentials.title")}
      description={t("credentials.description")}
      actions={
        <div className="flex flex-wrap items-center gap-2" data-tour="cred-filters">
          <div className="relative">
            <Input
              placeholder={t("credentials.filters.searchPlaceholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-56 pr-8"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={t("credentials.filters.clearSearch")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={templateFilter} onValueChange={setTemplateFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={t("credentials.filters.allTemplates")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("credentials.filters.allTemplates")}</SelectItem>
              {availableTemplates.map((tmpl) => (
                <SelectItem key={tmpl.id} value={tmpl.id}>
                  {tmpl.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={lifecycleFilter} onValueChange={setLifecycleFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t("credentials.filters.allLifecycle")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("credentials.filters.allLifecycle")}</SelectItem>
              {LIFECYCLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("credentials.table.headers.id")}</TableHead>
                <TableHead>{t("credentials.table.headers.earner")}</TableHead>
                <TableHead>{t("credentials.table.headers.title")}</TableHead>
                <TableHead>{t("credentials.table.headers.issued")}</TableHead>
                <TableHead>{t("credentials.table.headers.expires")}</TableHead>
                <TableHead data-tour="cred-col-lifecycle">{t("credentials.table.headers.lifecycle")}</TableHead>
                <TableHead data-tour="cred-col-blockchain">{t("credentials.table.headers.blockchain")}</TableHead>
                <TableHead data-tour="cred-col-actions">{t("credentials.table.headers.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mine.map((c) => {
                const chainStatus = mapChainStatus(c.blockchain?.chainStatus);
                const lc = c.lifecycle ?? "issued";
                const expiresDate = c.expiresAt ? new Date(c.expiresAt) : null;
                const isExpired = expiresDate ? expiresDate.getTime() < Date.now() : false;
                const canRenew = (lc === "issued" || lc === "expired") && !!c.expiresAt;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.id.slice(0, 8)}…</TableCell>
                    <TableCell>{c.earnerName}</TableCell>
                    <TableCell>{c.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(c.issuedAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm">
                      {expiresDate ? (
                        <div className="flex flex-col">
                          <span className={isExpired ? "text-destructive" : "text-foreground"}>
                            {expiresDate.toLocaleDateString()}
                          </span>
                          {isExpired && (
                            <span className="text-xs text-destructive">{t("credentials.table.expired")}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">{t("credentials.table.doesNotExpire")}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <LifecycleBadge lifecycle={lc} status={c.status} />
                      {lc === "rejected" && c.rejectionReason && (
                        <div className="mt-1 max-w-xs text-xs text-destructive">
                          "{c.rejectionReason}"
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={BLOCKCHAIN_BADGE_CLASS[chainStatus]}>
                        {BLOCKCHAIN_LABEL[chainStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {lc === "rejected" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                              <Pencil className="mr-1 h-3 w-3" /> {t("credentials.lifecycleActions.editResend")}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setDiscardTarget(c)}>
                              <Trash2 className="mr-1 h-3 w-3" /> {t("credentials.lifecycleActions.acceptRejection")}
                            </Button>
                          </>
                        )}
                        {canRenew && (
                          <Button size="sm" variant="outline" onClick={() => openRenew(c)}>
                            <CalendarClock className="mr-1 h-3 w-3" /> {t("credentials.lifecycleActions.renewExpiry")}
                          </Button>
                        )}
                        {lc !== "rejected" && !canRenew && (
                          <span className="text-xs text-muted-foreground">{t("credentials.table.noAction")}</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {mine.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="p-8 text-center text-sm text-muted-foreground">
                    {t("credentials.table.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit & resend dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("credentials.dialogs.edit.title")}</DialogTitle>
            <DialogDescription>
              {t("credentials.dialogs.edit.description", { earnerName: "" })}
              {editTarget && <span className="font-medium text-foreground">{editTarget.earnerName}</span>}
              {" "}{t("credentials.dialogs.edit.description", { earnerName: "." }).slice(-1) === "." ? "" : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="grade">{t("credentials.dialogs.edit.gradeLabel")}</Label>
              <Input id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder={t("credentials.dialogs.edit.gradePlaceholder")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expiry">{t("credentials.dialogs.edit.expiryLabel")}</Label>
              <Input id="expiry" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>{t("credentials.dialogs.edit.cancel")}</Button>
            <Button onClick={confirmResend} disabled={busy}>{t("credentials.dialogs.edit.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard dialog */}
      <Dialog open={!!discardTarget} onOpenChange={(o) => !o && setDiscardTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("credentials.dialogs.discard.title")}</DialogTitle>
            <DialogDescription>
              {t("credentials.dialogs.discard.description", { earnerName: discardTarget?.earnerName ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardTarget(null)}>{t("credentials.dialogs.discard.cancel")}</Button>
            <Button variant="destructive" onClick={confirmDiscard} disabled={busy}>{t("credentials.dialogs.discard.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renew dialog */}
      <Dialog open={!!renewTarget} onOpenChange={(o) => !o && closeRenew()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("credentials.dialogs.renew.title")}</DialogTitle>
            <DialogDescription>
              {renewTarget && (
                <>
                  {t("credentials.dialogs.renew.description", {
                    title: renewTarget.title,
                    earnerName: renewTarget.earnerName,
                  })}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <ol className="grid gap-2">
            {RENEWAL_STEPS.map((s, i) => {
              const done = i < renewStep;
              const current = i === renewStep;
              const stepLabelKey = `credentials.dialogs.renew.steps.${s.key}` as const;
              return (
                <li
                  key={s.key}
                  className={`flex items-center gap-3 rounded-md border p-3 text-sm ${
                    current ? "border-primary bg-primary/5" : done ? "border-muted bg-muted/30" : "border-muted"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      done
                        ? "bg-primary text-primary-foreground"
                        : current
                          ? "border-2 border-primary text-primary"
                          : "border border-muted-foreground/40 text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className={current ? "font-medium" : done ? "text-muted-foreground line-through" : "text-muted-foreground"}>
                    {t(stepLabelKey)}
                  </span>
                </li>
              );
            })}
          </ol>

          {renewStep === 2 && (
            <div className="grid gap-2 pt-2">
              <Label htmlFor="renew-expiry">{t("credentials.dialogs.renew.newExpiryLabel")}</Label>
              <Input
                id="renew-expiry"
                type="date"
                value={renewExpiry}
                onChange={(e) => setRenewExpiry(e.target.value)}
              />
              {renewTarget?.expiresAt && (
                <p className="text-xs text-muted-foreground">
                  {t("credentials.dialogs.renew.currentExpiry", {
                    date: new Date(renewTarget.expiresAt).toLocaleDateString(),
                  })}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeRenew} disabled={busy}>{t("credentials.dialogs.renew.cancel")}</Button>
            <Button onClick={advanceRenewal} disabled={busy}>
              {renewStep === 2 ? (
                <><Send className="mr-2 h-4 w-4" />{t("credentials.dialogs.renew.issueSign")}</>
              ) : (
                <>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  {renewStep === 0
                    ? t("credentials.dialogs.renew.steps.nextAdvanceToEvidence")
                    : t("credentials.dialogs.renew.steps.nextAdvanceToVerified")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function LifecycleBadge({ lifecycle, status }: { lifecycle: string; status: IssuedCredential["status"] }) {
  if (lifecycle === "pending_earner_acceptance") {
    return <StatusBadge status="pending_earner_acceptance" />;
  }
  if (lifecycle === "rejected") {
    return <StatusBadge status="rejected" />;
  }
  return <StatusBadge status={status} />;
}

function mapChainStatus(s: string | null | undefined): BlockchainStatus {
  switch (s) {
    case "queued":
    case "submitting":
    case "submitted":
    case "confirmed":
    case "failed":
    case "cancelled":
      return s;
    case "pending":
      return "queued";
    case "disabled":
      return "not_requested";
    default:
      return "not_requested";
  }
}
