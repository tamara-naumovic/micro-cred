// Async anchoring of issued credentials to the Bloxberg blockchain.
// enqueueAnchor: called from the issuance flow (authenticated).
// processAnchor: called from the cron worker (internal; uses admin client).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  canonicalJson,
  sha256Hex,
  commitmentHex,
  templateRefHex,
  randomSecretHex,
} from "./hash";
import { buildVcJson } from "./vc";

const STATUS_ACTIVE = 0;
const STATUS_REVOKED = 1;
const STATUS_EXPIRED = 2;

interface CredentialRow {
  id: string;
  template_id: string | null;
  title: string;
  earner_id: string;
  earner_name: string;
  issuer_id: string;
  issuer_name: string;
  issued_at: string;
  expires_at: string | null;
  status: string;
  source: string | null;
  subcategory: string | null;
  level: string | null;
  ects: number | null;
  skills: string[] | null;
  grade: string | null;
  credential_hash: string | null;
  learner_commitment: string | null;
  learner_secret: string | null;
  template_ref: string | null;
  vc_json: unknown;
  chain_status: string | null;
}

interface TemplateRow {
  qa_type: string | null;
  supervision_type: string | null;
  stackability_type: string | null;
  prerequisites: string | null;
  prerequisites_none: boolean | null;
}

async function computeAndPersistHashes(
  supabase: { from: (t: string) => any },
  cred: CredentialRow,
): Promise<CredentialRow> {
  // Already populated? Nothing to do.
  if (
    cred.credential_hash &&
    cred.learner_commitment &&
    cred.template_ref &&
    cred.learner_secret &&
    cred.vc_json
  ) {
    return cred;
  }

  let templateRow: TemplateRow | null = null;
  if (cred.template_id) {
    const { data } = await supabase
      .from("templates")
      .select("qa_type, supervision_type, stackability_type, prerequisites, prerequisites_none")
      .eq("id", cred.template_id)
      .maybeSingle();
    templateRow = (data as TemplateRow | null) ?? null;
  }

  const secret = cred.learner_secret ?? randomSecretHex(32);
  const vc =
    (cred.vc_json as Record<string, unknown> | null) ??
    buildVcJson({
      credentialId: cred.id,
      vcId: `urn:microcred:${cred.id}`,
      templateVersion: null,
      templateRef: null,
      title: cred.title,
      templateId: cred.template_id,
      earnerId: cred.earner_id,
      earnerName: cred.earner_name,
      issuerId: cred.issuer_id,
      issuerName: cred.issuer_name,
      issuedAt: cred.issued_at,
      expiresAt: cred.expires_at,
      source: cred.source,
      subcategory: cred.subcategory,
      level: cred.level,
      ects: cred.ects,
      skills: cred.skills,
      grade: cred.grade,
      qaType: templateRow?.qa_type ?? null,
      supervisionType: templateRow?.supervision_type ?? null,
      stackabilityType: templateRow?.stackability_type ?? null,
      prerequisites: templateRow?.prerequisites ?? null,
      prerequisitesNone: templateRow?.prerequisites_none ?? null,
    });

  const docHash = cred.credential_hash ?? (await sha256Hex(canonicalJson(vc)));
  const commit = cred.learner_commitment ?? (await commitmentHex(cred.earner_id, secret));
  const tref = cred.template_ref ?? (await templateRefHex(cred.template_id ?? cred.id));

  await supabase
    .from("credentials")
    .update({
      vc_json: vc,
      credential_hash: docHash,
      learner_commitment: commit,
      learner_secret: secret,
      template_ref: tref,
    })
    .eq("id", cred.id);

  return {
    ...cred,
    vc_json: vc,
    credential_hash: docHash,
    learner_commitment: commit,
    learner_secret: secret,
    template_ref: tref,
  };
}

