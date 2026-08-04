// Server-only Bloxberg client. Never import from client-reachable modules at top level.
// Always use dynamic import from within a server function handler.

import { to0x, keccak256Hex } from "./hash";
import CredentialRegistryAbi from "./abi/CredentialRegistry.json";
import TemplateRegistryAbi from "./abi/TemplateRegistry.json";

export class ChainNotConfiguredError extends Error {
  constructor(message = "Bloxberg chain anchoring is not configured") {
    super(message);
    this.name = "ChainNotConfiguredError";
  }
}

export interface CredentialAnchorRecord {
  credentialIdHex: string;           // hex (16 or 32 bytes); will be normalized to bytes32 via keccak when short
  documentHashHex: string;           // 32-byte hex
  learnerCommitmentHex: string;      // 32-byte hex
  templateRefHex: string;            // 32-byte hex
  issuedAt: number;                  // unused on-chain (contract uses block.timestamp); kept for API back-compat
  expiresAt: number;                 // 0 = never
  status: number;                    // unused on-chain (contract initializes Active); kept for back-compat
  issuerNameSnapshot: string;
}

export interface TemplateAnchorRecord {
  templateRefHex: string;            // 32-byte hex
  documentHashHex: string;           // 32-byte hex
  templateIdHex: string;             // 32-byte hex (will be normalized via keccak when short)
  version: string;                   // semver-ish "MAJOR.MINOR"
  issuerNameSnapshot: string;
  publishedAt: number;               // unused on-chain
  status: number;                    // unused on-chain
}

export interface AnchorResult {
  txHash: string | null;
  blockNumber: number;
  issuerAddress: string;
  contractAddress: string;
  alreadyAnchored?: boolean;
}

// Map of known custom-error selectors → human label. ethers v6 doesn't decode
// non-standard errors and reports them as "missing revert data". We pre-decode
// `e.info?.error?.data` (which usually arrives as "Reverted 0x<selector>...")
// and translate the selector to a useful message.
const KNOWN_REVERTS: Record<string, string> = {
  "0x87dbb506": "CredentialAlreadyExists",
  "0x1cb411bc": "CredentialNotFound",
  "0x6f4d9d9b": "TemplateAlreadyExists",
  "0x6f7c43f1": "TemplateNotFound",
  "0x9c8d2cd2": "InvalidTemplateRef",
};

function decodeRevert(err: unknown): string {
  const e = err as {
    shortMessage?: string;
    message?: string;
    data?: string;
    info?: { error?: { data?: string; message?: string } };
  };
  const rawData =
    (typeof e?.data === "string" ? e.data : undefined) ??
    e?.info?.error?.data ??
    "";
  const hex = rawData.replace(/^Reverted\s*/, "");
  if (hex.startsWith("0x") && hex.length >= 10) {
    const selector = hex.slice(0, 10).toLowerCase();
    const label = KNOWN_REVERTS[selector];
    if (label) {
      const arg = hex.length >= 74 ? "0x" + hex.slice(10, 74) : "";
      return `Contract reverted: ${label}${arg ? `(${arg})` : ""}`;
    }
    return `Contract reverted (selector ${selector})`;
  }
  return e?.shortMessage ?? e?.message ?? "Contract reverted";
}

interface ChainBase {
  rpcUrl: string;
  chainId: number;
  privateKey: string;
}

function readBase(): ChainBase {
  const rpcUrl = process.env.BLOXBERG_RPC_URL || "https://core.bloxberg.org";
  const chainId = Number(process.env.BLOXBERG_CHAIN_ID || "8995");
  const privateKey = process.env.BLOXBERG_PRIVATE_KEY ?? "";
  if (!privateKey) throw new ChainNotConfiguredError("Missing BLOXBERG_PRIVATE_KEY");
  return { rpcUrl, chainId, privateKey };
}

