import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getChainAvailabilityFn } from "@/lib/chain/anchor.functions";
import {
  Activity,
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileSignature,
  Inbox,
  Link2,
  ListChecks,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useStore } from "@/lib/store";
import type {
  CredentialApplication,
  IssuedCredential,
  MicroCredentialTemplate,
  MockUser,
} from "@/lib/types";

export const Route = createFileRoute("/issuer/")({
  head: () => ({ meta: [{ title: "Institution Dashboard — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <Overview />
    </RoleGuard>
  ),
});

// ============ Helpers ============


function maskAddress(addr?: string) {
  if (!addr) return "Not configured";
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function pct(n: number, d: number) {
  if (d === 0) return 0;
  return Math.round((n / d) * 1000) / 10;
}

// ============ Main component ============

function Overview() {
  const {
    activeUser,
    templates,
    credentials,
    applications,
    users,
    templateAssignees,
    events,
    audit,
    loading,
  } = useStore();
  const [templateFilter, setTemplateFilter] = useState<string>("all");

  if (!activeUser) return null;
  const orgId = activeUser.organizationId;
  const orgName = activeUser.organization ?? "Your institution";
  const isStaff = activeUser.subRole === "staff";

  const assignedIds = useMemo(
    () =>
      new Set(
        templateAssignees
          .filter((a) => a.userId === activeUser.id)
          .map((a) => a.templateId),
      ),
    [templateAssignees, activeUser.id],
  );
  const tVisible = (id: string) => !isStaff || assignedIds.has(id);

  // Institution-scoped data
  const orgTemplates = useMemo(
    () => templates.filter((t) => t.issuerId === orgId && tVisible(t.id)),
    [templates, orgId, assignedIds, isStaff],
  );
  const orgCredsAll = useMemo(
    () =>
      credentials.filter(
        (c) =>
          c.issuerId === orgId &&
          tVisible(c.templateId) &&
          (templateFilter === "all" || c.templateId === templateFilter),
      ),
    [credentials, orgId, assignedIds, isStaff, templateFilter],
  );
  const orgApps = useMemo(
    () =>
      applications.filter(
        (a) =>
          a.issuerId === orgId &&
          tVisible(a.templateId) &&
          (templateFilter === "all" || a.templateId === templateFilter),
      ),
    [applications, orgId, assignedIds, isStaff, templateFilter],
  );
  const orgUsers = useMemo(
    () =>
      users.filter((u) => u.role === "issuer" && u.organizationId === orgId),
    [users, orgId],
  );

  // KPIs
  const publishedTemplates = orgTemplates.filter((t) => t.status === "active");
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const issuedThisMonth = orgCredsAll.filter(
    (c) => new Date(c.issuedAt) >= startOfMonth,
  ).length;
  const publishedThisMonth = orgTemplates.filter(
    (t) => t.status === "active",
  ).length; // placeholder if no createdAt

  const activeCredsForLearners = orgCredsAll.filter(
    (c) => c.lifecycle === "issued" || c.status === "active",
  );
  const activeLearners = new Set(activeCredsForLearners.map((c) => c.earnerId))
    .size;
  const activeIssuers = orgUsers.length;

  const awaitingSig = orgApps.filter(
    (a) => a.status === "verified_by_provider",
  );
  const openRequests = orgApps.filter(
    (a) => a.status !== "issued" && a.status !== "rejected",
  );
  const pendingAcceptance = orgCredsAll.filter(
    (c) => c.lifecycle === "pending_earner_acceptance",
  );
  const queuedAnchors = orgCredsAll.filter(
    (c) =>
      c.blockchain.chainStatus === "pending" ||
      c.blockchain.chainStatus === "submitted",
  );
  const failedAnchors = orgCredsAll.filter(
    (c) => c.blockchain.chainStatus === "failed",
  );
  const confirmedAnchors = orgCredsAll.filter(
    (c) => c.blockchain.chainStatus === "confirmed",
  );
  const anchorableTotal = orgCredsAll.filter(
    (c) => c.blockchain.chainStatus !== "disabled",
  ).length;

  const pendingActionsCount =
    awaitingSig.length +
    openRequests.length +
    queuedAnchors.length +
    failedAnchors.length;

  // Lifecycle counts
  const lifecycleCounts = useMemo(() => {
    const counts = {
      active: 0,
      pending: 0,
      expired: 0,
      revoked: 0,
      superseded: 0,
    };
    for (const c of orgCredsAll) {
      const lc = c.lifecycle ?? "issued";
      if (lc === "pending_earner_acceptance") counts.pending++;
      else if (lc === "revoked") counts.revoked++;
      else if (lc === "expired") counts.expired++;
      else if (lc === "superseded") counts.superseded++;
      else if (lc === "issued") counts.active++;
    }
    return counts;
  }, [orgCredsAll]);

  // Recent activity (org-scoped)
  const orgTemplateIds = new Set(orgTemplates.map((t) => t.id));
  const orgCredentialIds = new Set(orgCredsAll.map((c) => c.id));
  const orgCredentialTitles = new Set(
    orgCredsAll.map((c) => c.title.toLowerCase()),
  );
  const recentActivity = useMemo(() => {
    const out: {
      id: string;
      at: string;
      title: string;
      detail?: string;
      kind: string;
    }[] = [];
    for (const e of events) {
      if (
        e.description &&
        Array.from(orgCredentialTitles).some((t) =>
          e.description.toLowerCase().includes(t),
        )
      ) {
        out.push({
          id: `e-${e.id}`,
          at: e.at,
          title: e.description,
          kind: e.type,
        });
      }
    }
    for (const a of audit) {
      if (orgCredentialIds.has(a.target) || orgTemplateIds.has(a.target)) {
        out.push({
          id: `a-${a.id}`,
          at: a.at,
          title: `${a.actor} ${a.action}`,
          kind: "audit",
        });
      }
    }
    return out
      .sort((a, b) => +new Date(b.at) - +new Date(a.at))
      .slice(0, 10);
  }, [events, audit, orgCredentialIds, orgTemplateIds, orgCredentialTitles]);

  if (loading) {
    return (
      <PageShell title="Institution Dashboard">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="mt-6 h-72" />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Institution Dashboard"
      description={`${orgName} — ${isStaff ? "your assigned micro-credentials and issuance activity." : "operations, governance and blockchain status for your institution."}`}
      actions={
        <>
          <DashboardFilters
            templateFilter={templateFilter}
            onTemplate={setTemplateFilter}
            templates={orgTemplates}
          />
          <Button asChild>
            <Link to="/issuer/issue">
              <Send className="mr-2 h-4 w-4" />
              Direct issue
            </Link>
          </Button>
        </>
      }
    >
      {/* Row 1 — KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Published MC templates"
          value={publishedTemplates.length}
          hint={
            publishedThisMonth > 0 ? `${publishedThisMonth} active` : undefined
          }
          icon={<BookOpen className="h-5 w-5" />}
          tone="primary"
        />
        <MetricCard
          label="Total issued credentials"
          value={orgCredsAll.length}
          hint={`${issuedThisMonth} this month`}
          icon={<Award className="h-5 w-5" />}
          tone="success"
        />
        <MetricCard
          label="Active learners"
          value={activeLearners}
          hint="With at least one active credential"
          icon={<Users className="h-5 w-5" />}
          tone="info"
        />
        <MetricCard
          label="Active issuers"
          value={activeIssuers}
          hint="Admin and staff with access"
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="purple"
        />
        <a
          href="#actions"
          onClick={(e) => {
            e.preventDefault();
            document
              .getElementById("actions")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="block"
        >
          <MetricCard
            label="Pending actions"
            value={pendingActionsCount}
            hint="Click to review"
            icon={<Inbox className="h-5 w-5" />}
            tone="warning"
          />
        </a>
        <MetricCard
          label="Blockchain confirmed"
          value={`${pct(confirmedAnchors.length, anchorableTotal)}%`}
          hint={`${confirmedAnchors.length} / ${anchorableTotal}`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
        />
      </div>

      {/* Row 2 — Lifecycle */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credential lifecycle</CardTitle>
            <CardDescription>Click a status to filter</CardDescription>
          </CardHeader>
          <CardContent>
            <LifecycleChart counts={lifecycleCounts} />
          </CardContent>
        </Card>
      </div>

      {/* Row 3 — Actions + Bloxberg */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2" id="actions">
        <ActionsCard
          awaitingSig={awaitingSig.length}
          openRequests={openRequests.length}
          pendingAcceptance={pendingAcceptance.length}
          queued={queuedAnchors.length}
          failed={failedAnchors.length}
        />
        <BloxbergCard
          queued={queuedAnchors.length}
          failed={failedAnchors.length}
          confirmed={confirmedAnchors.length}
          lastConfirmedAt={
            confirmedAnchors
              .map((c) => c.issuedAt)
              .sort()
              .slice(-1)[0]
          }
          issuerAddress={confirmedAnchors[0]?.blockchain.issuerAddress}
          contractAddress={confirmedAnchors[0]?.blockchain.contractAddress}
        />
      </div>

      {/* Row 4 — Templates + Issuers */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <TopTemplatesTable templates={orgTemplates} credentials={orgCredsAll} />
        <IssuerActivityTable
          users={orgUsers}
          credentials={orgCredsAll}
          applications={orgApps}
          templateAssignees={templateAssignees}
        />
      </div>

      {/* Row 5 — Learner overview + Recent activity */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <LearnerOverview
          credentials={orgCredsAll}
          pendingAcceptance={pendingAcceptance.length}
        />
        <TemplateStatusPanel
          templates={orgTemplates}
          credentials={orgCredsAll}
        />
      </div>

      <div className="mt-6">
        <RecentActivity items={recentActivity} />
      </div>
    </PageShell>
  );
}

// ============ Subcomponents ============

function DashboardFilters({
  period,
  onPeriod,
  templateFilter,
  onTemplate,
  templates,
}: {
  period: Period;
  onPeriod: (p: Period) => void;
  templateFilter: string;
  onTemplate: (id: string) => void;
  templates: MicroCredentialTemplate[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={period} onValueChange={(v) => onPeriod(v as Period)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="6m">Last 6 months</SelectItem>
          <SelectItem value="ay">This academic year</SelectItem>
          <SelectItem value="all">All time</SelectItem>
        </SelectContent>
      </Select>
      <Select value={templateFilter} onValueChange={onTemplate}>
        <SelectTrigger className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All micro-credentials</SelectItem>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function buildTimeSeries(creds: IssuedCredential[], period: Period) {
  const start = periodStart(period);
  const granularity =
    period === "30d" ? "day" : period === "6m" ? "week" : "month";

  type Bucket = { issued: number; confirmed: number; bucketStart: Date };
  const buckets = new Map<string, Bucket>();

  // Normalize a date to its bucket-start (week = Monday)
  const toBucketStart = (d: Date): Date => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (granularity === "day") return x;
    if (granularity === "month") return new Date(x.getFullYear(), x.getMonth(), 1);
    const day = x.getDay(); // 0=Sun..6=Sat
    const diff = (day + 6) % 7; // days since Monday
    x.setDate(x.getDate() - diff);
    return x;
  };

  const bucketKey = (d: Date) =>
    `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  const advance = (d: Date) => {
    if (granularity === "day") d.setDate(d.getDate() + 1);
    else if (granularity === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
  };

  const fmtLabel = (d: Date) => {
    if (granularity === "month")
      return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    // day and week → use the bucket-start date
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const fmtRange = (d: Date) => {
    if (granularity === "day")
      return d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    if (granularity === "month")
      return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    const left = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const right = end.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${left} – ${right}`;
  };

  // Seed buckets
  const cursor = toBucketStart(new Date(start));
  const end = new Date();
  while (cursor <= end) {
    const key = bucketKey(cursor);
    if (!buckets.has(key))
      buckets.set(key, { issued: 0, confirmed: 0, bucketStart: new Date(cursor) });
    advance(cursor);
  }

  for (const c of creds) {
    const d = new Date(c.issuedAt);
    if (d < start) continue;
    const bs = toBucketStart(d);
    const k = bucketKey(bs);
    const b = buckets.get(k) ?? { issued: 0, confirmed: 0, bucketStart: bs };
    b.issued += 1;
    if (c.blockchain.chainStatus === "confirmed") b.confirmed += 1;
    buckets.set(k, b);
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.bucketStart.getTime() - b.bucketStart.getTime())
    .map((b) => ({
      label: fmtLabel(b.bucketStart),
      rangeLabel: fmtRange(b.bucketStart),
      issued: b.issued,
      confirmed: b.confirmed,
    }));
}

function LifecycleChart({
  counts,
}: {
  counts: {
    active: number;
    pending: number;
    expired: number;
    revoked: number;
    superseded: number;
  };
}) {
  const data = [
    { name: "Active", value: counts.active, color: "var(--primary)" },
    {
      name: "Pending acceptance",
      value: counts.pending,
      color: "var(--info)",
    },
    { name: "Expired", value: counts.expired, color: "var(--muted-foreground)" },
    {
      name: "Revoked",
      value: counts.revoked,
      color: "var(--destructive)",
    },
    {
      name: "Superseded",
      value: counts.superseded,
      color: "var(--chart-2)",
    },
  ];
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0)
    return <EmptyBlock label="No credentials to display yet." />;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ left: 12 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            horizontal={false}
          />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12 }}
            width={130}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ActionsCard({
  awaitingSig,
  openRequests,
  pendingAcceptance,
  queued,
  failed,
}: {
  awaitingSig: number;
  openRequests: number;
  pendingAcceptance: number;
  queued: number;
  failed: number;
}) {
  const rows = [
    {
      key: "sig",
      icon: <FileSignature className="h-4 w-4" />,
      label: "Credentials awaiting signature",
      count: awaitingSig,
      to: "/issuer/requests",
      cta: "Review",
    },
    {
      key: "req",
      icon: <ClipboardList className="h-4 w-4" />,
      label: "Open learner requests",
      count: openRequests,
      to: "/issuer/requests",
      cta: "Review requests",
    },
    {
      key: "acc",
      icon: <Inbox className="h-4 w-4" />,
      label: "Pending learner acceptance",
      count: pendingAcceptance,
      to: "/issuer/credentials",
      cta: "View",
    },
    {
      key: "q",
      icon: <Activity className="h-4 w-4" />,
      label: "Blockchain operations queued",
      count: queued,
      to: "/issuer/anchoring-queue",
      cta: "Open queue",
    },
    {
      key: "f",
      icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
      label: "Blockchain operations failed",
      count: failed,
      to: "/issuer/anchoring-queue",
      cta: "Retry",
    },
  ].filter((r) => r.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Actions requiring attention</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No actions require your attention.
          </p>
        )}
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted">
                {r.icon}
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium">{r.label}</div>
                <div className="text-xs text-muted-foreground">
                  {r.count} item{r.count === 1 ? "" : "s"}
                </div>
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to={r.to}>{r.cta}</Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

type ChainAvail =
  | { status: "ok"; chainId: number; rpcUrl: string; credentialAddress: string; templateAddress: string; issuerAddress: string; balanceWei: string }
  | { status: "missing_config"; reason: string }
  | { status: "rpc_unavailable"; reason: string }
  | { status: "insufficient_balance"; reason: string; issuerAddress: string }
  | { status: "missing_role"; reason: string; issuerAddress: string; missingOn: ("template" | "credential")[] }
  | { status: "loading" };

function formatBalance(wei: string): string {
  try {
    const v = BigInt(wei);
    const whole = v / 10n ** 18n;
    const frac = v % 10n ** 18n;
    const fracStr = (frac.toString().padStart(18, "0")).slice(0, 6).replace(/0+$/, "");
    return fracStr ? `${whole}.${fracStr} BLXBRG` : `${whole} BLXBRG`;
  } catch {
    return "—";
  }
}

function explorerTxUrl(_addr: string) {
  return `https://blockexplorer.bloxberg.org/address/${_addr}`;
}

function BloxbergCard({
  queued,
  failed,
  confirmed,
  lastConfirmedAt,
}: {
  queued: number;
  failed: number;
  confirmed: number;
  lastConfirmedAt?: string;
  issuerAddress?: string;
  contractAddress?: string;
}) {
  const checkAvail = useServerFn(getChainAvailabilityFn);
  const [avail, setAvail] = useState<ChainAvail>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    checkAvail()
      .then((r) => { if (!cancelled) setAvail(r as ChainAvail); })
      .catch((e: unknown) => { if (!cancelled) setAvail({ status: "rpc_unavailable", reason: (e as Error).message }); });
    return () => { cancelled = true; };
  }, [checkAvail]);

  const isOk = avail.status === "ok";
  const issuerAddr = "issuerAddress" in avail ? (avail as { issuerAddress?: string }).issuerAddress : undefined;
  const credAddr = isOk ? avail.credentialAddress : undefined;
  const tplAddr = isOk ? avail.templateAddress : undefined;

  const rpcBadge = (() => {
    switch (avail.status) {
      case "ok": return <Badge variant="default">Operational</Badge>;
      case "loading": return <Badge variant="secondary">Checking…</Badge>;
      case "missing_config": return <Badge variant="destructive">Not configured</Badge>;
      case "rpc_unavailable": return <Badge variant="destructive">RPC unreachable</Badge>;
      case "insufficient_balance": return <Badge variant="destructive">No balance</Badge>;
      case "missing_role": return <Badge variant="destructive">Missing role</Badge>;
    }
  })();

  const credBadge = isOk
    ? <Badge variant="default">Connected</Badge>
    : avail.status === "missing_role" && avail.missingOn.includes("credential")
      ? <Badge variant="destructive">No ISSUER_ROLE</Badge>
      : <Badge variant="secondary">{avail.status === "missing_config" ? "Not configured" : "Unknown"}</Badge>;
  const tplBadge = isOk
    ? <Badge variant="default">Connected</Badge>
    : avail.status === "missing_role" && avail.missingOn.includes("template")
      ? <Badge variant="destructive">No ISSUER_ROLE</Badge>
      : <Badge variant="secondary">{avail.status === "missing_config" ? "Not configured" : "Unknown"}</Badge>;

  const warnings: { label: string; tone: "warn" | "err" }[] = [];
  if (avail.status === "missing_config") warnings.push({ label: avail.reason, tone: "err" });
  if (avail.status === "rpc_unavailable") warnings.push({ label: `RPC unreachable: ${avail.reason}`, tone: "err" });
  if (avail.status === "insufficient_balance") warnings.push({ label: "Issuer wallet balance is 0 — fund it on Bloxberg faucet", tone: "err" });
  if (avail.status === "missing_role") warnings.push({ label: avail.reason, tone: "err" });
  if (failed > 0) warnings.push({ label: "Failed operations require retry", tone: "err" });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bloxberg status</CardTitle>
        <CardDescription>Blockchain integration scoped to your institution</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <StatRow label="Network" value="Bloxberg" />
          <StatRow label="Chain ID" value={isOk ? String(avail.chainId) : "8995"} />
          <StatRow label="RPC connection" value={rpcBadge} />
          <StatRow label="Wallet balance" value={isOk ? formatBalance(avail.balanceWei) : "—"} />
          <StatRow label="TemplateRegistry" value={tplBadge} />
          <StatRow label="CredentialRegistry" value={credBadge} />
          <StatRow
            label="Issuer wallet"
            value={
              issuerAddr ? (
                <a href={explorerTxUrl(issuerAddr)} target="_blank" rel="noreferrer" className="font-mono text-xs hover:underline">
                  {maskAddress(issuerAddr)}
                </a>
              ) : <span className="text-muted-foreground">—</span>
            }
          />
          <StatRow label="Last confirmed" value={lastConfirmedAt ? timeAgo(lastConfirmedAt) : "—"} />
        </div>

        {(credAddr || tplAddr) && (
          <div className="space-y-1 pt-1 text-xs">
            {tplAddr && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Template contract</span>
                <a href={explorerTxUrl(tplAddr)} target="_blank" rel="noreferrer" className="font-mono hover:underline">{maskAddress(tplAddr)}</a>
              </div>
            )}
            {credAddr && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Credential contract</span>
                <a href={explorerTxUrl(credAddr)} target="_blank" rel="noreferrer" className="font-mono hover:underline">{maskAddress(credAddr)}</a>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Badge variant="outline">Queued: {queued}</Badge>
          <Badge variant={failed > 0 ? "destructive" : "outline"}>Failed: {failed}</Badge>
          <Badge variant="outline">Confirmed: {confirmed}</Badge>
        </div>

        {warnings.length > 0 && (
          <div className="space-y-1 pt-2">
            {warnings.map((w, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-md border p-2 text-xs ${
                  w.tone === "err"
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : "border-warning/30 bg-warning/10 text-warning-foreground"
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {w.label}
              </div>
            ))}
          </div>
        )}

        <Button asChild variant="outline" size="sm" className="mt-2">
          <Link to="/issuer/anchoring-queue">
            <Wallet className="mr-2 h-4 w-4" />
            Open blockchain queue
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}


function StatRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function TopTemplatesTable({
  templates,
  credentials,
}: {
  templates: MicroCredentialTemplate[];
  credentials: IssuedCredential[];
}) {
  const rows = templates
    .map((t) => {
      const creds = credentials.filter((c) => c.templateId === t.id);
      const confirmed = creds.filter(
        (c) => c.blockchain.chainStatus === "confirmed",
      ).length;
      const anchorable = creds.filter(
        (c) => c.blockchain.chainStatus !== "disabled",
      ).length;
      const learners = new Set(
        creds.filter((c) => c.lifecycle === "issued").map((c) => c.earnerId),
      ).size;
      const lastIssued = creds
        .map((c) => c.issuedAt)
        .sort()
        .slice(-1)[0];
      return {
        t,
        issued: creds.length,
        confirmed,
        anchorable,
        learners,
        lastIssued,
      };
    })
    .filter((r) => r.issued > 0 || r.t.status === "active")
    .sort((a, b) => b.issued - a.issued)
    .slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top micro-credentials</CardTitle>
        <CardDescription>Most issued published templates</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyBlock label="No published templates are available." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Micro-credential</TableHead>
                  <TableHead className="text-right">Version</TableHead>
                  <TableHead className="text-right">Issued</TableHead>
                  <TableHead className="text-right">Learners</TableHead>
                  <TableHead className="text-right">On-chain</TableHead>
                  <TableHead className="text-right">Last issued</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.t.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link
                        to="/issuer/microcredential-templates/$id"
                        params={{ id: r.t.id }}
                        className="hover:underline"
                      >
                        {r.t.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.t.version}
                    </TableCell>
                    <TableCell className="text-right">{r.issued}</TableCell>
                    <TableCell className="text-right">{r.learners}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.confirmed} / {r.anchorable}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.lastIssued
                        ? new Date(r.lastIssued).toLocaleDateString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IssuerActivityTable({
  users,
  credentials,
  applications,
  templateAssignees,
}: {
  users: MockUser[];
  credentials: IssuedCredential[];
  applications: CredentialApplication[];
  templateAssignees: { templateId: string; userId: string }[];
}) {
  const rows = users.map((u) => {
    const tplIds = new Set(
      templateAssignees
        .filter((a) => a.userId === u.id)
        .map((a) => a.templateId),
    );
    const isAdmin = u.subRole === "admin";
    const issuedCount = credentials.filter(
      (c) => isAdmin || tplIds.has(c.templateId),
    ).length;
    const pending = applications.filter(
      (a) =>
        (isAdmin || tplIds.has(a.templateId)) &&
        a.status === "verified_by_provider",
    ).length;
    const lastAct = credentials
      .filter((c) => isAdmin || tplIds.has(c.templateId))
      .map((c) => c.issuedAt)
      .sort()
      .slice(-1)[0];
    return {
      u,
      managed: isAdmin ? "All" : String(tplIds.size),
      issuedCount,
      pending,
      lastAct,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Issuer activity</CardTitle>
        <CardDescription>
          Authorised issuers and staff in your institution
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyBlock label="No issuers or staff have been added yet." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Issuer</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Templates</TableHead>
                  <TableHead className="text-right">Issued</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Last activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.u.id}>
                    <TableCell className="font-medium">{r.u.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {r.u.subRole === "admin" ? "Admin" : "Staff"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.managed}</TableCell>
                    <TableCell className="text-right">{r.issuedCount}</TableCell>
                    <TableCell className="text-right">{r.pending}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.lastAct
                        ? new Date(r.lastAct).toLocaleDateString()
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="mt-3">
          <Button asChild size="sm" variant="outline">
            <Link to="/issuer/staff">
              <Users className="mr-2 h-4 w-4" />
              Manage staff
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LearnerOverview({
  credentials,
  pendingAcceptance,
}: {
  credentials: IssuedCredential[];
  pendingAcceptance: number;
}) {
  const byLearner = new Map<string, number>();
  for (const c of credentials) {
    if (c.lifecycle !== "issued" && c.status !== "active") continue;
    byLearner.set(c.earnerId, (byLearner.get(c.earnerId) ?? 0) + 1);
  }
  const unique = byLearner.size;
  const multi = Array.from(byLearner.values()).filter((n) => n > 1).length;
  const avg =
    unique === 0
      ? 0
      : Math.round(
          (Array.from(byLearner.values()).reduce((s, n) => s + n, 0) / unique) *
            10,
        ) / 10;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const newThisMonth = new Set(
    credentials
      .filter((c) => new Date(c.issuedAt) >= startOfMonth)
      .map((c) => c.earnerId),
  ).size;

  const buckets = { one: 0, twoThree: 0, fourPlus: 0 };
  for (const n of byLearner.values()) {
    if (n === 1) buckets.one++;
    else if (n <= 3) buckets.twoThree++;
    else buckets.fourPlus++;
  }
  const dist = [
    { name: "1", value: buckets.one },
    { name: "2–3", value: buckets.twoThree },
    { name: "4+", value: buckets.fourPlus },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Learner overview</CardTitle>
        <CardDescription>Aggregate institutional view</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <StatRow label="Unique learners" value={unique} />
          <StatRow label="New this month" value={newThisMonth} />
          <StatRow label="Avg / learner" value={avg} />
          <StatRow label="Multi-credential" value={multi} />
          <StatRow label="Awaiting acceptance" value={pendingAcceptance} />
        </div>
        {unique > 0 && (
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dist} margin={{ left: 40, bottom: 5 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis dataKey="name" tick={{ fontSize: 12 }}>
                  <Label
                    value="Credentials per learner"
                    position="insideBottom"
                    offset={-2}
                    style={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
                </XAxis>
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={45} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="var(--primary)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TemplateStatusPanel({
  templates,
  credentials,
}: {
  templates: MicroCredentialTemplate[];
  credentials: IssuedCredential[];
}) {
  const lifecycle = {
    draft: templates.filter((t) => t.status === "draft").length,
    published: templates.filter((t) => t.status === "active").length,
    archived: templates.filter((t) => t.status === "archived").length,
  };
  // Per-template blockchain aggregation: pick a single representative status
  // per template based on its credentials' chainStatus values.
  // Priority: failed > pending > submitted > confirmed > disabled > not_anchored
  const tplChain = new Map<string, string>();
  const priority: Record<string, number> = {
    failed: 5,
    pending: 4,
    submitted: 3,
    confirmed: 2,
    disabled: 1,
    not_anchored: 0,
  };
  // Seed every template as "not_anchored" so templates without credentials still count
  for (const t of templates) tplChain.set(t.id, "not_anchored");
  for (const c of credentials) {
    const s = c.blockchain.chainStatus ?? "not_anchored";
    const cur = tplChain.get(c.templateId) ?? "not_anchored";
    if ((priority[s] ?? 0) > (priority[cur] ?? 0)) {
      tplChain.set(c.templateId, s);
    }
  }
  const chain = {
    not_anchored: 0,
    pending: 0,
    submitted: 0,
    confirmed: 0,
    failed: 0,
    disabled: 0,
  };
  for (const v of tplChain.values()) {
    if (v in chain) (chain as Record<string, number>)[v]++;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">MC template status</CardTitle>
        <CardDescription>
          Lifecycle and blockchain status
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border p-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Lifecycle
          </div>
          <div className="space-y-1.5 text-sm">
            <StatLine label="Draft" value={lifecycle.draft} />
            <StatLine label="Published" value={lifecycle.published} />
            <StatLine label="Archived" value={lifecycle.archived} />
          </div>
        </div>
        <div className="rounded-md border border-border p-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Blockchain
          </div>
          <div className="space-y-1.5 text-sm">
            <StatLine label="Not anchored" value={chain.not_anchored} />
            <StatLine label="Pending" value={chain.pending} />
            <StatLine label="Submitted" value={chain.submitted} />
            <StatLine label="Confirmed on Bloxberg" value={chain.confirmed} />
            <StatLine label="Failed anchoring" value={chain.failed} />
            <StatLine label="Anchoring disabled" value={chain.disabled} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


function StatLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function RecentActivity({
  items,
}: {
  items: { id: string; at: string; title: string; kind: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent institutional activity</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyBlock label="No recent activity for your institution." />
        ) : (
          <div className="divide-y divide-border">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex items-start gap-3 py-2.5 text-sm"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted">
                  {iconForKind(it.kind)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{it.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {timeAgo(it.at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/issuer/credentials">
              View all activity
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function iconForKind(kind: string) {
  switch (kind) {
    case "issuance":
      return <Award className="h-4 w-4" />;
    case "revocation":
      return <AlertTriangle className="h-4 w-4" />;
    case "application":
      return <ClipboardList className="h-4 w-4" />;
    case "audit":
      return <ListChecks className="h-4 w-4" />;
    default:
      return <Sparkles className="h-4 w-4" />;
  }
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="grid place-items-center rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
