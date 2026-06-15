// Server-only file builders for credential evidence downloads.
// Pure JS / Worker-safe: pdf-lib, qrcode, fflate, js-sha3.

import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { zipSync, strToU8 } from "fflate";
import sha3 from "js-sha3";
const { keccak256 } = sha3;

// Embed Noto Sans so non-ASCII characters (ć, š, ž, č, đ, etc.) render in PDFs.
// Standard pdf-lib fonts use WinAnsi encoding which cannot encode these.
import { fontBase64 as notoRegularBase64 } from "./fonts/NotoSans-Regular";
import { fontBase64 as notoBoldBase64 } from "./fonts/NotoSans-Bold";
import { fontBase64 as notoItalicBase64 } from "./fonts/NotoSans-Italic";

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const NOTO_REGULAR = base64ToBytes(notoRegularBase64);
const NOTO_BOLD = base64ToBytes(notoBoldBase64);
const NOTO_ITALIC = base64ToBytes(notoItalicBase64);

import type { LoadedCredential, CredentialRow, TemplateMeta } from "./package.server";
import {
  chainStatusEnum,
  chainStatusLabel,
  credentialStatusEnum,
  credentialStatusLabel,
  FAILED_ANCHOR_USER_MESSAGE,
} from "./labels";

const NETWORK_NAME = "Bloxberg";
const NETWORK_CHAIN_ID = 8995;
const CONTRACT_NAME = "CredentialRegistry";

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(bin);
}

function utf8ToBase64(s: string): string {
  return bytesToBase64(new TextEncoder().encode(s));
}

function safeStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toISOString();
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// JSON builders
// ---------------------------------------------------------------------------

interface SnapshotAchievement {
  outcomes?: string[] | null;
  assessment?: string | null;
  participation?: string | null;
  level?: string | null;
  ects?: number | null;
  skills?: string[] | null;
  grade?: string | null;
  source?: string | null;
  subcategory?: string | null;
  name?: string | null;
}

interface SnapshotEuMeta {
  qaType?: string | null;
  supervisionType?: string | null;
  stackabilityType?: string | null;
  prerequisites?: string | null;
  prerequisitesNone?: boolean | null;
}

interface SnapshotSubject {
  achievement?: SnapshotAchievement;
  euMetadata?: SnapshotEuMeta;
}

interface Snapshot {
  credentialSubject?: SnapshotSubject;
}

/** Read snapshot fields from canonical_payload when present, otherwise
 *  fall back to live template metadata. Snapshot is authoritative — this
 *  guarantees historical accuracy when templates change. */
function snapshotAchievement(
  cred: CredentialRow,
  template: TemplateMeta | null,
) {
  const snap = (cred.canonical_payload as Snapshot | null)?.credentialSubject;
  const a = snap?.achievement ?? {};
  const eu = snap?.euMetadata ?? {};
  return {
    outcomes: a.outcomes ?? template?.outcomes ?? [],
    assessment: a.assessment ?? template?.assessment ?? null,
    participation: a.participation ?? template?.participation ?? null,
    qaType: eu.qaType ?? template?.qa_type ?? null,
    supervisionType: eu.supervisionType ?? template?.supervision_type ?? null,
    stackabilityType: eu.stackabilityType ?? template?.stackability_type ?? null,
    prerequisites: eu.prerequisitesNone
      ? null
      : (eu.prerequisites ?? template?.prerequisites ?? null),
    prerequisitesNone:
      eu.prerequisitesNone ?? template?.prerequisites_none ?? false,
  };
}

