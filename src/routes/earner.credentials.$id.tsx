import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { ArrowLeft, Copy, ExternalLink, Share2, Check, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { ChainPendingChip } from "@/components/CredentialCard";
import { CredentialBlockchainVerificationCard } from "@/components/CredentialBlockchainVerificationCard";
import { EvidenceSection } from "@/components/evidence/EvidenceSection";
import { ShareDialog } from "@/components/ShareDialog";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import i18n from "@/i18n";
import {
  fetchMyCredential,
  isUuid,
  updateCredentialSharing,
  type DbCredential,
} from "@/lib/credentials";
import { acceptCredential, rejectCredential } from "@/lib/chain/anchor.functions";
import type { SharingSettings, IssuedCredential } from "@/lib/types";

export const Route = createFileRoute("/earner/credentials/$id")({
  head: () => ({ meta: [{ title: "Credential — MicroCred" }] }),
  component: () => (
    <RoleGuard role="earner">
      <Detail />
    </RoleGuard>
  ),
});

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(i18n.t("credentialDetail.shareCard.linkCopied", { ns: "earner" }));
  } catch {
    toast.error(i18n.t("credentialDetail.shareCard.copyDenied", { ns: "earner" }));
  }
}

function Detail() {
  const { id } = Route.useParams();
  const isReal = isUuid(id);
  return isReal ? <RealDetail credentialId={id} /> : <MockDetail credentialId={id} />;
}

/* ---------------- Real (DB-backed) ---------------- */

function RealDetail({ credentialId }: { credentialId: string }) {
  const qc = useQueryClient();
  const { t } = useTranslation("earner");
  const { data, isLoading, error } = useQuery({
    queryKey: ["credential", credentialId],
    queryFn: () => fetchMyCredential(credentialId),
  });

  if (isLoading) return <PageShell title={t("credentialDetail.loading")} description=""><div /></PageShell>;
  if (error || !data) throw notFound();

  const cred = data;
  const verifyPath = `/verify/${cred.share_token}`;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}${verifyPath}` : verifyPath;

  async function onToggle(patch: Partial<SharingSettings>) {
    try {
      await updateCredentialSharing(credentialId, patch);
      await qc.invalidateQueries({ queryKey: ["credential", credentialId] });
    } catch (e) {
      toast.error(t("credentialDetail.visibility.saveFailed"), { description: (e as Error).message });
    }
  }

  const sharing: SharingSettings = {
    isPublic: cred.share_is_public,
    showGrade: cred.share_show_grade,
    showSource: cred.share_show_source,
    showExpiry: cred.share_show_expiry,
    showSkills: cred.share_show_skills,
    showLevel: cred.share_show_level,
    showPrerequisites: cred.share_show_prerequisites,
    showSupervision: cred.share_show_supervision,
    showIntegration: cred.share_show_integration,
  };

  return (
    <DetailLayout
      title={cred.title}
      subtitle={t("credentials.pendingCard.issuedBy", { name: cred.issuer_name })}
      status={cred.status as IssuedCredential["status"]}
      source={cred.source as IssuedCredential["source"]}
      level={cred.level as IssuedCredential["level"]}
      ects={cred.ects ?? undefined}
      issuerName={cred.issuer_name}
      issuedAt={cred.issued_at}
      expiresAt={cred.expires_at ?? undefined}
      grade={cred.grade ?? undefined}
      skills={cred.skills}
      outcomes={cred.outcomes ?? []}
      blockchain={dbToBlockchain(cred)}
      sharing={sharing}
      shareUrl={shareUrl}
      verifyPath={verifyPath}
      onToggle={onToggle}
      credentialId={cred.id}
      lifecycle={cred.credential_lifecycle as IssuedCredential["lifecycle"]}
      rejectionReason={cred.rejection_reason ?? undefined}
      onAcceptanceChanged={() => qc.invalidateQueries({ queryKey: ["credential", credentialId] })}
      evidence={{ credentialId: cred.id, privateProofAvailable: !!cred.learner_secret }}
    />
  );
}

function dbToBlockchain(c: DbCredential) {
  return {
    did: c.ebsi_did ?? undefined,
    vcId: c.ebsi_vc_id ?? undefined,
    txHash: c.chain_tx_hash ?? c.ebsi_tx_hash ?? undefined,
    ebsiStatus: (c.ebsi_status as "not_anchored" | "pending" | "anchored") ?? "not_anchored",
    chainStatus: (c.chain_status as "pending" | "submitted" | "confirmed" | "failed" | "disabled" | null) ?? "pending",
    blockNumber: c.chain_block_number ?? undefined,
    issuerAddress: c.chain_issuer_address ?? undefined,
    contractAddress: c.chain_contract_address ?? undefined,
    documentHash: c.credential_hash ?? undefined,
    learnerCommitment: c.learner_commitment ?? undefined,
    templateRef: c.template_ref ?? undefined,
    learnerSecret: c.learner_secret ?? undefined,
  };
}

/* ---------------- Mock (in-memory) ---------------- */

function MockDetail({ credentialId }: { credentialId: string }) {
  const { credentials, updateSharing } = useStore();
  const { t } = useTranslation("earner");
  const cred = credentials.find((c) => c.id === credentialId);
  if (!cred) throw notFound();

  const verifyPath = cred.verificationLink;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}${verifyPath}` : verifyPath;

  return (
    <DetailLayout
      title={cred.title}
      subtitle={t("credentials.pendingCard.issuedBy", { name: cred.issuerName })}
      status={cred.status}
      source={cred.source}
      level={cred.level}
      ects={cred.ects}
      issuerName={cred.issuerName}
      issuedAt={cred.issuedAt}
      expiresAt={cred.expiresAt}
      grade={cred.grade}
      skills={cred.skills}
      blockchain={cred.blockchain}
      sharing={cred.sharing}
      shareUrl={shareUrl}
      verifyPath={verifyPath}
      onToggle={(patch) => Promise.resolve(updateSharing(cred.id, patch))}
      credentialId={cred.id}
      lifecycle={cred.lifecycle}
      rejectionReason={cred.rejectionReason}
      mockNotice
    />
  );
}

