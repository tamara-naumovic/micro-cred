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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: jobErr } = await supabaseAdmin
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

// ============================================================================
// New, plan-aligned server functions (Phase 2-6)
// ============================================================================

import {
  keccak256Hex,
  learnerCommitmentKeccak,
  templateRefKeccak,
} from "./hash";
import { buildTemplateCanonicalPayload } from "./vc";

export const getChainAvailabilityFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getChainAvailability } = await import("./bloxberg.server");
  return getChainAvailability();
});

async function assertIssuerForTemplate(
  supabase: any,
  userId: string,
  templateId: string,
): Promise<{ issuerId: string; issuerName: string }> {
  const { data: tpl } = await supabase
    .from("templates")
    .select("id, issuer_id")
    .eq("id", templateId)
    .maybeSingle();
  if (!tpl) throw new Error("Template not found");
  const { data: isAdmin } = await supabase.rpc("is_platform_admin", { _user_id: userId });
  const { data: isOrgAdmin } = await supabase.rpc("has_role_in_org", {
    _user_id: userId,
    _role: "issuer_admin",
    _org_id: tpl.issuer_id,
  });
  if (!isAdmin && !isOrgAdmin) throw new Error("Forbidden");
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", tpl.issuer_id)
    .maybeSingle();
  return { issuerId: tpl.issuer_id, issuerName: (org?.name as string) ?? "Issuer" };
}

function nextVersion(current: string | null | undefined): string {
  if (!current) return "1.0";
  const m = /^(\d+)\.(\d+)$/.exec(current);
  if (!m) return `${current}.1`;
  return `${m[1]}.${Number(m[2]) + 1}`;
}

/** Publish a template (DRAFT → PUBLISHED) and either anchor now or queue. */
export const publishTemplateAndAnchor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { templateId: string; anchorMode: "now" | "later" }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertIssuerForTemplate(supabase as never, userId, data.templateId);

    const { data: tpl, error } = await supabase
      .from("templates")
      .select("*")
      .eq("id", data.templateId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tpl) throw new Error("Template not found");

    const t = tpl as Record<string, any>;
    const isAlreadyPublished = t.status === "active";
    const version = isAlreadyPublished ? nextVersion(t.version as string) : (t.version as string) || "1.0";

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", t.issuer_id)
      .maybeSingle();
    const issuerName = (org?.name as string) ?? "Issuer";

    const canonical = buildTemplateCanonicalPayload({
      templateId: t.id,
      version,
      issuerId: t.issuer_id,
      issuerName,
      title: t.title,
      description: t.description ?? "",
      source: t.source,
      subcategory: t.subcategory ?? null,
      level: t.level,
      participation: t.participation,
      ects: t.ects ?? null,
      skills: t.skills ?? [],
      outcomes: t.outcomes ?? [],
      assessment: t.assessment ?? "",
      qaType: t.qa_type,
      prerequisites: t.prerequisites ?? "",
      prerequisitesNone: !!t.prerequisites_none,
      supervisionType: t.supervision_type ?? null,
      stackabilityType: t.stackability_type ?? null,
      expiryMode: t.expiry_mode,
      expiryDate: t.expiry_date ?? null,
      furtherInfo: t.further_info ?? null,
    });
    const documentHash = await sha256Hex(canonicalJson(canonical));
    const templateRef = templateRefKeccak(t.id, version, documentHash);
    const publishedAt = new Date().toISOString();

    // Insert immutable version snapshot (idempotent on conflict)
    const { error: vErr } = await supabase
      .from("template_versions" as never)
      .insert({
        template_id: t.id,
        version,
        canonical_payload: canonical,
        document_hash: documentHash,
        template_ref: templateRef,
        issuer_name_snapshot: issuerName,
        published_at: publishedAt,
        published_by: userId,
      } as never);
    if (vErr && !/duplicate/i.test(vErr.message)) throw new Error(vErr.message);

    // Update template row to PUBLISHED + snapshot fields
    await supabase
      .from("templates")
      .update({
        status: "active",
        version,
        canonical_payload: canonical,
        document_hash: documentHash,
        template_ref: templateRef,
        issuer_name_snapshot: issuerName,
        published_at: publishedAt,
        published_by: userId,
        blockchain_status: "not_requested",
      } as never)
      .eq("id", t.id);

    // Ensure a blockchain_records row exists for this version
    const { data: avail } = await supabase.rpc("__noop_avail" as never, {} as never).then(
      () => ({ data: null }),
      () => ({ data: null }),
    );
    void avail;
    const { isChainConfigured: chainCfg } = await import("./bloxberg.server");
    const contractAddress =
      process.env.TEMPLATE_REGISTRY_ADDRESS || process.env.BLOXBERG_CONTRACT_ADDRESS || "";

    const { error: bErr } = await supabase
      .from("template_blockchain_records" as never)
      .insert({
        template_id: t.id,
        template_version: version,
        network: "bloxberg",
        chain_id: Number(process.env.BLOXBERG_CHAIN_ID || "8995"),
        contract_address: contractAddress,
        document_hash: documentHash,
        template_ref: templateRef,
        blockchain_status: "not_requested",
      } as never);
    if (bErr && !/duplicate/i.test(bErr.message)) throw new Error(bErr.message);

    // Queue or anchor
    if (data.anchorMode === "later" || !chainCfg()) {
      await supabase
        .from("chain_anchor_jobs" as never)
        .insert({
          entity_type: "template",
          entity_id: t.id,
          operation: "anchor_template",
          status: "queued",
        } as never);
      await supabase
        .from("template_blockchain_records" as never)
        .update({ blockchain_status: "queued" } as never)
        .eq("template_id", t.id)
        .eq("template_version", version);
      await supabase
        .from("templates")
        .update({ blockchain_status: "queued" } as never)
        .eq("id", t.id);
      return { ok: true, version, mode: "queued" as const };
    }

    // Anchor now
    const { processTemplateAnchor } = await import("./worker.server");
    const res = await processTemplateAnchor(t.id, version);
    return { ok: true, version, mode: "now" as const, result: res };
  });

