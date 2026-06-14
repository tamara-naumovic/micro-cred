// Centralised label + tooltip mapping for the three independent status systems:
// template lifecycle, credential lifecycle, and blockchain anchoring status.

export type TemplateLifecycle = "draft" | "active" | "archived" | "published";
export type CredentialLifecycle =
  | "draft"
  | "pending_earner_acceptance"
  | "issued"
  | "revoked"
  | "expired"
  | "superseded";
export type BlockchainStatus =
  | "not_requested"
  | "queued"
  | "submitting"
  | "submitted"
  | "confirmed"
  | "failed"
  | "cancelled";

export const TEMPLATE_LIFECYCLE_LABEL: Record<TemplateLifecycle, string> = {
  draft: "Draft",
  active: "Published",
  published: "Published",
  archived: "Archived",
};

export const CREDENTIAL_LIFECYCLE_LABEL: Record<CredentialLifecycle, string> = {
  draft: "Draft",
  pending_earner_acceptance: "Pending acceptance",
  issued: "Issued",
  revoked: "Revoked",
  expired: "Expired",
  superseded: "Superseded",
};

export const BLOCKCHAIN_LABEL: Record<BlockchainStatus, string> = {
  not_requested: "Not requested",
  queued: "Queued",
  submitting: "Submitting",
  submitted: "Submitted",
  confirmed: "Confirmed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const BLOCKCHAIN_BADGE_CLASS: Record<BlockchainStatus, string> = {
  not_requested: "bg-muted text-muted-foreground border-border",
  queued: "bg-muted text-muted-foreground border-border",
  submitting: "bg-warning/15 text-warning-foreground border-warning/30",
  submitted: "bg-warning/15 text-warning-foreground border-warning/30",
  confirmed: "bg-success/15 text-success-foreground border-success/30",
  failed: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export const TEMPLATE_BLOCKCHAIN_DESCRIPTION: Record<BlockchainStatus, string> = {
  not_requested: "Blockchain anchoring has not been requested.",
  queued: "This published template is queued for Bloxberg anchoring.",
  submitting: "The template proof is being submitted to Bloxberg.",
  submitted: "The transaction was submitted and is awaiting confirmation.",
  confirmed: "The template version proof is confirmed on Bloxberg.",
  failed: "The template remains published, but blockchain anchoring was not completed.",
  cancelled: "Blockchain anchoring was cancelled.",
};

export const CREDENTIAL_BLOCKCHAIN_DESCRIPTION: Record<BlockchainStatus, string> = {
  not_requested: "Blockchain anchoring has not been requested.",
  queued: "Credential issued · Blockchain verification pending",
  submitting: "Credential issued · Blockchain verification in progress",
  submitted: "Credential issued · Awaiting blockchain confirmation",
  confirmed: "Credential issued · Blockchain verification confirmed",
  failed: "Credential issued · Blockchain verification temporarily unavailable",
  cancelled: "Blockchain anchoring was cancelled.",
};

export const TOOLTIPS = {
  internalVsChain:
    "Internal credential issuance and blockchain anchoring are independent. A credential is fully valid once issued internally, even if blockchain anchoring is pending.",
  templateAnchorPurpose:
    "Template anchoring protects the integrity and version history of the reusable micro-credential specification. Individual learner credentials are anchored separately when they are issued.",
  credentialAnchorPurpose:
    "Credential anchoring stores a cryptographic proof and lifecycle status of one issued credential. The full personal credential remains off-chain.",
  availability:
    "Bloxberg availability does not determine whether a template can be published or a credential can be issued.",
};

export const EXPLORER_BASE = "https://blockexplorer.bloxberg.org";

export function explorerTxUrl(hash?: string | null): string | null {
  return hash ? `${EXPLORER_BASE}/tx/${hash}` : null;
}

export function explorerAddrUrl(addr?: string | null): string | null {
  return addr ? `${EXPLORER_BASE}/address/${addr}` : null;
}