function readCredentialAddress(): string {
  const a =
    process.env.CREDENTIAL_REGISTRY_ADDRESS ||
    process.env.BLOXBERG_CONTRACT_ADDRESS ||
    "";
  if (!a) throw new ChainNotConfiguredError("Missing CREDENTIAL_REGISTRY_ADDRESS");
  return a;
}

function readTemplateAddress(): string {
  const a = process.env.TEMPLATE_REGISTRY_ADDRESS || "";
  if (!a) throw new ChainNotConfiguredError("Missing TEMPLATE_REGISTRY_ADDRESS");
  return a;
}

export function isChainConfigured(): boolean {
  return (
    !!process.env.BLOXBERG_PRIVATE_KEY &&
    !!(process.env.CREDENTIAL_REGISTRY_ADDRESS || process.env.BLOXBERG_CONTRACT_ADDRESS) &&
    !!process.env.TEMPLATE_REGISTRY_ADDRESS
  );
}

export type AvailabilityStatus =
  | { status: "ok"; chainId: number; rpcUrl: string; credentialAddress: string; templateAddress: string; issuerAddress: string; balanceWei: string }
  | { status: "missing_config"; reason: string }
  | { status: "rpc_unavailable"; reason: string }
  | { status: "insufficient_balance"; reason: string; issuerAddress: string }
  | { status: "missing_role"; reason: string; issuerAddress: string; missingOn: ("template" | "credential")[] };

/** Normalize an arbitrary hex (with/without 0x) to 32-byte (64 hex chars). Short inputs are keccak-hashed. */
export function toBytes32Hex(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length === 64) return clean;
  return keccak256Hex(hex);
}

export async function getChainAvailability(): Promise<AvailabilityStatus> {
  let base: ChainBase;
  let credAddr: string;
  let tplAddr: string;
  try {
    base = readBase();
    credAddr = readCredentialAddress();
    tplAddr = readTemplateAddress();
  } catch (e) {
    return { status: "missing_config", reason: (e as Error).message };
  }
  try {
    const ethers = await import("ethers");
    const provider = new ethers.JsonRpcProvider(base.rpcUrl);
    const block = await Promise.race([
      provider.getBlockNumber(),
      new Promise<number>((_, rej) => setTimeout(() => rej(new Error("RPC timeout")), 4000)),
    ]);
    if (typeof block !== "number") throw new Error("RPC unreachable");
    const wallet = new ethers.Wallet(base.privateKey, provider);
    const bal = await provider.getBalance(wallet.address);
    if (bal === 0n) {
      return { status: "insufficient_balance", reason: "Issuer wallet has zero balance", issuerAddress: wallet.address };
    }
    // Check ISSUER_ROLE on both contracts
    const ISSUER_ROLE = keccak256Hex("ISSUER_ROLE");
    const issuerRoleBytes32 = to0x(ISSUER_ROLE);
    const credContract = new ethers.Contract(credAddr, CredentialRegistryAbi as never, provider);
    const tplContract = new ethers.Contract(tplAddr, TemplateRegistryAbi as never, provider);
    const missing: ("template" | "credential")[] = [];
    try {
      const [credHas, tplHas] = await Promise.all([
        credContract.hasRole(issuerRoleBytes32, wallet.address) as Promise<boolean>,
        tplContract.hasRole(issuerRoleBytes32, wallet.address) as Promise<boolean>,
      ]);
      if (!credHas) missing.push("credential");
      if (!tplHas) missing.push("template");
    } catch (e) {
      return { status: "rpc_unavailable", reason: `Role check failed: ${(e as Error).message}` };
    }
    if (missing.length > 0) {
      return {
        status: "missing_role",
        reason: `Issuer wallet is missing ISSUER_ROLE on: ${missing.join(", ")} registry`,
        issuerAddress: wallet.address,
        missingOn: missing,
      };
    }
    return {
      status: "ok",
      chainId: base.chainId,
      rpcUrl: base.rpcUrl,
      credentialAddress: credAddr,
      templateAddress: tplAddr,
      issuerAddress: wallet.address,
      balanceWei: bal.toString(),
    };
  } catch (e) {
    return { status: "rpc_unavailable", reason: (e as Error).message };
  }
}