interface IssueRecipientInput {
  earnerId: string;
  earnerName: string;
  grade?: string | null;
  expiresAt?: string | null;
}

/** Issue one or more credentials from a published template, then queue/anchor each. */
export const issueCredentialsBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      templateId: string;
      issuedAt: string;
      recipients: IssueRecipientInput[];
      anchorMode: "now" | "later";
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: tpl, error } = await supabase
      .from("templates")
      .select("*")
      .eq("id", data.templateId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tpl) throw new Error("Template not found");
    const t = tpl as Record<string, any>;
    if (t.status !== "active") throw new Error("Template is not published");

    // Permission: issuer_admin in org, platform_admin, or template assignee
    const { data: isAdmin } = await supabase.rpc("is_platform_admin", { _user_id: userId });
    const { data: isOrgAdmin } = await supabase.rpc("has_role_in_org", {
      _user_id: userId,
      _role: "issuer_admin",
      _org_id: t.issuer_id,
    });
    const { data: isAssignee } = await supabase.rpc("is_template_assignee", {
      _user_id: userId,
      _template_id: t.id,
    });
    if (!isAdmin && !isOrgAdmin && !isAssignee) throw new Error("Forbidden");

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", t.issuer_id)
      .maybeSingle();
    const issuerName = (org?.name as string) ?? "Issuer";
    const templateVersion = (t.version as string) || "1.0";
    const templateRef =
      (t.template_ref as string | null) ?? templateRefKeccak(t.id, templateVersion, (t.document_hash as string) ?? "");

    const { isChainConfigured: chainCfg } = await import("./bloxberg.server");
    const canAnchorNow = chainCfg();
    const effectiveMode: "now" | "later" = data.anchorMode === "now" && canAnchorNow ? "now" : "later";

    const results: {
      recipientId: string;
      credentialId?: string;
      credentialStatus: string;
      blockchainStatus: string;
      txHash?: string;
      error?: string;
    }[] = [];

    for (const r of data.recipients) {
      try {
        const credentialId = crypto.randomUUID();
        const vcId = `urn:microcred:${credentialId}`;
        const expiresAt =
          r.expiresAt ?? (t.expiry_mode === "fixed_date" ? (t.expiry_date as string | null) : null);

        const vc = (await import("./vc")).buildVcJson({
          credentialId,
          vcId,
          title: t.title,
          templateId: t.id,
          templateVersion,
          templateRef,
          earnerId: r.earnerId,
          earnerName: r.earnerName,
          issuerId: t.issuer_id,
          issuerName,
          issuedAt: data.issuedAt,
          expiresAt,
          source: t.source,
          subcategory: t.subcategory ?? null,
          level: t.level,
          ects: t.ects ?? null,
          skills: t.skills ?? [],
          grade: r.grade ?? null,
          qaType: t.qa_type,
          supervisionType: t.supervision_type ?? null,
          stackabilityType: t.stackability_type ?? null,
          prerequisites: t.prerequisites ?? null,
          prerequisitesNone: !!t.prerequisites_none,
          outcomes: t.outcomes ?? [],
          assessment: t.assessment ?? null,
          participation: t.participation ?? null,
        });
        const docHash = await sha256Hex(canonicalJson(vc));
        const secret = randomSecretHex(32);
        const learnerCommitment = learnerCommitmentKeccak(r.earnerId, credentialId, secret);

        const { error: insErr } = await supabase
          .from("credentials")
          .insert({
            id: credentialId,
            template_id: t.id,
            title: t.title,
            earner_id: r.earnerId,
            earner_name: r.earnerName,
            issuer_id: t.issuer_id,
            issuer_name: issuerName,
            issued_at: data.issuedAt,
            expires_at: expiresAt,
            status: "active",
            credential_lifecycle: "issued",
            source: t.source,
            subcategory: t.subcategory ?? null,
            level: t.level,
            ects: t.ects ?? null,
            skills: t.skills ?? [],
            grade: r.grade ?? null,
            vc_id: vcId,
            template_version: templateVersion,
            template_ref: templateRef,
            issuer_name_snapshot: issuerName,
            canonical_payload: vc,
            vc_json: vc,
            credential_hash: docHash,
            learner_commitment: learnerCommitment,
            learner_secret: secret,
            chain_status: "not_requested",
          } as never);
        if (insErr) throw new Error(insErr.message);

        // Blockchain record
        const contractAddress =
          process.env.CREDENTIAL_REGISTRY_ADDRESS || process.env.BLOXBERG_CONTRACT_ADDRESS || "";
        await supabase
          .from("credential_blockchain_records" as never)
          .insert({
            credential_id: credentialId,
            network: "bloxberg",
            chain_id: Number(process.env.BLOXBERG_CHAIN_ID || "8995"),
            contract_address: contractAddress,
            document_hash: docHash,
            blockchain_status: "not_requested",
          } as never);

        if (effectiveMode === "later") {
          await supabase
            .from("chain_anchor_jobs" as never)
            .insert({
              entity_type: "credential",
              entity_id: credentialId,
              credential_id: credentialId,
              operation: "anchor_credential",
              status: "queued",
            } as never);
          await supabase
            .from("credentials")
            .update({ chain_status: "queued" } as never)
            .eq("id", credentialId);
          await supabase
            .from("credential_blockchain_records" as never)
            .update({ blockchain_status: "queued" } as never)
            .eq("credential_id", credentialId);
          results.push({ recipientId: r.earnerId, credentialId, credentialStatus: "issued", blockchainStatus: "queued" });
        } else {
          // Anchor now
          const { processCredentialAnchor } = await import("./worker.server");
          const res = await processCredentialAnchor(credentialId);
          results.push({
            recipientId: r.earnerId,
            credentialId,
            credentialStatus: "issued",
            blockchainStatus: res.ok ? "confirmed" : "failed",
            txHash: res.txHash,
            error: res.ok ? undefined : res.error,
          });
        }
      } catch (e) {
        results.push({
          recipientId: r.earnerId,
          credentialStatus: "not_issued",
          blockchainStatus: "not_requested",
          error: (e as Error).message,
        });
      }
    }

    return { ok: true, results };
  });

