import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listAnchorJobs, retryAnchorJob, cancelAnchorJob, repairCredentialChainFields, processAnchorQueueFn } from "@/lib/chain/anchor.functions";
import { useAuth } from "@/lib/auth";
import {
  BLOCKCHAIN_LABEL,
  BLOCKCHAIN_BADGE_CLASS,
  explorerTxUrl,
  type BlockchainStatus,
} from "@/lib/status-labels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  RefreshCcw,
  XOctagon,
  ExternalLink,
  AlertTriangle,
  Layers,
  Award,
  Wrench,
} from "lucide-react";

export const Route = createFileRoute("/issuer/anchoring-queue")({
  component: AnchoringQueuePage,
});

type EntityFilter = "all" | "template" | "credential";
type StatusFilter = "all" | "queued" | "failed" | "done";

function fmtDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function AnchoringQueuePage() {
  const { t } = useTranslation("issuer");
  const list = useServerFn(listAnchorJobs);
  const retry = useServerFn(retryAnchorJob);
  const cancel = useServerFn(cancelAnchorJob);
  const repair = useServerFn(repairCredentialChainFields);
  const processQueue = useServerFn(processAnchorQueueFn);
  const qc = useQueryClient();
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["anchor-jobs"],
    queryFn: () => list(),
    refetchInterval: 8000,
    enabled: !authLoading && !!user,
  });

  const [entityFilter, setEntityFilter] = useState<EntityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const retryMut = useMutation({
    mutationFn: ({ jobId, entityKind }: { jobId: string; entityKind: "template" | "credential" }) =>
      retry({ data: { jobId, entityKind } }),
    onSuccess: (res) => {
      if (res.ok) toast.success(t("anchoringQueue.toasts.retrySubmitted"));
      else toast.error(res.error ?? t("anchoringQueue.toasts.retryFailed"));
      qc.invalidateQueries({ queryKey: ["anchor-jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: ({ jobId, entityKind }: { jobId: string; entityKind: "template" | "credential" }) =>
      cancel({ data: { jobId, entityKind } }),
    onSuccess: () => {
      toast.success(t("anchoringQueue.toasts.cancelled"));
      qc.invalidateQueries({ queryKey: ["anchor-jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const repairMut = useMutation({
    mutationFn: (credentialId: string) => repair({ data: { credentialId } }),
    onSuccess: (res: any) => {
      if (res?.anchorResult?.ok) {
        toast.success(t("anchoringQueue.toasts.repaired"));
      } else if (res?.ok) {
        toast.success(
          t("anchoringQueue.toasts.repairedFields") + (res.anchorResult?.error ? ` ${res.anchorResult.error}` : ""),
        );
      } else {
        toast.error(res?.anchorResult?.error ?? t("anchoringQueue.toasts.repairFailed"));
      }
      qc.invalidateQueries({ queryKey: ["anchor-jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const processMut = useMutation({
    mutationFn: () => processQueue(),
    onSuccess: (res: { processed: number }) => {
      toast.success(t("anchoringQueue.toasts.processed", { count: res.processed }));
      qc.invalidateQueries({ queryKey: ["anchor-jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.rows ?? [];
  const maxAttempts = data?.maxAttempts ?? 5;

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (entityFilter !== "all" && r.entity_type !== entityFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, entityFilter, statusFilter]);

  const counts = useMemo(() => {
    const c = { queued: 0, failed: 0, done: 0, running: 0 };
    for (const r of rows) {
      if (r.status === "queued") c.queued++;
      else if (r.status === "failed") c.failed++;
      else if (r.status === "done") c.done++;
      else if (r.status === "running") c.running++;
    }
    return c;
  }, [rows]);

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t("anchoringQueue.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("anchoringQueue.description")}
          </p>
        </div>
        <Button
          onClick={() => processMut.mutate()}
          disabled={processMut.isPending}
          className="shrink-0"
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${processMut.isPending ? "animate-spin" : ""}`} />
          {processMut.isPending ? t("anchoringQueue.actions.processing") : t("anchoringQueue.actions.processQueue")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryStat label={t("anchoringQueue.stats.queued")} value={counts.queued} />
        <SummaryStat label={t("anchoringQueue.stats.running")} value={counts.running} />
        <SummaryStat label={t("anchoringQueue.stats.failed")} value={counts.failed} tone="destructive" />
        <SummaryStat label={t("anchoringQueue.stats.confirmed")} value={counts.done} tone="success" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("anchoringQueue.card.title")}</CardTitle>
          <CardDescription>
            {t("anchoringQueue.card.description", { max: maxAttempts })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={entityFilter} onValueChange={(v) => setEntityFilter(v as EntityFilter)}>
              <TabsList>
                <TabsTrigger value="all">{t("anchoringQueue.filters.all")}</TabsTrigger>
                <TabsTrigger value="template">{t("anchoringQueue.filters.templates")}</TabsTrigger>
                <TabsTrigger value="credential">{t("anchoringQueue.filters.credentials")}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <TabsList>
                <TabsTrigger value="all">{t("anchoringQueue.filters.allStates")}</TabsTrigger>
                <TabsTrigger value="queued">{t("anchoringQueue.filters.queued")}</TabsTrigger>
                <TabsTrigger value="failed">{t("anchoringQueue.filters.failed")}</TabsTrigger>
                <TabsTrigger value="done">{t("anchoringQueue.filters.done")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">{t("anchoringQueue.empty.loading")}</div>
          ) : isError ? (
            <div className="py-12 text-center text-sm text-destructive">{t("anchoringQueue.empty.error")}</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("anchoringQueue.empty.noMatch")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("anchoringQueue.table.type")}</TableHead>
                    <TableHead>{t("anchoringQueue.table.title")}</TableHead>
                    <TableHead>{t("anchoringQueue.table.versionLearner")}</TableHead>
                    <TableHead>{t("anchoringQueue.table.internalStatus")}</TableHead>
                    <TableHead>{t("anchoringQueue.table.blockchain")}</TableHead>
                    <TableHead>{t("anchoringQueue.table.attempts")}</TableHead>
                    <TableHead>{t("anchoringQueue.table.lastAttempt")}</TableHead>
                    <TableHead className="text-right">{t("anchoringQueue.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const bcStatus = r.blockchainStatus as BlockchainStatus;
                    const tx = r.transaction_hash ?? r.blockchainTxHash;
                    const link =
                      r.entity_type === "template"
                        ? `/issuer/microcredential-templates/${r.entity_id}`
                        : `/issuer/credentials`;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            {r.entity_type === "template" ? (
                              <Layers className="h-3.5 w-3.5" />
                            ) : (
                              <Award className="h-3.5 w-3.5" />
                            )}
                            {r.entity_type === "template"
                              ? t("anchoringQueue.types.template")
                              : t("anchoringQueue.types.credential")}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link to={link} className="hover:underline">
                            {r.title}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.subtitle ?? "—"}
                          <div className="text-xs">{fmtDate(r.dateLabel)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {r.internalStatus.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={BLOCKCHAIN_BADGE_CLASS[bcStatus] ?? ""}
                          >
                            {BLOCKCHAIN_LABEL[bcStatus] ?? bcStatus}
                          </Badge>
                          {r.last_error ? (
                            <div
                              className="mt-1 flex items-start gap-1 text-xs text-destructive"
                              title={r.last_error}
                            >
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                              <span className="line-clamp-2">{r.last_error}</span>
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {r.attempts}/{maxAttempts}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDate(r.last_attempt_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {tx ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                asChild
                                title={t("anchoringQueue.actions.viewTransaction")}
                              >
                                <a
                                  href={explorerTxUrl(tx)!}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            ) : null}
                            {bcStatus !== "confirmed" &&
                              (r.status === "queued" || r.status === "failed") &&
                              r.attempts < maxAttempts && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => retryMut.mutate({ jobId: r.id, entityKind: r.entity_type })}
                                  disabled={retryMut.isPending}
                                >
                                  <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                                  {t("anchoringQueue.actions.retry")}
                                </Button>
                              )}
                            {bcStatus !== "confirmed" &&
                              r.entity_type === "credential" &&
                              r.status === "failed" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => repairMut.mutate(r.entity_id)}
                                  disabled={repairMut.isPending}
                                  title={t("anchoringQueue.actions.repairTitle")}
                                >
                                  <Wrench className="mr-1 h-3.5 w-3.5" />
                                  {t("anchoringQueue.actions.repair")}
                                </Button>
                              )}
                            {bcStatus !== "confirmed" &&
                              (r.status === "queued" || r.status === "failed") && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => cancelMut.mutate({ jobId: r.id, entityKind: r.entity_type })}
                                  disabled={cancelMut.isPending}
                                  title={t("anchoringQueue.actions.cancel")}
                                >
                                  <XOctagon className="h-3.5 w-3.5" />
                                </Button>
                              )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "destructive" | "success";
}) {
  const toneClass =
    tone === "destructive"
      ? "text-destructive"
      : tone === "success"
        ? "text-success-foreground"
        : "";
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
