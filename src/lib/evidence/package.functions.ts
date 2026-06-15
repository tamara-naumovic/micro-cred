// Single dispatcher server function for credential evidence downloads.
// All file generation happens server-side from the frozen snapshot.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EvidenceFileType =
  | "pdf"
  | "json"
  | "receipt"
  | "instructions"
  | "package"
  | "private_proof";

export interface EvidenceResult {
  filename: string;
  contentType: string;
  base64: string;
}

interface Input {
  credentialId: string;
  fileType: EvidenceFileType;
}

export const generateCredentialEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Input) => {
    if (!d?.credentialId || typeof d.credentialId !== "string") {
      throw new Error("credentialId is required");
    }
    const ok = [
      "pdf",
      "json",
      "receipt",
      "instructions",
      "package",
      "private_proof",
    ];
    if (!ok.includes(d.fileType)) throw new Error("Invalid file type");
    return d;
  })
  .handler(async ({ data, context }): Promise<EvidenceResult> => {
    const { supabase, userId, claims } = context;
    const {
      loadCredentialForEvidence,
      authorizeViewer,
      assertIntegrity,
      writeAuditEvent,
    } = await import("./package.server");
    const {
      buildCredentialJson,
      buildVerificationReceipt,
      buildCredentialPdf,
      buildInstructionsPdf,
      buildQrPng,
      buildReadme,
      buildZip,
      buildPrivateProof,
      bytesToBase64,
    } = await import("./builders.server");

    const loaded = await loadCredentialForEvidence(data.credentialId);

    // Private proof: owner only + fresh session.
    if (data.fileType === "private_proof") {
      if (loaded.cred.earner_id !== userId) {
        throw new Error("You are not authorised to download this credential.");
      }
      const iat =
        typeof (claims as { iat?: number })?.iat === "number"
          ? (claims as { iat: number }).iat
          : 0;
      const ageSec = Math.floor(Date.now() / 1000) - iat;
      if (iat === 0 || ageSec > 30 * 60) {
        throw new Error(
          "Please sign in again to download your private ownership proof.",
        );
      }
      if (!loaded.cred.learner_secret) {
        throw new Error(
          "Private ownership proof is not available for this credential.",
        );
      }
      const body = buildPrivateProof(loaded);
      await writeAuditEvent({
        userId,
        actorName: (claims as { email?: string })?.email ?? null,
        action: "download_credential_private_proof",
        credentialId: loaded.cred.id,
      });
      return {
        filename: `micro-credential-${loaded.cred.share_token}-private-proof.json`,
        contentType: "application/json",
        base64: utf8ToBase64(body),
      };
    }

    // Public files: owner OR platform_admin OR issuer of this org.
    await authorizeViewer({
      supabase: supabase as never,
      userId,
      cred: loaded.cred,
    });

    if (data.fileType === "pdf" || data.fileType === "json" || data.fileType === "package") {
      await assertIntegrity(loaded.cred);
    }

    const actorEmail =
      (claims as { email?: string })?.email ?? null;

    if (data.fileType === "json") {
      const body = buildCredentialJson(loaded);
      await writeAuditEvent({
        userId,
        actorName: actorEmail,
        action: "download_credential_json",
        credentialId: loaded.cred.id,
      });
      return {
        filename: `micro-credential-${loaded.cred.share_token}.json`,
        contentType: "application/json",
        base64: utf8ToBase64(body),
      };
    }

    if (data.fileType === "receipt") {
      const body = buildVerificationReceipt(loaded);
      await writeAuditEvent({
        userId,
        actorName: actorEmail,
        action: "download_credential_receipt",
        credentialId: loaded.cred.id,
      });
      return {
        filename: `micro-credential-${loaded.cred.share_token}-receipt.json`,
        contentType: "application/json",
        base64: utf8ToBase64(body),
      };
    }

    if (data.fileType === "instructions") {
      const bytes = await buildInstructionsPdf();
      await writeAuditEvent({
        userId,
        actorName: actorEmail,
        action: "download_credential_instructions",
        credentialId: loaded.cred.id,
      });
      return {
        filename: `micro-credential-${loaded.cred.share_token}-instructions.pdf`,
        contentType: "application/pdf",
        base64: bytesToBase64(bytes),
      };
    }

    if (data.fileType === "pdf") {
      const qr = await buildQrPng(loaded.verifyUrl);
      const pdf = await buildCredentialPdf(loaded, qr);
      await writeAuditEvent({
        userId,
        actorName: actorEmail,
        action: "download_credential_pdf",
        credentialId: loaded.cred.id,
      });
      return {
        filename: `micro-credential-${loaded.cred.share_token}.pdf`,
        contentType: "application/pdf",
        base64: bytesToBase64(pdf),
      };
    }

    // package
    const qr = await buildQrPng(loaded.verifyUrl);
    const credentialPdf = await buildCredentialPdf(loaded, qr);
    const instructionsPdf = await buildInstructionsPdf();
    const zip = buildZip({
      credentialPdf,
      credentialJson: buildCredentialJson(loaded),
      receiptJson: buildVerificationReceipt(loaded),
      instructionsPdf,
      qrPng: qr,
      readme: buildReadme(loaded),
    });
    await writeAuditEvent({
      userId,
      actorName: actorEmail,
      action: "download_credential_package",
      credentialId: loaded.cred.id,
    });
    return {
      filename: `micro-credential-${loaded.cred.share_token}.zip`,
      contentType: "application/zip",
      base64: bytesToBase64(zip),
    };
  });

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
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
