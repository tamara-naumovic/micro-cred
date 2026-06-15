import { useMemo, useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { MockUser } from "@/lib/types";

type User = MockUser;

interface StaffPickerProps {
  staff: User[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
}

export function StaffPicker({ staff, selected, onChange, placeholder, emptyMessage }: StaffPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedUsers = useMemo(
    () => selected.map((id) => staff.find((u) => u.id === id)).filter(Boolean) as User[],
    [selected, staff],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const available = staff.filter((u) => !selected.includes(u.id));
    if (!q) return available.slice(0, 8);
    return available
      .filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, staff, selected]);

  const add = (id: string) => {
    onChange([...selected, id]);
    setQuery("");
  };

  const remove = (id: string) => onChange(selected.filter((x) => x !== id));

  return (
    <div ref={containerRef} className="relative space-y-2">
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map((u) => (
            <Badge key={u.id} variant="secondary" className="gap-1 pr-1">
              <span>{u.name}</span>
              <button
                type="button"
                onClick={() => remove(u.id)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Remove ${u.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? "Search staff by name or email"}
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-md border bg-popover shadow-md">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => add(u.id)}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted"
            >
              <span className="text-sm font-medium">{u.name}</span>
              <span className="text-xs text-muted-foreground">{u.email}</span>
            </button>
          ))}
        </div>
      )}
      {open && query && results.length === 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-md border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
          {emptyMessage ?? "No staff found"}
        </div>
      )}
    </div>
  );
}
