import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const { t } = useTranslation(["earner", "common"]);
  const [step, setStep] = useState<1 | 2>(1);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [issuerFilter, setIssuerFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "formal" | "non_formal">("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  const tpl = templates.find((tp) => tp.id === templateId);
  const myOrgIds = new Set(
    activeUser
      ? earnerInstitutions.filter((ei) => ei.earnerId === activeUser.id).map((ei) => ei.organizationId)
      : [],
  );
  const active = templates.filter((tp) => tp.status === "active" && myOrgIds.has(tp.issuerId));
  const issuerOptions = useMemo(
    () => Array.from(new Set(active.map((tp) => tp.issuerName).filter(Boolean))).sort(),
    [active],
  );
  const levelOptions = useMemo(
    () => Array.from(new Set(active.map((tp) => tp.level).filter((l) => l && l !== "N/A"))).sort(),
    [active],
  );
  const filtersActive = issuerFilter !== "all" || sourceFilter !== "all" || levelFilter !== "all";
  const visible = active.filter((tp) => {
    if (issuerFilter !== "all" && tp.issuerName !== issuerFilter) return false;
    if (sourceFilter !== "all" && tp.source !== sourceFilter) return false;
    if (levelFilter !== "all" && tp.level !== levelFilter) return false;
    return true;
  });

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
      toast.error(t("apply.toasts.blocked"));
      return;
    }
    const app = createApplication(tpl.id);
    if (app) {
      toast.success(t("apply.toasts.submitted"));
      navigate({ to: "/earner/applications" });
    }
  }

  return (
    <PageShell
      title={t("apply.title")}
      description={t("apply.description")}
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
          {step === 1 ? t("apply.steps.choose") : t("apply.steps.review")}
        </span>
      </div>

      {step === 1 && (
        <>
          {active.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Select value={issuerFilter} onValueChange={setIssuerFilter}>
                <SelectTrigger className="w-56"><SelectValue placeholder={t("apply.filters.allIssuers")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("apply.filters.allIssuers")}</SelectItem>
                  {issuerOptions.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}>
                <SelectTrigger className="w-44"><SelectValue placeholder={t("apply.filters.allTypes")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("apply.filters.allTypes")}</SelectItem>
                  <SelectItem value="formal">{t("source.formal", { ns: "common" })}</SelectItem>
                  <SelectItem value="non_formal">{t("source.non_formal", { ns: "common" })}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-44"><SelectValue placeholder={t("apply.filters.allLevels")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("apply.filters.allLevels")}</SelectItem>
                  {levelOptions.map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map((tp) => {
              const blocked = blockedReason(tp.id);
              return (
                <Card
                  key={tp.id}
                  className={`${blocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${templateId === tp.id ? "border-primary ring-2 ring-primary/20" : ""}`}
                  onClick={() => {
                    if (blocked) return;
                    setTemplateId(tp.id);
                  }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{tp.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="line-clamp-2 text-muted-foreground">{tp.description}</p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="capitalize">
                        {tp.source === "formal" ? t("source.formal", { ns: "common" }) : t("source.non_formal", { ns: "common" })}
                      </Badge>
                      {tp.level !== "N/A" && <Badge variant="outline">{tp.level}</Badge>}
                      {tp.ects && <Badge variant="outline">{tp.ects} ECTS</Badge>}
                      {blocked === "applied" && (
                        <Badge variant="outline" className="border-warning/40 text-warning-foreground">
                          {t("apply.card.alreadyApplied")}
                        </Badge>
                      )}
                      {blocked === "issued" && (
                        <Badge variant="outline" className="border-success/40 text-success-foreground">
                          {t("apply.card.alreadyIssued")}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{t("apply.card.issuedBy", { name: tp.issuerName })}</div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button size="sm" variant="outline" asChild onClick={(e) => e.stopPropagation()}>
                        <Link to="/earner/microcredential-templates/$id" params={{ id: tp.id }}>
                          {t("apply.card.seeMore")}
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        disabled={!!blocked}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (blocked) return;
                          setTemplateId(tp.id);
                          setStep(2);
                        }}
                      >
                        {t("apply.card.continue")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {active.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {myOrgIds.size === 0 ? t("apply.empty.notLinked") : t("apply.empty.noTemplates")}
              </p>
            )}
            {active.length > 0 && visible.length === 0 && filtersActive && (
              <p className="text-sm text-muted-foreground">{t("apply.empty.noMatches")}</p>
            )}
          </div>
        </>
      )}

      {step === 2 && tpl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("apply.review.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="font-medium text-base">{tpl.title}</div>
              <div className="text-muted-foreground">{tpl.issuerName}</div>
            </div>
            <p className="text-muted-foreground">{tpl.description}</p>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="capitalize">
                {tpl.source === "formal" ? t("source.formal", { ns: "common" }) : t("source.non_formal", { ns: "common" })}
              </Badge>
              {tpl.level !== "N/A" && <Badge variant="outline">{tpl.level}</Badge>}
              {tpl.ects && <Badge variant="outline">{tpl.ects} ECTS</Badge>}
            </div>
            {tpl.skills.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{t("apply.review.skills")}</div>
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
                {t("apply.review.info")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="mt-6 flex justify-between">
          <Button variant="outline" onClick={() => setStep(1)}>
            {t("apply.actions.back")}
          </Button>
          <Button onClick={submit}>{t("apply.actions.apply")}</Button>
        </div>
      )}
    </PageShell>
  );
}
