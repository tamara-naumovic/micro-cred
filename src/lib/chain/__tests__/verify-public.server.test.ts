import { describe, expect, it } from "vitest";
import {
  assertPubliclyShared,
  buildVerificationResult,
  NotPubliclySharedError,
  type DbFacts,
} from "../verify-public.server";
import type { OnChainCredentialRead, OnChainTemplateRead } from "../verify-read.server";

const HASH = "0x" + "ab".repeat(32);
const OTHER_HASH = "0x" + "cd".repeat(32);
const TPL_REF = "0x" + "11".repeat(32);

const db: DbFacts = {
  credentialId: "3f5a2a3c-2c2a-4a7b-9d1e-000000000001",
  credentialHash: HASH,
  templateRef: TPL_REF,
  templateDocumentHash: OTHER_HASH,
  lifecycle: "issued",
  chainStatus: "confirmed",
  transactionHash: "0xdeadbeef",
  blockNumber: 123,
};

function credRead(over: Partial<OnChainCredentialRead> = {}): OnChainCredentialRead {
  return {
    verifyValid: true,
    verifyStatusCode: 1,
    verifyExpired: false,
    documentHash: HASH,
    learnerCommitment: "0x" + "22".repeat(32),
    templateRef: TPL_REF,
    issuerAddress: "0xIssuer",
    issuedAt: 1_700_000_000,
    expiresAt: null,
    statusCode: 1,
    issuerNameSnapshot: "Uni",
    ...over,
  };
}

function tplRead(over: Partial<OnChainTemplateRead> = {}): OnChainTemplateRead {
  return {
    verifyValid: true,
    verifyStatusCode: 1,
    documentHash: OTHER_HASH,
    statusCode: 1,
    issuerAddress: "0xIssuer",
    publishedAt: 1_700_000_000,
    ...over,
  };
}

const base = { db, chainId: 8995 as const };

describe("buildVerificationResult", () => {
  it("confirmed and valid credential", () => {
    const r = buildVerificationResult({ ...base, credential: credRead(), template: tplRead() });
    expect(r.verificationAvailable).toBe(true);
    expect(r.credential?.existsOnChain).toBe(true);
    expect(r.credential?.hashMatches).toBe(true);
    expect(r.credential?.status).toBe("Active");
    expect(r.consistency.databaseAndBlockchainMatch).toBe(true);
    expect(r.consistency.warnings).toHaveLength(0);
  });

  it("credential not found on-chain", () => {
    const r = buildVerificationResult({
      ...base,
      credential: credRead({ statusCode: 0, verifyStatusCode: 0, verifyValid: false, documentHash: null }),
      template: tplRead(),
    });
    expect(r.credential?.existsOnChain).toBe(false);
    expect(r.credential?.status).toBe("None");
    expect(r.consistency.warnings.map((w) => w.code)).toContain("confirmed_but_not_on_chain");
  });

  it("document hash mismatch", () => {
    const r = buildVerificationResult({
      ...base,
      credential: credRead({ documentHash: OTHER_HASH, verifyValid: false }),
      template: tplRead(),
    });
    expect(r.credential?.hashMatches).toBe(false);
    expect(r.consistency.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(["document_hash_mismatch", "verify_credential_false"]),
    );
    expect(r.consistency.databaseAndBlockchainMatch).toBe(false);
  });

  it("expired credential", () => {
    const r = buildVerificationResult({
      ...base,
      credential: credRead({ verifyExpired: true, expiresAt: 1_700_000_100 }),
      template: tplRead(),
    });
    expect(r.credential?.expired).toBe(true);
    expect(r.credential?.expiresAt).toBe(new Date(1_700_000_100 * 1000).toISOString());
  });

  it("on-chain Revoked credential", () => {
    const r = buildVerificationResult({
      ...base,
      credential: credRead({ statusCode: 2, verifyValid: false }),
      template: tplRead(),
    });
    expect(r.credential?.status).toBe("Revoked");
    expect(r.consistency.warnings.map((w) => w.code)).toContain("active_offchain_revoked_onchain");
  });

  it("on-chain Superseded credential", () => {
    const r = buildVerificationResult({
      ...base,
      credential: credRead({ statusCode: 3, verifyValid: false }),
      template: tplRead(),
    });
    expect(r.credential?.status).toBe("Superseded");
    expect(r.consistency.warnings.map((w) => w.code)).toContain("active_offchain_revoked_onchain");
  });

  it("revoked off-chain but Active on-chain", () => {
    const r = buildVerificationResult({
      ...base,
      db: { ...db, lifecycle: "revoked" },
      credential: credRead(),
      template: tplRead(),
    });
    expect(r.credential?.status).toBe("Active");
    expect(r.database.lifecycle).toBe("revoked");
    expect(r.consistency.warnings.map((w) => w.code)).toContain("revoked_offchain_active_onchain");
  });

  it("template archived", () => {
    const r = buildVerificationResult({
      ...base,
      credential: credRead(),
      template: tplRead({ statusCode: 2, verifyValid: false }),
    });
    expect(r.template.status).toBe("Archived");
    expect(r.consistency.warnings.map((w) => w.code)).toContain("template_archived");
  });

  it("template data unavailable", () => {
    const r = buildVerificationResult({
      ...base,
      db: { ...db, templateDocumentHash: null },
      credential: credRead(),
      template: null,
      templateSkippedReason: "missing_template_data",
    });
    expect(r.template.verificationAvailable).toBe(false);
    expect(r.credential?.existsOnChain).toBe(true);
    expect(r.consistency.warnings.map((w) => w.code)).toContain("template_data_unavailable");
  });

  it("RPC unavailable", () => {
    const r = buildVerificationResult({
      ...base,
      credential: null,
      template: null,
      error: { code: "rpc_unavailable", message: "RPC timeout" },
    });
    expect(r.verificationAvailable).toBe(false);
    expect(r.credential).toBeNull();
    expect(r.database.transactionHash).toBe("0xdeadbeef");
    expect(r.error?.code).toBe("rpc_unavailable");
  });

  it("missing contract configuration", () => {
    const r = buildVerificationResult({
      ...base,
      credential: null,
      template: null,
      error: { code: "missing_contract_config", message: "Missing CREDENTIAL_REGISTRY_ADDRESS" },
    });
    expect(r.verificationAvailable).toBe(false);
    expect(r.consistency.warnings.map((w) => w.code)).toContain("missing_contract_config");
  });

  it("missing stored document hash", () => {
    const r = buildVerificationResult({
      ...base,
      db: { ...db, credentialHash: null },
      credential: null,
      template: null,
      error: { code: "missing_stored_document_hash", message: "No stored document hash" },
    });
    expect(r.consistency.warnings.map((w) => w.code)).toContain("missing_stored_document_hash");
  });

  it("template ref mismatch is reported", () => {
    const r = buildVerificationResult({
      ...base,
      credential: credRead({ templateRef: "0x" + "99".repeat(32) }),
      template: tplRead(),
    });
    expect(r.consistency.warnings.map((w) => w.code)).toContain("template_ref_mismatch");
  });
});

describe("assertPubliclyShared", () => {
  it("rejects a credential hidden by share_is_public", () => {
    expect(() => assertPubliclyShared({ share_is_public: false })).toThrow(NotPubliclySharedError);
    expect(() => assertPubliclyShared(null)).toThrow(NotPubliclySharedError);
  });

  it("passes a publicly shared credential", () => {
    expect(assertPubliclyShared({ share_is_public: true })).toEqual({ share_is_public: true });
  });
});
