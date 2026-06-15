// Server-only worker helpers: process a single template or credential anchor job.
// Called by anchor.functions.ts (admin context already verified by callers) and
// by the cron route /api/public/hooks/process-chain-anchors.

import { isChainConfigured, submitCredentialAnchor, submitTemplateAnchor, ChainNotConfiguredError } from "./bloxberg.server";

const STATUS_ACTIVE = 0;
const STATUS_REVOKED = 1;
const STATUS_EXPIRED = 2;
const STATUS_PUBLISHED = 0;

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

  const c = cred as Record<string, any>;
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
        chain_tx_hash: res.txHash,
        chain_block_number: res.blockNumber,
        chain_issuer_address: res.issuerAddress,
        chain_contract_address: res.contractAddress,
        chain_confirmed_at: confIso,
        chain_error: null,
      } as never)
      .eq("id", credentialId);
    await supabaseAdmin
      .from("credential_blockchain_records" as never)
      .update({
        blockchain_status: "confirmed",
        transaction_hash: res.txHash,
        block_number: res.blockNumber,
        anchored_at: confIso,
        contract_address: res.contractAddress,
        last_error: null,
        attempt_count: (c.chain_attempts ?? 0) + 1,
      } as never)
      .eq("credential_id", credentialId);
    return { ok: true, txHash: res.txHash };
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
        transaction_hash: res.txHash,
        block_number: res.blockNumber,
        anchored_at: confIso,
        contract_address: res.contractAddress,
        last_error: null,
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

    return { ok: true, txHash: res.txHash };
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
