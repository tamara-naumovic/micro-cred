import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore, type BulkRow } from "@/lib/store";

const SAMPLE = `email,firstName,lastName,studentId,grade,expiryDate
mila@student.fon.bg.ac.rs,Mila,Petrović,FON-2023-0142,Pass,
luka@student.fon.bg.ac.rs,Luka,Jovanović,FON-2022-0815,Pass with distinction,
sara@student.fon.bg.ac.rs,Sara,Nikolić,FON-2024-0003,Pass,2028-06-30`;

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
      firstName: row.firstName,
      lastName: row.lastName,
      studentId: row.studentId,
      grade: row.grade || undefined,
      expiryDate: row.expiryDate || undefined,
    } as BulkRow;
  });
}

function Bulk() {
  const { activeUser, templates, templateAssignees, bulkIssue } = useStore();
  const navigate = useNavigate();
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

  const submit = () => {
    if (!templateId) return toast.error("Pick a micro-credential");
    if (rows.length === 0) return toast.error("CSV is empty or malformed");
    const issued = bulkIssue(templateId, rows);
    toast.success(`Bulk issued ${issued.length} credential(s)`);
    navigate({ to: "/issuer/credentials" });
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
              Headers: email, firstName, lastName, studentId, grade, expiryDate
            </p>
          </div>
          <div className="rounded-md border border-border p-3 text-sm">
            <span className="font-medium">{rows.length}</span> recipient(s) parsed
            {rows.length > 0 && (
              <span className="ml-2 text-muted-foreground">— first: {rows[0].firstName} {rows[0].lastName}</span>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={submit}><UploadCloud className="mr-2 h-4 w-4" />Process & issue</Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
