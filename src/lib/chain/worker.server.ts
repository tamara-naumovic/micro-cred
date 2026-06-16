// Server-only worker helpers: process a single template or credential anchor job.
// Called by anchor.functions.ts (admin context already verified by callers) and
// by the cron route /api/public/hooks/process-chain-anchors.

import { isChainConfigured, submitCredentialAnchor, submitTemplateAnchor, ChainNotConfiguredError } from "./bloxberg.server";
import {
  canonicalJson,
  sha256Hex,
  randomSecretHex,
  learnerCommitmentKeccak,
  templateRefKeccak,
} from "./hash";
import { buildVcJson } from "./vc";

const STATUS_ACTIVE = 0;
const STATUS_REVOKED = 1;
const STATUS_EXPIRED = 2;
const STATUS_PUBLISHED = 0;

/**
 * Backfill missing chain fields on a credential row.
 * Some credentials were inserted via legacy client-side paths (store.tsx
 * directIssue / bulkIssue / issueFromApplication) that didn't compute
 * vc_json / credential_hash / learner_commitment / learner_secret /
 * template_ref. Without these the on-chain submit would receive null
 * hex strings and crash with "Cannot read properties of null (reading 'startsWith')".
 *
 * Exported so server fns (repairCredentialChainFields) can reuse the same
 * logic and surface failures explicitly to the UI.
 */
export async function ensureCredentialChainFields(
  supabaseAdmin: any,
  cred: Record<string, any>,
): Promise<Record<string, any>> {
  // Load any existing learner secret from the locked-down secrets table.
  if (!cred.learner_secret) {
    const { data: secRow } = await supabaseAdmin
      .from("credential_secrets")
      .select("secret")
      .eq("credential_id", cred.id)
      .maybeSingle();
    cred.learner_secret = ((secRow as { secret: string } | null)?.secret) ?? null;
  }

  const hasAll =
    cred.credential_hash &&
    cred.learner_commitment &&
    cred.learner_secret &&
    cred.template_ref &&
    cred.vc_json;
  if (hasAll) return cred;

  let tpl: Record<string, any> | null = null;
  if (cred.template_id) {
    const { data } = await supabaseAdmin
      .from("templates")
      .select("*")
      .eq("id", cred.template_id)
      .maybeSingle();
    tpl = (data as Record<string, any> | null) ?? null;
  }

  const templateVersion: string =
    (cred.template_version as string | null) ?? (tpl?.version as string | null) ?? "1.0";
  const vcId: string = (cred.vc_id as string | null) ?? `urn:microcred:${cred.id}`;

  const templateRef: string =
    (cred.template_ref as string | null) ??
    (tpl?.template_ref as string | null) ??
    templateRefKeccak(
      cred.template_id ?? cred.id,
      templateVersion,
      (tpl?.document_hash as string | null) ?? "",
    );

  const vc =
    (cred.vc_json as Record<string, unknown> | null) ??
    buildVcJson({
      credentialId: cred.id,
      vcId,
      title: cred.title,
      templateId: cred.template_id,
      templateVersion,
      templateRef,
      earnerId: cred.earner_id,
      earnerName: cred.earner_name,
      issuerId: cred.issuer_id,
      issuerName: (cred.issuer_name_snapshot as string | null) ?? cred.issuer_name,
      issuedAt: cred.issued_at,
      expiresAt: cred.expires_at,
      source: (cred.source as string | null) ?? (tpl?.source as string | null) ?? null,
      subcategory: (cred.subcategory as string | null) ?? (tpl?.subcategory as string | null) ?? null,
      level: (cred.level as string | null) ?? (tpl?.level as string | null) ?? null,
      ects: (cred.ects as number | null) ?? (tpl?.ects as number | null) ?? null,
      skills: (cred.skills as string[] | null) ?? (tpl?.skills as string[] | null) ?? [],
      grade: (cred.grade as string | null) ?? null,
      qaType: (tpl?.qa_type as string | null) ?? null,
      supervisionType: (tpl?.supervision_type as string | null) ?? null,
      stackabilityType: (tpl?.stackability_type as string | null) ?? null,
      prerequisites: (tpl?.prerequisites as string | null) ?? null,
      prerequisitesNone: !!(tpl?.prerequisites_none as boolean | null),
      outcomes: (tpl?.outcomes as string[] | null) ?? [],
      assessment: (tpl?.assessment as string | null) ?? null,
      participation: (tpl?.participation as string | null) ?? null,
    });

  const docHash: string =
    (cred.credential_hash as string | null) ?? (await sha256Hex(canonicalJson(vc)));
  const learnerSecret: string =
    (cred.learner_secret as string | null) ?? randomSecretHex(32);
  const learnerCommitment: string =
    (cred.learner_commitment as string | null) ??
    learnerCommitmentKeccak(cred.earner_id, cred.id, learnerSecret);

  const { error: updErr } = await supabaseAdmin
    .from("credentials")
    .update({
      vc_id: vcId,
      vc_json: vc,
      canonical_payload: vc,
      template_version: templateVersion,
      template_ref: templateRef,
      credential_hash: docHash,
      learner_commitment: learnerCommitment,
    } as never)
    .eq("id", cred.id);
  if (updErr) {
    throw new Error(
      `Failed to backfill chain fields for credential ${cred.id}: ${updErr.message}`,
    );
  }

  // Persist the secret to the earner-only table (admin client; RLS bypassed).
  await supabaseAdmin
    .from("credential_secrets")
    .upsert({ credential_id: cred.id, secret: learnerSecret } as never, {
      onConflict: "credential_id",
    } as never);

  const contractAddress =
    process.env.CREDENTIAL_REGISTRY_ADDRESS || process.env.BLOXBERG_CONTRACT_ADDRESS || "";
  await supabaseAdmin
    .from("credential_blockchain_records")
    .upsert(
      {
        credential_id: cred.id,
        network: "bloxberg",
        chain_id: Number(process.env.BLOXBERG_CHAIN_ID || "8995"),
        contract_address: contractAddress,
        document_hash: docHash,
        blockchain_status: cred.chain_status ?? "not_requested",
      } as never,
      { onConflict: "credential_id" } as never,
    );

  return {
    ...cred,
    vc_id: vcId,
    vc_json: vc,
    template_version: templateVersion,
    template_ref: templateRef,
    credential_hash: docHash,
    learner_secret: learnerSecret,
    learner_commitment: learnerCommitment,
  };
}



