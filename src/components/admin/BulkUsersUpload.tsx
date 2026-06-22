import { useMemo, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export type BulkRow = { name: string; email: string; password: string };
export type BulkResultSummary = { created: number; failed: number; errors: string[] };

function parseCSV(text: string, tr: (k: string, opts?: any) => string): { rows: BulkRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: BulkRow[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { rows, errors };

  const first = lines[0].toLowerCase();
  const startIdx =
    first.includes("name") && first.includes("email") && first.includes("password") ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 3) {
      errors.push(tr("bulkUsers.errors.expectedColumns", { row: i + 1 }));
      continue;
    }
    const [name, email, password] = parts;
    if (!name || !email || !password) {
      errors.push(tr("bulkUsers.errors.missingField", { row: i + 1 }));
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(tr("bulkUsers.errors.invalidEmail", { row: i + 1, email }));
      continue;
    }
    if (password.length < 6) {
      errors.push(tr("bulkUsers.errors.shortPassword", { row: i + 1 }));
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
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseCSV(text, t), [text, t]);

  async function onFile(file: File) {
    const txt = await file.text();
    setText(txt);
  }

  async function submit() {
    if (parsed.rows.length === 0) {
      toast.error(t("bulkUsers.errors.noValidRows"));
      return;
    }
    setBusy(true);
    try {
      const res = await onSubmit(parsed.rows);
      if (res.failed === 0) {
        toast.success(t(`bulkUsers.toasts.added_${label}`, { count: res.created, defaultValue: `${res.created} ${label} added` }));
        setText("");
      } else {
        toast.warning(t("bulkUsers.toasts.partial", { created: res.created, failed: res.failed }));
        if (res.errors.length > 0) {
          // eslint-disable-next-line no-console
          console.warn("Bulk add errors:", res.errors);
        }
      }
    } catch (e: any) {
      toast.error(e?.message ?? t("bulkUsers.errors.addFailed"));
    } finally {
      setBusy(false);
    }
  }

  const addLabelKey = `bulkUsers.addLabel_${label}`;

  return (
    <div className="space-y-3">
      <div>
        <Label>{t("bulkUsers.title")}</Label>
        <p
          className="text-xs text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: t("bulkUsers.hint") }}
        />
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("bulkUsers.placeholder")}
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
          <Upload className="mr-2 h-4 w-4" /> {t("bulkUsers.uploadCsv")}
        </Button>
        <div className="text-xs text-muted-foreground">
          {t("bulkUsers.counts", { valid: parsed.rows.length, invalid: parsed.errors.length })}
        </div>
        <div className="ml-auto">
          <Button type="button" onClick={submit} disabled={busy || parsed.rows.length === 0}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t(addLabelKey, { count: parsed.rows.length, defaultValue: `Add ${parsed.rows.length} ${label}` })}
          </Button>
        </div>
      </div>
      {parsed.errors.length > 0 && (
        <ul className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          {parsed.errors.slice(0, 5).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
          {parsed.errors.length > 5 && <li>{t("bulkUsers.moreErrors", { count: parsed.errors.length - 5 })}</li>}
        </ul>
      )}
    </div>
  );
}
