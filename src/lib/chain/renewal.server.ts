// Server-only renewal workflow: issue a replacement credential, anchor it, and
// only then supersede the original credential on-chain and off-chain.
// Never import from client-reachable modules at top level.

import { canonicalJson, sha256Hex, randomSecretHex, learnerCommitmentKeccak, templateRefKeccak } from "./hash";
import { buildVcJson } from "./vc";

export type RenewalState =
  | "replacement_pending"
  | "replacement_anchored"
  | "supersede_pending"
  | "supersede_failed"
  | "completed"
  | "cancelled";

export interface RenewalOutcome {
  ok: boolean;
  renewalId: string;
  replacementCredentialId: string;
  state: RenewalState;
  replacementTxHash?: string | null;
  supersedeTxHash?: string | null;
  error?: string;
  offChainOnly?: boolean;
}

async function audit(
  supabaseAdmin: any,
  actorId: string | null,
  action: string,
  target: string,
) {
  await supabaseAdmin.from("audit_log").insert({
    actor_id: actorId,
    actor_name: "issuer",
    action,
    target,
  } as never);
}

async function notify(
  supabaseAdmin: any,
  earnerId: string,
  titleKey: string,
  bodyKey: string,
  title: string,
  body: string,
  link: string,
  params: Record<string, unknown>,
) {
  await supabaseAdmin.from("notifications").insert({
    for_user_id: earnerId,
    title,
    body,
    link,
    title_key: titleKey,
    body_key: bodyKey,
    params,
  } as never);
}

/**
 * Create the replacement credential row (new UUID, new expiry, same template
 * version), reusing the production VC / hash / commitment helpers.
 */
export async function createReplacementCredential(
  supabaseAdmin: any,
  original: Record<string, any>,
  newExpiresAt: string,
): Promise<{ id: string; documentHash: string }> {
  const credentialId = crypto.randomUUID();
  const vcId = `urn:microcred:${credentialId}`;

  let tpl: Record<string, any> | null = null;
  if (original.template_id) {
    const { data } = await supabaseAdmin
      .from("templates")
      .select("*")
      .eq("id", original.template_id)
      .maybeSingle();
    tpl = (data as Record<string, any> | null) ?? null;
  }

  const templateVersion: string =
    (original.template_version as string | null) ?? (tpl?.version as string | null) ?? "1.0";
  const templateRef: string =
    (original.template_ref as string | null) ??
    (tpl?.template_ref as string | null) ??
    templateRefKeccak(
      original.template_id ?? credentialId,
      templateVersion,
      (tpl?.document_hash as string | null) ?? "",
    );
  const issuerName: string =
    (original.issuer_name_snapshot as string | null) ?? (original.issuer_name as string);
  const issuedAt = new Date().toISOString();

  const vc = buildVcJson({
    credentialId,
    vcId,
    title: original.title,
    templateId: original.template_id,
    templateVersion,
    templateRef,
    earnerId: original.earner_id,
    earnerName: original.earner_name,
    issuerId: original.issuer_id,
    issuerName,
    issuedAt,
    expiresAt: newExpiresAt,
    source: original.source ?? tpl?.source ?? null,
    subcategory: original.subcategory ?? tpl?.subcategory ?? null,
    level: original.level ?? tpl?.level ?? null,
    ects: original.ects ?? tpl?.ects ?? null,
    skills: original.skills ?? tpl?.skills ?? [],
    grade: original.grade ?? null,
    qaType: tpl?.qa_type ?? null,
    supervisionType: tpl?.supervision_type ?? null,
    stackabilityType: tpl?.stackability_type ?? null,
    prerequisites: tpl?.prerequisites ?? null,
    prerequisitesNone: !!tpl?.prerequisites_none,
    outcomes: tpl?.outcomes ?? [],
    assessment: tpl?.assessment ?? null,
    participation: tpl?.participation ?? null,
  });

  const documentHash = await sha256Hex(canonicalJson(vc));
  const secret = randomSecretHex(32);
  const learnerCommitment = learnerCommitmentKeccak(original.earner_id, credentialId, secret);

  const { error: insErr } = await supabaseAdmin.from("credentials").insert({
    id: credentialId,
    template_id: original.template_id,
    title: original.title,
    earner_id: original.earner_id,
    earner_name: original.earner_name,
    issuer_id: original.issuer_id,
    issuer_name: original.issuer_name,
    issued_at: issuedAt,
    expires_at: newExpiresAt,
    status: "active",
    credential_lifecycle: "issued",
    source: original.source ?? tpl?.source ?? "formal",
    subcategory: original.subcategory ?? null,
    level: original.level ?? tpl?.level ?? "N/A",
    ects: original.ects ?? null,
    skills: original.skills ?? [],
    grade: original.grade ?? null,
    vc_id: vcId,
    template_version: templateVersion,
    template_ref: templateRef,
    issuer_name_snapshot: issuerName,
    canonical_payload: vc,
    vc_json: vc,
    credential_hash: documentHash,
    learner_commitment: learnerCommitment,
    chain_status: "not_requested",
    renewed_from_id: original.id,
    share_is_public: false,
  } as never);
  if (insErr) throw new Error(insErr.message);

  await supabaseAdmin
    .from("credential_secrets")
    .upsert({ credential_id: credentialId, secret } as never, {
      onConflict: "credential_id",
    } as never);

  const contractAddress =
    process.env.CREDENTIAL_REGISTRY_ADDRESS || process.env.BLOXBERG_CONTRACT_ADDRESS || "";
  await supabaseAdmin.from("credential_blockchain_records").insert({
    credential_id: credentialId,
    network: "bloxberg",
    chain_id: Number(process.env.BLOXBERG_CHAIN_ID || "8995"),
    contract_address: contractAddress,
    document_hash: documentHash,
    blockchain_status: "not_requested",
  } as never);

  return { id: credentialId, documentHash };
}