export async function processCredentialAnchor(credentialId: string): Promise<{
  ok: boolean;
  skipped?: boolean;
  txHash?: string;
  error?: string;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cred, error } = await supabaseAdmin
    .from("credentials")
    .select("*")
    .eq("id", credentialId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!cred) return { ok: false, error: "Credential not found" };

  if (!isChainConfigured()) {
    await supabaseAdmin
      .from("credentials")
      .update({ chain_status: "queued", chain_error: "Chain not configured" } as never)
      .eq("id", credentialId);
    await supabaseAdmin
      .from("credential_blockchain_records" as never)
      .update({ blockchain_status: "queued", last_error: "Chain not configured" } as never)
      .eq("credential_id", credentialId);
    return { ok: false, skipped: true, error: "Chain not configured" };
  }

  // Auto-heal: legacy credentials may be missing the hex fields we need below.
  // Backfill before computing anything else; throws a clear error if it can't.
  const c = await ensureCredentialChainFields(supabaseAdmin, cred as Record<string, any>);

  const issuedAtSec = Math.floor(new Date(c.issued_at).getTime() / 1000);
  const expiresAtSec = c.expires_at ? Math.floor(new Date(c.expires_at).getTime() / 1000) : 0;
  const statusInt = c.credential_lifecycle === "revoked"
    ? STATUS_REVOKED
    : c.credential_lifecycle === "expired"
      ? STATUS_EXPIRED
      : STATUS_ACTIVE;

  const nowIso = new Date().toISOString();
  await supabaseAdmin
    .from("credentials")
    .update({ chain_status: "submitting", chain_submitted_at: nowIso, chain_last_attempt_at: nowIso, chain_attempts: (c.chain_attempts ?? 0) + 1 } as never)
    .eq("id", credentialId);
  await supabaseAdmin
    .from("credential_blockchain_records" as never)
    .update({ blockchain_status: "submitting", last_attempt_at: nowIso } as never)
    .eq("credential_id", credentialId);

  try {
    const res = await submitCredentialAnchor({
      credentialIdHex: c.id.replace(/-/g, ""),
      documentHashHex: c.credential_hash!,
      learnerCommitmentHex: c.learner_commitment!,
      templateRefHex: c.template_ref!,
      issuedAt: issuedAtSec,
      expiresAt: expiresAtSec,
      status: statusInt,
      issuerNameSnapshot: (c.issuer_name_snapshot as string) ?? c.issuer_name,
    });
    const confIso = new Date().toISOString();
    await supabaseAdmin
      .from("credentials")
      .update({
        chain_status: "confirmed",
        chain_tx_hash: res.txHash ?? null,
        chain_block_number: res.blockNumber || null,
        chain_issuer_address: res.issuerAddress,
        chain_contract_address: res.contractAddress,
        chain_confirmed_at: confIso,
        chain_error: res.alreadyAnchored
          ? "Recovered: credential was already on chain"
          : null,
      } as never)
      .eq("id", credentialId);
    await supabaseAdmin
      .from("credential_blockchain_records" as never)
      .update({
        blockchain_status: "confirmed",
        transaction_hash: res.txHash ?? null,
        block_number: res.blockNumber || null,
        anchored_at: confIso,
        contract_address: res.contractAddress,
        last_error: res.alreadyAnchored
          ? "Recovered: credential was already on chain"
          : null,
        attempt_count: (c.chain_attempts ?? 0) + 1,
      } as never)
      .eq("credential_id", credentialId);
    return { ok: true, txHash: res.txHash ?? undefined };
  } catch (e) {
    const msg = e instanceof ChainNotConfiguredError ? "Chain not configured" : (e as Error).message;
    await supabaseAdmin
      .from("credentials")
      .update({ chain_status: "failed", chain_error: msg } as never)
      .eq("id", credentialId);
    await supabaseAdmin
      .from("credential_blockchain_records" as never)
      .update({ blockchain_status: "failed", last_error: msg } as never)
      .eq("credential_id", credentialId);
    return { ok: false, error: msg };
  }
}

