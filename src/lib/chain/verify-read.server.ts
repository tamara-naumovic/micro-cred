// Server-only, READ-ONLY Bloxberg contract reads used by the public verification
// page. No wallet, no private key, no write transactions.

import { to0x } from "./hash";
import { toBytes32Hex } from "./bloxberg.server";
import CredentialRegistryAbi from "./abi/CredentialRegistry.json";
import TemplateRegistryAbi from "./abi/TemplateRegistry.json";

export const DEFAULT_RPC_URL = "https://core.bloxberg.org";

export interface ChainReadConfig {
  rpcUrl: string;
  chainId: number;
  credentialAddress: string;
  templateAddress: string | null;
}

export class ChainConfigMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChainConfigMissingError";
  }
}

export class ChainRpcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChainRpcError";
  }
}

/** Read-only config. Intentionally does NOT read BLOXBERG_PRIVATE_KEY. */
export function readChainReadConfig(): ChainReadConfig {
  const rpcUrl = process.env.BLOXBERG_RPC_URL || DEFAULT_RPC_URL;
  const chainId = Number(process.env.BLOXBERG_CHAIN_ID || "8995");
  const credentialAddress =
    process.env.CREDENTIAL_REGISTRY_ADDRESS || process.env.BLOXBERG_CONTRACT_ADDRESS || "";
  const templateAddress = process.env.TEMPLATE_REGISTRY_ADDRESS || "";
  if (!credentialAddress) {
    throw new ChainConfigMissingError("Missing CREDENTIAL_REGISTRY_ADDRESS");
  }
  return {
    rpcUrl,
    chainId,
    credentialAddress,
    templateAddress: templateAddress || null,
  };
}

export interface OnChainCredentialRead {
  verifyValid: boolean;
  verifyStatusCode: number;
  verifyExpired: boolean;
  documentHash: string | null;
  learnerCommitment: string | null;
  templateRef: string | null;
  issuerAddress: string | null;
  issuedAt: number | null;
  expiresAt: number | null;
  statusCode: number;
  issuerNameSnapshot: string | null;
}

export interface OnChainTemplateRead {
  verifyValid: boolean;
  verifyStatusCode: number;
  documentHash: string | null;
  statusCode: number;
  issuerAddress: string | null;
  publishedAt: number | null;
}

const ZERO32 = "0x" + "00".repeat(32);

function withTimeout<T>(p: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new ChainRpcError("RPC timeout")), ms)),
  ]);
}

async function getProvider(rpcUrl: string) {
  const ethers = await import("ethers");
  return { ethers, provider: new ethers.JsonRpcProvider(rpcUrl) };
}

/** bytes32 normalization identical to the active anchoring flow. */
export function normalizeBytes32(hex: string): `0x${string}` {
  return to0x(toBytes32Hex(hex));
}

/** UUID → bytes32, exactly as the anchoring flow does it (dashes stripped, then keccak). */
export function credentialIdToBytes32(credentialUuid: string): `0x${string}` {
  return normalizeBytes32(credentialUuid.replace(/-/g, ""));
}

export async function readCredentialFromChain(
  cfg: ChainReadConfig,
  credentialIdB32: string,
  presentedDocumentHashB32: string,
): Promise<OnChainCredentialRead> {
  const { ethers, provider } = await getProvider(cfg.rpcUrl);
  const contract = new ethers.Contract(
    cfg.credentialAddress,
    CredentialRegistryAbi as never,
    provider,
  );

  let verify: [boolean, bigint | number, boolean];
  try {
    verify = (await withTimeout(
      contract.verifyCredential(credentialIdB32, presentedDocumentHashB32) as Promise<
        [boolean, bigint | number, boolean]
      >,
    )) as [boolean, bigint | number, boolean];
  } catch (e) {
    throw new ChainRpcError((e as Error).message || "verifyCredential failed");
  }

  let record: OnChainCredentialRead = {
    verifyValid: Boolean(verify[0]),
    verifyStatusCode: Number(verify[1] ?? 0),
    verifyExpired: Boolean(verify[2]),
    documentHash: null,
    learnerCommitment: null,
    templateRef: null,
    issuerAddress: null,
    issuedAt: null,
    expiresAt: null,
    statusCode: Number(verify[1] ?? 0),
    issuerNameSnapshot: null,
  };

  try {
    const r = (await withTimeout(contract.getCredential(credentialIdB32) as Promise<unknown>)) as
      | Record<string | number, unknown>
      | undefined;
    if (r) {
      const docHash = (r[0] ?? r["documentHash"]) as string | undefined;
      if (docHash && docHash !== ZERO32) {
        record = {
          ...record,
          documentHash: docHash,
          learnerCommitment: ((r[1] ?? r["learnerCommitment"]) as string) ?? null,
          templateRef: ((r[2] ?? r["templateRef"]) as string) ?? null,
          issuerAddress: ((r[3] ?? r["issuer"]) as string) ?? null,
          issuedAt: Number((r[4] ?? r["issuedAt"]) ?? 0) || null,
          expiresAt: Number((r[5] ?? r["expiresAt"]) ?? 0) || null,
          statusCode: Number((r[6] ?? r["status"]) ?? record.statusCode),
          issuerNameSnapshot: ((r[7] ?? r["issuerNameSnapshot"]) as string) ?? null,
        };
      }
    }
  } catch {
    // getCredential reverts with CredentialNotFound when the id is absent —
    // verifyCredential already told us the status, so keep going.
  }

  return record;
}

export async function readTemplateFromChain(
  cfg: ChainReadConfig,
  templateRefB32: string,
  presentedDocumentHashB32: string,
): Promise<OnChainTemplateRead> {
  if (!cfg.templateAddress) {
    throw new ChainConfigMissingError("Missing TEMPLATE_REGISTRY_ADDRESS");
  }
  const { ethers, provider } = await getProvider(cfg.rpcUrl);
  const contract = new ethers.Contract(
    cfg.templateAddress,
    TemplateRegistryAbi as never,
    provider,
  );

  let verify: [boolean, bigint | number];
  try {
    verify = (await withTimeout(
      contract.verifyTemplate(templateRefB32, presentedDocumentHashB32) as Promise<
        [boolean, bigint | number]
      >,
    )) as [boolean, bigint | number];
  } catch (e) {
    throw new ChainRpcError((e as Error).message || "verifyTemplate failed");
  }

  let out: OnChainTemplateRead = {
    verifyValid: Boolean(verify[0]),
    verifyStatusCode: Number(verify[1] ?? 0),
    documentHash: null,
    statusCode: Number(verify[1] ?? 0),
    issuerAddress: null,
    publishedAt: null,
  };

  try {
    const r = (await withTimeout(contract.getTemplate(templateRefB32) as Promise<unknown>)) as
      | Record<string | number, unknown>
      | undefined;
    if (r) {
      const docHash = (r[1] ?? r["documentHash"]) as string | undefined;
      if (docHash && docHash !== ZERO32) {
        out = {
          ...out,
          documentHash: docHash,
          issuerAddress: ((r[2] ?? r["issuer"]) as string) ?? null,
          publishedAt: Number((r[3] ?? r["publishedAt"]) ?? 0) || null,
          statusCode: Number((r[5] ?? r["status"]) ?? out.statusCode),
        };
      }
    }
  } catch {
    // Template not found on chain — verifyTemplate status already covers it.
  }

  return out;
}
