import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileDown } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { TemplateBlockchainProofCard } from "@/components/TemplateBlockchainProofCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

async function openQaDocument(path: string, failMsg: string) {
  const { data, error } = await supabase.storage
    .from("qa-documents")
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    toast.error(error?.message ?? failMsg);
    return;
  }
  window.open(data.signedUrl, "_blank");
}

export const Route = createFileRoute("/earner/microcredential-templates/$id")({
  head: () => ({ meta: [{ title: "Micro-credential — MicroCred" }] }),
  component: () => (
    <RoleGuard role="earner">
      <Detail />
    </RoleGuard>
  ),
});

function Detail() {
  const { id } = Route.useParams();
  const { activeUser, templates, earnerInstitutions } = useStore();
  const { t } = useTranslation(["earner", "common"]);
  const navigate = useNavigate();
  const tpl = templates.find((tt) => tt.id === id);

  const allowed = useMemo(() => {
    if (!activeUser || !tpl) return false;
    if (tpl.status !== "active") return false;
    const myOrgIds = new Set(
      earnerInstitutions.filter((ei) => ei.earnerId === activeUser.id).map((ei) => ei.organizationId),
    );
    return myOrgIds.has(tpl.issuerId);
  }, [activeUser, tpl, earnerInstitutions]);

  if (!activeUser) return null;

  if (!tpl) {
    return (
      <PageShell title={t("templateDetail.notFound")}>
        <Button variant="outline" onClick={() => navigate({ to: "/earner/apply" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />{t("templateDetail.back")}
        </Button>
      </PageShell>
    );
  }

  if (!allowed) return <Navigate to="/earner/apply" replace />;

  const paths =
    tpl.qaDocumentPaths && tpl.qaDocumentPaths.length > 0
      ? tpl.qaDocumentPaths
      : tpl.qaDocumentPath
        ? [tpl.qaDocumentPath]
        : [];

  return (
    <PageShell
      title={tpl.title}
      description={tpl.description}
      actions={
        <Button variant="outline" asChild>
          <Link to="/earner/apply"><ArrowLeft className="mr-2 h-4 w-4" />{t("templateDetail.backToApply")}</Link>
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge status={tpl.status} />
        <Badge variant="outline">v{tpl.version}</Badge>
        <Badge variant="outline">{tpl.source === "formal" ? t("source.formal", { ns: "common" }) : t("source.non_formal", { ns: "common" })}</Badge>
        <Badge variant="outline">{tpl.level}</Badge>
        {tpl.ects != null && <Badge variant="outline">{tpl.ects} ECTS</Badge>}
        <Badge variant="outline">{tpl.participation}</Badge>
      </div>
      <div className="grid gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("templateDetail.specification")}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <Field label={t("templateDetail.fields.outcomes")}>
              <ul className="list-disc space-y-1 pl-5">{tpl.outcomes.map((o) => <li key={o}>{o}</li>)}</ul>
            </Field>
            <Field label={t("templateDetail.fields.skills")}>{tpl.skills.join(", ")}</Field>
            <Field label={t("templateDetail.fields.assessment")}>{tpl.assessment}</Field>
            <Field label={t("templateDetail.fields.qualityAssurance")}>
              <div className="space-y-2">
                <div>{t(`templateDetail.qa.${tpl.qaType}`, { defaultValue: tpl.qualityAssurance })}</div>
                {paths.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("templateDetail.noDocs")}</p>
                ) : (
                  paths.map((p) => (
                    <div key={p}>
                      <Button size="sm" variant="outline" onClick={() => openQaDocument(p, t("templateDetail.couldNotOpen"))}>
                        <FileDown className="mr-2 h-4 w-4" />{p.split("/").pop()}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Field>
            <Field label={t("templateDetail.fields.prerequisites")}>
              {tpl.prerequisitesNone ? t("templateDetail.noPrerequisites") : (tpl.prerequisites || "—")}
            </Field>
            <Field label={t("templateDetail.fields.supervision")}>
              {tpl.supervisionType ? t(`templateDetail.supervisionLabel.${tpl.supervisionType}`, { defaultValue: "—" }) : "—"}
            </Field>
            <Field label={t("templateDetail.fields.stackability")}>
              {tpl.stackabilityType ? t(`templateDetail.stackabilityLabel.${tpl.stackabilityType}`, { defaultValue: "—" }) : "—"}
            </Field>
            <Field label={t("templateDetail.fields.expiry")}>
              {tpl.expiryMode === "fixed_date" && tpl.expiryDate
                ? t("templateDetail.expiresOn", { date: new Date(tpl.expiryDate).toLocaleDateString() })
                : t("templateDetail.doesNotExpire")}
            </Field>
          </CardContent>
        </Card>
        <TemplateBlockchainProofCard templateId={tpl.id} canManage={false} />
      </div>
    </PageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
