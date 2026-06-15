import { useMemo, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export type BulkRow = { name: string; email: string; password: string };
export type BulkResultSummary = { created: number; failed: number; errors: string[] };

function parseCSV(text: string): { rows: BulkRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: BulkRow[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { rows, errors };

  // Detect optional header
  const first = lines[0].toLowerCase();
  const startIdx =
    first.includes("name") && first.includes("email") && first.includes("password") ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    // Support comma or semicolon
    const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 3) {
      errors.push(`Row ${i + 1}: expected "name, email, password"`);
      continue;
    }
    const [name, email, password] = parts;
    if (!name || !email || !password) {
      errors.push(`Row ${i + 1}: missing field`);
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Row ${i + 1}: invalid email "${email}"`);
      continue;
    }
    if (password.length < 6) {
      errors.push(`Row ${i + 1}: password must be at least 6 characters`);
      continue;
    }
    rows.push({ name, email: email.toLowerCase(), password });
  }
  return { rows, errors };
}

export function BulkUsersUpload({
  label,
  onSubmit,
}: {
  label: string;
  onSubmit: (rows: BulkRow[]) => Promise<BulkResultSummary>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseCSV(text), [text]);

  async function onFile(file: File) {
    const t = await file.text();
    setText(t);
  }

  async function submit() {
    if (parsed.rows.length === 0) {
      toast.error("No valid rows to submit");
      return;
    }
    setBusy(true);
    try {
      const res = await onSubmit(parsed.rows);
      if (res.failed === 0) {
        toast.success(`${res.created} ${label} added`);
        setText("");
      } else {
        toast.warning(`${res.created} added, ${res.failed} failed`);
        if (res.errors.length > 0) {
          // eslint-disable-next-line no-console
          console.warn("Bulk add errors:", res.errors);
        }
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Bulk add failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Bulk add via CSV</Label>
        <p className="text-xs text-muted-foreground">
          Columns: <code>name, email, password</code> (one per line). Header row is optional.
        </p>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Jane Doe, jane@uni.org, Pa$$w0rd\nJohn Roe, john@uni.org, Pa$$w0rd"}
        rows={6}
        disabled={busy}
        className="font-mono text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Upload className="mr-2 h-4 w-4" /> Upload CSV file
        </Button>
        <div className="text-xs text-muted-foreground">
          {parsed.rows.length} valid · {parsed.errors.length} invalid
        </div>
        <div className="ml-auto">
          <Button type="button" onClick={submit} disabled={busy || parsed.rows.length === 0}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add {parsed.rows.length || ""} {label}
          </Button>
        </div>
      </div>
      {parsed.errors.length > 0 && (
        <ul className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          {parsed.errors.slice(0, 5).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
          {parsed.errors.length > 5 && <li>…and {parsed.errors.length - 5} more</li>}
        </ul>
      )}
    </div>
  );
}
