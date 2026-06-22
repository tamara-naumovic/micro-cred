import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { ArrowLeft, Users, FileDown, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { TemplateBlockchainProofCard } from "@/components/TemplateBlockchainProofCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StaffPicker } from "@/components/StaffPicker";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

type StorageRemoveResult = { error: { message: string } | null };

async function openQaDocument(path: string, errorMsg: string) {
  const { data, error } = await supabase.storage
    .from("qa-documents")
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) {
    toast.error(error?.message ?? errorMsg);
    return;
  }
  window.open(data.signedUrl, "_blank");
}

export const Route = createFileRoute("/issuer/microcredential-templates/$id")({
  head: () => ({ meta: [{ title: "Micro-credential — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <Detail />
    </RoleGuard>
  ),
});

function Detail() {
  const { t } = useTranslation("issuer");
  const { id } = Route.useParams();
  const { activeUser, templates, templateAssignees } = useStore();
  const navigate = useNavigate();
  const tpl = templates.find((tmpl) => tmpl.id === id);
  const isStaff = activeUser?.subRole === "staff";
  const assignedToMe = useMemo(
    () => templateAssignees.some((a) => a.templateId === id && a.userId === activeUser?.id),
    [templateAssignees, id, activeUser?.id],
  );

  useEffect(() => {
    if (isStaff && tpl && !assignedToMe) {
      toast.error(t("templates.detail.notAssigned"));
    }
  }, [isStaff, tpl, assignedToMe]);

  if (!activeUser) return null;
  if (isStaff && tpl && !assignedToMe)
    return <Navigate to="/issuer/microcredential-templates" replace />;

  if (!tpl) {
    return (
      <PageShell title={t("templates.detail.notFoundTitle")}>
        <Button variant="outline" onClick={() => navigate({ to: "/issuer/microcredential-templates" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />{t("templates.detail.backButton")}
        </Button>
      </PageShell>
    );
  }

  const qaLabel: Record<string, string> = {
    internal: t("templates.qaOptions.internal"),
    external: t("templates.qaOptions.external"),
    internal_and_external: t("templates.qaOptions.internal_and_external"),
    other: t("templates.qaOptions.other"),
    not_specified: t("templates.qaOptions.not_specified"),
  };
  const supervisionLabel: Record<string, string> = {
    unsupervised_no_id: t("templates.supervisionOptions.unsupervised_no_id"),
    supervised_no_id: t("templates.supervisionOptions.supervised_no_id"),
    supervised_online_with_id: t("templates.supervisionOptions.supervised_online_with_id"),
    supervised_onsite_with_id: t("templates.supervisionOptions.supervised_onsite_with_id"),
  };
  const stackabilityLabel: Record<string, string> = {
    stand_alone: t("templates.stackabilityOptions.stand_alone"),
    independent_integrated: t("templates.stackabilityOptions.independent_integrated"),
    stackable: t("templates.stackabilityOptions.stackable"),
  };

  return (
    <PageShell
      title={tpl.title}
      description={tpl.description}
      actions={
        <Button variant="outline" asChild>
          <Link to="/issuer/microcredential-templates">
            <ArrowLeft className="mr-2 h-4 w-4" />{t("templates.detail.allLink")}
          </Link>
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge status={tpl.status} />
        <Badge variant="outline">v{tpl.version}</Badge>
        <Badge variant="outline">
          {tpl.source === "formal"
            ? t("templates.detail.fields.sourceFormal")
            : t("templates.detail.fields.sourceNonFormal")}
        </Badge>
        <Badge variant="outline">{tpl.level}</Badge>
        {tpl.ects != null && <Badge variant="outline">{tpl.ects} ECTS</Badge>}
        <Badge variant="outline">{tpl.participation}</Badge>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">{t("templates.detail.sections.specification")}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <Field label={t("templates.detail.fields.outcomes")}>
              <ul className="list-disc space-y-1 pl-5">{tpl.outcomes.map((o) => <li key={o}>{o}</li>)}</ul>
            </Field>
            <Field label={t("templates.detail.fields.skills")}>{tpl.skills.join(", ")}</Field>
            <Field label={t("templates.detail.fields.assessment")}>{tpl.assessment}</Field>
            <Field label={t("templates.detail.fields.qualityAssurance")}>
              <div className="space-y-2">
                <div>{qaLabel[tpl.qaType] ?? tpl.qualityAssurance}</div>
                <QaDocumentsEditor
                  templateId={tpl.id}
                  issuerId={tpl.issuerId}
                  paths={
                    tpl.qaDocumentPaths && tpl.qaDocumentPaths.length > 0
                      ? tpl.qaDocumentPaths
                      : tpl.qaDocumentPath
                        ? [tpl.qaDocumentPath]
                        : []
                  }
                  canEdit={!isStaff}
                />
              </div>
            </Field>
            <Field label={t("templates.detail.fields.prerequisites")}>
              {tpl.prerequisitesNone ? t("templates.detail.fields.noPrerequisites") : (tpl.prerequisites || "—")}
            </Field>
            <Field label={t("templates.detail.fields.supervision")}>
              {tpl.supervisionType ? supervisionLabel[tpl.supervisionType] : "—"}
            </Field>
            <Field label={t("templates.detail.fields.stackability")}>
              {tpl.stackabilityType ? stackabilityLabel[tpl.stackabilityType] : "—"}
            </Field>
            <Field label={t("templates.detail.fields.expiry")}>
              {tpl.expiryMode === "fixed_date" && tpl.expiryDate
                ? t("templates.detail.fields.expiresOn", { date: new Date(tpl.expiryDate).toLocaleDateString() })
                : t("templates.detail.fields.doesNotExpire")}
            </Field>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <AssigneesCard
            templateId={tpl.id}
            isStaff={!!isStaff}
            orgId={activeUser.organizationId}
          />
          <TemplateBlockchainProofCard templateId={tpl.id} canManage={!isStaff} />
        </div>
      </div>
    </PageShell>
  );
}

function AssigneesCard({
  templateId,
  isStaff,
  orgId,
}: {
  templateId: string;
  isStaff: boolean;
  orgId?: string;
}) {
  const { t } = useTranslation("issuer");
  const { users, templateAssignees, assignTemplateUsers } = useStore();
  const staffUsers = useMemo(
    () =>
      users.filter(
        (u) => u.role === "issuer" && u.subRole === "staff" && u.organizationId === orgId,
      ),
    [users, orgId],
  );
  const currentIds = useMemo(
    () =>
      templateAssignees.filter((a) => a.templateId === templateId).map((a) => a.userId),
    [templateAssignees, templateId],
  );
  const [selected, setSelected] = useState<string[]>(currentIds);
  useEffect(() => setSelected(currentIds), [currentIds.join(",")]);
  const [busy, setBusy] = useState(false);
  const dirty =
    selected.length !== currentIds.length ||
    selected.some((id) => !currentIds.includes(id));

  if (isStaff) {
    const names = staffUsers.filter((u) => currentIds.includes(u.id)).map((u) => u.name);
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />{t("templates.detail.sections.assignedStaff")}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {names.length === 0 ? (
            <p className="text-muted-foreground">{t("templates.detail.assignees.noStaffAssigned")}</p>
          ) : (
            <ul className="space-y-1">{names.map((n) => <li key={n}>{n}</li>)}</ul>
          )}
        </CardContent>
      </Card>
    );
  }

  const save = async () => {
    setBusy(true);
    try {
      await assignTemplateUsers(templateId, selected);
      toast.success(t("templates.detail.assignees.saveSuccess"));
    } catch (e: any) {
      toast.error(e?.message ?? t("templates.detail.assignees.saveFail"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />{t("templates.detail.sections.assignedStaff")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {staffUsers.length === 0 && (
          <p className="text-muted-foreground">
            {t("templates.detail.assignees.noStaffYet")}{" "}
            <Link to="/issuer/staff" className="text-primary underline">{t("templates.detail.assignees.addStaff")}</Link>.
          </p>
        )}
        {staffUsers.length > 0 && (
          <StaffPicker
            staff={staffUsers}
            selected={selected}
            onChange={setSelected}
            placeholder={t("templates.detail.assignees.searchPlaceholder")}
          />
        )}
        {staffUsers.length > 0 && (
          <Button size="sm" disabled={!dirty || busy} onClick={save}>
            {t("templates.detail.assignees.saveButton")}
          </Button>
        )}
      </CardContent>
    </Card>
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

function QaDocumentsEditor({
  templateId,
  issuerId,
  paths,
  canEdit,
}: {
  templateId: string;
  issuerId: string;
  paths: string[];
  canEdit: boolean;
}) {
  const { t } = useTranslation("issuer");
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const persist = async (next: string[]) => {
    const { error } = await supabase
      .from("templates")
      .update({ qa_document_paths: next, qa_document_path: next[0] ?? null })
      .eq("id", templateId);
    if (error) throw new Error(error.message);
  };

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const newPaths: string[] = [];
      for (const f of Array.from(files)) {
        const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${issuerId}/${templateId}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("qa-documents")
          .upload(path, f, { upsert: false, contentType: f.type || undefined });
        if (upErr) throw new Error(`Failed to upload ${f.name}: ${upErr.message}`);
        newPaths.push(path);
      }
      await persist([...paths, ...newPaths]);
      toast.success(t("templates.detail.qaDocs.updateSuccess"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("templates.detail.qaDocs.uploadFail"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const { refresh } = useStore();

  const onRemove = async (path: string) => {
    setBusy(true);
    try {
      const res = (await supabase.storage
        .from("qa-documents")
        .remove([path])) as unknown as StorageRemoveResult;
      if (res.error) {
        console.warn("[qa-documents] storage remove failed", res.error.message);
      }
      await persist(paths.filter((p) => p !== path));
      await refresh();
      toast.success(t("templates.detail.qaDocs.removeSuccess"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("templates.detail.qaDocs.removeFail"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {paths.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("templates.detail.qaDocs.noDocs")}</p>
      )}
      {paths.map((p) => (
        <div key={p} className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openQaDocument(p, t("templates.detail.qaDocs.openError"))}>
            <FileDown className="mr-2 h-4 w-4" />{p.split("/").pop()}
          </Button>
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => onRemove(p)}
              aria-label={t("templates.detail.qaDocs.removeAriaLabel")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      {canEdit && (
        <div>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onUpload(e.target.files)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {busy ? t("templates.detail.qaDocs.uploading") : t("templates.detail.qaDocs.addDocs")}
          </Button>
        </div>
      )}
    </div>
  );
}
