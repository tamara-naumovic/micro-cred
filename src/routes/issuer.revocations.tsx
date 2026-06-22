import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, XOctagon } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/issuer/revocations")({
  head: () => ({ meta: [{ title: "Revocations — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <Revocations />
    </RoleGuard>
  ),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZES = [10, 20, 50, 100];

type Cred = {
  id: string;
  earnerName: string;
  title: string;
  revocationReason?: string | null;
  status: string;
};

function filterCreds<T extends Cred>(rows: T[], earnerQ: string, templateFilter: string): T[] {
  const needle = earnerQ.trim().toLowerCase();
  return rows.filter((c) => {
    if (needle && !c.earnerName.toLowerCase().includes(needle)) return false;
    if (templateFilter !== "all" && c.title !== templateFilter) return false;
    return true;
  });
}

function FilterBar({
  earnerQ,
  onEarnerQ,
  templateFilter,
  onTemplateFilter,
  templates,
}: {
  earnerQ: string;
  onEarnerQ: (v: string) => void;
  templateFilter: string;
  onTemplateFilter: (v: string) => void;
  templates: string[];
}) {
  const { t } = useTranslation("issuer");
  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative max-w-sm flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("revocations.filters.searchPlaceholder")}
          className="pl-8"
          value={earnerQ}
          onChange={(e) => onEarnerQ(e.target.value)}
        />
      </div>
      <Select value={templateFilter} onValueChange={onTemplateFilter}>
        <SelectTrigger className="w-[240px]">
          <SelectValue placeholder={t("revocations.filters.allTemplates")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("revocations.filters.allTemplates")}</SelectItem>
          {templates.map((tmpl) => (
            <SelectItem key={tmpl} value={tmpl}>
              {tmpl}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Pager({
  total,
  page,
  pageSize,
  onPage,
  onPageSize,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const { t } = useTranslation("issuer");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>{t("revocations.pager.rowsPerPage")}</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            onPageSize(Number(v));
            onPage(1);
          }}
        >
          <SelectTrigger className="h-8 w-[80px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3 text-muted-foreground">
        <span>
          {t("revocations.pager.pageOf", { current, pages, total, count: total })}
        </span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPage(current - 1)}
            disabled={current <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPage(current + 1)}
            disabled={current >= pages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Revocations() {
  const { t } = useTranslation("issuer");
  const { activeUser, credentials, revokeCredential } = useStore();
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  const [historyEarnerQ, setHistoryEarnerQ] = useState("");
  const [historyTemplate, setHistoryTemplate] = useState("all");
  const [historyPage, setHistoryPage] = useState(1);
  const [historySize, setHistorySize] = useState(10);

  const [activeEarnerQ, setActiveEarnerQ] = useState("");
  const [activeTemplate, setActiveTemplate] = useState("all");
  const [activePage, setActivePage] = useState(1);
  const [activeSize, setActiveSize] = useState(10);

  if (!activeUser) return null;
  const mine = credentials.filter((c) => c.issuerId === activeUser.organizationId);
  const active = mine.filter((c) => c.status === "active");
  const revoked = mine.filter((c) => c.status === "revoked");

  const revokedTemplates = useMemo(
    () => Array.from(new Set(revoked.map((c) => c.title))).sort(),
    [revoked],
  );
  const activeTemplates = useMemo(
    () => Array.from(new Set(active.map((c) => c.title))).sort(),
    [active],
  );

  const filteredRevoked = useMemo(
    () => filterCreds(revoked, historyEarnerQ, historyTemplate),
    [revoked, historyEarnerQ, historyTemplate],
  );
  const filteredActive = useMemo(
    () => filterCreds(active, activeEarnerQ, activeTemplate),
    [active, activeEarnerQ, activeTemplate],
  );

  const revokedPages = Math.max(1, Math.ceil(filteredRevoked.length / historySize));
  const activePages = Math.max(1, Math.ceil(filteredActive.length / activeSize));
  const revokedPageSafe = Math.min(historyPage, revokedPages);
  const activePageSafe = Math.min(activePage, activePages);

  const revokedSlice = filteredRevoked.slice(
    (revokedPageSafe - 1) * historySize,
    revokedPageSafe * historySize,
  );
  const activeSlice = filteredActive.slice(
    (activePageSafe - 1) * activeSize,
    activePageSafe * activeSize,
  );

  async function handleRevoke(id: string) {
    if (!reason.trim()) {
      toast.error(t("revocations.toasts.provideReason"));
      return;
    }
    setPending(true);
    try {
      if (UUID_RE.test(id)) {
        const { revokeCredentialOnChain } = await import("@/lib/chain/anchor.functions");
        const res = await revokeCredentialOnChain({ data: { credentialId: id, reason } });
        if (res.mode === "on_chain_revoke_queued") {
          toast.success(t("revocations.toasts.revokedQueued"));
        } else {
          toast.success(t("revocations.toasts.revoked"));
        }
        revokeCredential(id, reason);
      } else {
        revokeCredential(id, reason);
        toast.success(t("revocations.toasts.revoked"));
      }
      setTarget(null);
      setReason("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <PageShell
      title={t("revocations.title")}
      description={t("revocations.description")}
    >
      <h2 className="mb-3 font-display text-lg font-semibold">{t("revocations.history.heading")}</h2>
      <Card className="mb-6">
        <CardContent className="space-y-3 p-4">
          <FilterBar
            earnerQ={historyEarnerQ}
            onEarnerQ={(v) => {
              setHistoryEarnerQ(v);
              setHistoryPage(1);
            }}
            templateFilter={historyTemplate}
            onTemplateFilter={(v) => {
              setHistoryTemplate(v);
              setHistoryPage(1);
            }}
            templates={revokedTemplates}
          />
        </CardContent>
        <div className="border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("revocations.table.id")}</TableHead>
                <TableHead>{t("revocations.table.earner")}</TableHead>
                <TableHead>{t("revocations.table.title")}</TableHead>
                <TableHead>{t("revocations.table.reason")}</TableHead>
                <TableHead>{t("revocations.table.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revokedSlice.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.id}</TableCell>
                  <TableCell>{c.earnerName}</TableCell>
                  <TableCell>{c.title}</TableCell>
                  <TableCell className="text-sm">{c.revocationReason ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                </TableRow>
              ))}
              {filteredRevoked.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                    {historyEarnerQ || historyTemplate !== "all"
                      ? t("revocations.empty.noMatchingRevocations")
                      : t("revocations.empty.noRevocations")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {filteredRevoked.length > 0 && (
          <Pager
            total={filteredRevoked.length}
            page={revokedPageSafe}
            pageSize={historySize}
            onPage={setHistoryPage}
            onPageSize={setHistorySize}
          />
        )}
      </Card>

      <h2 className="mb-3 font-display text-lg font-semibold">{t("revocations.revokeSection.heading")}</h2>
      <Card>
        <CardContent className="space-y-3 p-4">
          <FilterBar
            earnerQ={activeEarnerQ}
            onEarnerQ={(v) => {
              setActiveEarnerQ(v);
              setActivePage(1);
            }}
            templateFilter={activeTemplate}
            onTemplateFilter={(v) => {
              setActiveTemplate(v);
              setActivePage(1);
            }}
            templates={activeTemplates}
          />
        </CardContent>
        <div className="border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("revocations.table.id")}</TableHead>
                <TableHead>{t("revocations.table.earner")}</TableHead>
                <TableHead>{t("revocations.table.title")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeSlice.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.id}</TableCell>
                  <TableCell>{c.earnerName}</TableCell>
                  <TableCell>{c.title}</TableCell>
                  <TableCell>
                    <Dialog open={target === c.id} onOpenChange={(o) => setTarget(o ? c.id : null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <XOctagon className="mr-2 h-4 w-4" />
                          {t("revocations.actions.revoke")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t("revocations.dialogs.revoke.title", { id: c.id })}</DialogTitle>
                        </DialogHeader>
                        <Input
                          placeholder={t("revocations.dialogs.revoke.reasonPlaceholder")}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setTarget(null)} disabled={pending}>
                            {t("revocations.dialogs.revoke.cancel")}
                          </Button>
                          <Button onClick={() => handleRevoke(c.id)} disabled={pending}>
                            {pending
                              ? t("revocations.dialogs.revoke.confirming")
                              : t("revocations.dialogs.revoke.confirm")}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
              {filteredActive.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="p-6 text-center text-sm text-muted-foreground">
                    {activeEarnerQ || activeTemplate !== "all"
                      ? t("revocations.empty.noMatchingActive")
                      : t("revocations.empty.noActive")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {filteredActive.length > 0 && (
          <Pager
            total={filteredActive.length}
            page={activePageSafe}
            pageSize={activeSize}
            onPage={setActivePage}
            onPageSize={setActiveSize}
          />
        )}
      </Card>
    </PageShell>
  );
}
