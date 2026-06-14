// Server-only Bloxberg client. Never import from client-reachable modules at top level.
// Use dynamic import from within server function handlers.

import { to0x } from "./hash";

export class ChainNotConfiguredError extends Error {
  constructor(message = "Bloxberg chain anchoring is not configured") {
    super(message);
    this.name = "ChainNotConfiguredError";
  }
}

export interface AnchorRecord {
  documentHashHex: string; // 64 hex chars
  learnerCommitmentHex: string; // 64 hex chars
  templateRefHex: string; // 64 hex chars
  issuedAt: number; // unix seconds
  expiresAt: number; // unix seconds, 0 if none
  status: number; // 0=Active, 1=Revoked, 2=Expired
  issuerNameSnapshot: string;
}

export interface AnchorResult {
  txHash: string;
  blockNumber: number;
  issuerAddress: string;
  contractAddress: string;
}

interface ChainEnv {
  rpcUrl: string;
  contractAddress: string;
  abi: unknown;
  functionName: string;
  privateKey: string;
}

function readEnv(): ChainEnv {
  const rpcUrl = process.env.BLOXBERG_RPC_URL;
  const contractAddress = process.env.BLOXBERG_CONTRACT_ADDRESS;
  const abiRaw = process.env.BLOXBERG_CONTRACT_ABI;
  const functionName = process.env.BLOXBERG_FUNCTION_NAME || "storeCredential";
  const privateKey = process.env.BLOXBERG_PRIVATE_KEY;
  if (!rpcUrl || !contractAddress || !abiRaw || !privateKey) {
    throw new ChainNotConfiguredError();
  }
  let abi: unknown;
  try {
    abi = JSON.parse(abiRaw);
  } catch (e) {
    throw new Error(`Invalid BLOXBERG_CONTRACT_ABI JSON: ${(e as Error).message}`);
  }
  return { rpcUrl, contractAddress, abi, functionName, privateKey };
}

export function isChainConfigured(): boolean {
  try {
    readEnv();
    return true;
  } catch {
    return false;
  }
}

export async function submitAnchor(record: AnchorRecord): Promise<AnchorResult> {
  const env = readEnv();
  const ethers = await import("ethers");
  const provider = new ethers.JsonRpcProvider(env.rpcUrl);
  const wallet = new ethers.Wallet(env.privateKey, provider);
  const contract = new ethers.Contract(env.contractAddress, env.abi as ethers.InterfaceAbi, wallet);

  const fn = contract.getFunction(env.functionName);
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
    contractAddress: env.contractAddress,
  };
}
