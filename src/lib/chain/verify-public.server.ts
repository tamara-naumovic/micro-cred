// Server-only logic for public, read-only on-chain verification of a shared
// credential. Never returns private data (vc_json, canonical payload, learner
// secret, earner UUID, e-mails).

import {
  ChainConfigMissingError,
  ChainRpcError,
  credentialIdToBytes32,
  normalizeBytes32,
  readChainReadConfig,
  readCredentialFromChain,
  readTemplateFromChain,
  type OnChainCredentialRead,
  type OnChainTemplateRead,
} from "./verify-read.server";

export const CREDENTIAL_STATUS_LABEL: Record<number, string> = {
  0: "None",
  1: "Active",
  2: "Revoked",
  3: "Superseded",
};

export const TEMPLATE_STATUS_LABEL: Record<number, string> = {
  0: "None",
  1: "Active",
  2: "Archived",
};

export interface DbFacts {
  credentialId: string;
  credentialHash: string | null;
  templateRef: string | null;
  templateDocumentHash: string | null;
  lifecycle: string | null;
  chainStatus: string | null;
  transactionHash: string | null;
  blockNumber: number | null;
}

export interface VerificationWarning {
  code: string;
  message: string;
}

export interface CredentialVerificationResult {
  verificationAvailable: boolean;
  network: "bloxberg";
  chainId: number;
  checkedAt: string;
  credential: {
    existsOnChain: boolean;
    valid: boolean;
    hashMatches: boolean;
    expired: boolean;
    statusCode: number;
    status: string;
    documentHash: string | null;
    learnerCommitment: string | null;
    templateRef: string | null;
    issuerAddress: string | null;
    issuerNameSnapshot: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
  } | null;
  template: {
    verificationAvailable: boolean;
    existsOnChain: boolean;
    valid: boolean;
    statusCode: number;
    status: string;
    documentHash: string | null;
  };
  database: {
    lifecycle: string | null;
    chainStatus: string | null;
    transactionHash: string | null;
    blockNumber: number | null;
  };
  consistency: {
    databaseAndBlockchainMatch: boolean;
    warnings: VerificationWarning[];
  };
  error?: { code: string; message: string } | null;
}

function sameHex(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const na = (a.startsWith("0x") ? a.slice(2) : a).toLowerCase();
  const nb = (b.startsWith("0x") ? b.slice(2) : b).toLowerCase();
  return na === nb;
}

function tsToIso(sec: number | null): string | null {
  if (!sec) return null;
  return new Date(sec * 1000).toISOString();
}

const UNAVAILABLE_TEMPLATE = {
  verificationAvailable: false,
  existsOnChain: false,
  valid: false,
  statusCode: 0,
  status: TEMPLATE_STATUS_LABEL[0],
  documentHash: null,
} as const;