export function buildCredentialJson(loaded: LoadedCredential): string {
  const { cred, template, publicId } = loaded;

  const learnerIdHash = keccak256(cred.earner_id);
  const subjectId = `urn:microcred:learner:${learnerIdHash.slice(0, 32)}`;
  const snap = snapshotAchievement(cred, template);

  const achievement = {
    title: cred.title,
    description: template?.description ?? null,
    learningOutcomes: snap.outcomes,
    skills: cred.skills ?? [],
    ects: cred.ects ?? null,
    workload: null,
    level: cred.level === "N/A" ? null : cred.level,
    assessment: snap.assessment,
    grade: cred.grade ?? null,
    participation: snap.participation,
    qualityAssurance: snap.qaType,
    prerequisites: snap.prerequisitesNone ? "None" : snap.prerequisites,
    supervisionAndIdentityVerification: snap.supervisionType,
    integrationAndStackability: snap.stackabilityType,
  };

  const hasChain = !!cred.chain_contract_address;
  const blockchainProof = hasChain
    ? {
        network: NETWORK_NAME,
        chainId: NETWORK_CHAIN_ID,
        status: chainStatusEnum(cred.chain_status as never),
        contractAddress: cred.chain_contract_address,
        transactionHash: cred.chain_tx_hash,
        blockNumber: cred.chain_block_number,
        documentHash: cred.credential_hash,
        anchoredAt: cred.chain_confirmed_at ?? cred.chain_submitted_at ?? null,
      }
    : null;

  const doc: Record<string, unknown> = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    id: publicId,
    type: ["VerifiableCredential", "MicroCredential"],
    issuer: {
      id: `urn:microcred:issuer:${cred.issuer_id}`,
      name: cred.issuer_name_snapshot ?? cred.issuer_name,
    },
    issuanceDate: cred.issued_at,
    expirationDate: cred.expires_at,
    credentialSubject: {
      id: subjectId,
      name: cred.earner_name,
      achievement,
    },
    credentialStatus: {
      status: credentialStatusEnum(cred.status, cred.credential_lifecycle),
    },
    template: {
      templateId: `urn:microcred:template:${cred.template_id}`,
      version: cred.template_version ?? "1.0",
      templateRef: cred.template_ref,
    },
    blockchainProof,
  };

  // Include a real VC proof if one is stored; otherwise omit.
  const vc = cred.vc_json as { proof?: unknown } | null | undefined;
  if (vc && typeof vc === "object" && "proof" in vc && vc.proof) {
    (doc as Record<string, unknown>).proof = vc.proof;
  }

  return JSON.stringify(doc, null, 2);
}

export function buildVerificationReceipt(loaded: LoadedCredential): string {
  const { cred, verifyUrl, publicId } = loaded;
  const credIdHash = "0x" + keccak256(cred.id);

  const status = chainStatusEnum(cred.chain_status as never);
  const isConfirmed = status === "CONFIRMED";

  const receipt: Record<string, unknown> = {
    credentialId: publicId,
    credentialIdHash: credIdHash,
    documentHash: cred.credential_hash,
    learnerCommitment: cred.learner_commitment,
    templateRef: cred.template_ref,
    credentialStatus: credentialStatusEnum(cred.status, cred.credential_lifecycle),
    blockchainStatus: status,
    network: { name: NETWORK_NAME, chainId: NETWORK_CHAIN_ID },
    contract: cred.chain_contract_address
      ? { name: CONTRACT_NAME, address: cred.chain_contract_address }
      : null,
    transactionHash: isConfirmed ? cred.chain_tx_hash : null,
    blockNumber: isConfirmed ? cred.chain_block_number : null,
    anchoredAt: isConfirmed ? (cred.chain_confirmed_at ?? null) : null,
    verificationUrl: verifyUrl,
    generatedAt: new Date().toISOString(),
  };

  if (status === "FAILED") {
    receipt.message = FAILED_ANCHOR_USER_MESSAGE;
  } else if (status === "QUEUED" || status === "PENDING" || status === "SUBMITTED") {
    receipt.message =
      "Blockchain confirmation is pending. The credential is valid in the platform.";
  }

  return JSON.stringify(receipt, null, 2);
}

