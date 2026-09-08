import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { adminBulkCreateUsers } from "@/lib/admin-users.functions";

export type CsvRow = {
  displayName: string;
  role: "earner" | "issuer";
  email: string;
  password: string;
};

function parseCSV(
  text: string,
  tr: (k: string, opts?: any) => string,
): { rows: CsvRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: CsvRow[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { rows, errors };

  const first = lines[0].toLowerCase();
  const startIdx =
    first.includes("display_name") || (first.includes("role") && first.includes("email")) ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 4) {
      errors.push(tr("users.bulk.errors.expectedColumns", { row: i + 1 }));
      continue;
    }
    const [displayName, roleRaw, email, password] = parts;
    const role = (roleRaw ?? "").toLowerCase();
    if (!displayName || !role || !email || !password) {
      errors.push(tr("users.bulk.errors.missingField", { row: i + 1 }));
      continue;
    }
    if (role !== "earner" && role !== "issuer") {
      errors.push(tr("users.bulk.errors.badRole", { row: i + 1, role: roleRaw }));
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(tr("users.bulk.errors.invalidEmail", { row: i + 1, email }));
      continue;
    }
    if (password.length < 6) {
      errors.push(tr("users.bulk.errors.shortPassword", { row: i + 1 }));
      continue;
    }
    rows.push({ displayName, role: role as "earner" | "issuer", email: email.toLowerCase(), password });
  }
  return { rows, errors };
}

export function BulkUsersCsvUpload({ onDone }: { onDone?: () => void }) {
  const { t } = useTranslation("admin");
  const { organizations } = useStore();
  const bulkCreate = useServerFn(adminBulkCreateUsers);
  const [text, setText] = useState("");
  const [orgId, setOrgId] = useState("");
  
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseCSV(text, t), [text, t]);
  const hasIssuers = parsed.rows.some((r) => r.role === "issuer");

  async function submit() {
    if (parsed.rows.length === 0) {
      toast.error(t("users.bulk.errors.noValidRows"));
      return;
    }
    if (hasIssuers && !orgId) {
      toast.error(t("users.toasts.pickInstitution"));
      return;
    }
    setBusy(true);
    try {
      const res = await bulkCreate({
        data: {
          rows: parsed.rows,
          organizationId: orgId || undefined,
        },
      });
      if (res.failed === 0) {
        toast.success(
          t("users.bulk.toasts.created", {
            created: res.created,
            existing: res.skippedExisting,
          }),
        );
        setText("");
      } else {
        toast.warning(
          t("users.bulk.toasts.partial", { created: res.created, failed: res.failed }),
        );
        // eslint-disable-next-line no-console
        console.warn("Bulk create errors:", res.errors);
      }
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? t("users.toasts.createFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>{t("users.bulk.title")}</Label>
        <p className="text-xs text-muted-foreground">{t("users.bulk.hint")}</p>
        <pre className="mt-1 rounded bg-muted p-2 text-[11px] text-muted-foreground">
          {t("users.bulk.example")}
        </pre>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("users.bulk.placeholder")}
        rows={6}
        disabled={busy}
        className="font-mono text-sm"
      />

      <div>
        <Label>{t("users.bulk.institution")}</Label>
        <InstitutionCombobox
          organizations={organizations}
          value={orgId}
          onChange={setOrgId}
          disabled={busy}
          placeholder={t("users.fields.selectInstitution")}
          searchPlaceholder={t("users.fields.searchInstitution")}
        />
        <p className="mt-1 text-xs text-muted-foreground">{t("users.bulk.institutionHint")}</p>
      </div>


      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setText(await f.text());
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Upload className="mr-2 h-4 w-4" /> {t("users.bulk.uploadCsv")}
        </Button>
        <div className="text-xs text-muted-foreground">
          {t("users.bulk.counts", { valid: parsed.rows.length, invalid: parsed.errors.length })}
        </div>
        <div className="ml-auto">
          <Button type="button" onClick={submit} disabled={busy || parsed.rows.length === 0}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("users.bulk.submit", { count: parsed.rows.length })}
          </Button>
        </div>
      </div>

      {parsed.errors.length > 0 && (
        <ul className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          {parsed.errors.slice(0, 5).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
          {parsed.errors.length > 5 && (
            <li>{t("users.bulk.moreErrors", { count: parsed.errors.length - 5 })}</li>
          )}
        </ul>
      )}
    </div>
  );
}

type InstitutionComboboxProps = {
  organizations: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
};

function InstitutionCombobox({
  organizations,
  value,
  onChange,
  disabled,
  placeholder,
  searchPlaceholder,
}: InstitutionComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = organizations.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{selected?.name ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder ?? placeholder} />
          <CommandList>
            <CommandEmpty>Nema rezultata.</CommandEmpty>
            <CommandGroup>
              {organizations.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.name}
                  onSelect={() => {
                    onChange(o.id === value ? "" : o.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === o.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{o.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