/** Pure result builder — unit-testable without any network access. */
export function buildVerificationResult(params: {
  db: DbFacts;
  chainId: number;
  credential: OnChainCredentialRead | null;
  template: OnChainTemplateRead | null;
  templateSkippedReason?: "missing_template_data" | "template_rpc_error" | "missing_template_config" | null;
  error?: { code: string; message: string } | null;
  checkedAt?: string;
}): CredentialVerificationResult {
  const { db, credential, template } = params;
  const warnings: VerificationWarning[] = [];
  const checkedAt = params.checkedAt ?? new Date().toISOString();

  if (!db.credentialHash) {
    warnings.push({
      code: "missing_stored_document_hash",
      message: "No stored document hash — the credential was never prepared for anchoring.",
    });
  }

  if (params.error) {
    warnings.push({ code: params.error.code, message: params.error.message });
    return {
      verificationAvailable: false,
      network: "bloxberg",
      chainId: params.chainId,
      checkedAt,
      credential: null,
      template: { ...UNAVAILABLE_TEMPLATE },
      database: {
        lifecycle: db.lifecycle,
        chainStatus: db.chainStatus,
        transactionHash: db.transactionHash,
        blockNumber: db.blockNumber,
      },
      consistency: { databaseAndBlockchainMatch: false, warnings },
      error: params.error,
    };
  }

  const cred = credential!;
  const existsOnChain = cred.statusCode !== 0;
  const hashMatches = existsOnChain && sameHex(cred.documentHash, db.credentialHash);
  const statusLabel = CREDENTIAL_STATUS_LABEL[cred.statusCode] ?? String(cred.statusCode);

  if (!existsOnChain) {
    if (db.chainStatus === "confirmed") {
      warnings.push({
        code: "confirmed_but_not_on_chain",
        message: "The database marks this credential as anchored, but it was not found on chain.",
      });
    } else {
      warnings.push({
        code: "not_on_chain",
        message: "This credential is not anchored on the blockchain.",
      });
    }
  } else {
    if (db.credentialHash && !hashMatches) {
      warnings.push({
        code: "document_hash_mismatch",
        message: "The stored document hash differs from the hash recorded on chain.",
      });
    }
    if (!cred.verifyValid) {
      warnings.push({
        code: "verify_credential_false",
        message: "The contract reports this credential as not valid for the presented hash.",
      });
    }
    const offChainRevoked = db.lifecycle === "revoked" || db.lifecycle === "rejected";
    if (offChainRevoked && cred.statusCode === 1) {
      warnings.push({
        code: "revoked_offchain_active_onchain",
        message: "The credential is revoked in the database but still Active on chain.",
      });
    }
    if (!offChainRevoked && (cred.statusCode === 2 || cred.statusCode === 3)) {
      warnings.push({
        code: "active_offchain_revoked_onchain",
        message: `The credential is active in the database but ${statusLabel} on chain.`,
      });
    }
    if (db.templateRef && cred.templateRef && !sameHex(cred.templateRef, db.templateRef)) {
      warnings.push({
        code: "template_ref_mismatch",
        message: "The template reference in the database differs from the one recorded on chain.",
      });
    }
  }

  let templateOut: CredentialVerificationResult["template"] = { ...UNAVAILABLE_TEMPLATE };
  if (params.templateSkippedReason === "missing_template_data") {
    warnings.push({
      code: "template_data_unavailable",
      message: "Template verification data is not available for this credential.",
    });
  } else if (params.templateSkippedReason === "missing_template_config") {
    warnings.push({
      code: "missing_template_config",
      message: "The template registry contract is not configured.",
    });
  } else if (params.templateSkippedReason === "template_rpc_error") {
    warnings.push({
      code: "template_rpc_unavailable",
      message: "The template registry could not be reached.",
    });
  } else if (template) {
    const tStatus = TEMPLATE_STATUS_LABEL[template.statusCode] ?? String(template.statusCode);
    templateOut = {
      verificationAvailable: true,
      existsOnChain: template.statusCode !== 0,
      valid: template.verifyValid,
      statusCode: template.statusCode,
      status: tStatus,
      documentHash: template.documentHash,
    };
    if (template.statusCode === 0) {
      warnings.push({
        code: "template_not_on_chain",
        message: "The template version is not registered on chain.",
      });
    } else if (template.statusCode === 2) {
      warnings.push({ code: "template_archived", message: "The template version is archived on chain." });
    }
  }

  const match =
    existsOnChain &&
    hashMatches &&
    cred.verifyValid &&
    !warnings.some((w) =>
      [
        "confirmed_but_not_on_chain",
        "document_hash_mismatch",
        "verify_credential_false",
        "revoked_offchain_active_onchain",
        "active_offchain_revoked_onchain",
        "template_ref_mismatch",
      ].includes(w.code),
    );

  return {
    verificationAvailable: true,
    network: "bloxberg",
    chainId: params.chainId,
    checkedAt,
    credential: {
      existsOnChain,
      valid: cred.verifyValid,
      hashMatches,
      expired: cred.verifyExpired,
      statusCode: cred.statusCode,
      status: statusLabel,
      documentHash: cred.documentHash,
      learnerCommitment: cred.learnerCommitment,
      templateRef: cred.templateRef,
      issuerAddress: cred.issuerAddress,
      issuerNameSnapshot: cred.issuerNameSnapshot,
      issuedAt: tsToIso(cred.issuedAt),
      expiresAt: tsToIso(cred.expiresAt),
    },
    template: templateOut,
    database: {
      lifecycle: db.lifecycle,
      chainStatus: db.chainStatus,
      transactionHash: db.transactionHash,
      blockNumber: db.blockNumber,
    },
    consistency: { databaseAndBlockchainMatch: match, warnings },
  };
}

export class NotPubliclySharedError extends Error {
  constructor() {
    super("Credential not publicly shared");
    this.name = "NotPubliclySharedError";
  }
}