export function buildPrivateProof(loaded: LoadedCredential): string {
  const { cred, publicId } = loaded;
  if (!cred.learner_secret) {
    throw new Error("Private ownership proof is not available for this credential.");
  }
  const credentialIdHash = "0x" + keccak256(cred.id);
  const learnerIdHash = "0x" + keccak256(cred.earner_id);
  return JSON.stringify(
    {
      credentialId: publicId,
      credentialIdHash,
      learnerIdHash,
      recoverySecret: cred.learner_secret.startsWith("0x")
        ? cred.learner_secret
        : "0x" + cred.learner_secret,
      learnerCommitment: cred.learner_commitment,
      commitmentAlgorithm:
        "keccak256(abi.encode(bytes32 learnerIdHash, bytes32 credentialIdHash, bytes32 recoverySecret))",
      warning:
        "Keep this file private. Do not share it publicly. This file is confidential and is used to prove ownership of your credential.",
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

// ---------------------------------------------------------------------------
// QR code
// ---------------------------------------------------------------------------

export async function buildQrPng(url: string): Promise<Uint8Array> {
  const buf = await QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
  });
  // node Buffer is a Uint8Array — but we copy to a plain Uint8Array for safety.
  return new Uint8Array(buf);
}

// ---------------------------------------------------------------------------
// Credential PDF
// ---------------------------------------------------------------------------

interface PdfFonts {
  regular: import("pdf-lib").PDFFont;
  bold: import("pdf-lib").PDFFont;
  italic: import("pdf-lib").PDFFont;
}

function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  const words = text.split(/\s+/);
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur ? cur + " " : "") + w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function buildCredentialPdf(
  loaded: LoadedCredential,
  qrPng: Uint8Array,
): Promise<Uint8Array> {
  const { cred, template, verifyUrl, publicId } = loaded;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const page = doc.addPage([595.28, 841.89]); // A4 portrait
  const { width, height } = page.getSize();

  const fonts: PdfFonts = {
    regular: await doc.embedFont(NOTO_REGULAR, { subset: true }),
    bold: await doc.embedFont(NOTO_BOLD, { subset: true }),
    italic: await doc.embedFont(NOTO_ITALIC, { subset: true }),
  };

  const margin = 48;
  let y = height - margin;
  const primary = rgb(0.09, 0.18, 0.36);
  const muted = rgb(0.45, 0.48, 0.55);
  const text = rgb(0.13, 0.15, 0.2);

  // Header brand line
  page.drawText("MICROCRED", {
    x: margin,
    y,
    size: 11,
    font: fonts.bold,
    color: primary,
  });
  page.drawText("Credential Certificate", {
    x: width - margin - fonts.regular.widthOfTextAtSize("Credential Certificate", 10),
    y,
    size: 10,
    font: fonts.italic,
    color: muted,
  });
  y -= 18;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: primary,
  });
  y -= 28;

  // Title block + QR (right column)
  const qrImg = await doc.embedPng(qrPng);
  const qrSize = 110;
  const titleMaxWidth = width - margin * 2 - qrSize - 16;
  const titleLines = wrapText(cred.title, 38);
  let titleY = y;
  for (const line of titleLines) {
    page.drawText(line, {
      x: margin,
      y: titleY,
      size: 20,
      font: fonts.bold,
      color: text,
    });
    titleY -= 24;
    if (titleY < y - 60) break;
  }
  page.drawText(`Issued to ${cred.earner_name}`, {
    x: margin,
    y: titleY - 4,
    size: 12,
    font: fonts.regular,
    color: text,
    maxWidth: titleMaxWidth,
  });
  page.drawText(
    `by ${cred.issuer_name_snapshot ?? cred.issuer_name}`,
    {
      x: margin,
      y: titleY - 22,
      size: 11,
      font: fonts.italic,
      color: muted,
      maxWidth: titleMaxWidth,
    },
  );

  page.drawImage(qrImg, {
    x: width - margin - qrSize,
    y: y - qrSize + 6,
    width: qrSize,
    height: qrSize,
  });

  y = Math.min(titleY - 38, y - qrSize - 10);

  // Status row
  const statusLabel = credentialStatusLabel(cred.status, cred.credential_lifecycle);
  const chainLabel = chainStatusLabel(cred.chain_status as never);
  page.drawText(`Status: ${statusLabel}    ·    Blockchain proof: ${chainLabel}`, {
    x: margin,
    y,
    size: 10,
    font: fonts.bold,
    color: primary,
  });
  y -= 22;

  // Metadata grid (snapshot-first so old credentials stay historically accurate)
  const snap = snapshotAchievement(cred, template);
  const rows: Array<[string, string]> = [];
  rows.push(["Issued", fmtDate(cred.issued_at)]);
  rows.push(["Expires", cred.expires_at ? fmtDate(cred.expires_at) : "Does not expire"]);
  if (cred.grade) rows.push(["Grade / result", cred.grade]);
  if (cred.level && cred.level !== "N/A") rows.push(["Level", cred.level]);
  if (cred.ects != null) rows.push(["ECTS / workload", `${cred.ects} ECTS`]);
  rows.push(["Source", cred.source === "formal" ? "Formal" : "Non-formal"]);
  if (snap.participation) rows.push(["Participation", snap.participation]);
  if (snap.assessment) rows.push(["Assessment", snap.assessment]);
  if (snap.qaType) rows.push(["Quality assurance", snap.qaType]);
  if (snap.prerequisitesNone) {
    rows.push(["Prerequisites", "None"]);
  } else if (snap.prerequisites) {
    rows.push(["Prerequisites", snap.prerequisites]);
  }
  if (snap.supervisionType) {
    rows.push(["Supervision & identity verification", snap.supervisionType]);
  }
  if (snap.stackabilityType) {
    rows.push(["Integration / stackability", snap.stackabilityType]);
  }
  if (cred.template_version) rows.push(["Template version", cred.template_version]);
  rows.push(["Credential ID", publicId]);

  const colWidth = (width - margin * 2) / 2;
  const lineH = 14;
  for (let i = 0; i < rows.length; i += 2) {
    const left = rows[i];
    const right = rows[i + 1];
    drawField(page, margin, y, colWidth, left[0], left[1], fonts, muted, text);
    if (right) {
      drawField(
        page,
        margin + colWidth,
        y,
        colWidth,
        right[0],
        right[1],
        fonts,
        muted,
        text,
      );
    }
    y -= lineH * 2.2;
    if (y < 220) break; // leave room for outcomes/skills/footer
  }

  // Learning outcomes + skills ---------------------------------------------
  const outcomes = snap.outcomes;
  if (outcomes.length && y > 200) {
    y -= 4;
    page.drawText("Learning outcomes", {
      x: margin,
      y,
      size: 10,
      font: fonts.bold,
      color: primary,
    });
    y -= 14;
    for (const o of outcomes.slice(0, 5)) {
      for (const line of wrapText("• " + o, 95)) {
        if (y < 180) break;
        page.drawText(line, { x: margin, y, size: 9, font: fonts.regular, color: text });
        y -= 12;
      }
    }
    y -= 6;
  }

  if (cred.skills?.length && y > 200) {
    page.drawText("Skills", {
      x: margin,
      y,
      size: 10,
      font: fonts.bold,
      color: primary,
    });
    y -= 14;
    for (const line of wrapText(cred.skills.join(" · "), 100)) {
      if (y < 180) break;
      page.drawText(line, { x: margin, y, size: 9, font: fonts.regular, color: text });
      y -= 12;
    }
    y -= 8;
  }

  // Technical verification block (smaller) ---------------------------------
  const techY0 = 150;
  page.drawLine({
    start: { x: margin, y: techY0 + 14 },
    end: { x: width - margin, y: techY0 + 14 },
    thickness: 0.5,
    color: muted,
  });
  page.drawText("Technical verification", {
    x: margin,
    y: techY0,
    size: 9,
    font: fonts.bold,
    color: muted,
  });
  const tech: string[] = [];
  if (cred.credential_hash) tech.push(`Document hash: ${cred.credential_hash}`);
  if (cred.chain_tx_hash && chainStatusEnum(cred.chain_status as never) === "CONFIRMED") {
    tech.push(`Tx hash: ${cred.chain_tx_hash}`);
  }
  tech.push(`Network: ${NETWORK_NAME} (chainId ${NETWORK_CHAIN_ID})`);
  if (cred.chain_contract_address) {
    tech.push(`Contract: ${cred.chain_contract_address}`);
  }
  let ty = techY0 - 12;
  for (const t of tech) {
    for (const line of wrapText(t, 110)) {
      page.drawText(line, { x: margin, y: ty, size: 7.5, font: fonts.regular, color: muted });
      ty -= 10;
    }
  }

  // Footer ------------------------------------------------------------------
  const footerLines = wrapText(
    "This credential can be verified using the QR code or verification link. The blockchain stores cryptographic proof and lifecycle status, not the complete personal credential.",
    105,
  );
  let fy = 48;
  for (const line of footerLines.reverse()) {
    page.drawText(line, { x: margin, y: fy, size: 8, font: fonts.italic, color: muted });
    fy += 10;
  }
  page.drawText(verifyUrl, {
    x: margin,
    y: 30,
    size: 7,
    font: fonts.regular,
    color: muted,
  });

  const bytes = await doc.save();
  return bytes;
}

