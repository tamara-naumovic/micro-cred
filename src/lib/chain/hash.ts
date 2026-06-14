// Isomorphic SHA-256 / canonicalization helpers for blockchain anchoring.
// No Node-only deps — uses Web Crypto (globalThis.crypto.subtle).

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
  // Copy into a fresh ArrayBuffer-backed view so the TS lib type matches BufferSource exactly.
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

export function randomSecretHex(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function to0x(hex: string): `0x${string}` {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return ("0x" + clean) as `0x${string}`;
}

export async function commitmentHex(earnerId: string, secretHex: string): Promise<string> {
  return sha256Hex(`${earnerId}|${secretHex}`);
}

export async function templateRefHex(templateId: string): Promise<string> {
  return sha256Hex(`template:${templateId}`);
}
