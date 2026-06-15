import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
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
import { CredentialBlockchainVerificationCard } from "@/components/CredentialBlockchainVerificationCard";
import { ShareDialog } from "@/components/ShareDialog";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
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
    toast.success("Link copied");
  } catch {
    toast.error("Copy not allowed in this preview — select the link manually.");
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
  const { data, isLoading, error } = useQuery({
    queryKey: ["credential", credentialId],
    queryFn: () => fetchMyCredential(credentialId),
  });

  if (isLoading) return <PageShell title="Loading…" description=""><div /></PageShell>;
  if (error || !data) throw notFound();

  const cred = data;
  const verifyPath = `/verify/${cred.share_token}`;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}${verifyPath}` : verifyPath;

  async function onToggle(patch: Partial<SharingSettings>) {
    try {
      await updateCredentialSharing(credentialId, patch);
      await qc.invalidateQueries({ queryKey: ["credential", credentialId] });
    } catch (e) {
      toast.error("Could not save", { description: (e as Error).message });
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
      subtitle={`Issued by ${cred.issuer_name}`}
      status={cred.status as IssuedCredential["status"]}
      source={cred.source as IssuedCredential["source"]}
      level={cred.level as IssuedCredential["level"]}
      ects={cred.ects ?? undefined}
      issuerName={cred.issuer_name}
      issuedAt={cred.issued_at}
      expiresAt={cred.expires_at ?? undefined}
      grade={cred.grade ?? undefined}
      skills={cred.skills}
      blockchain={dbToBlockchain(cred)}
      sharing={sharing}
      shareUrl={shareUrl}
      verifyPath={verifyPath}
      onToggle={onToggle}
      credentialId={cred.id}
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
  const cred = credentials.find((c) => c.id === credentialId);
  if (!cred) throw notFound();

  const verifyPath = cred.verificationLink;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}${verifyPath}` : verifyPath;

  return (
    <DetailLayout
      title={cred.title}
      subtitle={`Issued by ${cred.issuerName}`}
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
  blockchain: IssuedCredential["blockchain"];
  sharing: SharingSettings;
  shareUrl: string;
  verifyPath: string;
  credentialId: string;
  onToggle: (patch: Partial<SharingSettings>) => Promise<void> | void;
  mockNotice?: boolean;
}

function DetailLayout(p: DetailLayoutProps) {
  return (
    <PageShell
      title={p.title}
      description={p.subtitle}
      actions={
        <Button variant="outline" asChild>
          <Link to="/earner/credentials">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Link>
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Status</div>
                  <div className="mt-1">
                    <StatusBadge status={p.status} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="capitalize">
                    {p.source === "formal" ? "Formal" : "Non-formal"}
                  </Badge>
                  {p.level !== "N/A" && <Badge variant="outline">{p.level}</Badge>}
                  {p.ects && <Badge variant="outline">{p.ects} ECTS</Badge>}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Field label="Issuer" value={p.issuerName} />
                {p.providerName && <Field label="Course provider" value={p.providerName} />}
                <Field label="Issued" value={new Date(p.issuedAt).toLocaleDateString()} />
                {p.expiresAt && <Field label="Expires" value={new Date(p.expiresAt).toLocaleDateString()} />}
                {p.grade && <Field label="Grade" value={p.grade} />}
              </dl>
              {p.skills.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Skills</div>
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

        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Share & verification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-border bg-muted/40 p-2 font-mono text-xs break-all">{p.shareUrl}</div>
              <div className="flex flex-wrap gap-2">
                <ShareDialog
                  url={p.verifyPath}
                  title={p.title}
                  summary={`Verifiable micro-credential issued by ${p.issuerName}.`}
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
                      <Share2 className="mr-1 h-3 w-3" /> Share
                    </Button>
                  }
                />
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(p.shareUrl)}>
                  <Copy className="mr-1 h-3 w-3" /> Copy
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={p.verifyPath} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1 h-3 w-3" /> Open
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {p.mockNotice
                  ? "Demo credential — toggles change only your local view."
                  : "Changes apply immediately to the public verification page."}
              </p>
              {([
                ["isPublic", "Publicly verifiable"],
                ["showSource", "Show learning source"],
                ["showGrade", "Show grade"],
                ["showExpiry", "Show expiry date"],
                ["showSkills", "Show skills"],
                ["showLevel", "Show level"],
                ["showPrerequisites", "Show prerequisites"],
                ["showSupervision", "Show supervision & ID verification"],
                ["showIntegration", "Show integration / stackability"],
              ] as const).map(([k, label]) => (
                <label key={k} className="flex items-center justify-between text-sm">
                  <span>{label}</span>
                  <Switch
                    checked={p.sharing[k]}
                    onCheckedChange={(v) => p.onToggle({ [k]: v } as Partial<SharingSettings>)}
                  />
                </label>
              ))}
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