/** Anchor a single template version now (manual). */
export const anchorTemplateNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { templateId: string; version: string }) => d)
  .handler(async ({ data, context }) => {
    await assertIssuerForTemplate(context.supabase as never, context.userId, data.templateId);
    const { processTemplateAnchor } = await import("./worker.server");
    return processTemplateAnchor(data.templateId, data.version);
  });

/** Anchor a single credential now (manual). */
export const anchorCredentialNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { credentialId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cred } = await supabase
      .from("credentials")
      .select("issuer_id, template_id")
      .eq("id", data.credentialId)
      .maybeSingle();
    if (!cred) throw new Error("Credential not found");
    const { data: isAdmin } = await supabase.rpc("is_platform_admin", { _user_id: userId });
    const { data: isOrgAdmin } = await supabase.rpc("has_role_in_org", {
      _user_id: userId,
      _role: "issuer_admin",
      _org_id: cred.issuer_id,
    });
    const { data: isAssignee } = await supabase.rpc("is_template_assignee", {
      _user_id: userId,
      _template_id: cred.template_id,
    });
    if (!isAdmin && !isOrgAdmin && !isAssignee) throw new Error("Forbidden");
    const { processCredentialAnchor } = await import("./worker.server");
    return processCredentialAnchor(data.credentialId);
  });

