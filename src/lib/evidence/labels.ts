// Shared label maps for credential evidence files. Client-safe.

export type RawChainStatus =
  | "confirmed"
  | "queued"
  | "pending"
  | "submitted"
  | "failed"
  | "disabled"
  | "not_requested"
  | null
  | undefined;

/** Human-readable label for the earner-facing chain status. */
export function chainStatusLabel(s: RawChainStatus): string {
  switch (s) {
    case "confirmed":
      return "Confirmed";
    case "queued":
    case "pending":
    case "submitted":
      return "Pending";
    case "failed":
      return "Temporarily unavailable";
    case "disabled":
      return "Cancelled";
    case "not_requested":
    default:
      return "Not requested";
  }
}

/** UPPERCASE enum used inside machine-readable JSON files. */
export function chainStatusEnum(s: RawChainStatus): string {
  switch (s) {
    case "confirmed":
      return "CONFIRMED";
    case "queued":
      return "QUEUED";
    case "pending":
      return "PENDING";
    case "submitted":
      return "SUBMITTED";
    case "failed":
      return "FAILED";
    case "disabled":
      return "DISABLED";
    case "not_requested":
    default:
      return "NOT_REQUESTED";
  }
}

export function credentialStatusEnum(
  status: string | null | undefined,
  lifecycle: string | null | undefined,
): string {
  const lc = (lifecycle ?? "").toLowerCase();
  if (lc === "revoked") return "REVOKED";
  if (lc === "superseded") return "SUPERSEDED";
  if (lc === "rejected") return "REJECTED";
  if (lc === "pending_earner_acceptance") return "PENDING_ACCEPTANCE";
  const st = (status ?? "").toLowerCase();
  if (st === "expired") return "EXPIRED";
  if (st === "active") return "ACTIVE";
  return st.toUpperCase() || "ISSUED";
}

export function credentialStatusLabel(
  status: string | null | undefined,
  lifecycle: string | null | undefined,
): string {
  switch (credentialStatusEnum(status, lifecycle)) {
    case "ACTIVE":
      return "Active";
    case "REVOKED":
      return "Revoked";
    case "EXPIRED":
      return "Expired";
    case "SUPERSEDED":
      return "Superseded";
    case "REJECTED":
      return "Rejected";
    case "PENDING_ACCEPTANCE":
      return "Awaiting acceptance";
    default:
      return "Issued";
  }
}

/** User-facing message attached to a verification receipt when the
 *  blockchain anchor failed. Safe — no RPC / backend detail. */
export const FAILED_ANCHOR_USER_MESSAGE =
  "Blockchain anchoring is temporarily unavailable. The credential remains valid and the platform will retry automatically.";
