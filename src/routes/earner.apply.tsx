import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/earner/apply")({
  head: () => ({ meta: [{ title: "Apply for credential — MicroCred" }] }),
  component: () => (
    <RoleGuard role="earner">
      <Apply />
    </RoleGuard>
  ),
});

function Apply() {
  const { templates, createApplication, applications, credentials, activeUser, earnerInstitutions } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const tpl = templates.find((t) => t.id === templateId);
  const myOrgIds = new Set(
    activeUser
      ? earnerInstitutions.filter((ei) => ei.earnerId === activeUser.id).map((ei) => ei.organizationId)
      : [],
  );
  const active = templates.filter((t) => t.status === "active" && myOrgIds.has(t.issuerId));

  const appliedTemplateIds = new Set(
    activeUser
      ? applications
          .filter((a) => a.earnerId === activeUser.id && a.status !== "issued" && a.status !== "rejected")
          .map((a) => a.templateId)
      : [],
  );
  const issuedTemplateIds = new Set(
    activeUser
      ? credentials
          .filter((c) => c.earnerId === activeUser.id && c.status === "active")
          .map((c) => c.templateId)
      : [],
  );

  function blockedReason(id: string): "applied" | "issued" | null {
    if (issuedTemplateIds.has(id)) return "issued";
    if (appliedTemplateIds.has(id)) return "applied";
    return null;
  }

  function submit() {
    if (!tpl) return;
    if (blockedReason(tpl.id)) {
      toast.error("You already have an active application or credential for this template.");
      return;
    }
    const app = createApplication(tpl.id);
    if (app) {
      toast.success("Application submitted");
      navigate({ to: "/earner/applications" });
    }
  }

  return (
    <PageShell
      title="Apply for a micro-credential"
      description="Pick a credential template and submit your application. The issuer handles all verification internally."
    >
      <div className="mb-6 flex items-center gap-2 text-sm">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {s}
            </div>
            {s < 2 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
        <span className="ml-3 text-muted-foreground">
          {step === 1 ? "Choose template" : "Review & apply"}
        </span>
      </div>

      {step === 1 && (
        <div className="grid gap-3 md:grid-cols-2">
          {active.map((t) => {
            const blocked = blockedReason(t.id);
            return (
              <Card
                key={t.id}
                className={`${blocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${templateId === t.id ? "border-primary ring-2 ring-primary/20" : ""}`}
                onClick={() => {
                  if (blocked) return;
                  setTemplateId(t.id);
                }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="line-clamp-2 text-muted-foreground">{t.description}</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="capitalize">
                      {t.source === "formal" ? "Formal" : "Non-formal"}
                    </Badge>
                    {t.level !== "N/A" && <Badge variant="outline">{t.level}</Badge>}
                    {t.ects && <Badge variant="outline">{t.ects} ECTS</Badge>}
                    {blocked === "applied" && (
                      <Badge variant="outline" className="border-warning/40 text-warning-foreground">
                        Already applied
                      </Badge>
                    )}
                    {blocked === "issued" && (
                      <Badge variant="outline" className="border-success/40 text-success-foreground">
                        Already issued
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">Issued by {t.issuerName}</div>
                </CardContent>
              </Card>
            );
          })}
          {active.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {myOrgIds.size === 0
                ? "You are not linked to any institution yet. Contact the platform admin to be linked to an institution."
                : "No active micro-credentials available from your institution(s) yet."}
            </p>
          )}
        </div>
      )}

      {step === 2 && tpl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review & apply</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="font-medium text-base">{tpl.title}</div>
              <div className="text-muted-foreground">{tpl.issuerName}</div>
            </div>
            <p className="text-muted-foreground">{tpl.description}</p>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="capitalize">
                {tpl.source === "formal" ? "Formal" : "Non-formal"}
              </Badge>
              {tpl.level !== "N/A" && <Badge variant="outline">{tpl.level}</Badge>}
              {tpl.ects && <Badge variant="outline">{tpl.ects} ECTS</Badge>}
            </div>
            {tpl.skills.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Skills</div>
                <div className="flex flex-wrap gap-1">
                  {tpl.skills.map((s) => (
                    <Badge key={s} variant="outline">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-success shrink-0" />
              <p className="text-xs text-muted-foreground">
                After you apply, the issuer will internally verify your participation and progress this
                application through the lifecycle. You can track the status from your Applications page.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex justify-between">
        <Button variant="outline" disabled={step === 1} onClick={() => setStep(1)}>
          Back
        </Button>
        {step === 1 ? (
          <Button onClick={() => setStep(2)} disabled={!templateId}>
            Continue
          </Button>
        ) : (
          <Button onClick={submit}>Apply</Button>
        )}
      </div>
    </PageShell>
  );
}