/** Cancel a queued anchor job. */
export const cancelAnchorJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: job } = await supabase
      .from("chain_anchor_jobs" as never)
      .select("*")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job) throw new Error("Job not found");
    const j = job as Record<string, any>;
    if (j.status === "done" || j.status === "running") {
      throw new Error("Job is no longer cancellable");
    }
    await supabase
      .from("chain_anchor_jobs" as never)
      .update({ status: "cancelled" } as never)
      .eq("id", data.jobId);
    if (j.entity_type === "credential") {
      await supabase
        .from("credentials")
        .update({ chain_status: "cancelled" } as never)
        .eq("id", j.entity_id);
      await supabase
        .from("credential_blockchain_records" as never)
        .update({ blockchain_status: "cancelled" } as never)
        .eq("credential_id", j.entity_id);
    } else {
      await supabase
        .from("templates")
        .update({ blockchain_status: "cancelled" } as never)
        .eq("id", j.entity_id);
      await supabase
        .from("template_blockchain_records" as never)
        .update({ blockchain_status: "cancelled" } as never)
        .eq("template_id", j.entity_id);
    }
    return { ok: true };
  });

/** Revoke a credential. If already confirmed on-chain, queue REVOKE_CREDENTIAL job. */
export const revokeCredentialOnChain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { credentialId: string; reason?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cred } = await supabase
      .from("credentials")
      .select("id, issuer_id, template_id, chain_status, credential_lifecycle")
      .eq("id", data.credentialId)
      .maybeSingle();
    if (!cred) throw new Error("Credential not found");
    const { data: isAdmin } = await supabase.rpc("is_platform_admin", { _user_id: userId });
    const { data: isOrgAdmin } = await supabase.rpc("has_role_in_org", {
      _user_id: userId,
      _role: "issuer_admin",
      _org_id: cred.issuer_id,
    });
    if (!isAdmin && !isOrgAdmin) throw new Error("Forbidden");

    const c = cred as Record<string, any>;
    const alreadyConfirmed = c.chain_status === "confirmed";

    await supabase
      .from("credentials")
      .update({
        credential_lifecycle: "revoked",
        status: "revoked",
        revocation_reason: data.reason ?? null,
      } as never)
      .eq("id", data.credentialId);

    if (alreadyConfirmed) {
      await supabase
        .from("chain_anchor_jobs" as never)
        .insert({
          entity_type: "credential",
          entity_id: data.credentialId,
          credential_id: data.credentialId,
          operation: "revoke_credential",
          status: "queued",
        } as never);
      return { ok: true, mode: "on_chain_revoke_queued" };
    }

    // Cancel any pending issuance anchor jobs
    await supabase
      .from("chain_anchor_jobs" as never)
      .update({ status: "cancelled" } as never)
      .eq("entity_id", data.credentialId)
      .eq("operation", "anchor_credential")
      .in("status", ["queued", "failed"]);
    await supabase
      .from("credentials")
      .update({ chain_status: "cancelled" } as never)
      .eq("id", data.credentialId);
    await supabase
      .from("credential_blockchain_records" as never)
      .update({ blockchain_status: "cancelled" } as never)
      .eq("credential_id", data.credentialId);
    return { ok: true, mode: "cancelled" };
  });

