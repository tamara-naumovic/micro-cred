import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StaffPicker } from "@/components/StaffPicker";
import { useStore } from "@/lib/store";
import { AnchorModeSelector, type AnchorMode } from "@/components/AnchorModeSelector";
import { IssuanceResultDialog, type IssuanceResultRow } from "@/components/IssuanceResultDialog";
import { issueCredentialsBatch } from "@/lib/chain/anchor.functions";

export const Route = createFileRoute("/issuer/issue/")({
  head: () => ({ meta: [{ title: "Direct Issuance — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <Direct />
    </RoleGuard>
  ),
});

type RecipientOverride = { grade: string; expiryDate: string };

function Direct() {
  const { t } = useTranslation("issuer");
  const { activeUser, templates, users, userRolesById, templateAssignees, credentials } = useStore();
  const isStaff = activeUser?.subRole === "staff";
  const issueBatch = useServerFn(issueCredentialsBatch);
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
  // Exclude any user who is also issuer staff or issuer admin anywhere on the
  // platform — they cannot be credential recipients.
  const allEarners = users.filter((u) => {
    if (u.role !== "earner") return false;
    const roles = userRolesById[u.id] ?? [];
    return !roles.includes("issuer_admin") && !roles.includes("issuer_staff");
  });
  const [templateId, setTemplateId] = useState(myTemplates[0]?.id ?? "");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [defaultGrade, setDefaultGrade] = useState("");
  const [overrides, setOverrides] = useState<Record<string, RecipientOverride>>({});
  const [anchorMode, setAnchorMode] = useState<AnchorMode>("later");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<IssuanceResultRow[] | null>(null);

  // Earners who already have a non-revoked credential for the selected template
  const earnersWithActive = useMemo(() => {
    if (!templateId) return new Set<string>();
    return new Set(
      credentials
        .filter((c) => c.templateId === templateId && c.status !== "revoked")
        .map((c) => c.earnerId),
    );
  }, [credentials, templateId]);

  // Exclude already-credentialed earners from the picker entirely
  const earners = useMemo(
    () => allEarners.filter((u) => !earnersWithActive.has(u.id)),
    [allEarners, earnersWithActive],
  );

  // If template changes and some currently-selected earners now have an active
  // credential for the new template, drop them from the selection.
  useEffect(() => {
    setOverrides((prev) => {
      const filtered: Record<string, RecipientOverride> = {};
      let changed = false;
      for (const [id, val] of Object.entries(prev)) {
        if (earnersWithActive.has(id)) {
          changed = true;
        } else {
          filtered[id] = val;
        }
      }
      return changed ? filtered : prev;
    });
  }, [earnersWithActive]);

  const selectedIds = Object.keys(overrides);

  const setSelectedIds = (ids: string[]) => {
    setOverrides((prev) => {
      const next: Record<string, RecipientOverride> = {};
      ids.forEach((id) => {
        next[id] = prev[id] ?? { grade: "", expiryDate: "" };
      });
      return next;
    });
  };

  const updateField = (id: string, key: keyof RecipientOverride, value: string) => {
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  };

  const submit = async () => {
    if (!templateId || selectedIds.length === 0) {
      toast.error(t("issue.single.toasts.validationError"));
      return;
    }
    const recipients = selectedIds.map((id) => {
      const u = earners.find((e) => e.id === id);
      return {
        earnerId: id,
        earnerName: u?.name ?? "Earner",
        grade: overrides[id].grade || defaultGrade || null,
        expiresAt: overrides[id].expiryDate ? new Date(overrides[id].expiryDate).toISOString() : null,
      };
    });
    setSubmitting(true);
    try {
      const res: any = await issueBatch({
        data: {
          templateId,
          issuedAt: new Date(issueDate).toISOString(),
          recipients,
          anchorMode,
        },
      });
      const rows: IssuanceResultRow[] = (res?.results ?? []).map((r: IssuanceResultRow) => ({
        ...r,
        recipientName: earners.find((e) => e.id === r.recipientId)?.name,
      }));
      setResults(rows);
      // Realtime subscription on credentials triggers refetch automatically.
    } catch (e: any) {
      toast.error(e?.message ?? t("issue.single.toasts.issuanceFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell
      title={t("issue.single.title")}
      description={t("issue.single.description")}
    >
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>{t("issue.single.fields.microCredential")}</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder={t("issue.single.fields.microCredentialPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {myTemplates.map((tmpl) => (
                    <SelectItem key={tmpl.id} value={tmpl.id}>{tmpl.title} (v{tmpl.version})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("issue.single.fields.issueDate")}</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div>
              <Label>{t("issue.single.fields.grade")} <span className="text-muted-foreground">{t("issue.single.fields.gradeOptional")}</span></Label>
              <Input
                value={defaultGrade}
                onChange={(e) => setDefaultGrade(e.target.value)}
                placeholder={t("issue.single.fields.gradePlaceholder")}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("issue.single.fields.gradeHint")}
              </p>
            </div>
          </div>

          <div>
            <Label>{t("issue.single.fields.recipients", { count: selectedIds.length })}</Label>
            <div className="mt-2">
              <StaffPicker
                staff={earners}
                selected={selectedIds}
                onChange={setSelectedIds}
                placeholder={t("issue.single.fields.searchPlaceholder")}
                emptyMessage={t("issue.single.fields.searchEmpty")}
              />
            </div>
            {templateId && earnersWithActive.size > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("issue.single.fields.hiddenHint", { count: earnersWithActive.size })}
              </p>
            )}
          </div>


          {selectedIds.length > 0 && (
            <div>
              <Label>{t("issue.single.fields.perRecipient")}</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                {t("issue.single.fields.perRecipientHint")}
              </p>
              <div className="overflow-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">{t("issue.single.fields.colRecipient")}</th>
                      <th className="px-3 py-2 text-left">{t("issue.single.fields.colGrade")}</th>
                      <th className="px-3 py-2 text-left">{t("issue.single.fields.colExpiry")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedIds.map((id) => {
                      const u = earners.find((x) => x.id === id);
                      if (!u) return null;
                      return (
                        <tr key={id} className="border-t border-border">
                          <td className="px-3 py-2">
                            <div className="font-medium">{u.name}</div>
                            <div className="text-xs text-muted-foreground">{u.studentId}</div>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              value={overrides[id].grade}
                              onChange={(ev) => updateField(id, "grade", ev.target.value)}
                              placeholder={t("issue.single.fields.gradePlaceholder")}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="date"
                              value={overrides[id].expiryDate}
                              onChange={(ev) => updateField(id, "expiryDate", ev.target.value)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          <AnchorModeSelector value={anchorMode} onChange={setAnchorMode} scope="credential" />

          <div className="flex justify-end">
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {submitting ? t("issue.single.buttons.issuing") : t("issue.single.buttons.issue")}
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
