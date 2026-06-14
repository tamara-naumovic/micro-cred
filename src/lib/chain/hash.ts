// Isomorphic hashing helpers for blockchain anchoring.
// SHA-256 via Web Crypto. Keccak-256 via js-sha3 (server + client safe).

import sha3 from "js-sha3";
const { keccak256 } = sha3;

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) {
    return "[" + value.map((v) => canonicalize(v)).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalize((value as Record<string, unknown>)[k]))
      .join(",") +
    "}"
  );
}

export function canonicalJson(value: unknown): string {
  return canonicalize(value);
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const buf = new Uint8Array(data.byteLength);
  buf.set(data);
  const digest = await crypto.subtle.digest("SHA-256", buf.buffer);
  return bytesToHex(new Uint8Array(digest));
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export function randomSecretHex(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function to0x(hex: string): `0x${string}` {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return ("0x" + clean) as `0x${string}`;
}

/** Keccak-256 of a UTF-8 string, returns 64-char lower-case hex (no 0x). */
export function keccak256Hex(input: string | Uint8Array): string {
  return keccak256(typeof input === "string" ? new TextEncoder().encode(input) : input);
}

/** Concatenates two hex (no 0x) strings as raw bytes, then keccak256. */
export function keccak256ConcatHex(...hexParts: string[]): string {
  const total = hexParts.reduce((n, h) => n + (h.startsWith("0x") ? h.length - 2 : h.length) / 2, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const h of hexParts) {
    const b = hexToBytes(h);
    out.set(b, off);
    off += b.length;
  }
  return keccak256(out);
}

/** Backwards-compatible commitment (sha256). New flow uses learnerCommitmentKeccak below. */
export async function commitmentHex(earnerId: string, secretHex: string): Promise<string> {
  return sha256Hex(`${earnerId}|${secretHex}`);
}

/** Learner commitment per spec:
 *  earnerIdHash = keccak256(earnerUUID)
 *  credentialIdHash = keccak256(credentialId)
 *  learnerCommitment = keccak256(earnerIdHash || credentialIdHash || randomSecret)
 */
export function learnerCommitmentKeccak(
  earnerId: string,
  credentialId: string,
  randomSecretHex32: string,
): string {
  const earnerIdHash = keccak256Hex(earnerId);
  const credentialIdHash = keccak256Hex(credentialId);
  return keccak256ConcatHex(earnerIdHash, credentialIdHash, randomSecretHex32);
}

/** Template reference per spec:
 *  templateRef = keccak256(templateIdHash || versionHash || documentHash)
 */
export function templateRefKeccak(templateId: string, version: string, documentHashHex: string): string {
  const idHash = keccak256Hex(templateId);
  const verHash = keccak256Hex(version);
  return keccak256ConcatHex(idHash, verHash, documentHashHex);
}

/** Backwards-compatible templateRef helper (sha256 of "template:<id>") for legacy callers. */
export async function templateRefHex(templateId: string): Promise<string> {
  return sha256Hex(`template:${templateId}`);
}