/** Enqueue a credential for async on-chain anchoring. Idempotent. */
export const enqueueAnchor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { credentialId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("credentials")
      .select(
        "id, template_id, title, earner_id, earner_name, issuer_id, issuer_name, issued_at, expires_at, status, source, subcategory, level, ects, skills, grade, credential_hash, learner_commitment, learner_secret, template_ref, vc_json, chain_status",
      )
      .eq("id", data.credentialId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Credential not found");

    await computeAndPersistHashes(supabase as never, row as unknown as CredentialRow);

    if ((row as { chain_status?: string }).chain_status === "confirmed") {
      return { ok: true, alreadyConfirmed: true };
    }

    // Insert a queue row. Unique partial index makes this idempotent for active jobs.
    const { error: jobErr } = await supabase
      .from("chain_anchor_jobs")
      .insert({ credential_id: data.credentialId, status: "queued" } as never);
    // Duplicate-key error is fine — a job is already pending.
    if (jobErr && !/duplicate key|unique/i.test(jobErr.message)) {
      throw new Error(jobErr.message);
    }
    await supabase
      .from("credentials")
      .update({ chain_status: "pending" } as never)
      .eq("id", data.credentialId);

    return { ok: true };
  });

/** Internal: process a single anchor job. Used by the cron worker. */
export async function processAnchor(credentialId: string): Promise<{
  ok: boolean;
  skipped?: boolean;
  txHash?: string;
  error?: string;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { isChainConfigured, submitAnchor, ChainNotConfiguredError } = await import(
    "./bloxberg.server"
  );

  const { data, error } = await supabaseAdmin
    .from("credentials")
    .select(
      "id, template_id, title, earner_id, earner_name, issuer_id, issuer_name, issued_at, expires_at, status, source, subcategory, level, ects, skills, grade, credential_hash, learner_commitment, learner_secret, template_ref, vc_json, chain_status",
    )
    .eq("id", credentialId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Credential not found" };

  const cred = await computeAndPersistHashes(
    supabaseAdmin as never,
    data as unknown as CredentialRow,
  );

  if (!isChainConfigured()) {
    await supabaseAdmin
      .from("credentials")
      .update({ chain_status: "pending", chain_error: "Chain not configured" } as never)
      .eq("id", credentialId);
    return { ok: false, skipped: true, error: "Chain not configured" };
  }

  const issuedAtSec = Math.floor(new Date(cred.issued_at).getTime() / 1000);
  const expiresAtSec = cred.expires_at
    ? Math.floor(new Date(cred.expires_at).getTime() / 1000)
    : 0;
  const statusInt =
    cred.status === "revoked"
      ? STATUS_REVOKED
      : cred.status === "expired"
        ? STATUS_EXPIRED
        : STATUS_ACTIVE;

  await supabaseAdmin
    .from("credentials")
    .update({ chain_status: "submitted", chain_submitted_at: new Date().toISOString() } as never)
    .eq("id", credentialId);

  try {
    const res = await submitAnchor({
      credentialIdHex: cred.id.replace(/-/g, ""),
      documentHashHex: cred.credential_hash!,
      learnerCommitmentHex: cred.learner_commitment!,
      templateRefHex: cred.template_ref!,
      issuedAt: issuedAtSec,
      expiresAt: expiresAtSec,
      status: statusInt,
      issuerNameSnapshot: cred.issuer_name,
    });
    await supabaseAdmin
      .from("credentials")
      .update({
        chain_status: "confirmed",
        chain_tx_hash: res.txHash,
        chain_block_number: res.blockNumber,
        chain_issuer_address: res.issuerAddress,
        chain_contract_address: res.contractAddress,
        chain_confirmed_at: new Date().toISOString(),
        chain_error: null,
      } as never)
      .eq("id", credentialId);
    return { ok: true, txHash: res.txHash };
  } catch (e) {
    const msg = e instanceof ChainNotConfiguredError ? "Chain not configured" : (e as Error).message;
    await supabaseAdmin
      .from("credentials")
      .update({ chain_status: "failed", chain_error: msg } as never)
      .eq("id", credentialId);
    return { ok: false, error: msg };
  }
}