export async function submitCredentialAnchor(record: CredentialAnchorRecord): Promise<AnchorResult> {
  const base = readBase();
  const address = readCredentialAddress();
  const ethers = await import("ethers");
  const provider = new ethers.JsonRpcProvider(base.rpcUrl);
  const wallet = new ethers.Wallet(base.privateKey, provider);
  const contract = new ethers.Contract(
    address,
    CredentialRegistryAbi as ConstructorParameters<typeof ethers.Contract>[1],
    wallet,
  );
  const credentialIdB32 = to0x(toBytes32Hex(record.credentialIdHex));
  const docHashB32 = to0x(record.documentHashHex);

  // Pre-check: if this credentialId is already on-chain, return early instead
  // of submitting a tx that will revert with CredentialAlreadyExists.
  try {
    const existing = await contract.getCredential(credentialIdB32);
    const existingDocHash = (existing?.[0] ?? existing?.documentHash) as string | undefined;
    const existingIssuer = (existing?.[3] ?? existing?.issuer) as string | undefined;
    if (existingDocHash && existingDocHash !== "0x" + "00".repeat(32)) {
      const sameDoc = existingDocHash.toLowerCase() === docHashB32.toLowerCase();
      const sameIssuer = (existingIssuer ?? "").toLowerCase() === wallet.address.toLowerCase();
      if (sameDoc && sameIssuer) {
        return {
          txHash: null,
          blockNumber: 0,
          issuerAddress: wallet.address,
          contractAddress: address,
          alreadyAnchored: true,
        };
      }
      throw new Error(
        `Credential already exists on chain with a different ${sameDoc ? "issuer" : "document hash"}. ` +
          `Issue a superseded version instead.`,
      );
    }
  } catch (e) {
    // getCredential reverts with CredentialNotFound when the id is not present —
    // that's the happy path; fall through to issuance. Re-throw the explicit
    // mismatch error we constructed above.
    const msg = (e as Error)?.message ?? "";
    if (msg.startsWith("Credential already exists on chain")) throw e;
    // Otherwise: not found / unknown — proceed to issue.
  }

  try {
    const tx = await contract.issueCredential(
      credentialIdB32,
      docHashB32,
      to0x(record.learnerCommitmentHex),
      to0x(record.templateRefHex),
      BigInt(record.expiresAt),
      record.issuerNameSnapshot,
    );
    const receipt = await tx.wait(1);
    return {
      txHash: tx.hash,
      blockNumber: Number(receipt?.blockNumber ?? 0),
      issuerAddress: wallet.address,
      contractAddress: address,
    };
  } catch (e) {
    throw new Error(decodeRevert(e));
  }
}

// Backwards-compat alias used by older code paths.
export const submitAnchor = submitCredentialAnchor;

/** "1.0" → 1000, "1.2" → 1002, "2.0" → 2000. Stored on-chain as uint32 so versions sort. */
function versionToUint32(version: string): number {
  const m = /^(\d+)\.(\d+)$/.exec(version);
  if (m) return Number(m[1]) * 1000 + Number(m[2]);
  const n = Number(version);
  if (Number.isFinite(n) && n >= 0) return Math.floor(n) * 1000;
  return 1000;
}

