import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { LifecycleTimeline } from "@/components/LifecycleTimeline";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const { activeUser, applications, advanceApplicationStatus, rejectApplication } = useStore();
  if (!activeUser) return null;
  const queue = applications.filter(
    (a) => a.issuerId === activeUser.organizationId && a.status !== "issued" && a.status !== "rejected",
  );

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
                          const u = advanceApplicationStatus(a.id);
                          if (u) {
                            toast.success(
                              isFinal ? "Credential issued & signed" : `Moved to ${next}`,
                            );
                          }
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
    </PageShell>
  );
}