export async function processTemplateAnchor(
  templateId: string,
  version: string,
): Promise<{ ok: boolean; skipped?: boolean; txHash?: string; error?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: ver } = await supabaseAdmin
    .from("template_versions" as never)
    .select("*")
    .eq("template_id", templateId)
    .eq("version", version)
    .maybeSingle();
  if (!ver) return { ok: false, error: "Template version not found" };
  const v = ver as Record<string, any>;

  if (!isChainConfigured()) {
    await supabaseAdmin
      .from("templates")
      .update({ blockchain_status: "queued" } as never)
      .eq("id", templateId);
    await supabaseAdmin
      .from("template_blockchain_records" as never)
      .update({ blockchain_status: "queued", last_error: "Chain not configured" } as never)
      .eq("template_id", templateId)
      .eq("template_version", version);
    return { ok: false, skipped: true, error: "Chain not configured" };
  }

  const nowIso = new Date().toISOString();
  await supabaseAdmin
    .from("templates")
    .update({ blockchain_status: "submitting" } as never)
    .eq("id", templateId);
  await supabaseAdmin
    .from("template_blockchain_records" as never)
    .update({ blockchain_status: "submitting", last_attempt_at: nowIso } as never)
    .eq("template_id", templateId)
    .eq("template_version", version);

  try {
    if (!v.template_ref || !v.document_hash) {
      throw new Error(
        `Template version ${templateId}@${version} is missing template_ref/document_hash. ` +
        `Re-publish the template to recompute them.`,
      );
    }
    const res = await submitTemplateAnchor({
      templateRefHex: v.template_ref,
      documentHashHex: v.document_hash,
      templateIdHex: templateId.replace(/-/g, ""),
      version,
      issuerNameSnapshot: v.issuer_name_snapshot,
      publishedAt: Math.floor(new Date(v.published_at).getTime() / 1000),
      status: STATUS_PUBLISHED,
    });
    const confIso = new Date().toISOString();
    await supabaseAdmin
      .from("templates")
      .update({ blockchain_status: "confirmed" } as never)
      .eq("id", templateId);
    await supabaseAdmin
      .from("template_blockchain_records" as never)
      .update({
        blockchain_status: "confirmed",
        transaction_hash: res.txHash ?? null,
        block_number: res.blockNumber || null,
        anchored_at: confIso,
        contract_address: res.contractAddress,
        last_error: res.alreadyAnchored
          ? "Recovered: template version was already on chain"
          : null,
      } as never)
      .eq("template_id", templateId)
      .eq("template_version", version);

    // Auto-enqueue all related issued credentials that are not yet confirmed on-chain.
    try {
      const { data: pendingCreds } = await supabaseAdmin
        .from("credentials")
        .select("id, chain_status")
        .eq("template_id", templateId);
      const credIds = ((pendingCreds as { id: string; chain_status: string | null }[] | null) ?? [])
        .filter((r) => r.chain_status !== "confirmed")
        .map((r) => r.id);
      if (credIds.length > 0) {
        const nowIso2 = new Date().toISOString();
        // Re-queue only jobs that were skipped due to "Chain not configured".
        // Do NOT reset attempts/status on jobs that failed for other reasons —
        // that would bypass MAX_ATTEMPTS and risk infinite retry loops.
        await supabaseAdmin
          .from("credential_anchor_jobs" as never)
          .update({
            status: "queued",
            attempts: 0,
            next_attempt_at: nowIso2,
            last_error: null,
          } as never)
          .in("credential_id", credIds)
          .eq("status", "failed")
          .eq("last_error", "Chain not configured");
        // Insert jobs for credentials that don't have one yet (ignore duplicates).
        const rows = credIds.map((id) => ({
          credential_id: id,
          operation: "anchor_credential",
          status: "queued",
        }));
        const { error: insErr } = await supabaseAdmin
          .from("credential_anchor_jobs" as never)
          .insert(rows as never);
        if (insErr && !/duplicate key|unique/i.test(insErr.message)) {
          console.error("[auto-enqueue credentials] insert error", insErr.message);
        }
        await supabaseAdmin
          .from("credentials")
          .update({ chain_status: "pending", chain_error: null } as never)
          .in("id", credIds);
      }
    } catch (e) {
      console.error("[auto-enqueue credentials] failed", (e as Error).message);
    }

    return { ok: true, txHash: res.txHash ?? undefined };
  } catch (e) {
    const msg = e instanceof ChainNotConfiguredError ? "Chain not configured" : (e as Error).message;
    await supabaseAdmin
      .from("templates")
      .update({ blockchain_status: "failed" } as never)
      .eq("id", templateId);
    await supabaseAdmin
      .from("template_blockchain_records" as never)
      .update({ blockchain_status: "failed", last_error: msg } as never)
      .eq("template_id", templateId)
      .eq("template_version", version);
    return { ok: false, error: msg };
  }
}
