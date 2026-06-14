// Server-only Bloxberg client. Never import from client-reachable modules at top level.
// Always use dynamic import from within a server function handler.

import { to0x } from "./hash";

export class ChainNotConfiguredError extends Error {
  constructor(message = "Bloxberg chain anchoring is not configured") {
    super(message);
    this.name = "ChainNotConfiguredError";
  }
}

export interface CredentialAnchorRecord {
  credentialIdHex: string;
  documentHashHex: string;
  learnerCommitmentHex: string;
  templateRefHex: string;
  issuedAt: number;
  expiresAt: number;
  status: number; // 0=Active, 1=Revoked, 2=Expired
  issuerNameSnapshot: string;
}

export interface TemplateAnchorRecord {
  templateRefHex: string;
  documentHashHex: string;
  templateIdHex: string;
  version: string;
  issuerNameSnapshot: string;
  publishedAt: number;
  status: number;
}

export interface AnchorResult {
  txHash: string;
  blockNumber: number;
  issuerAddress: string;
  contractAddress: string;
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

function readCredentialContract(): { address: string; abi: unknown; functionName: string } {
  const address =
    process.env.CREDENTIAL_REGISTRY_ADDRESS ||
    process.env.BLOXBERG_CONTRACT_ADDRESS ||
    "";
  const abiRaw = process.env.CREDENTIAL_REGISTRY_ABI || process.env.BLOXBERG_CONTRACT_ABI || "";
  const functionName = process.env.CREDENTIAL_REGISTRY_FUNCTION || process.env.BLOXBERG_FUNCTION_NAME || "storeCredential";
  if (!address || !abiRaw) throw new ChainNotConfiguredError("Missing CREDENTIAL_REGISTRY_ADDRESS or ABI");
  try {
    return { address, abi: JSON.parse(abiRaw), functionName };
  } catch (e) {
    throw new Error(`Invalid CREDENTIAL_REGISTRY_ABI JSON: ${(e as Error).message}`);
  }
}

function readTemplateContract(): { address: string; abi: unknown; functionName: string } {
  const address = process.env.TEMPLATE_REGISTRY_ADDRESS || process.env.BLOXBERG_CONTRACT_ADDRESS || "";
  const abiRaw = process.env.TEMPLATE_REGISTRY_ABI || process.env.BLOXBERG_CONTRACT_ABI || "";
  const functionName = process.env.TEMPLATE_REGISTRY_FUNCTION || "storeTemplate";
  if (!address || !abiRaw) throw new ChainNotConfiguredError("Missing TEMPLATE_REGISTRY_ADDRESS or ABI");
  try {
    return { address, abi: JSON.parse(abiRaw), functionName };
  } catch (e) {
    throw new Error(`Invalid TEMPLATE_REGISTRY_ABI JSON: ${(e as Error).message}`);
  }
}

export function isChainConfigured(): boolean {
  return !!process.env.BLOXBERG_PRIVATE_KEY && !!(
    process.env.CREDENTIAL_REGISTRY_ADDRESS || process.env.BLOXBERG_CONTRACT_ADDRESS
  );
}

export type AvailabilityStatus =
  | { status: "ok"; chainId: number; rpcUrl: string; address: string }
  | { status: "missing_config"; reason: string }
  | { status: "no_contract"; reason: string }
  | { status: "rpc_unavailable"; reason: string }
  | { status: "insufficient_balance"; reason: string };

export async function getChainAvailability(): Promise<AvailabilityStatus> {
  let base: ChainBase;
  try {
    base = readBase();
  } catch (e) {
    return { status: "missing_config", reason: (e as Error).message };
  }
  let contract: { address: string };
  try {
    contract = readCredentialContract();
  } catch (e) {
    return { status: "no_contract", reason: (e as Error).message };
  }
  try {
    const ethers = await import("ethers");
    const provider = new ethers.JsonRpcProvider(base.rpcUrl);
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 3000);
    const block = await Promise.race([
      provider.getBlockNumber(),
      new Promise<number>((_, rej) => setTimeout(() => rej(new Error("RPC timeout")), 3000)),
    ]).finally(() => clearTimeout(to));
    if (typeof block !== "number") throw new Error("RPC unreachable");
    const wallet = new ethers.Wallet(base.privateKey, provider);
    const bal = await provider.getBalance(wallet.address);
    if (bal === 0n) {
      return { status: "insufficient_balance", reason: "Issuer wallet has zero balance" };
    }
    return { status: "ok", chainId: base.chainId, rpcUrl: base.rpcUrl, address: contract.address };
  } catch (e) {
    return { status: "rpc_unavailable", reason: (e as Error).message };
  }
}

export async function submitCredentialAnchor(record: CredentialAnchorRecord): Promise<AnchorResult> {
  const base = readBase();
  const c = readCredentialContract();
  const ethers = await import("ethers");
  const provider = new ethers.JsonRpcProvider(base.rpcUrl);
  const wallet = new ethers.Wallet(base.privateKey, provider);
  const contract = new ethers.Contract(c.address, c.abi as ConstructorParameters<typeof ethers.Contract>[1], wallet);
  const fn = contract.getFunction(c.functionName);
  const tx = await fn(
    to0x(record.documentHashHex),
    to0x(record.learnerCommitmentHex),
    to0x(record.templateRefHex),
    wallet.address,
    BigInt(record.issuedAt),
    BigInt(record.expiresAt),
    record.status,
    record.issuerNameSnapshot,
  );
  const receipt = await tx.wait(1);
  return {
    txHash: tx.hash,
    blockNumber: Number(receipt?.blockNumber ?? 0),
    issuerAddress: wallet.address,
    contractAddress: c.address,
  };
}

// Backwards-compat alias used by older code paths.
export const submitAnchor = submitCredentialAnchor;

export async function submitTemplateAnchor(record: TemplateAnchorRecord): Promise<AnchorResult> {
  const base = readBase();
  const c = readTemplateContract();
  const ethers = await import("ethers");
  const provider = new ethers.JsonRpcProvider(base.rpcUrl);
  const wallet = new ethers.Wallet(base.privateKey, provider);
  const contract = new ethers.Contract(c.address, c.abi as ConstructorParameters<typeof ethers.Contract>[1], wallet);
  const fn = contract.getFunction(c.functionName);
  const tx = await fn(
    to0x(record.templateRefHex),
    to0x(record.documentHashHex),
    to0x(record.templateIdHex),
    record.version,
    record.issuerNameSnapshot,
    wallet.address,
    BigInt(record.publishedAt),
    record.status,
  );
  const receipt = await tx.wait(1);
  return {
    txHash: tx.hash,
    blockNumber: Number(receipt?.blockNumber ?? 0),
    issuerAddress: wallet.address,
    contractAddress: c.address,
  };
}

export async function submitRevokeCredential(credentialIdHex: string): Promise<AnchorResult> {
  const base = readBase();
  const c = readCredentialContract();
  const ethers = await import("ethers");
  const provider = new ethers.JsonRpcProvider(base.rpcUrl);
  const wallet = new ethers.Wallet(base.privateKey, provider);
  const contract = new ethers.Contract(c.address, c.abi as ConstructorParameters<typeof ethers.Contract>[1], wallet);
  const fn = contract.getFunction(process.env.CREDENTIAL_REGISTRY_REVOKE_FUNCTION || "revokeCredential");
  const tx = await fn(to0x(credentialIdHex));
  const receipt = await tx.wait(1);
  return {
    txHash: tx.hash,
    blockNumber: Number(receipt?.blockNumber ?? 0),
    issuerAddress: wallet.address,
    contractAddress: c.address,
  };
}
