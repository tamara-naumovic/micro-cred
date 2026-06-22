import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, Search } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { CredentialCard } from "@/components/CredentialCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";
import { acceptCredential, rejectCredential } from "@/lib/chain/anchor.functions";
import type { IssuedCredential } from "@/lib/types";


export const Route = createFileRoute("/earner/credentials/")({
  head: () => ({ meta: [{ title: "My credentials — MicroCred" }] }),
  component: () => (
    <RoleGuard role="earner">
      <List />
    </RoleGuard>
  ),
});

type TabKey = "pending" | "all" | "active" | "rejected" | "expired" | "revoked";

const TAB_KEYS: TabKey[] = ["pending", "all", "active", "rejected", "expired", "revoked"];

function matches(c: IssuedCredential, tab: TabKey): boolean {
  const lc = c.lifecycle ?? "issued";
  if (tab === "pending") return lc === "pending_earner_acceptance";
  if (tab === "rejected") return lc === "rejected";
  if (tab === "all") return lc !== "pending_earner_acceptance" && lc !== "rejected";
  if (tab === "active") return lc === "issued" && c.status === "active";
  if (tab === "expired") return c.status === "expired";
  if (tab === "revoked") return lc === "revoked";
  return true;
}

function List() {
  const { activeUser, credentials, refresh } = useStore();
  const { t } = useTranslation(["earner", "common"]);
  const [src, setSrc] = useState<"all" | "formal" | "non_formal">("all");
  const [searchQ, setSearchQ] = useState("");
  const [issuerFilter, setIssuerFilter] = useState<string>("all");
  const [rejectTarget, setRejectTarget] = useState<IssuedCredential | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const accept = useServerFn(acceptCredential);
  const reject = useServerFn(rejectCredential);

  if (!activeUser) return null;
  const mine = credentials.filter((c) => c.earnerId === activeUser.id);
  const pendingCount = mine.filter((c) => c.lifecycle === "pending_earner_acceptance").length;
  const issuerOptions = useMemo(
    () => Array.from(new Set(mine.map((c) => c.issuerName).filter(Boolean))).sort(),
    [mine],
  );
  const q = searchQ.trim().toLowerCase();
  const passesFilters = (c: IssuedCredential) => {
    if (src !== "all" && c.source !== src) return false;
    if (issuerFilter !== "all" && c.issuerName !== issuerFilter) return false;
    if (!q) return true;
    if (c.title?.toLowerCase().includes(q)) return true;
    if ((c.skills ?? []).some((s) => s.toLowerCase().includes(q))) return true;
    return false;
  };


  const onAccept = async (c: IssuedCredential) => {
    setBusy(true);
    try {
      const res = await accept({ data: { credentialId: c.id } });
      if ((res as any)?.chainPending) {
        toast.success(t("credentials.toasts.accepted"), {
          description: t("credentials.toasts.acceptedPending"),
        });
      } else {
        toast.success(t("credentials.toasts.accepted"));
      }
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? t("credentials.toasts.couldNotAccept"));
    } finally {
      setBusy(false);
    }
  };

  const onConfirmReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      toast.error(t("credentials.rejectDialog.reasonRequired"));
      return;
    }
    setBusy(true);
    try {
      await reject({ data: { credentialId: rejectTarget.id, reason: rejectReason.trim() } });
      toast.success(t("credentials.toasts.rejected"));
      setRejectTarget(null);
      setRejectReason("");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? t("credentials.toasts.couldNotReject"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title={t("credentials.title")} description={t("credentials.description")}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("credentials.sourceLabel")}</span>
        {(["all", "formal", "non_formal"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSrc(s)}
            className={`rounded-full border px-3 py-1 text-xs ${src === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
          >
            {t(`source.${s}`, { ns: "common" })}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder={t("credentials.searchPlaceholder")}
            className="pl-8"
          />
        </div>
        <Select value={issuerFilter} onValueChange={setIssuerFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder={t("credentials.allIssuers")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("credentials.allIssuers")}</SelectItem>
            {issuerOptions.map((name) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue={pendingCount > 0 ? "pending" : "all"}>
        <TabsList>
          {TAB_KEYS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {t(`credentials.tabs.${tab}`)}
              {tab === "pending" && pendingCount > 0 && (
                <Badge variant="outline" className="ml-2 bg-warning/20 text-warning-foreground border-warning/30">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {TAB_KEYS.map((tab) => {
          const items = mine.filter((c) => matches(c, tab) && passesFilters(c));

          return (
            <TabsContent key={tab} value={tab} className="mt-4">
              {tab === "pending" && items.length > 0 && (
                <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
                  {t("credentials.pendingBanner")}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.map((c) =>
                  c.lifecycle === "pending_earner_acceptance" ? (
                    <PendingCard
                      key={c.id}
                      credential={c}
                      onAccept={() => onAccept(c)}
                      onReject={() => {
                        setRejectTarget(c);
                        setRejectReason("");
                      }}
                      busy={busy}
                    />
                  ) : c.lifecycle === "rejected" ? (
                    <RejectedCard key={c.id} credential={c} />
                  ) : (
                    <CredentialCard
                      key={c.id}
                      credential={c}
                      detailHref={`/earner/credentials/${c.id}`}
                      shareHref={c.shareToken ? `/profile/${c.shareToken}` : undefined}
                    />
                  ),
                )}
                {items.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("credentials.empty")}</p>
                )}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("credentials.rejectDialog.title")}</DialogTitle>
            <DialogDescription>
              {rejectTarget && (
                <Trans
                  i18nKey="credentials.rejectDialog.description"
                  ns="earner"
                  values={{ title: rejectTarget.title }}
                  components={{ strong: <span className="font-medium text-foreground" /> }}
                />
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t("credentials.rejectDialog.placeholder")}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              {t("actions.cancel", { ns: "common" })}
            </Button>
            <Button variant="destructive" disabled={busy} onClick={onConfirmReject}>
              {t("credentials.rejectDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function PendingCard({
  credential,
  onAccept,
  onReject,
  busy,
}: {
  credential: IssuedCredential;
  onAccept: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation("earner");
  return (
    <Card className="border-warning/40">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-warning-foreground">{t("credentials.pendingCard.title")}</div>
            <div className="mt-1 font-display text-lg font-semibold">{credential.title}</div>
            <div className="text-sm text-muted-foreground">{t("credentials.pendingCard.issuedBy", { name: credential.issuerName })}</div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">{t("credentials.pendingCard.issued")}</dt>
            <dd>{new Date(credential.issuedAt).toLocaleDateString()}</dd>
          </div>
          {credential.expiresAt && (
            <div>
              <dt className="text-muted-foreground">{t("credentials.pendingCard.expires")}</dt>
              <dd>{new Date(credential.expiresAt).toLocaleDateString()}</dd>
            </div>
          )}
          {credential.grade && (
            <div>
              <dt className="text-muted-foreground">{t("credentials.pendingCard.grade")}</dt>
              <dd>{credential.grade}</dd>
            </div>
          )}
          {credential.level !== "N/A" && (
            <div>
              <dt className="text-muted-foreground">{t("credentials.pendingCard.level")}</dt>
              <dd>{credential.level}</dd>
            </div>
          )}
        </dl>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={onAccept} disabled={busy}>
            <Check className="mr-1 h-3.5 w-3.5" /> {t("credentials.pendingCard.accept")}
          </Button>
          <Button size="sm" variant="outline" onClick={onReject} disabled={busy}>
            <X className="mr-1 h-3.5 w-3.5" /> {t("credentials.pendingCard.reject")}
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/earner/credentials/$id" params={{ id: credential.id }}>
              {t("credentials.pendingCard.viewDetails")}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RejectedCard({ credential }: { credential: IssuedCredential }) {
  const { t } = useTranslation("earner");
  return (
    <Card className="border-destructive/40">
      <CardContent className="space-y-2 p-5">
        <div className="text-xs uppercase tracking-wider text-destructive">{t("credentials.rejectedCard.title")}</div>
        <div className="font-display text-lg font-semibold">{credential.title}</div>
        <div className="text-sm text-muted-foreground">{t("credentials.rejectedCard.issuedBy", { name: credential.issuerName })}</div>
        {credential.rejectionReason && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
            <span className="font-medium">{t("credentials.rejectedCard.yourReason")}</span> {credential.rejectionReason}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {t("credentials.rejectedCard.waiting")}
        </p>
      </CardContent>
    </Card>
  );
}