function drawField(
  page: import("pdf-lib").PDFPage,
  x: number,
  y: number,
  maxWidth: number,
  label: string,
  value: string,
  fonts: PdfFonts,
  muted: import("pdf-lib").RGB,
  text: import("pdf-lib").RGB,
) {
  page.drawText(label.toUpperCase(), {
    x,
    y,
    size: 7,
    font: fonts.bold,
    color: muted,
  });
  const lines = wrapText(safeStr(value) ?? "—", Math.floor(maxWidth / 5));
  let ly = y - 11;
  for (const line of lines.slice(0, 2)) {
    page.drawText(line, { x, y: ly, size: 10, font: fonts.regular, color: text });
    ly -= 12;
  }
}

// ---------------------------------------------------------------------------
// Verification instructions PDF
// ---------------------------------------------------------------------------

export async function buildInstructionsPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 48;
  let y = height - margin;
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const muted = rgb(0.45, 0.48, 0.55);
  const text = rgb(0.13, 0.15, 0.2);
  const primary = rgb(0.09, 0.18, 0.36);

  page.drawText("How to verify this credential", {
    x: margin,
    y,
    size: 18,
    font: bold,
    color: primary,
  });
  y -= 22;
  page.drawText("A short guide for verifiers, employers and auditors.", {
    x: margin,
    y,
    size: 10,
    font: italic,
    color: muted,
  });
  y -= 26;

  const steps = [
    "Scan the QR code on the credential PDF, or open the verification URL in any browser.",
    "Check the current credential lifecycle status (Valid, Revoked, Expired, Superseded).",
    "Check the blockchain proof status (Pending, Confirmed or Temporarily unavailable).",
    "When performing a technical audit, compare the document hash printed on the credential with the hash anchored on Bloxberg.",
    "Follow the Bloxberg transaction link when available to inspect on-chain proof directly.",
  ];
  for (let i = 0; i < steps.length; i++) {
    page.drawText(`${i + 1}.`, { x: margin, y, size: 11, font: bold, color: primary });
    for (const line of wrapText(steps[i], 90)) {
      page.drawText(line, { x: margin + 18, y, size: 10, font: regular, color: text });
      y -= 14;
    }
    y -= 4;
  }
  y -= 8;

  page.drawText("What the statuses mean", { x: margin, y, size: 12, font: bold, color: primary });
  y -= 16;
  const meanings: Array<[string, string]> = [
    ["Valid", "The credential has been issued and is currently in effect."],
    ["Revoked", "The issuer has cancelled this credential."],
    ["Expired", "The credential's expiry date has passed."],
    ["Superseded", "A newer version of this credential has replaced it."],
    ["Blockchain proof pending", "The credential is valid; on-chain confirmation is still being processed."],
    ["Blockchain proof confirmed", "Cryptographic proof has been anchored on Bloxberg."],
    ["Blockchain temporarily unavailable", "The platform could not anchor the credential and will retry automatically. Off-chain validity is unchanged."],
  ];
  for (const [k, v] of meanings) {
    page.drawText(k, { x: margin, y, size: 10, font: bold, color: text });
    y -= 12;
    for (const line of wrapText(v, 100)) {
      page.drawText(line, { x: margin + 12, y, size: 9.5, font: regular, color: text });
      y -= 12;
    }
    y -= 4;
  }
  y -= 8;

  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: muted,
  });
  y -= 16;
  page.drawText("Privacy", { x: margin, y, size: 11, font: bold, color: primary });
  y -= 14;
  for (const line of wrapText(
    "The complete credential and personal learner data are stored off-chain. The blockchain stores only cryptographic proof, references and lifecycle status.",
    95,
  )) {
    page.drawText(line, { x: margin, y, size: 10, font: regular, color: text });
    y -= 14;
  }

  return await doc.save();
}

