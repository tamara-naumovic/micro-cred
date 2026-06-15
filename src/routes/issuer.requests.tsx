import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Send, XCircle } from "lucide-react";
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
  const {
    activeUser,
    applications,
    templates,
    templateAssignees,
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

  if (!activeUser) return null;
  const isStaff = activeUser.subRole === "staff";
  const assignedIds = new Set(
    templateAssignees.filter((a) => a.userId === activeUser.id).map((a) => a.templateId),
  );
  const queue = applications
    .filter((a) => a.issuerId === activeUser.organizationId && a.status !== "issued" && a.status !== "rejected")
    .filter((a) => (isStaff ? assignedIds.has(a.templateId) : true));

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
    if (u) toast.success("Sent to earner for acceptance");
    setIssueDialog(null);
  };

  return (
    <PageShell
      title="Issuance Requests"
      description="Move each application through the lifecycle. The final step issues and signs the credential."
    >
      {queue.length === 0 && (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground">No active applications.</CardContent>
        </Card>
      )}
      <div className="space-y-4">
        {queue.map((a) => {
          const next = nextLabel(a.status);
          const isFinal = a.status === "verified_by_provider";
          return (
            <Card key={a.id}>
              <CardContent className="grid gap-4 p-5 md:grid-cols-3">
                <div className="md:col-span-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-semibold">{a.templateTitle}</span>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Earner: <span className="text-foreground">{a.earnerName}</span>
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
                          if (u) toast.success(`Moved to ${next}`);
                        }}
                      >
                        {isFinal ? (
                          <>
                            <Send className="mr-2 h-4 w-4" />Issue & sign
                          </>
                        ) : (
                          <>
                            <ArrowRight className="mr-2 h-4 w-4" />Advance to {next}
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        rejectApplication(a.id, "Rejected by issuer");
                        toast.info("Application rejected");
                      }}
                    >
                      <XCircle className="mr-2 h-4 w-4" />Reject
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
            <DialogTitle>Issue & sign credential</DialogTitle>
            <DialogDescription>
              {issueDialog ? (
                <>
                  Finalize <span className="font-medium text-foreground">{issueDialog.templateTitle}</span>{" "}
                  for <span className="font-medium text-foreground">{issueDialog.earnerName}</span>.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="grade">Grade (optional)</Label>
              <Input
                id="grade"
                placeholder="e.g. A, Pass, 9/10"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expiry">Expiry date (optional)</Label>
              <Input
                id="expiry"
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
              {issueDialog?.defaultExpiry && (
                <p className="text-xs text-muted-foreground">
                  Template default: {issueDialog.defaultExpiry}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialog(null)}>
              Cancel
            </Button>
            <Button onClick={confirmIssue}>
              <Send className="mr-2 h-4 w-4" />Issue & sign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
