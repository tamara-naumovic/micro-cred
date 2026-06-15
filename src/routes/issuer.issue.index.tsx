import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
  const { activeUser, templates, users, templateAssignees } = useStore();
  const isStaff = activeUser?.subRole === "staff";
  const issueBatch = useServerFn(issueCredentialsBatch);
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
  const earners = users.filter((u) => u.role === "earner");
  const [templateId, setTemplateId] = useState(myTemplates[0]?.id ?? "");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [defaultGrade, setDefaultGrade] = useState("");
  const [overrides, setOverrides] = useState<Record<string, RecipientOverride>>({});
  const [anchorMode, setAnchorMode] = useState<AnchorMode>("later");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<IssuanceResultRow[] | null>(null);

  const selectedIds = Object.keys(overrides);

  const toggle = (id: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = { grade: "", expiryDate: "" };
      return next;
    });
  };

  const updateField = (id: string, key: keyof RecipientOverride, value: string) => {
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  };

  const submit = async () => {
    if (!templateId || selectedIds.length === 0) {
      toast.error("Pick a micro-credential and at least one earner");
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
      toast.error(e?.message ?? "Issuance failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell
      title="Direct Issuance"
      description="Issue micro-credentials directly to one or more earners. Most metadata comes from the template; per-recipient fields are entered below."
    >
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Micro-credential</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="Select a micro-credential" /></SelectTrigger>
                <SelectContent>
                  {myTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.title} (v{t.version})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date of issuing</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div>
              <Label>Grade <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                value={defaultGrade}
                onChange={(e) => setDefaultGrade(e.target.value)}
                placeholder="e.g. Pass"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Applied to all recipients unless overridden below.
              </p>
            </div>
          </div>

          <div>
            <Label>Recipients ({selectedIds.length} selected)</Label>
            <div className="mt-2 grid max-h-72 gap-2 overflow-auto rounded-md border border-border p-2 sm:grid-cols-2">
              {earners.map((e) => (
                <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm hover:bg-muted">
                  <Checkbox checked={!!overrides[e.id]} onCheckedChange={() => toggle(e.id)} />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{e.name}</div>
                    <div className="text-xs text-muted-foreground">{e.studentId} · {e.email}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div>
              <Label>Per-recipient details</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Grade and expiry date are optional and set per learner.
              </p>
              <div className="overflow-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Recipient</th>
                      <th className="px-3 py-2 text-left">Grade</th>
                      <th className="px-3 py-2 text-left">Expiry date</th>
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
                              placeholder="e.g. Pass"
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
              Issue credentials
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