/* ---------------- Shared layout ---------------- */

interface DetailLayoutProps {
  title: string;
  subtitle: string;
  status: IssuedCredential["status"];
  source: IssuedCredential["source"];
  level: IssuedCredential["level"];
  ects?: number;
  issuerName: string;
  providerName?: string;
  issuedAt: string;
  expiresAt?: string;
  grade?: string;
  skills: string[];
  outcomes?: string[];
  blockchain: IssuedCredential["blockchain"];
  sharing: SharingSettings;
  shareUrl: string;
  verifyPath: string;
  credentialId: string;
  onToggle: (patch: Partial<SharingSettings>) => Promise<void> | void;
  mockNotice?: boolean;
  lifecycle?: IssuedCredential["lifecycle"];
  rejectionReason?: string;
  onAcceptanceChanged?: () => void;
  evidence?: { credentialId: string; privateProofAvailable: boolean };
}

function DetailLayout(p: DetailLayoutProps) {
  const { t } = useTranslation(["earner", "common"]);
  const isPending = p.lifecycle === "pending_earner_acceptance";
  const isRejected = p.lifecycle === "rejected";
  const VISIBILITY_KEYS = [
    "isPublic",
    "showSource",
    "showGrade",
    "showExpiry",
    "showLevel",
    "showPrerequisites",
    "showSupervision",
    "showIntegration",
  ] as const;
  return (
    <PageShell
      title={p.title}
      description={p.subtitle}
      actions={
        <Button variant="outline" asChild>
          <Link to="/earner/credentials">
            <ArrowLeft className="mr-1 h-4 w-4" /> {t("credentialDetail.back")}
          </Link>
        </Button>
      }
    >
      {isPending && (
        <AcceptanceBanner
          credentialId={p.credentialId}
          onChanged={p.onAcceptanceChanged}
          mockNotice={p.mockNotice}
        />
      )}
      {isRejected && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <div className="font-medium text-destructive">{t("credentialDetail.rejectedBanner.title")}</div>
          {p.rejectionReason && (
            <div className="mt-1 text-muted-foreground">{t("credentialDetail.rejectedBanner.reason", { reason: p.rejectionReason })}</div>
          )}
          <div className="mt-1 text-xs text-muted-foreground">
            {t("credentialDetail.rejectedBanner.waiting")}
          </div>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("credentialDetail.fields.status")}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusBadge status={p.status} />
                    {p.status === "active" && <ChainPendingChip status={p.blockchain?.chainStatus} />}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="capitalize">
                    {p.source === "formal" ? t("source.formal", { ns: "common" }) : t("source.non_formal", { ns: "common" })}
                  </Badge>
                  {p.level !== "N/A" && <Badge variant="outline">{p.level}</Badge>}
                  {p.ects && <Badge variant="outline">{p.ects} ECTS</Badge>}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Field label={t("credentialDetail.fields.issuer")} value={p.issuerName} />
                {p.providerName && <Field label={t("credentialDetail.fields.courseProvider")} value={p.providerName} />}
                <Field label={t("credentialDetail.fields.issued")} value={new Date(p.issuedAt).toLocaleDateString()} />
                {p.expiresAt && <Field label={t("credentialDetail.fields.expires")} value={new Date(p.expiresAt).toLocaleDateString()} />}
                {p.grade && <Field label={t("credentialDetail.fields.grade")} value={p.grade} />}
              </dl>
              {p.outcomes && p.outcomes.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("credentialDetail.fields.outcomes")}</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                    {p.outcomes.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
              {p.skills.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("credentialDetail.fields.skills")}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.skills.map((s) => (
                      <Badge key={s} variant="secondary">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <CredentialBlockchainVerificationCard
            data={{
              credentialId: p.credentialId,
              vcId: p.blockchain?.vcId ?? null,
              templateRef: p.blockchain?.templateRef ?? null,
              network: "bloxberg",
              chainId: 8995,
              contractAddress: p.blockchain?.contractAddress ?? null,
              blockchainStatus: p.blockchain?.chainStatus ?? "not_requested",
              documentHash: p.blockchain?.documentHash ?? null,
              learnerCommitment: p.blockchain?.learnerCommitment ?? null,
              transactionHash: p.blockchain?.txHash ?? null,
              blockNumber: p.blockchain?.blockNumber ?? null,
              issuerAddress: p.blockchain?.issuerAddress ?? null,
            }}
            audience="owner"
          />

          {p.evidence && !isPending && !isRejected && (
            <EvidenceSection
              credentialId={p.evidence.credentialId}
              isOwner
              privateProofAvailable={p.evidence.privateProofAvailable}
            />
          )}

        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("credentialDetail.shareCard.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-border bg-muted/40 p-2 font-mono text-xs break-all">{p.shareUrl}</div>
              <div className="flex flex-wrap gap-2">
                <ShareDialog
                  url={p.verifyPath}
                  title={p.title}
                  summary={t("credentialDetail.shareCard.summary", { name: p.issuerName })}
                  qrId={`qr-${p.credentialId}`}
                  certification={{
                    name: p.title,
                    organizationName: p.issuerName,
                    issueDate: p.issuedAt,
                    expirationDate: p.expiresAt,
                    certId: p.credentialId,
                  }}
                  trigger={
                    <Button size="sm">
                      <Share2 className="mr-1 h-3 w-3" /> {t("credentialDetail.shareCard.share")}
                    </Button>
                  }
                />
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(p.shareUrl)}>
                  <Copy className="mr-1 h-3 w-3" /> {t("credentialDetail.shareCard.copy")}
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={p.verifyPath} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1 h-3 w-3" /> {t("credentialDetail.shareCard.open")}
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("credentialDetail.visibility.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {p.mockNotice
                  ? t("credentialDetail.visibility.demoNotice")
                  : t("credentialDetail.visibility.liveNotice")}
              </p>
              {VISIBILITY_KEYS.map((k) => (
                <label key={k} className="flex items-center justify-between text-sm">
                  <span>{t(`credentialDetail.visibility.${k}`)}</span>
                  <Switch
                    checked={p.sharing[k]}
                    onCheckedChange={(v) => p.onToggle({ [k]: v } as Partial<SharingSettings>)}
                  />
                </label>
              ))}
              <p className="pt-2 text-xs text-muted-foreground border-t border-border">
                {t("credentialDetail.visibility.footer")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

function AcceptanceBanner({
  credentialId,
  onChanged,
  mockNotice,
}: {
  credentialId: string;
  onChanged?: () => void;
  mockNotice?: boolean;
}) {
  const { t } = useTranslation(["earner", "common"]);
  const accept = useServerFn(acceptCredential);
  const reject = useServerFn(rejectCredential);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const onAccept = async () => {
    if (mockNotice) {
      toast.info(t("credentialDetail.acceptance.demoNotice"));
      return;
    }
    setBusy(true);
    try {
      const res = await accept({ data: { credentialId } });
      if ((res as any)?.chainPending) {
        toast.success(t("credentials.toasts.accepted"), {
          description: t("credentials.toasts.acceptedPending"),
        });
      } else {
        toast.success(t("credentials.toasts.accepted"));
      }
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? t("credentials.toasts.couldNotAccept"));
    } finally {
      setBusy(false);
    }
  };

  const onReject = async () => {
    if (!reason.trim()) {
      toast.error(t("credentials.rejectDialog.reasonRequired"));
      return;
    }
    setBusy(true);
    try {
      await reject({ data: { credentialId, reason: reason.trim() } });
      toast.success(t("credentials.toasts.rejected"));
      setOpen(false);
      setReason("");
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? t("credentials.toasts.couldNotReject"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-4">
      <div className="font-medium text-warning-foreground">{t("credentialDetail.acceptance.title")}</div>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("credentialDetail.acceptance.description")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onAccept} disabled={busy}>
          <Check className="mr-1 h-3.5 w-3.5" /> {t("credentialDetail.acceptance.acceptBtn")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={busy}>
          <X className="mr-1 h-3.5 w-3.5" /> {t("credentialDetail.acceptance.rejectBtn")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("credentialDetail.rejectDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("credentialDetail.rejectDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("credentialDetail.rejectDialog.placeholder")}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("actions.cancel", { ns: "common" })}</Button>
            <Button variant="destructive" disabled={busy} onClick={onReject}>{t("credentialDetail.rejectDialog.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
