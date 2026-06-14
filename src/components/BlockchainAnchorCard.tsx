import { useState } from "react";
import { Check, Copy, ExternalLink, Eye, EyeOff, Hexagon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface BlockchainAnchor {
  chainStatus?: string | null;
  txHash?: string | null;
  blockNumber?: number | null;
  issuerAddress?: string | null;
  contractAddress?: string | null;
  documentHash?: string | null;
  learnerCommitment?: string | null;
  templateRef?: string | null;
  learnerSecret?: string | null; // only present for the earner viewing their own credential
}

const EXPLORER = "https://blockexplorer.bloxberg.org";

const STATUS_VARIANT: Record<string, { label: string; cls: string }> = {
  confirmed: { label: "Anchored on Bloxberg", cls: "bg-success/15 text-success-foreground border-success/30" },
  submitted: { label: "Submitting…", cls: "bg-warning/15 text-warning-foreground border-warning/30" },
  pending: { label: "Awaiting anchor", cls: "bg-muted text-muted-foreground border-border" },
  failed: { label: "Anchor failed (will retry)", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  disabled: { label: "Anchoring disabled", cls: "bg-muted text-muted-foreground border-border" },
};

export function BlockchainAnchorCard({
  anchor,
  showSecret = false,
  compact = false,
}: {
  anchor?: BlockchainAnchor;
  showSecret?: boolean;
  compact?: boolean;
}) {
  const status = anchor?.chainStatus ?? "pending";
  const variant = STATUS_VARIANT[status] ?? STATUS_VARIANT.pending;
  const txUrl = anchor?.txHash ? `${EXPLORER}/tx/${anchor.txHash}` : null;
  const contractUrl = anchor?.contractAddress ? `${EXPLORER}/address/${anchor.contractAddress}` : null;

  return (
    <Card>
      <CardHeader className={compact ? "pb-3" : undefined}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Hexagon className="h-4 w-4 text-primary" />
          Bloxberg blockchain anchor
          <Badge variant="outline" className={`ml-2 text-[10px] uppercase tracking-wider ${variant.cls}`}>
            {variant.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {status === "pending" && (
          <p className="text-muted-foreground">
            This credential is queued for on-chain anchoring. Once submitted, the transaction hash will appear here.
          </p>
        )}
        {status === "failed" && (
          <p className="text-muted-foreground">
            Last submission attempt failed. The system will retry automatically.
          </p>
        )}

        <dl className="grid gap-2 rounded-md bg-muted/40 p-3 font-mono text-xs">
          <FieldRow label="Tx hash" value={anchor?.txHash ?? null} href={txUrl} />
          <FieldRow label="Block" value={anchor?.blockNumber != null ? String(anchor.blockNumber) : null} />
          <FieldRow label="Contract" value={anchor?.contractAddress ?? null} href={contractUrl} />
          <FieldRow label="Issuer wallet" value={anchor?.issuerAddress ?? null} />
          <FieldRow label="Document hash" value={prefix0x(anchor?.documentHash)} />
          <FieldRow label="Learner commitment" value={prefix0x(anchor?.learnerCommitment)} />
          <FieldRow label="Template ref" value={prefix0x(anchor?.templateRef)} />
        </dl>

        {showSecret && anchor?.learnerSecret && (
          <SecretReveal secret={anchor.learnerSecret} />
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

function FieldRow({ label, value, href }: { label: string; value: string | null; href?: string | null }) {
  const [copied, setCopied] = useState(false);
  const display = value ?? "—";
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1 break-all text-foreground">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
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

function SecretReveal({ secret }: { secret: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-dashed border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium">Your proof secret</div>
          <p className="text-xs text-muted-foreground">
            Combined with your earner ID, this proves the on-chain learner commitment belongs to you. Keep it private.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
          {open ? "Hide" : "Reveal"}
        </Button>
      </div>
      {open && (
        <div className="mt-2 break-all rounded bg-muted/60 p-2 font-mono text-xs">0x{secret}</div>
      )}
    </div>
  );
}