/** Reveal a learner's secret to the owner only. */
export const revealLearnerSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { credentialId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cred } = await supabase
      .from("credentials")
      .select("earner_id, learner_secret")
      .eq("id", data.credentialId)
      .maybeSingle();
    if (!cred || cred.earner_id !== userId) throw new Error("Forbidden");
    return { secret: (cred.learner_secret as string) ?? null };
  });

// ============================================================================
// Phase 5: Anchoring Queue listing + retry
// ============================================================================

const MAX_ATTEMPTS = 5;

interface QueueRow {
  id: string;
  entity_type: "template" | "credential";
  entity_id: string;
  operation: string;
  status: string;
  attempts: number;
  last_error: string | null;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  transaction_hash: string | null;
  created_at: string;
  // enriched
  title: string;
  subtitle: string | null;
  dateLabel: string | null;
  internalStatus: string;
  blockchainStatus: string;
  blockchainTxHash: string | null;
  issuerId: string | null;
}

async function isUserIssuerAdminOrPlatformAdmin(
  supabase: any,
  userId: string,
): Promise<{ isAdmin: boolean; orgIds: string[] }> {
  const { data: isAdmin } = await supabase.rpc("is_platform_admin", { _user_id: userId });
  const { data: roles } = await supabase
    .from("user_roles")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("role", "issuer_admin");
  const orgIds = ((roles ?? []) as { organization_id: string | null }[])
    .map((r) => r.organization_id)
    .filter((x): x is string => !!x);
  return { isAdmin: !!isAdmin, orgIds };
}

export const listAnchorJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { isAdmin, orgIds } = await isUserIssuerAdminOrPlatformAdmin(supabase as never, userId);

    const { data: jobs, error } = await (supabase as any)
      .from("chain_anchor_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const rows: QueueRow[] = [];
    const credIds = new Set<string>();
    const tplIds = new Set<string>();
    for (const j of (jobs ?? []) as Record<string, any>[]) {
      const entity = (j.entity_type ?? "credential") as "template" | "credential";
      if (entity === "credential") credIds.add(j.entity_id ?? j.credential_id);
      else tplIds.add(j.entity_id);
    }

    const credMap = new Map<string, any>();
    const tplMap = new Map<string, any>();
    if (credIds.size) {
      const { data: creds } = await (supabase as any)
        .from("credentials")
        .select("id, title, earner_name, issued_at, credential_lifecycle, status, chain_status, chain_tx_hash, issuer_id")
        .in("id", Array.from(credIds));
      for (const c of (creds ?? []) as any[]) credMap.set(c.id, c);
    }
    if (tplIds.size) {
      const { data: tpls } = await (supabase as any)
        .from("templates")
        .select("id, title, version, published_at, status, blockchain_status, issuer_id")
        .in("id", Array.from(tplIds));
      for (const t of (tpls ?? []) as any[]) tplMap.set(t.id, t);
    }

    for (const j of (jobs ?? []) as Record<string, any>[]) {
      const entity = (j.entity_type ?? "credential") as "template" | "credential";
      const entityId = j.entity_id ?? j.credential_id;
      let title = "";
      let subtitle: string | null = null;
      let dateLabel: string | null = null;
      let internalStatus = "";
      let blockchainStatus = "";
      let txHash: string | null = null;
      let issuerId: string | null = null;
      if (entity === "credential") {
        const c = credMap.get(entityId);
        if (!c) continue;
        title = c.title;
        subtitle = c.earner_name;
        dateLabel = c.issued_at;
        internalStatus = c.credential_lifecycle ?? c.status ?? "issued";
        blockchainStatus = c.chain_status ?? "not_requested";
        txHash = c.chain_tx_hash ?? null;
        issuerId = c.issuer_id ?? null;
      } else {
        const t = tplMap.get(entityId);
        if (!t) continue;
        title = t.title;
        subtitle = t.version ? `v${t.version}` : null;
        dateLabel = t.published_at;
        internalStatus = t.status === "active" ? "published" : (t.status ?? "draft");
        blockchainStatus = t.blockchain_status ?? "not_requested";
        issuerId = t.issuer_id ?? null;
      }

      if (!isAdmin && (!issuerId || !orgIds.includes(issuerId))) continue;

      rows.push({
        id: j.id,
        entity_type: entity,
        entity_id: entityId,
        operation: j.operation ?? "anchor_credential",
        status: j.status,
        attempts: j.attempts ?? 0,
        last_error: j.last_error ?? null,
        last_attempt_at: j.last_attempt_at ?? null,
        next_attempt_at: j.next_attempt_at ?? null,
        transaction_hash: j.transaction_hash ?? txHash,
        created_at: j.created_at,
        title,
        subtitle,
        dateLabel,
        internalStatus,
        blockchainStatus,
        blockchainTxHash: txHash,
        issuerId,
      });
    }

    return { rows, maxAttempts: MAX_ATTEMPTS };
  });

