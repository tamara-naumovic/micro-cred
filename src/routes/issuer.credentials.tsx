import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  { key: "in_review", label: "In review", nextLabel: "Advance to evidence collected" },
  { key: "evidence_collected", label: "Evidence collected", nextLabel: "Advance to verified by provider" },
  { key: "verified_by_provider", label: "Verified by provider", nextLabel: "Issue & sign" },
  { key: "issued", label: "Issued (renewed)", nextLabel: null },
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

  if (!activeUser) return null;
  const isStaff = activeUser.subRole === "staff";
  const assignedIds = new Set(
    templateAssignees.filter((a) => a.userId === activeUser.id).map((a) => a.templateId),
  );
  const availableTemplates = templates
    .filter((t) => t.issuerId === activeUser.organizationId)
    .filter((t) => (isStaff ? assignedIds.has(t.id) : true));
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

  const LIFECYCLE_OPTIONS: { value: string; label: string }[] = [
    { value: "issued", label: "Issued" },
    { value: "pending_earner_acceptance", label: "Pending acceptance" },
    { value: "rejected", label: "Rejected" },
    { value: "revoked", label: "Revoked" },
    { value: "expired", label: "Expired" },
    { value: "superseded", label: "Superseded" },
    { value: "draft", label: "Draft" },
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
      toast.success("Credential resent to earner");
      await refresh();
      setEditTarget(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not resend");
    } finally {
      setBusy(false);
    }
  };

  const confirmDiscard = async () => {
    if (!discardTarget) return;
    setBusy(true);
    try {
      await discard({ data: { credentialId: discardTarget.id } });
      toast.success("Rejected credential deleted");
      await refresh();
      setDiscardTarget(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not delete");
    } finally {
      setBusy(false);
    }
  };

  const advanceRenewal = async () => {
    if (!renewTarget) return;
    // Steps 0, 1 are local UI only.
    if (renewStep < 2) {
      setRenewStep(renewStep + 1);
      toast.success(`Moved to ${RENEWAL_STEPS[renewStep + 1].label}`);
      return;
    }
    // Step 2 → finalize: requires new expiry date
    if (!renewExpiry) {
      toast.error("Pick a new expiry date");
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
      toast.success("Credential expiry extended");
      await refresh();
      closeRenew();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not renew");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell
      title="Issued Credentials"
      description="All micro-credentials your organisation has issued."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Input
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-56 pr-8"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={templateFilter} onValueChange={setTemplateFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All templates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All templates</SelectItem>
              {availableTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={lifecycleFilter} onValueChange={setLifecycleFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All lifecycle statuses</SelectItem>
              {LIFECYCLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
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
                <TableHead>ID</TableHead>
                <TableHead>Earner</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Lifecycle</TableHead>
                <TableHead>Blockchain</TableHead>
                <TableHead>Actions</TableHead>
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
                            <span className="text-xs text-destructive">Expired</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Does not expire</span>
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
                              <Pencil className="mr-1 h-3 w-3" /> Edit & resend
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setDiscardTarget(c)}>
                              <Trash2 className="mr-1 h-3 w-3" /> Accept rejection
                            </Button>
                          </>
                        )}
                        {canRenew && (
                          <Button size="sm" variant="outline" onClick={() => openRenew(c)}>
                            <CalendarClock className="mr-1 h-3 w-3" /> Renew expiry
                          </Button>
                        )}
                        {lc !== "rejected" && !canRenew && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {mine.length === 0 && (
                <TableRow><TableCell colSpan={8} className="p-8 text-center text-sm text-muted-foreground">No credentials match.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit & resend credential</DialogTitle>
            <DialogDescription>
              Update grade and/or expiry date and resend to{" "}
              {editTarget && <span className="font-medium text-foreground">{editTarget.earnerName}</span>}{" "}
              for acceptance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="grade">Grade</Label>
              <Input id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. A, Pass" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expiry">Expiry date</Label>
              <Input id="expiry" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={confirmResend} disabled={busy}>Resend to earner</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!discardTarget} onOpenChange={(o) => !o && setDiscardTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept rejection and delete credential</DialogTitle>
            <DialogDescription>
              This permanently deletes the credential for{" "}
              {discardTarget && <span className="font-medium text-foreground">{discardTarget.earnerName}</span>}.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDiscard} disabled={busy}>Delete credential</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renewTarget} onOpenChange={(o) => !o && closeRenew()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renew credential expiry</DialogTitle>
            <DialogDescription>
              {renewTarget && (
                <>
                  Extend expiry of{" "}
                  <span className="font-medium text-foreground">{renewTarget.title}</span> for{" "}
                  <span className="font-medium text-foreground">{renewTarget.earnerName}</span>.
                  No earner acceptance is required — the credential is already issued and anchored.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <ol className="grid gap-2">
            {RENEWAL_STEPS.map((s, i) => {
              const done = i < renewStep;
              const current = i === renewStep;
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
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>

          {renewStep === 2 && (
            <div className="grid gap-2 pt-2">
              <Label htmlFor="renew-expiry">New expiry date</Label>
              <Input
                id="renew-expiry"
                type="date"
                value={renewExpiry}
                onChange={(e) => setRenewExpiry(e.target.value)}
              />
              {renewTarget?.expiresAt && (
                <p className="text-xs text-muted-foreground">
                  Current expiry: {new Date(renewTarget.expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeRenew} disabled={busy}>Cancel</Button>
            <Button onClick={advanceRenewal} disabled={busy}>
              {renewStep === 2 ? (
                <><Send className="mr-2 h-4 w-4" />Issue & sign</>
              ) : (
                <><ArrowRight className="mr-2 h-4 w-4" />{RENEWAL_STEPS[renewStep].nextLabel}</>
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