export async function submitTemplateAnchor(record: TemplateAnchorRecord): Promise<AnchorResult> {
  const base = readBase();
  const address = readTemplateAddress();
  const ethers = await import("ethers");
  const provider = new ethers.JsonRpcProvider(base.rpcUrl);
  const wallet = new ethers.Wallet(base.privateKey, provider);
  const contract = new ethers.Contract(
    address,
    TemplateRegistryAbi as ConstructorParameters<typeof ethers.Contract>[1],
    wallet,
  );
  const templateRefB32 = to0x(record.templateRefHex);
  const docHashB32 = to0x(record.documentHashHex);

  // Pre-check: idempotently treat an existing version as already anchored.
  try {
    const existing = await contract.getTemplate(templateRefB32);
    const existingDocHash = (existing?.[1] ?? existing?.documentHash) as string | undefined;
    const existingIssuer = (existing?.[2] ?? existing?.issuer) as string | undefined;
    if (existingDocHash && existingDocHash !== "0x" + "00".repeat(32)) {
      const sameDoc = existingDocHash.toLowerCase() === docHashB32.toLowerCase();
      const sameIssuer = (existingIssuer ?? "").toLowerCase() === wallet.address.toLowerCase();
      if (sameDoc && sameIssuer) {
        return {
          txHash: null,
          blockNumber: 0,
          issuerAddress: wallet.address,
          contractAddress: address,
          alreadyAnchored: true,
        };
      }
      throw new Error(
        `Template version already exists on chain with a different ${sameDoc ? "issuer" : "document hash"}. ` +
          `Bump the version and re-publish.`,
      );
    }
  } catch (e) {
    const msg = (e as Error)?.message ?? "";
    if (msg.startsWith("Template version already exists")) throw e;
  }

  try {
    const tx = await contract.registerTemplateVersion(
      templateRefB32,
      to0x(toBytes32Hex(record.templateIdHex)),
      docHashB32,
      versionToUint32(record.version),
      record.issuerNameSnapshot,
    );
    const receipt = await tx.wait(1);
    return {
      txHash: tx.hash,
      blockNumber: Number(receipt?.blockNumber ?? 0),
      issuerAddress: wallet.address,
      contractAddress: address,
    };
  } catch (e) {
    throw new Error(decodeRevert(e));
  }
}

export interface RevokeResult extends AnchorResult {
  confirmedAt: string;
  alreadyRevoked?: boolean;
}

export class RevokeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RevokeConflictError";
  }
}

/**
 * Mark an on-chain credential as Revoked.
 *
 * Read-checks the record first: it must exist and be Active. Already-revoked
 * records return idempotently instead of submitting a reverting tx. Uses the
 * same UUID -> bytes32 normalization as submitCredentialAnchor.
 *
 * `reasonHashHex` is the keccak256 hash of the free-text reason — the plain
 * reason text is never sent on chain.
 */
export async function submitRevokeCredential(
  credentialIdHex: string,
  reasonHashHex?: string,
): Promise<RevokeResult> {
  const base = readBase();
  const address = readCredentialAddress();
  const ethers = await import("ethers");
  const provider = new ethers.JsonRpcProvider(base.rpcUrl);
  const wallet = new ethers.Wallet(base.privateKey, provider);
  const contract = new ethers.Contract(
    address,
    CredentialRegistryAbi as ConstructorParameters<typeof ethers.Contract>[1],
    wallet,
  );
  const credentialB32 = to0x(toBytes32Hex(credentialIdHex.replace(/-/g, "")));
  const reason = reasonHashHex ? to0x(toBytes32Hex(reasonHashHex)) : to0x("0".repeat(64));

  // Read-check before writing.
  let record: { exists: boolean; issuer: string; status: number };
  try {
    const r = await contract.getCredential(credentialB32);
    const documentHash = (r?.[0] ?? r?.documentHash) as string | undefined;
    const issuer = (r?.[3] ?? r?.issuer) as string | undefined;
    const status = Number(r?.[6] ?? r?.status ?? 0);
    record = {
      exists: !!documentHash && documentHash !== "0x" + "00".repeat(32) && status !== 0,
      issuer: issuer ?? "",
      status,
    };
  } catch {
    record = { exists: false, issuer: "", status: 0 };
  }

  if (record.exists && record.status === 2) {
    return {
      txHash: null,
      blockNumber: 0,
      issuerAddress: wallet.address,
      contractAddress: address,
      confirmedAt: new Date().toISOString(),
      alreadyRevoked: true,
    };
  }
  if (!record.exists) {
    throw new RevokeConflictError("Credential is not present on chain");
  }
  if (record.status !== 1) {
    throw new RevokeConflictError(
      `Credential is not Active on chain (status ${record.status}); revocation not applicable`,
    );
  }

  // Contract: revokeCredential(bytes32 credentialId, bytes32 reasonHash)
  try {
    const tx = await contract.revokeCredential(credentialB32, reason);
    const receipt = await tx.wait(1);
    return {
      txHash: tx.hash,
      blockNumber: Number(receipt?.blockNumber ?? 0),
      issuerAddress: wallet.address,
      contractAddress: address,
      confirmedAt: new Date().toISOString(),
    };
  } catch (e) {
    throw new Error(decodeRevert(e));
  }
}


