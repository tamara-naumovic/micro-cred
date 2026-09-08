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
};

function InstitutionCombobox({
  organizations,
  value,
  onChange,
  disabled,
  placeholder,
}: InstitutionComboboxProps) {
  const { t } = useTranslation("admin");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = organizations.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return organizations;
    return organizations.filter((o) => o.name.toLowerCase().includes(term));
  }, [organizations, search]);

  useEffect(() => {
    if (open) {
      setHighlightedIndex(0);
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
    setSearch("");
  }, [open]);

  function selectOrg(orgId: string) {
    onChange(orgId === value ? "" : orgId);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        setHighlightedIndex((i) => (i + 1) % Math.max(filtered.length, 1));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open) {
        setHighlightedIndex(
          (i) => (i - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1),
        );
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        const org = filtered[highlightedIndex];
        if (org) selectOrg(org.id);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="combobox"
          aria-expanded={open}
          aria-disabled={disabled}
          onClick={() => {
            if (!disabled && !open) setOpen(true);
          }}
          className={cn(
            "flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors",
            disabled && "cursor-not-allowed opacity-50",
            !disabled && "cursor-pointer",
            open && "ring-1 ring-ring",
          )}
        >
          {open ? (
            <div
              className="flex flex-1 items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                disabled={disabled}
              />
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          ) : (
            <>
              <span className="truncate text-foreground">
                {selected?.name ?? placeholder}
              </span>
              <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
            </>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="max-h-60 overflow-auto p-1">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t("users.fields.noResults")}
            </div>
          ) : (
            filtered.map((o, i) => (
              <div
                key={o.id}
                onClick={() => selectOrg(o.id)}
                onMouseEnter={() => setHighlightedIndex(i)}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                  i === highlightedIndex && "bg-accent text-accent-foreground",
                )}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4 shrink-0",
                    value === o.id ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="truncate">{o.name}</span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
