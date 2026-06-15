import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Trash2 } from "lucide-react";
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
import { resendCredential, discardRejectedCredential } from "@/lib/chain/anchor.functions";
import type { IssuedCredential } from "@/lib/types";

export const Route = createFileRoute("/issuer/credentials")({
  head: () => ({ meta: [{ title: "Issued Credentials — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <List />
    </RoleGuard>
  ),
});

function List() {
  const { activeUser, credentials, templateAssignees } = useStore();
  const [q, setQ] = useState("");
  const [editTarget, setEditTarget] = useState<IssuedCredential | null>(null);
  const [grade, setGrade] = useState("");
  const [expiry, setExpiry] = useState("");
  const [discardTarget, setDiscardTarget] = useState<IssuedCredential | null>(null);
  const [busy, setBusy] = useState(false);
  const resend = useServerFn(resendCredential);
  const discard = useServerFn(discardRejectedCredential);

  if (!activeUser) return null;
  const isStaff = activeUser.subRole === "staff";
  const assignedIds = new Set(
    templateAssignees.filter((a) => a.userId === activeUser.id).map((a) => a.templateId),
  );
  const mine = credentials
    .filter((c) => c.issuerId === activeUser.organizationId)
    .filter((c) => (isStaff ? (c.templateId ? assignedIds.has(c.templateId) : false) : true))
    .filter((c) =>
      !q ||
      c.title.toLowerCase().includes(q.toLowerCase()) ||
      c.earnerName.toLowerCase().includes(q.toLowerCase()) ||
      c.id.toLowerCase().includes(q.toLowerCase()),
    );

  const openEdit = (c: IssuedCredential) => {
    setEditTarget(c);
    setGrade(c.grade ?? "");
    setExpiry(c.expiresAt ? c.expiresAt.slice(0, 10) : "");
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
      setDiscardTarget(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not delete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell
      title="Issued Credentials"
      description="All micro-credentials your organisation has issued."
      actions={<Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />}
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
                <TableHead>Lifecycle</TableHead>
                <TableHead>Blockchain</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mine.map((c) => {
                const chainStatus = mapChainStatus(c.blockchain?.chainStatus);
                const lc = c.lifecycle ?? "issued";
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.id.slice(0, 8)}…</TableCell>
                    <TableCell>{c.earnerName}</TableCell>
                    <TableCell>{c.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(c.issuedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <LifecycleBadge lifecycle={lc} status={c.status} />
                      {lc === "rejected" && c.rejectionReason && (
                        <div className="mt-1 max-w-xs text-xs text-destructive">
                          “{c.rejectionReason}”
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
                        {lc === "rejected" ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                              <Pencil className="mr-1 h-3 w-3" /> Edit & resend
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setDiscardTarget(c)}>
                              <Trash2 className="mr-1 h-3 w-3" /> Accept rejection
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {mine.length === 0 && (
                <TableRow><TableCell colSpan={7} className="p-8 text-center text-sm text-muted-foreground">No credentials match.</TableCell></TableRow>
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
