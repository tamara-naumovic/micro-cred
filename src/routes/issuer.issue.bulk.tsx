import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
  const { activeUser, templates, users, templateAssignees } = useStore();
  const issueBatch = useServerFn(issueCredentialsBatch);
  const isStaff = activeUser?.subRole === "staff";
  const assignedIds = useMemo(
    () => new Set(templateAssignees.filter((a) => a.userId === activeUser?.id).map((a) => a.templateId)),
    [templateAssignees, activeUser?.id],
  );
  const myTemplates = useMemo(
    () => templates.filter(
      (t) => t.issuerId === activeUser?.organizationId
        && t.status === "active"
        && (!isStaff || assignedIds.has(t.id)),
    ),
    [templates, activeUser, isStaff, assignedIds],
  );
  const [templateId, setTemplateId] = useState(myTemplates[0]?.id ?? "");
  const [csv, setCsv] = useState(SAMPLE);
  const rows = useMemo(() => parseCsv(csv), [csv]);
  const [anchorMode, setAnchorMode] = useState<AnchorMode>("later");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<IssuanceResultRow[] | null>(null);

  // Pre-resolve emails to earner IDs
  const resolved = useMemo(() => {
    return rows.map((r) => {
      const u = users.find((x) => x.email.toLowerCase() === r.email.toLowerCase());
      return { row: r, user: u };
    });
  }, [rows, users]);
  const unmatched = resolved.filter((r) => !r.user).length;

  const submit = async () => {
    if (!templateId) return toast.error("Pick a micro-credential");
    if (rows.length === 0) return toast.error("CSV is empty or malformed");
    const recipients = resolved
      .filter((r) => r.user)
      .map((r) => ({
        earnerId: r.user!.id,
        earnerName: r.user!.name,
        grade: r.row.grade ?? null,
        expiresAt: r.row.expiryDate ? new Date(r.row.expiryDate).toISOString() : null,
      }));
    if (recipients.length === 0) return toast.error("No CSV rows matched an existing earner email");
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
            error: "No earner account found for this email",
          });
        });
      setResults(rowsOut);
    } catch (e: any) {
      toast.error(e?.message ?? "Issuance failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell
      title="Bulk Issuance"
      description="Paste a CSV (or upload via XLSX in the production version) to issue many credentials at once."
    >
      <Card>
        <CardContent className="space-y-5 p-6">
          <div>
            <Label>Micro-credential</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Select a micro-credential" /></SelectTrigger>
              <SelectContent>
                {myTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>CSV input</Label>
            <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={10} className="font-mono text-xs" />
            <p className="mt-1 text-xs text-muted-foreground">
              Headers: email, grade, expiryDate
            </p>
          </div>
          <div className="rounded-md border border-border p-3 text-sm space-y-1">
            <div><span className="font-medium">{rows.length}</span> recipient(s) parsed</div>
            {unmatched > 0 && (
              <div className="text-xs text-warning-foreground">
                {unmatched} email(s) do not match an existing earner account and will be skipped.
              </div>
            )}
          </div>

          <AnchorModeSelector value={anchorMode} onChange={setAnchorMode} scope="credential" />

          <div className="flex justify-end">
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              Process & issue
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
