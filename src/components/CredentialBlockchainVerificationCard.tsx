import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Eye, EyeOff, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  BLOCKCHAIN_LABEL,
  BLOCKCHAIN_BADGE_CLASS,
  CREDENTIAL_BLOCKCHAIN_DESCRIPTION,
  TOOLTIPS,
  explorerTxUrl,
  explorerAddrUrl,
  type BlockchainStatus,
} from "@/lib/status-labels";

// Public-safe credential anchor data. Never expose internal earner UUID or
// learner_secret here — the secret is fetched on-demand via revealLearnerSecret.
export interface CredentialVerificationData {
  credentialId: string;
  vcId?: string | null;
  templateRef?: string | null;
  network?: string | null;
  chainId?: number | null;
  contractAddress?: string | null;
  blockchainStatus?: string | null;
  documentHash?: string | null;
  learnerCommitment?: string | null;
  transactionHash?: string | null;
  blockNumber?: number | null;
  anchoredAt?: string | null;
  issuerAddress?: string | null;
}

interface Props {
  data: CredentialVerificationData;
  audience: "owner" | "issuer" | "public";
  compact?: boolean;
}

function normaliseStatus(s?: string | null): BlockchainStatus {
  switch (s) {
    case "not_requested":
    case "queued":
    case "submitting":
    case "submitted":
    case "confirmed":
    case "failed":
    case "cancelled":
      return s;
    case "pending":
      return "queued";
    default:
      return "not_requested";
  }
}

export function CredentialBlockchainVerificationCard({ data, audience, compact }: Props) {
  const status = normaliseStatus(data.blockchainStatus);
  const label = BLOCKCHAIN_LABEL[status];
  const description = CREDENTIAL_BLOCKCHAIN_DESCRIPTION[status];
  const badgeClass = BLOCKCHAIN_BADGE_CLASS[status];

  if (status === "not_requested" && audience === "public") {
    // Earner-facing: hide the entire row when no anchor is requested (per spec).
    return null;
  }

  const txUrl = explorerTxUrl(data.transactionHash);
  const contractUrl = explorerAddrUrl(data.contractAddress);
  const issuerUrl = explorerAddrUrl(data.issuerAddress);

  return (
    <Card>
      <CardHeader className={compact ? "pb-3" : undefined}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4 text-primary" />
          Blockchain verification
          <Badge
            variant="outline"
            className={`ml-2 text-[10px] uppercase tracking-wider ${badgeClass}`}
          >
            {label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground italic">{TOOLTIPS.internalVsChain}</p>

        <dl className="grid gap-2 rounded-md bg-muted/40 p-3 font-mono text-xs">
          <FieldRow label="Credential ID" value={data.credentialId} />
          <FieldRow label="VC ID" value={data.vcId ?? null} />
          <FieldRow label="Template ref" value={prefix0x(data.templateRef)} />
          <FieldRow label="Network" value={data.network ?? "bloxberg"} />
          <FieldRow label="Chain ID" value={data.chainId != null ? String(data.chainId) : "8995"} />
          <FieldRow label="Contract" value={data.contractAddress ?? null} href={contractUrl} />
          <FieldRow label="Document hash" value={prefix0x(data.documentHash)} />
          <FieldRow label="Learner commitment" value={prefix0x(data.learnerCommitment)} />
          <FieldRow label="Transaction" value={data.transactionHash ?? null} href={txUrl} />
          <FieldRow
            label="Block"
            value={data.blockNumber != null ? String(data.blockNumber) : null}
          />
          <FieldRow
            label="Anchored at"
            value={data.anchoredAt ? new Date(data.anchoredAt).toLocaleString() : null}
          />
          <FieldRow label="Issuer wallet" value={data.issuerAddress ?? null} href={issuerUrl} />
        </dl>

        {audience === "owner" && (
          <OwnerSecretReveal credentialId={data.credentialId} />
        )}

        {txUrl && (
          <Button size="sm" variant="outline" asChild>
            <a href={txUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1 h-3 w-3" /> View on Bloxberg explorer
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function prefix0x(hex?: string | null): string | null {
  if (!hex) return null;
  return hex.startsWith("0x") ? hex : `0x${hex}`;
}

function FieldRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null;
  href?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const display = value ?? "—";
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1 break-all text-foreground">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:underline"
          >
            {display}
          </a>
        ) : (
          <span>{display}</span>
        )}
        {value && (
          <button
            type="button"
            className="opacity-60 hover:opacity-100"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              } catch {
                /* ignore */
              }
            }}
            aria-label={`Copy ${label}`}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        )}
      </dd>
    </div>
  );
}

function OwnerSecretReveal({ credentialId }: { credentialId: string }) {
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const { revealLearnerSecret } = await import("@/lib/chain/anchor.functions");
      const res = await revealLearnerSecret({ data: { credentialId } });
      return res.secret;
    },
    onSuccess: (s) => {
      setSecret(s);
      setOpen(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-md border border-dashed border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium">Your proof secret</div>
          <p className="text-xs text-muted-foreground">
            Combined with the on-chain learner commitment, this proves the credential belongs to
            you. Keep it private — never share publicly.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (open) {
              setOpen(false);
              return;
            }
            if (secret) setOpen(true);
            else mut.mutate();
          }}
          disabled={mut.isPending}
        >
          {open ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
          {open ? "Hide" : mut.isPending ? "Loading…" : "Reveal"}
        </Button>
      </div>
      {open && secret && (
        <div className="mt-2 break-all rounded bg-muted/60 p-2 font-mono text-xs">
          {secret.startsWith("0x") ? secret : `0x${secret}`}
        </div>
      )}
      {open && !secret && (
        <div className="mt-2 text-xs text-muted-foreground">No secret available.</div>
      )}
    </div>
  );
}