export interface SupersedeResult extends AnchorResult {
  confirmedAt: string;
  alreadySuperseded?: boolean;
}

export class SupersedeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupersedeConflictError";
  }
}

/**
 * Mark an on-chain credential as Superseded by a replacement credential.
 * Read-checks both records first: both must exist, be Active and share the
 * same on-chain issuer address. Uses the exact same UUID -> bytes32
 * normalization as submitCredentialAnchor (hex without dashes -> toBytes32Hex).
 */
export async function submitSupersedeCredential(
  originalCredentialId: string,
  replacementCredentialId: string,
): Promise<SupersedeResult> {
  const base = readBase();
  const address = readCredentialAddress();
  const ethers = await import("ethers");
  const provider = new ethers.JsonRpcProvider(base.rpcUrl);
  const wallet = new ethers.Wallet(base.privateKey, provider);
  const contract = new ethers.Contract(
    address,
    CredentialRegistryAbi as ConstructorParameters<typeof ethers.Contract>[1],
    wallet,
  );

  const originalB32 = to0x(toBytes32Hex(originalCredentialId.replace(/-/g, "")));
  const replacementB32 = to0x(toBytes32Hex(replacementCredentialId.replace(/-/g, "")));

  const readRecord = async (id: string) => {
    try {
      const r = await contract.getCredential(id);
      const documentHash = (r?.[0] ?? r?.documentHash) as string | undefined;
      const issuer = (r?.[3] ?? r?.issuer) as string | undefined;
      const status = Number(r?.[6] ?? r?.status ?? 0);
      const exists = !!documentHash && documentHash !== "0x" + "00".repeat(32) && status !== 0;
      return { exists, issuer: issuer ?? "", status };
    } catch {
      return { exists: false, issuer: "", status: 0 };
    }
  };

  const [orig, repl] = await Promise.all([readRecord(originalB32), readRecord(replacementB32)]);

  // Idempotency: already superseded on chain.
  if (orig.exists && orig.status === 3) {
    return {
      txHash: null,
      blockNumber: 0,
      issuerAddress: wallet.address,
      contractAddress: address,
      confirmedAt: new Date().toISOString(),
      alreadySuperseded: true,
    };
  }
  if (!orig.exists) {
    throw new SupersedeConflictError("Original credential is not present on chain");
  }
  if (orig.status !== 1) {
    throw new SupersedeConflictError(
      `Original credential is not Active on chain (status ${orig.status})`,
    );
  }
  if (!repl.exists) {
    throw new SupersedeConflictError("Replacement credential is not present on chain");
  }
  if (repl.status !== 1) {
    throw new SupersedeConflictError(
      `Replacement credential is not Active on chain (status ${repl.status})`,
    );
  }
  if (orig.issuer.toLowerCase() !== repl.issuer.toLowerCase()) {
    throw new SupersedeConflictError(
      "Original and replacement credentials have different on-chain issuer addresses",
    );
  }

  try {
    const tx = await contract.supersedeCredential(originalB32, replacementB32);
    const receipt = await tx.wait(1);
    return {
      txHash: tx.hash,
      blockNumber: Number(receipt?.blockNumber ?? 0),
      issuerAddress: wallet.address,
      contractAddress: address,
      confirmedAt: new Date().toISOString(),
    };
  } catch (e) {
    throw new Error(decodeRevert(e));
  }
}