/** Throws unless the row exists and is publicly shared. */
export function assertPubliclyShared<T extends { share_is_public?: boolean | null } | null>(
  row: T,
): NonNullable<T> {
  if (!row || !row.share_is_public) throw new NotPubliclySharedError();
  return row as NonNullable<T>;
}

/** Loads only the technical fields needed for verification. */
export async function loadCredentialFacts(shareToken: string): Promise<
  DbFacts & { templateId: string | null; templateVersion: string | null }
> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("credentials")
    .select(
      "id, share_is_public, credential_hash, template_id, template_ref, template_version, credential_lifecycle, chain_status, chain_tx_hash, chain_block_number",
    )
    .eq("share_token", shareToken)
    .maybeSingle();
  if (error) throw error;
  const row = assertPubliclyShared(data as never as { share_is_public: boolean } & Record<string, unknown>);

  let templateDocumentHash: string | null = null;
  const templateId = (row["template_id"] as string | null) ?? null;
  if (templateId) {
    const { data: tpl } = await supabaseAdmin
      .from("templates")
      .select("document_hash")
      .eq("id", templateId)
      .maybeSingle();
    templateDocumentHash = (tpl?.document_hash as string | null) ?? null;
  }

  return {
    credentialId: row["id"] as string,
    credentialHash: (row["credential_hash"] as string | null) ?? null,
    templateRef: (row["template_ref"] as string | null) ?? null,
    templateDocumentHash,
    lifecycle: (row["credential_lifecycle"] as string | null) ?? null,
    chainStatus: (row["chain_status"] as string | null) ?? null,
    transactionHash: (row["chain_tx_hash"] as string | null) ?? null,
    blockNumber: (row["chain_block_number"] as number | null) ?? null,
    templateId,
    templateVersion: (row["template_version"] as string | null) ?? null,
  };
}

/** Full orchestration: DB gate → read-only RPC → structured result. */
export async function runPublicChainVerification(
  shareToken: string,
): Promise<CredentialVerificationResult> {
  const facts = await loadCredentialFacts(shareToken);
  const db: DbFacts = {
    credentialId: facts.credentialId,
    credentialHash: facts.credentialHash,
    templateRef: facts.templateRef,
    templateDocumentHash: facts.templateDocumentHash,
    lifecycle: facts.lifecycle,
    chainStatus: facts.chainStatus,
    transactionHash: facts.transactionHash,
    blockNumber: facts.blockNumber,
  };

  let cfg;
  try {
    cfg = readChainReadConfig();
  } catch (e) {
    return buildVerificationResult({
      db,
      chainId: 8995,
      credential: null,
      template: null,
      error: {
        code: "missing_contract_config",
        message: (e as Error).message || "Blockchain contract configuration is missing.",
      },
    });
  }

  if (!db.credentialHash) {
    return buildVerificationResult({
      db,
      chainId: cfg.chainId,
      credential: null,
      template: null,
      error: {
        code: "missing_stored_document_hash",
        message: "No stored document hash is available for this credential.",
      },
    });
  }

  let credRead: OnChainCredentialRead;
  try {
    credRead = await readCredentialFromChain(
      cfg,
      credentialIdToBytes32(db.credentialId),
      normalizeBytes32(db.credentialHash),
    );
  } catch (e) {
    const isConfig = e instanceof ChainConfigMissingError;
    return buildVerificationResult({
      db,
      chainId: cfg.chainId,
      credential: null,
      template: null,
      error: {
        code: isConfig ? "missing_contract_config" : "rpc_unavailable",
        message:
          e instanceof ChainRpcError || isConfig
            ? e.message
            : (e as Error).message || "The blockchain node could not be reached.",
      },
    });
  }

  let templateRead: OnChainTemplateRead | null = null;
  let templateSkippedReason:
    | "missing_template_data"
    | "template_rpc_error"
    | "missing_template_config"
    | null = null;

  if (!db.templateRef || !db.templateDocumentHash) {
    templateSkippedReason = "missing_template_data";
  } else if (!cfg.templateAddress) {
    templateSkippedReason = "missing_template_config";
  } else {
    try {
      templateRead = await readTemplateFromChain(
        cfg,
        normalizeBytes32(db.templateRef),
        normalizeBytes32(db.templateDocumentHash),
      );
    } catch {
      templateSkippedReason = "template_rpc_error";
    }
  }

  return buildVerificationResult({
    db,
    chainId: cfg.chainId,
    credential: credRead,
    template: templateRead,
    templateSkippedReason,
  });
}
