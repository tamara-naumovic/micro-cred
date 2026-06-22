import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { UploadCloud, Loader2, FileUp, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore, type BulkRow } from "@/lib/store";
import { AnchorModeSelector, type AnchorMode } from "@/components/AnchorModeSelector";
import { IssuanceResultDialog, type IssuanceResultRow } from "@/components/IssuanceResultDialog";
import { issueCredentialsBatch } from "@/lib/chain/anchor.functions";

const SAMPLE = `email,grade,expiryDate
mila@student.fon.bg.ac.rs,Pass,
luka@student.fon.bg.ac.rs,Pass with distinction,
sara@student.fon.bg.ac.rs,Pass,2028-06-30`;

export const Route = createFileRoute("/issuer/issue/bulk")({
  head: () => ({ meta: [{ title: "Bulk Issuance — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <Bulk />
    </RoleGuard>
  ),
});

function parseCsv(input: string): BulkRow[] {
  const lines = input.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = values[i] ?? ""));
    return {
      email: row.email,
      grade: row.grade || undefined,
      expiryDate: row.expiryDate || undefined,
    } as BulkRow;
  });
}

function Bulk() {
  const { t } = useTranslation("issuer");
  const { activeUser, templates, users, userRolesById, templateAssignees, credentials } = useStore();
  const issueBatch = useServerFn(issueCredentialsBatch);
  const isStaff = activeUser?.subRole === "staff";
  const assignedIds = useMemo(
    () => new Set(templateAssignees.filter((a) => a.userId === activeUser?.id).map((a) => a.templateId)),
    [templateAssignees, activeUser?.id],
  );
  const myTemplates = useMemo(
    () => templates.filter(
      (tmpl) => tmpl.issuerId === activeUser?.organizationId
        && tmpl.status === "active"
        && (!isStaff || assignedIds.has(tmpl.id)),
    ),
    [templates, activeUser, isStaff, assignedIds],
  );
  const [templateId, setTemplateId] = useState(myTemplates[0]?.id ?? "");
  const [csv, setCsv] = useState(SAMPLE);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rows = useMemo(() => parseCsv(csv), [csv]);
  const [anchorMode, setAnchorMode] = useState<AnchorMode>("later");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<IssuanceResultRow[] | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv" || file.type === "application/vnd.ms-excel";
    if (!isCsv) return toast.error(t("issue.bulk.toasts.invalidFile"));
    if (file.size > 1_000_000) return toast.error(t("issue.bulk.toasts.fileTooLarge"));
    try {
      let text = await file.text();
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      setCsv(text);
      setFileName(file.name);
      toast.success(t("issue.bulk.toasts.fileLoaded", { name: file.name }));
    } catch {
      toast.error(t("issue.bulk.toasts.fileLoadFailed"));
    }
  };

  const clearFile = () => {
    setCsv(SAMPLE);
    setFileName(null);
  };

  // Earners with an existing non-revoked credential for the selected template
  const earnersWithActive = useMemo(() => {
    if (!templateId) return new Set<string>();
    return new Set(
      credentials
        .filter((c) => c.templateId === templateId && c.status !== "revoked")
        .map((c) => c.earnerId),
    );
  }, [credentials, templateId]);

  // Pre-resolve emails to earner IDs and detect duplicates / staff conflicts
  const resolved = useMemo(() => {
    return rows.map((r) => {
      const u = users.find((x) => x.email.toLowerCase() === r.email.toLowerCase());
      const roles = u ? (userRolesById[u.id] ?? []) : [];
      const isStaffOrAdmin =
        roles.includes("issuer_admin") || roles.includes("issuer_staff");
      const alreadyHas = u ? earnersWithActive.has(u.id) : false;
      return { row: r, user: u, alreadyHas, isStaffOrAdmin };
    });
  }, [rows, users, userRolesById, earnersWithActive]);
  const unmatched = resolved.filter((r) => !r.user).length;
  const duplicates = resolved.filter((r) => r.user && r.alreadyHas).length;
  const staffConflicts = resolved.filter((r) => r.user && r.isStaffOrAdmin).length;

  const submit = async () => {
    if (!templateId) return toast.error(t("issue.bulk.toasts.noTemplate"));
    if (rows.length === 0) return toast.error(t("issue.bulk.toasts.emptyCSV"));
    const recipients = resolved
      .filter((r) => r.user && !r.alreadyHas && !r.isStaffOrAdmin)
      .map((r) => ({
        earnerId: r.user!.id,
        earnerName: r.user!.name,
        grade: r.row.grade ?? null,
        expiresAt: r.row.expiryDate ? new Date(r.row.expiryDate).toISOString() : null,
      }));
    if (recipients.length === 0) return toast.error(t("issue.bulk.toasts.noEligible"));
    setSubmitting(true);
    try {
      const res: any = await issueBatch({
        data: {
          templateId,
          issuedAt: new Date().toISOString(),
          recipients,
          anchorMode,
        },
      });
      const rowsOut: IssuanceResultRow[] = (res?.results ?? []).map((r: IssuanceResultRow) => ({
        ...r,
        recipientName: users.find((u) => u.id === r.recipientId)?.name,
      }));
      // Include unmatched rows as not-issued
      resolved
        .filter((r) => !r.user)
        .forEach((r) => {
          rowsOut.push({
            recipientId: r.row.email,
            recipientName: r.row.email,
            credentialStatus: "not_issued",
            blockchainStatus: "not_requested",
            error: t("issue.bulk.errors.noAccount"),
          });
        });
      // Include duplicates as not-issued
      resolved
        .filter((r) => r.user && r.alreadyHas)
        .forEach((r) => {
          rowsOut.push({
            recipientId: r.user!.id,
            recipientName: r.user!.name,
            credentialStatus: "not_issued",
            blockchainStatus: "not_requested",
            error: t("issue.bulk.errors.alreadyActive"),
          });
        });
      // Include staff/admin conflicts as not-issued
      resolved
        .filter((r) => r.user && r.isStaffOrAdmin)
        .forEach((r) => {
          rowsOut.push({
            recipientId: r.user!.id,
            recipientName: r.user!.name,
            credentialStatus: "not_issued",
            blockchainStatus: "not_requested",
            error: t("issue.bulk.errors.staffConflict"),
          });
        });
      setResults(rowsOut);
    } catch (e: any) {
      toast.error(e?.message ?? t("issue.bulk.toasts.issuanceFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell
      title={t("issue.bulk.title")}
      description={t("issue.bulk.description")}
    >
      <Card>
        <CardContent className="space-y-5 p-6">
          <div>
            <Label>{t("issue.bulk.fields.microCredential")}</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder={t("issue.bulk.fields.microCredentialPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {myTemplates.map((tmpl) => (
                  <SelectItem key={tmpl.id} value={tmpl.id}>{tmpl.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label className="mb-0">{t("issue.bulk.fields.csvInput")}</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={handleFileUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp className="mr-2 h-4 w-4" />
                  {t("issue.bulk.buttons.upload")}
                </Button>
              </div>
            </div>
            <Textarea value={csv} onChange={(e) => { setCsv(e.target.value); setFileName(null); }} rows={10} className="font-mono text-xs" />
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {t("issue.bulk.fields.csvHint")}
              </p>
              {fileName && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{t("issue.bulk.fields.loaded")} <span className="font-medium text-foreground">{fileName}</span></span>
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-2" onClick={clearFile}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="rounded-md border border-border p-3 text-sm space-y-1">
            <div><span className="font-medium">{rows.length}</span> {t("issue.bulk.preview.parsed", { count: rows.length }).replace(/^\d+ /, "")}</div>
            {unmatched > 0 && (
              <div className="text-xs text-warning-foreground">
                {t("issue.bulk.preview.unmatched", { count: unmatched })}
              </div>
            )}
            {duplicates > 0 && (
              <div className="text-xs text-warning-foreground">
                {t("issue.bulk.preview.duplicates", { count: duplicates })}
              </div>
            )}
            {staffConflicts > 0 && (
              <div className="text-xs text-warning-foreground">
                {t("issue.bulk.preview.staffConflicts", { count: staffConflicts })}
              </div>
            )}
          </div>

          <AnchorModeSelector value={anchorMode} onChange={setAnchorMode} scope="credential" />

          <div className="flex justify-end">
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              {submitting ? t("issue.bulk.buttons.processing") : t("issue.bulk.buttons.process")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <IssuanceResultDialog
        open={!!results}
        onOpenChange={(o) => { if (!o) setResults(null); }}
        results={results ?? []}
      />
    </PageShell>
  );
}