async function assertJobAccess(supabase: any, userId: string, job: any): Promise<void> {
  const entity = (job.entity_type ?? "credential") as "template" | "credential";
  const entityId = job.entity_id ?? job.credential_id;
  let issuerId: string | null = null;
  if (entity === "credential") {
    const { data } = await supabase
      .from("credentials")
      .select("issuer_id")
      .eq("id", entityId)
      .maybeSingle();
    issuerId = data?.issuer_id ?? null;
  } else {
    const { data } = await supabase
      .from("templates")
      .select("issuer_id")
      .eq("id", entityId)
      .maybeSingle();
    issuerId = data?.issuer_id ?? null;
  }
  if (!issuerId) throw new Error("Entity not found");
  const { data: isAdmin } = await supabase.rpc("is_platform_admin", { _user_id: userId });
  const { data: isOrgAdmin } = await supabase.rpc("has_role_in_org", {
    _user_id: userId,
    _role: "issuer_admin",
    _org_id: issuerId,
  });
  if (!isAdmin && !isOrgAdmin) throw new Error("Forbidden");
}

export const retryAnchorJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job } = await (supabase as any)
      .from("chain_anchor_jobs")
      .select("*")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job) throw new Error("Job not found");
    await assertJobAccess(supabase as never, userId, job);
    const j = job as Record<string, any>;
    if (j.status === "done") throw new Error("Job already completed");
    if (j.status === "cancelled") throw new Error("Job is cancelled");
    if ((j.attempts ?? 0) >= MAX_ATTEMPTS) throw new Error("Maximum retry attempts reached");

    const entity = (j.entity_type ?? "credential") as "template" | "credential";
    const entityId = j.entity_id ?? j.credential_id;

    // Re-queue (cron will pick it up) and also kick off immediately.
    await (supabase as any)
      .from("chain_anchor_jobs")
      .update({ status: "queued", last_error: null } as never)
      .eq("id", data.jobId);

    let res;
    if (entity === "credential") {
      const { processCredentialAnchor } = await import("./worker.server");
      res = await processCredentialAnchor(entityId);
    } else {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rec } = await supabaseAdmin
        .from("template_blockchain_records")
        .select("template_version")
        .eq("template_id", entityId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const version = (rec as any)?.template_version ?? "1.0";
      const { processTemplateAnchor } = await import("./worker.server");
      res = await processTemplateAnchor(entityId, version);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("chain_anchor_jobs")
      .update({
        status: res.ok ? "done" : "failed",
        attempts: (j.attempts ?? 0) + 1,
        last_error: res.ok ? null : (res.error ?? "unknown error"),
        last_attempt_at: new Date().toISOString(),
      } as never)
      .eq("id", data.jobId);

    return { ok: res.ok, error: res.error };
  });