// ---------------------------------------------------------------------------
// README + ZIP
// ---------------------------------------------------------------------------

export function buildReadme(loaded: LoadedCredential): string {
  const { cred, verifyUrl, publicId } = loaded;
  const lines: string[] = [];
  lines.push("MicroCred — Credential Evidence Package");
  lines.push("=".repeat(60));
  lines.push("");
  lines.push(`Title:    ${cred.title}`);
  lines.push(`Issuer:   ${cred.issuer_name_snapshot ?? cred.issuer_name}`);
  lines.push(`Issued:   ${fmtDateLong(cred.issued_at)}`);
  if (cred.expires_at) lines.push(`Expires:  ${fmtDateLong(cred.expires_at)}`);
  lines.push(`Credential ID: ${publicId}`);
  lines.push("");
  lines.push("Files in this package");
  lines.push("---------------------");
  lines.push("credential.pdf");
  lines.push("    Human-readable certificate. Share with employers and verifiers.");
  lines.push("credential.json");
  lines.push("    Machine-readable record of the credential.");
  lines.push("    Suitable for wallets and digital portfolios.");
  lines.push("verification-receipt.json");
  lines.push("    Blockchain proof references and integrity hashes.");
  lines.push("verification-instructions.pdf");
  lines.push("    Step-by-step guide for verifiers.");
  lines.push("qr-code.png");
  lines.push("    Standalone QR code pointing at the public verification page.");
  lines.push("README.txt");
  lines.push("    This file.");
  lines.push("");
  lines.push(`Verification URL: ${verifyUrl}`);
  lines.push("");
  lines.push("Privacy notice");
  lines.push("--------------");
  lines.push(
    "The personal credential content is stored off-chain. The blockchain holds only",
  );
  lines.push(
    "cryptographic proof, lifecycle status and template references. The complete credential",
  );
  lines.push("never leaves the platform unless you share it through this package.");
  lines.push("");
  lines.push("Private ownership proof");
  lines.push("-----------------------");
  lines.push(
    "This ZIP intentionally does NOT contain the private ownership proof (recovery secret).",
  );
  lines.push(
    "If you need it, download it separately from the credential page. Keep it private and",
  );
  lines.push("never send it to employers, verifiers or other third parties.");
  lines.push("");
  lines.push("Blockchain status");
  lines.push("-----------------");
  lines.push(
    "Blockchain anchoring may still be pending even when the credential is already issued.",
  );
  lines.push(
    "Pending anchoring does NOT mean the credential is invalid — it only means the on-chain",
  );
  lines.push("proof has not been confirmed yet.");
  lines.push("");
  return lines.join("\n");
}

export interface PackageFiles {
  credentialPdf: Uint8Array;
  credentialJson: string;
  receiptJson: string;
  instructionsPdf: Uint8Array;
  qrPng: Uint8Array;
  readme: string;
}

export function buildZip(files: PackageFiles): Uint8Array {
  return zipSync({
    "credential-package/credential.pdf": files.credentialPdf,
    "credential-package/credential.json": strToU8(files.credentialJson),
    "credential-package/verification-receipt.json": strToU8(files.receiptJson),
    "credential-package/verification-instructions.pdf": files.instructionsPdf,
    "credential-package/qr-code.png": files.qrPng,
    "credential-package/README.txt": strToU8(files.readme),
  });
}

// Re-export types used elsewhere
export type { CredentialRow, TemplateMeta };
