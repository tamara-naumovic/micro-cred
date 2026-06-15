// Server-only helpers: load credential row, authorize the caller,
// verify document-hash integrity. No client imports.

import { canonicalJson, sha256Hex } from "@/lib/chain/hash";

export interface CredentialRow {
  id: string;
  template_id: string;
  template_version: string | null;
  title: string;
  earner_id: string;
  earner_name: string;
  issuer_id: string;
  issuer_name: string;
  issuer_name_snapshot: string | null;
  issued_at: string;
  expires_at: string | null;
  status: string;
  credential_lifecycle: string;
  source: string;
  subcategory: string | null;
  level: string;
  ects: number | null;
  skills: string[];
  grade: string | null;
  share_token: string;
  credential_hash: string | null;
  learner_commitment: string | null;
  learner_secret: string | null;
  template_ref: string | null;
  vc_id: string | null;
  vc_json: unknown;
  canonical_payload: unknown;
  chain_status: string | null;
  chain_tx_hash: string | null;
  chain_block_number: number | null;
  chain_issuer_address: string | null;
  chain_contract_address: string | null;
  chain_confirmed_at: string | null;
  chain_submitted_at: string | null;
  revocation_reason: string | null;
  superseded_by_id: string | null;
}

export interface TemplateMeta {
  qa_type: string | null;
  participation: string | null;
  assessment: string | null;
  prerequisites: string | null;
  prerequisites_none: boolean | null;
  supervision_type: string | null;
  stackability_type: string | null;
  outcomes: string[] | null;
  description: string | null;
}

export interface LoadedCredential {
  cred: CredentialRow;
  template: TemplateMeta | null;
  /** absolute https URL for the public verification page */
  verifyUrl: string;
  /** display id used in filenames + JSON `id` field */
  publicId: string;
}

const SELECT_COLS =
  "id, template_id, template_version, title, earner_id, earner_name, issuer_id, issuer_name, issuer_name_snapshot, issued_at, expires_at, status, credential_lifecycle, source, subcategory, level, ects, skills, grade, share_token, credential_hash, learner_commitment, learner_secret, template_ref, vc_id, vc_json, canonical_payload, chain_status, chain_tx_hash, chain_block_number, chain_issuer_address, chain_contract_address, chain_confirmed_at, chain_submitted_at, revocation_reason, superseded_by_id";

export async function loadCredentialForEvidence(
  credentialId: string,
): Promise<LoadedCredential> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("credentials")
    .select(SELECT_COLS)
    .eq("id", credentialId)
    .maybeSingle();
  if (error) throw new Error("Credential data is temporarily unavailable.");
  if (!data) throw new Error("Credential not found.");
  const cred = data as unknown as CredentialRow;

  let template: TemplateMeta | null = null;
  if (cred.template_id) {
    const tplRes = await supabaseAdmin
      .from("templates")
      .select(
        "qa_type, participation, assessment, prerequisites, prerequisites_none, supervision_type, stackability_type, outcomes, description",
      )
      .eq("id", cred.template_id)
      .maybeSingle();
    template = (tplRes.data as TemplateMeta | null) ?? null;
  }

  const publicId = cred.vc_id ?? `urn:microcred:${cred.id}`;
  const baseUrl =
    process.env.PUBLIC_APP_URL ?? "https://micro-credential-platform.lovable.app";
  const verifyUrl = `${baseUrl.replace(/\/$/, "")}/verify/${cred.share_token}`;

  return { cred, template, verifyUrl, publicId };
}

/** Authorize the caller for non-private downloads.
 *  Owner, platform_admin, issuer_admin/staff of the issuing org. */
export async function authorizeViewer(opts: {
  supabase: {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>;
  };
  userId: string;
  cred: CredentialRow;
}): Promise<"owner" | "platform_admin" | "issuer"> {
  if (opts.cred.earner_id === opts.userId) return "owner";
  const adminRes = await opts.supabase.rpc("is_platform_admin", {
    _user_id: opts.userId,
  });
  if (adminRes.data === true) return "platform_admin";
  for (const role of ["issuer_admin", "issuer_staff"]) {
    const r = await opts.supabase.rpc("has_role_in_org", {
      _user_id: opts.userId,
      _role: role,
      _org_id: opts.cred.issuer_id,
    });
    if (r.data === true) return "issuer";
  }
  throw new Error("You are not authorised to download this credential.");
}

/** Verify the document hash still matches the stored canonical payload.
 *  Skips silently when either is missing (legacy credentials). */
export async function assertIntegrity(cred: CredentialRow): Promise<void> {
  if (!cred.credential_hash || cred.canonical_payload == null) return;
  const recomputed = await sha256Hex(canonicalJson(cred.canonical_payload));
  if (recomputed.toLowerCase() !== cred.credential_hash.toLowerCase()) {
    throw new Error(
      "We could not generate the package because the stored credential snapshot failed an integrity check.",
    );
  }
}

/** Insert a single audit_log row. Never logs the recovery secret. */
export async function writeAuditEvent(opts: {
  userId: string;
  actorName: string | null;
  action: string;
  credentialId: string;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_log").insert({
      actor_id: opts.userId,
      actor_name: opts.actorName ?? "earner",
      action: opts.action,
      target: opts.credentialId,
    } as never);
  } catch (e) {
    // Audit failures must never block downloads.
    console.error("[evidence] audit write failed", (e as Error)?.message);
  }
}