async function setRenewal(supabaseAdmin: any, renewalId: string, patch: Record<string, unknown>) {
  await supabaseAdmin.from("credential_renewals").update(patch as never).eq("id", renewalId);
}

/**
 * Mark the original superseded off-chain. Only called after the on-chain
 * supersede succeeded, or when the original was never anchored.
 */
async function markOriginalSuperseded(
  supabaseAdmin: any,
  originalId: string,
  replacementId: string,
) {
  await supabaseAdmin
    .from("credentials")
    .update({
      credential_lifecycle: "superseded",
      superseded_by_id: replacementId,
    } as never)
    .eq("id", originalId);
}

/**
 * Drive a renewal forward: anchor the replacement, wait for confirmation, then
 * supersede the original. Safe to call repeatedly (manual retry).
 */
export async function runRenewalWorkflow(
  renewalId: string,
  actorId: string | null,
): Promise<RenewalOutcome> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("credential_renewals")
    .select("*")
    .eq("id", renewalId)
    .maybeSingle();
  if (!row) throw new Error("Renewal not found");
  const r = row as Record<string, any>;
  const originalId: string = r.original_credential_id;
  const replacementId: string | null = r.replacement_credential_id;
  if (!replacementId) throw new Error("Renewal has no replacement credential");

  const { data: origRow } = await supabaseAdmin
    .from("credentials")
    .select("id, title, earner_id, chain_status, credential_lifecycle")
    .eq("id", originalId)
    .maybeSingle();
  const orig = (origRow as Record<string, any> | null) ?? {};

  const { isChainConfigured } = await import("./bloxberg.server");
  const originalWasAnchored = orig.chain_status === "confirmed";

  // Original never anchored (or chain not configured): off-chain-only renewal.
  if (!originalWasAnchored || !isChainConfigured()) {
    await markOriginalSuperseded(supabaseAdmin, originalId, replacementId);
    await setRenewal(supabaseAdmin, renewalId, {
      state: "completed",
      completed_at: new Date().toISOString(),
      supersede_chain_status: originalWasAnchored ? "not_requested" : "not_applicable",
      last_error: null,
    });
    await audit(supabaseAdmin, actorId, "original credential superseded (off-chain only)", originalId);
    await notify(
      supabaseAdmin,
      orig.earner_id,
      "events.credentialRenewed.title",
      "events.credentialRenewed.body",
      "Credential renewed",
      `${orig.title ?? "Credential"} has been replaced by a renewed credential.`,
      `/earner/credentials/${replacementId}`,
      { title: orig.title ?? "" },
    );
    return {
      ok: true,
      renewalId,
      replacementCredentialId: replacementId,
      state: "completed",
      offChainOnly: true,
    };
  }

  // 1) Anchor the replacement (idempotent: skip when already confirmed).
  const { data: replRow } = await supabaseAdmin
    .from("credentials")
    .select("id, chain_status, chain_tx_hash")
    .eq("id", replacementId)
    .maybeSingle();
  let replacement = (replRow as Record<string, any> | null) ?? {};
  if (replacement.chain_status !== "confirmed") {
    const { processCredentialAnchor } = await import("./worker.server");
    const anchorRes = await processCredentialAnchor(replacementId);
    if (!anchorRes.ok) {
      await setRenewal(supabaseAdmin, renewalId, {
        state: "replacement_pending",
        last_error: anchorRes.error ?? "Replacement anchoring failed",
        attempts: (r.attempts ?? 0) + 1,
      });
      await audit(supabaseAdmin, actorId, "renewal failed: replacement anchoring", replacementId);
      return {
        ok: false,
        renewalId,
        replacementCredentialId: replacementId,
        state: "replacement_pending",
        error: anchorRes.error ?? "Replacement anchoring failed",
      };
    }
    const { data: refreshed } = await supabaseAdmin
      .from("credentials")
      .select("id, chain_status, chain_tx_hash")
      .eq("id", replacementId)
      .maybeSingle();
    replacement = (refreshed as Record<string, any> | null) ?? replacement;
  }

  if (replacement.chain_status !== "confirmed") {
    await setRenewal(supabaseAdmin, renewalId, {
      state: "replacement_pending",
      last_error: "Replacement is not confirmed on chain yet",
      attempts: (r.attempts ?? 0) + 1,
    });
    return {
      ok: false,
      renewalId,
      replacementCredentialId: replacementId,
      state: "replacement_pending",
      error: "Replacement is not confirmed on chain yet",
    };
  }

  await setRenewal(supabaseAdmin, renewalId, {
    state: "supersede_pending",
    replacement_anchored_at: new Date().toISOString(),
    supersede_chain_status: "submitting",
  });
  await audit(supabaseAdmin, actorId, "replacement credential anchored", replacementId);

  // 2) Supersede the original on-chain via a dedicated job (own operation,
  // never processed by the regular anchor branch).
  const { data: existingJob } = await supabaseAdmin
    .from("credential_anchor_jobs")
    .select("id")
    .eq("credential_id", originalId)
    .eq("operation", "supersede_credential")
    .maybeSingle();
  if (existingJob) {
    await supabaseAdmin
      .from("credential_anchor_jobs")
      .update({ status: "running", last_error: null } as never)
      .eq("id", (existingJob as { id: string }).id);
  } else {
    await supabaseAdmin.from("credential_anchor_jobs").insert({
      credential_id: originalId,
      operation: "supersede_credential",
      status: "running",
    } as never);
  }

  try {
    const { submitSupersedeCredential } = await import("./bloxberg.server");
    const res = await submitSupersedeCredential(originalId, replacementId);
    await markOriginalSuperseded(supabaseAdmin, originalId, replacementId);
    await supabaseAdmin
      .from("credentials")
      .update({
        chain_status: "confirmed",
        chain_error: res.alreadySuperseded ? "Recovered: already superseded on chain" : null,
      } as never)
      .eq("id", originalId);
    await setRenewal(supabaseAdmin, renewalId, {
      state: "completed",
      completed_at: new Date().toISOString(),
      supersede_chain_status: "confirmed",
      supersede_tx_hash: res.txHash,
      supersede_block_number: res.blockNumber || null,
      supersede_confirmed_at: res.confirmedAt,
      last_error: null,
    });
    await supabaseAdmin
      .from("credential_anchor_jobs")
      .update({
        status: "done",
        transaction_hash: res.txHash,
        last_attempt_at: res.confirmedAt,
        last_error: null,
      } as never)
      .eq("credential_id", originalId)
      .eq("operation", "supersede_credential");

    await audit(supabaseAdmin, actorId, "original credential superseded on chain", originalId);
    await notify(
      supabaseAdmin,
      orig.earner_id,
      "events.credentialRenewed.title",
      "events.credentialRenewed.body",
      "Credential renewed",
      `${orig.title ?? "Credential"} has been replaced by a renewed credential.`,
      `/earner/credentials/${replacementId}`,
      { title: orig.title ?? "" },
    );

    return {
      ok: true,
      renewalId,
      replacementCredentialId: replacementId,
      state: "completed",
      replacementTxHash: replacement.chain_tx_hash ?? null,
      supersedeTxHash: res.txHash,
    };
  } catch (e) {
    const msg = (e as Error).message;
    await setRenewal(supabaseAdmin, renewalId, {
      state: "supersede_failed",
      supersede_chain_status: "failed",
      last_error: msg,
      attempts: (r.attempts ?? 0) + 1,
    });
    await supabaseAdmin
      .from("credential_anchor_jobs")
      .update({
        status: "failed",
        last_attempt_at: new Date().toISOString(),
        last_error: msg,
      } as never)
      .eq("credential_id", originalId)
      .eq("operation", "supersede_credential");
    await audit(supabaseAdmin, actorId, "renewal failed: supersede transaction", originalId);
    // Original stays Active off-chain; replacement stays Active.
    return {
      ok: false,
      renewalId,
      replacementCredentialId: replacementId,
      state: "supersede_failed",
      replacementTxHash: replacement.chain_tx_hash ?? null,
      error: msg,
    };
  }
}
