import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, ChevronDown, Copy, ExternalLink, Eye, EyeOff, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  BLOCKCHAIN_BADGE_CLASS,
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
  const { t } = useTranslation("common");
  const status = normaliseStatus(data.blockchainStatus);
  const label = t(`blockchain.${status}`);
  const description = t(`blockchainCard.desc.${status}`);
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
          {t("blockchainCard.title")}
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
        <p className="text-xs text-muted-foreground italic">{t("blockchainCard.internalVsChain")}</p>

        <dl className="grid gap-2 rounded-md bg-muted/40 p-3 font-mono text-xs">
          <FieldRow label={t("blockchainCard.fields.credentialId")} value={data.credentialId} />
          <FieldRow label={t("blockchainCard.fields.vcId")} value={data.vcId ?? null} />
          <FieldRow label={t("blockchainCard.fields.templateRef")} value={prefix0x(data.templateRef)} />
          <FieldRow label={t("blockchainCard.fields.network")} value={data.network ?? "bloxberg"} />
          <FieldRow label={t("blockchainCard.fields.chainId")} value={data.chainId != null ? String(data.chainId) : "8995"} />
          <FieldRow label={t("blockchainCard.fields.contract")} value={data.contractAddress ?? null} href={contractUrl} />
          <FieldRow label={t("blockchainCard.fields.documentHash")} value={prefix0x(data.documentHash)} />
          <FieldRow label={t("blockchainCard.fields.learnerCommitment")} value={prefix0x(data.learnerCommitment)} />
          <FieldRow label={t("blockchainCard.fields.transaction")} value={data.transactionHash ?? null} href={txUrl} />
          <FieldRow
            label={t("blockchainCard.fields.block")}
            value={data.blockNumber != null ? String(data.blockNumber) : null}
          />
          <FieldRow
            label={t("blockchainCard.fields.anchoredAt")}
            value={data.anchoredAt ? new Date(data.anchoredAt).toLocaleString() : null}
          />
          <FieldRow label={t("blockchainCard.fields.issuerWallet")} value={data.issuerAddress ?? null} href={issuerUrl} />
        </dl>

        {audience === "owner" && (
          <OwnerSecretReveal credentialId={data.credentialId} />
        )}

        {txUrl && (
          <Button size="sm" variant="outline" asChild>
            <a href={txUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1 h-3 w-3" /> {t("blockchainCard.explorer")}
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
  const { t } = useTranslation("common");
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
            aria-label={t("blockchainCard.copy", { label })}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        )}
      </dd>
    </div>
  );
}

function OwnerSecretReveal({ credentialId }: { credentialId: string }) {
  const { t } = useTranslation("common");
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
          <div className="text-xs font-medium">{t("blockchainCard.secret.title")}</div>
          <p className="text-xs text-muted-foreground">
            {t("blockchainCard.secret.desc")}
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
          {open ? t("blockchainCard.secret.hide") : mut.isPending ? t("blockchainCard.secret.loading") : t("blockchainCard.secret.reveal")}
        </Button>
      </div>
      {open && secret && (
        <div className="mt-2 break-all rounded bg-muted/60 p-2 font-mono text-xs">
          {secret.startsWith("0x") ? secret : `0x${secret}`}
        </div>
      )}
      {open && !secret && (
        <div className="mt-2 text-xs text-muted-foreground">{t("blockchainCard.secret.none")}</div>
      )}
    </div>
  );
}
