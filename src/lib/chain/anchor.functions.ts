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
  // Load any existing learner secret from the locked-down secrets table.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!cred.learner_secret) {
    const { data: secRow } = await supabaseAdmin
      .from("credential_secrets")
      .select("secret")
      .eq("credential_id", cred.id)
      .maybeSingle();
    cred.learner_secret = ((secRow as { secret: string } | null)?.secret) ?? null;
  }

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
      template_ref: tref,
    })
    .eq("id", cred.id);

  // Persist the secret to the earner-only table (admin client; RLS bypassed).
  await supabaseAdmin
    .from("credential_secrets")
    .upsert({ credential_id: cred.id, secret } as never, {
      onConflict: "credential_id",
    } as never);

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
        "id, template_id, title, earner_id, earner_name, issuer_id, issuer_name, issued_at, expires_at, status, source, subcategory, level, ects, skills, grade, credential_hash, learner_commitment, template_ref, vc_json, chain_status",
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
      .from("credential_anchor_jobs")
      .insert({ credential_id: data.credentialId, operation: "anchor_credential", status: "queued" } as never);
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
      "id, template_id, title, earner_id, earner_name, issuer_id, issuer_name, issued_at, expires_at, status, source, subcategory, level, ects, skills, grade, credential_hash, learner_commitment, template_ref, vc_json, chain_status",
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

    // Writes below go through the admin client because template_versions,
    // template_blockchain_records, and chain_anchor_jobs are RLS-locked
    // (read-only for authenticated). Authorization was enforced above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Insert immutable version snapshot (idempotent on conflict)
    const { error: vErr } = await supabaseAdmin
      .from("template_versions")
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
    await supabaseAdmin
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

    const { isChainConfigured: chainCfg } = await import("./bloxberg.server");
    const contractAddress =
      process.env.TEMPLATE_REGISTRY_ADDRESS || process.env.BLOXBERG_CONTRACT_ADDRESS || "";

    const { error: bErr } = await supabaseAdmin
      .from("template_blockchain_records")
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
      const { error: qErr } = await supabaseAdmin
        .from("template_anchor_jobs")
        .insert({
          template_id: t.id,
          template_version: version,
          operation: "anchor_template",
          status: "queued",
        } as never);
      if (qErr && !/duplicate/i.test(qErr.message)) throw new Error(qErr.message);
      await supabaseAdmin
        .from("template_blockchain_records")
        .update({ blockchain_status: "queued" } as never)
        .eq("template_id", t.id)
        .eq("template_version", version);
      await supabaseAdmin
        .from("templates")
        .update({ blockchain_status: "queued" } as never)
        .eq("id", t.id);
      return { ok: true, version, mode: "queued" as const };
    }

    // Anchor now
    const { processTemplateAnchor } = await import("./worker.server");
    const res = await processTemplateAnchor(t.id, version);
    // Always record a job row so it appears in the queue history
    await supabaseAdmin
      .from("template_anchor_jobs")
      .insert({
        template_id: t.id,
        template_version: version,
        operation: "anchor_template",
        status: res.ok ? "done" : "failed",
        attempts: 1,
        last_error: res.ok ? null : (res.error ?? null),
        last_attempt_at: new Date().toISOString(),
        transaction_hash: res.txHash ?? null,
      } as never);
    return { ok: true, version, mode: "now" as const, result: res };
  });

/** Internal helper: ensure a template is confirmed on-chain before anchoring a credential. */
async function isTemplateAnchored(
  supabaseAdminClient: any,
  templateId: string | null | undefined,
): Promise<{ anchored: boolean; reason?: string }> {
  if (!templateId) return { anchored: false, reason: "Credential has no template" };
  const { data: tpl } = await supabaseAdminClient
    .from("templates")
    .select("blockchain_status")
    .eq("id", templateId)
    .maybeSingle();
  const status = (tpl as any)?.blockchain_status as string | undefined;
  if (status === "confirmed") return { anchored: true };
  return {
    anchored: false,
    reason: "Cannot anchor credential: the microcredential template is not yet anchored on the blockchain.",
  };
}

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
            credential_lifecycle: "pending_earner_acceptance",
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
            chain_status: "not_requested",
          } as never);
        if (insErr) throw new Error(insErr.message);

        // Persist learner secret to the earner-only table.
        await supabaseAdmin
          .from("credential_secrets")
          .upsert({ credential_id: credentialId, secret } as never, {
            onConflict: "credential_id",
          } as never);

        // Blockchain record stub — anchoring deferred until earner accepts.
        const contractAddress =
          process.env.CREDENTIAL_REGISTRY_ADDRESS || process.env.BLOXBERG_CONTRACT_ADDRESS || "";
        await supabaseAdmin
          .from("credential_blockchain_records")
          .insert({
            credential_id: credentialId,
            network: "bloxberg",
            chain_id: Number(process.env.BLOXBERG_CHAIN_ID || "8995"),
            contract_address: contractAddress,
            document_hash: docHash,
            blockchain_status: "not_requested",
          } as never);


        // Intentionally do NOT enqueue an anchor job: it will be enqueued
        // when the earner accepts the credential. effectiveMode (now/later)
        // is only honoured after acceptance.
        void effectiveMode;
        results.push({
          recipientId: r.earnerId,
          credentialId,
          credentialStatus: "pending_earner_acceptance",
          blockchainStatus: "not_requested",
        });
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

/** Anchor a single credential now (manual). Blocks if template not anchored. */
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tplCheck = await isTemplateAnchored(supabaseAdmin, cred.template_id);
    if (!tplCheck.anchored) {
      throw new Error(tplCheck.reason ?? "Template not yet anchored");
    }
    const { processCredentialAnchor } = await import("./worker.server");
    return processCredentialAnchor(data.credentialId);
  });

/** Cancel a queued anchor job. */
export const cancelAnchorJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string; entityKind: "template" | "credential" }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = data.entityKind === "template" ? "template_anchor_jobs" : "credential_anchor_jobs";
    const { data: job } = await (supabaseAdmin as any)
      .from(table)
      .select("*")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job) throw new Error("Job not found");
    const j = job as Record<string, any>;
    const entityId = data.entityKind === "template" ? j.template_id : j.credential_id;
    await assertJobAccess(supabase as never, userId, { entity_type: data.entityKind, entity_id: entityId });
    if (j.status === "done" || j.status === "running") {
      throw new Error("Job is no longer cancellable");
    }
    await (supabaseAdmin as any)
      .from(table)
      .update({ status: "cancelled" } as never)
      .eq("id", data.jobId);
    if (data.entityKind === "credential") {
      await supabase
        .from("credentials")
        .update({ chain_status: "cancelled" } as never)
        .eq("id", entityId);
      await supabaseAdmin
        .from("credential_blockchain_records")
        .update({ blockchain_status: "cancelled" } as never)
        .eq("credential_id", entityId);
    } else {
      await supabaseAdmin
        .from("templates")
        .update({ blockchain_status: "cancelled" } as never)
        .eq("id", entityId);
      await supabaseAdmin
        .from("template_blockchain_records")
        .update({ blockchain_status: "cancelled" } as never)
        .eq("template_id", entityId);
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (alreadyConfirmed) {
      await supabaseAdmin
        .from("credential_anchor_jobs")
        .insert({
          credential_id: data.credentialId,
          operation: "revoke_credential",
          status: "queued",
        } as never);
      return { ok: true, mode: "on_chain_revoke_queued" };
    }

    // Cancel any pending issuance anchor jobs
    await supabaseAdmin
      .from("credential_anchor_jobs")
      .update({ status: "cancelled" } as never)
      .eq("credential_id", data.credentialId)
      .eq("operation", "anchor_credential")
      .in("status", ["queued", "failed"]);
    await supabase
      .from("credentials")
      .update({ chain_status: "cancelled" } as never)
      .eq("id", data.credentialId);
    await supabaseAdmin
      .from("credential_blockchain_records")
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
      .select("earner_id")
      .eq("id", data.credentialId)
      .maybeSingle();
    if (!cred || (cred as { earner_id: string }).earner_id !== userId) {
      throw new Error("Forbidden");
    }
    // RLS on credential_secrets also restricts to the earner.
    const { data: row } = await supabase
      .from("credential_secrets")
      .select("secret")
      .eq("credential_id", data.credentialId)
      .maybeSingle();
    return { secret: ((row as { secret: string } | null)?.secret) ?? null };
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [tplRes, credRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("template_anchor_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      (supabaseAdmin as any)
        .from("credential_anchor_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (tplRes.error) throw new Error(tplRes.error.message);
    if (credRes.error) throw new Error(credRes.error.message);

    const tplJobs = (tplRes.data ?? []) as Record<string, any>[];
    const credJobs = (credRes.data ?? []) as Record<string, any>[];

    const tplIds = Array.from(new Set(tplJobs.map((j) => j.template_id).filter(Boolean)));
    const credIds = Array.from(new Set(credJobs.map((j) => j.credential_id).filter(Boolean)));

    const tplMap = new Map<string, any>();
    const credMap = new Map<string, any>();
    if (tplIds.length) {
      const { data: tpls } = await (supabaseAdmin as any)
        .from("templates")
        .select("id, title, version, published_at, status, blockchain_status, issuer_id")
        .in("id", tplIds);
      for (const t of (tpls ?? []) as any[]) tplMap.set(t.id, t);
    }
    if (credIds.length) {
      const { data: creds } = await (supabaseAdmin as any)
        .from("credentials")
        .select("id, title, earner_name, issued_at, credential_lifecycle, status, chain_status, chain_tx_hash, issuer_id, template_id")
        .in("id", credIds);
      for (const c of (creds ?? []) as any[]) credMap.set(c.id, c);
    }

    const rows: QueueRow[] = [];

    for (const j of tplJobs) {
      const t = tplMap.get(j.template_id);
      if (!t) continue;
      const issuerId: string | null = t.issuer_id ?? null;
      if (!isAdmin && (!issuerId || !orgIds.includes(issuerId))) continue;
      rows.push({
        id: j.id,
        entity_type: "template",
        entity_id: j.template_id,
        operation: j.operation ?? "anchor_template",
        status: j.status,
        attempts: j.attempts ?? 0,
        last_error: j.last_error ?? null,
        last_attempt_at: j.last_attempt_at ?? null,
        next_attempt_at: j.next_attempt_at ?? null,
        transaction_hash: j.transaction_hash ?? null,
        created_at: j.created_at,
        title: t.title,
        subtitle: j.template_version ? `v${j.template_version}` : (t.version ? `v${t.version}` : null),
        dateLabel: t.published_at,
        internalStatus: t.status === "active" ? "published" : (t.status ?? "draft"),
        blockchainStatus: t.blockchain_status ?? "not_requested",
        blockchainTxHash: null,
        issuerId,
      });
    }

    for (const j of credJobs) {
      const c = credMap.get(j.credential_id);
      if (!c) continue;
      const issuerId: string | null = c.issuer_id ?? null;
      if (!isAdmin && (!issuerId || !orgIds.includes(issuerId))) continue;
      // Compute "template blocked" hint for the UI
      let lastError = j.last_error ?? null;
      if (!lastError && c.template_id) {
        const tplRow = tplMap.get(c.template_id);
        if (tplRow && tplRow.blockchain_status !== "confirmed" && (j.status === "queued" || j.status === "failed")) {
          lastError = "Waiting for template to be anchored on blockchain.";
        }
      }
      rows.push({
        id: j.id,
        entity_type: "credential",
        entity_id: j.credential_id,
        operation: j.operation ?? "anchor_credential",
        status: j.status,
        attempts: j.attempts ?? 0,
        last_error: lastError,
        last_attempt_at: j.last_attempt_at ?? null,
        next_attempt_at: j.next_attempt_at ?? null,
        transaction_hash: j.transaction_hash ?? c.chain_tx_hash ?? null,
        created_at: j.created_at,
        title: c.title,
        subtitle: c.earner_name,
        dateLabel: c.issued_at,
        internalStatus: c.credential_lifecycle ?? c.status ?? "issued",
        blockchainStatus: c.chain_status ?? "not_requested",
        blockchainTxHash: c.chain_tx_hash ?? null,
        issuerId,
      });
    }

    rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
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
  .inputValidator((d: { jobId: string; entityKind: "template" | "credential" }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = data.entityKind === "template" ? "template_anchor_jobs" : "credential_anchor_jobs";
    const { data: job } = await (supabaseAdmin as any)
      .from(table)
      .select("*")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job) throw new Error("Job not found");
    const j = job as Record<string, any>;
    const entityId = data.entityKind === "template" ? j.template_id : j.credential_id;
    await assertJobAccess(supabase as never, userId, { entity_type: data.entityKind, entity_id: entityId });
    if (j.status === "done") throw new Error("Job already completed");
    if (j.status === "cancelled") throw new Error("Job is cancelled");
    if ((j.attempts ?? 0) >= MAX_ATTEMPTS) throw new Error("Maximum retry attempts reached");

    // For credential jobs, refuse to run if the template is not anchored.
    if (data.entityKind === "credential") {
      const { data: cred } = await supabaseAdmin
        .from("credentials")
        .select("template_id")
        .eq("id", entityId)
        .maybeSingle();
      const tplCheck = await isTemplateAnchored(supabaseAdmin, (cred as any)?.template_id);
      if (!tplCheck.anchored) {
        const nowIso = new Date().toISOString();
        await (supabaseAdmin as any)
          .from(table)
          .update({
            status: "failed",
            attempts: (j.attempts ?? 0) + 1,
            last_error: tplCheck.reason,
            last_attempt_at: nowIso,
            next_attempt_at: new Date(Date.now() + 2 * 60_000).toISOString(),
          } as never)
          .eq("id", data.jobId);
        throw new Error(tplCheck.reason ?? "Template not yet anchored");
      }
    }

    // Re-queue and kick off immediately.
    await (supabaseAdmin as any)
      .from(table)
      .update({ status: "queued", last_error: null } as never)
      .eq("id", data.jobId);

    let res: { ok: boolean; error?: string; txHash?: string };
    if (data.entityKind === "credential") {
      const { processCredentialAnchor } = await import("./worker.server");
      res = await processCredentialAnchor(entityId);
    } else {
      const version = j.template_version ?? "1.0";
      const { processTemplateAnchor } = await import("./worker.server");
      res = await processTemplateAnchor(entityId, version);
    }

    await (supabaseAdmin as any)
      .from(table)
      .update({
        status: res.ok ? "done" : "failed",
        attempts: (j.attempts ?? 0) + 1,
        last_error: res.ok ? null : (res.error ?? "unknown error"),
        last_attempt_at: new Date().toISOString(),
        transaction_hash: res.txHash ?? j.transaction_hash ?? null,
      } as never)
      .eq("id", data.jobId);

    return { ok: res.ok, error: res.error };
  });

// ============================================================================
// Earner acceptance flow
// ============================================================================

async function enqueueAcceptedAnchor(credentialId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { isChainConfigured } = await import("./bloxberg.server");

  // Create the anchor job (idempotent).
  const { error: jobErr } = await supabaseAdmin
    .from("credential_anchor_jobs")
    .insert({
      credential_id: credentialId,
      operation: "anchor_credential",
      status: "queued",
    } as never);
  if (jobErr && !/duplicate/i.test(jobErr.message)) throw new Error(jobErr.message);

  await supabaseAdmin
    .from("credentials")
    .update({ chain_status: "queued" } as never)
    .eq("id", credentialId);
  await supabaseAdmin
    .from("credential_blockchain_records")
    .update({ blockchain_status: "queued" } as never)
    .eq("credential_id", credentialId);

  if (!isChainConfigured()) return;

  // Look up the credential's template and check whether it is anchored.
  const { data: cred } = await supabaseAdmin
    .from("credentials")
    .select("template_id")
    .eq("id", credentialId)
    .maybeSingle();
  const tplCheck = await isTemplateAnchored(supabaseAdmin, (cred as any)?.template_id);
  if (!tplCheck.anchored) return; // Worker will retry later

  const { processCredentialAnchor } = await import("./worker.server");
  const res = await processCredentialAnchor(credentialId);
  await supabaseAdmin
    .from("credential_anchor_jobs")
    .update({
      status: res.ok ? "done" : "failed",
      attempts: 1,
      last_error: res.ok ? null : (res.error ?? null),
      last_attempt_at: new Date().toISOString(),
      transaction_hash: res.txHash ?? null,
    } as never)
    .eq("credential_id", credentialId)
    .eq("operation", "anchor_credential")
    .in("status", ["queued", "running", "failed"]);
}

/** Earner accepts a credential pending their acceptance. */
export const acceptCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { credentialId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cred } = await supabase
      .from("credentials")
      .select("id, earner_id, issuer_id, title, credential_lifecycle")
      .eq("id", data.credentialId)
      .maybeSingle();
    if (!cred) throw new Error("Credential not found");
    if ((cred as any).earner_id !== userId) throw new Error("Forbidden");
    if ((cred as any).credential_lifecycle !== "pending_earner_acceptance") {
      throw new Error("Credential is not awaiting acceptance");
    }

    const { error: updErr } = await supabase
      .from("credentials")
      .update({
        credential_lifecycle: "issued",
        accepted_at: new Date().toISOString(),
        rejection_reason: null,
        rejected_at: null,
      } as never)
      .eq("id", data.credentialId);
    if (updErr) throw new Error(updErr.message);

    // Notify the issuer org.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notifications").insert({
      for_role: "issuer_admin",
      for_org_id: (cred as any).issuer_id,
      title: "Earner accepted credential",
      body: `${(cred as any).title} was accepted by the earner.`,
      link: "/issuer/credentials",
    } as never);

    // Now best-effort anchor on Bloxberg. If this fails, the credential is
    // still accepted/active for the earner — the cron worker will retry.
    let chainPending = false;
    try {
      await enqueueAcceptedAnchor(data.credentialId);
      // After enqueue, if the row didn't reach 'confirmed' yet, mark pending.
      const { data: row } = await supabaseAdmin
        .from("credentials")
        .select("chain_status")
        .eq("id", data.credentialId)
        .maybeSingle();
      const cs = (row as any)?.chain_status as string | null | undefined;
      chainPending = cs !== "confirmed" && cs !== "disabled";
    } catch (e) {
      chainPending = true;
      const msg = (e as Error)?.message ?? "Chain anchor failed";
      console.error("[acceptCredential] chain anchor failed:", msg);
      // Make sure a job exists so cron retries, and surface the error.
      const { error: insErr } = await supabaseAdmin
        .from("credential_anchor_jobs")
        .insert({
          credential_id: data.credentialId,
          operation: "anchor_credential",
          status: "queued",
          last_error: msg,
          last_attempt_at: new Date().toISOString(),
        } as never);
      if (insErr && /duplicate/i.test(insErr.message)) {
        await supabaseAdmin
          .from("credential_anchor_jobs")
          .update({
            status: "queued",
            last_error: msg,
            last_attempt_at: new Date().toISOString(),
          } as never)
          .eq("credential_id", data.credentialId)
          .eq("operation", "anchor_credential");
      }
      await supabaseAdmin
        .from("credentials")
        .update({ chain_status: "queued", chain_error: msg } as never)
        .eq("id", data.credentialId);
    }

    return { ok: true, chainPending };
  });

/** Earner rejects a credential with a reason. */
export const rejectCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { credentialId: string; reason: string }) => d)
  .handler(async ({ data, context }) => {
    const reason = (data.reason ?? "").trim();
    if (!reason) throw new Error("Reason is required");
    const { supabase, userId } = context;
    const { data: cred } = await supabase
      .from("credentials")
      .select("id, earner_id, issuer_id, title, credential_lifecycle")
      .eq("id", data.credentialId)
      .maybeSingle();
    if (!cred) throw new Error("Credential not found");
    if ((cred as any).earner_id !== userId) throw new Error("Forbidden");
    if ((cred as any).credential_lifecycle !== "pending_earner_acceptance") {
      throw new Error("Credential is not awaiting acceptance");
    }

    const { error: updErr } = await supabase
      .from("credentials")
      .update({
        credential_lifecycle: "rejected",
        rejection_reason: reason,
        rejected_at: new Date().toISOString(),
      } as never)
      .eq("id", data.credentialId);
    if (updErr) throw new Error(updErr.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notifications").insert([
      {
        for_role: "issuer_admin",
        for_org_id: (cred as any).issuer_id,
        title: "Earner rejected credential",
        body: `${(cred as any).title} was rejected. Reason: ${reason}`,
        link: "/issuer/credentials",
      },
      {
        for_role: "issuer_staff",
        for_org_id: (cred as any).issuer_id,
        title: "Earner rejected credential",
        body: `${(cred as any).title} was rejected. Reason: ${reason}`,
        link: "/issuer/credentials",
      },
    ] as never);

    return { ok: true };
  });

/** Issuer resends a rejected credential with optional updates to grade/expiry. */
export const resendCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { credentialId: string; grade?: string | null; expiryDate?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cred } = await supabase
      .from("credentials")
      .select("*")
      .eq("id", data.credentialId)
      .maybeSingle();
    if (!cred) throw new Error("Credential not found");
    const c = cred as Record<string, any>;
    if (c.credential_lifecycle !== "rejected") {
      throw new Error("Only rejected credentials can be resent");
    }
    const { data: isAdmin } = await supabase.rpc("is_platform_admin", { _user_id: userId });
    const { data: isOrgAdmin } = await supabase.rpc("has_role_in_org", {
      _user_id: userId,
      _role: "issuer_admin",
      _org_id: c.issuer_id,
    });
    const { data: isAssignee } = await supabase.rpc("is_template_assignee", {
      _user_id: userId,
      _template_id: c.template_id,
    });
    if (!isAdmin && !isOrgAdmin && !isAssignee) throw new Error("Forbidden");

    const newGrade = data.grade === undefined ? c.grade : (data.grade ?? null);
    const newExpiry = data.expiryDate === undefined ? c.expires_at : (data.expiryDate ?? null);

    // Recompute VC + hash + learner commitment with fresh secret.
    const vc = (await import("./vc")).buildVcJson({
      credentialId: c.id,
      vcId: c.vc_id ?? `urn:microcred:${c.id}`,
      title: c.title,
      templateId: c.template_id,
      templateVersion: c.template_version ?? null,
      templateRef: c.template_ref ?? null,
      earnerId: c.earner_id,
      earnerName: c.earner_name,
      issuerId: c.issuer_id,
      issuerName: c.issuer_name,
      issuedAt: c.issued_at,
      expiresAt: newExpiry,
      source: c.source,
      subcategory: c.subcategory ?? null,
      level: c.level,
      ects: c.ects ?? null,
      skills: c.skills ?? [],
      grade: newGrade,
      qaType: null,
      supervisionType: null,
      stackabilityType: null,
      prerequisites: null,
      prerequisitesNone: null,
    });
    const docHash = await sha256Hex(canonicalJson(vc));
    const secret = randomSecretHex(32);
    const learnerCommitment = learnerCommitmentKeccak(c.earner_id, c.id, secret);

    const { error: updErr } = await supabase
      .from("credentials")
      .update({
        grade: newGrade,
        expires_at: newExpiry,
        vc_json: vc,
        canonical_payload: vc,
        credential_hash: docHash,
        learner_commitment: learnerCommitment,
        learner_secret: secret,
        credential_lifecycle: "pending_earner_acceptance",
        rejection_reason: null,
        rejected_at: null,
        accepted_at: null,
      } as never)
      .eq("id", data.credentialId);
    if (updErr) throw new Error(updErr.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("credential_blockchain_records")
      .update({ document_hash: docHash, blockchain_status: "not_requested" } as never)
      .eq("credential_id", data.credentialId);
    await supabaseAdmin.from("notifications").insert({
      for_user_id: c.earner_id,
      title: "Credential resent for your acceptance",
      body: `${c.title} was updated and resent. Please review and accept or reject it.`,
      link: `/earner/credentials/${c.id}`,
    } as never);

    return { ok: true };
  });

/** Issuer accepts the rejection — deletes the credential entirely. */
export const discardRejectedCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { credentialId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cred } = await supabase
      .from("credentials")
      .select("id, issuer_id, template_id, credential_lifecycle, chain_status")
      .eq("id", data.credentialId)
      .maybeSingle();
    if (!cred) throw new Error("Credential not found");
    const c = cred as Record<string, any>;
    if (c.credential_lifecycle !== "rejected") {
      throw new Error("Only rejected credentials can be discarded");
    }
    if (c.chain_status === "confirmed") {
      throw new Error("Credential is anchored on-chain and cannot be deleted");
    }
    const { data: isAdmin } = await supabase.rpc("is_platform_admin", { _user_id: userId });
    const { data: isOrgAdmin } = await supabase.rpc("has_role_in_org", {
      _user_id: userId,
      _role: "issuer_admin",
      _org_id: c.issuer_id,
    });
    const { data: isAssignee } = await supabase.rpc("is_template_assignee", {
      _user_id: userId,
      _template_id: c.template_id,
    });
    if (!isAdmin && !isOrgAdmin && !isAssignee) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: full } = await supabaseAdmin
      .from("credentials")
      .select("earner_id, title")
      .eq("id", data.credentialId)
      .maybeSingle();
    await supabaseAdmin.from("credential_anchor_jobs").delete().eq("credential_id", data.credentialId);
    await supabaseAdmin.from("credential_blockchain_records").delete().eq("credential_id", data.credentialId);
    await supabaseAdmin.from("credentials").delete().eq("id", data.credentialId);
    if (full && (full as any).earner_id) {
      await supabaseAdmin.from("notifications").insert({
        for_user_id: (full as any).earner_id,
        title: "Rejection accepted by issuer",
        body: `Your rejection of "${(full as any).title}" was accepted. The credential has been discarded.`,
        link: "/earner/credentials",
      } as never);
    }

    return { ok: true };
  });

/**
 * Repair a single credential's chain fields and re-queue its anchor job.
 * Use when a credential was created via a legacy path and is missing
 * vc_json / credential_hash / learner_commitment / template_ref.
 */
export const repairCredentialChainFields = createServerFn({ method: "POST" })
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
      _org_id: (cred as any).issuer_id,
    });
    const { data: isAssignee } = await supabase.rpc("is_template_assignee", {
      _user_id: userId,
      _template_id: (cred as any).template_id,
    });
    if (!isAdmin && !isOrgAdmin && !isAssignee) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureCredentialChainFields } = await import("./worker.server");

    const { data: full, error: fetchErr } = await supabaseAdmin
      .from("credentials")
      .select("*")
      .eq("id", data.credentialId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!full) throw new Error("Credential not found");

    const repaired = await ensureCredentialChainFields(
      supabaseAdmin,
      full as Record<string, any>,
    );

    // Reset chain status + clear last error so worker will pick it up again.
    await supabaseAdmin
      .from("credentials")
      .update({ chain_status: "queued", chain_error: null } as never)
      .eq("id", data.credentialId);

    // Reset / insert the anchor job.
    const nowIso = new Date().toISOString();
    const { data: existingJob } = await (supabaseAdmin as any)
      .from("credential_anchor_jobs")
      .select("id")
      .eq("credential_id", data.credentialId)
      .eq("operation", "anchor_credential")
      .maybeSingle();
    if (existingJob) {
      await (supabaseAdmin as any)
        .from("credential_anchor_jobs")
        .update({
          status: "queued",
          attempts: 0,
          last_error: null,
          next_attempt_at: nowIso,
        } as never)
        .eq("id", (existingJob as any).id);
    } else {
      await (supabaseAdmin as any)
        .from("credential_anchor_jobs")
        .insert({
          credential_id: data.credentialId,
          operation: "anchor_credential",
          status: "queued",
        } as never);
    }

    // If the template is anchored, try the submit inline so the user sees a result.
    const tplCheck = await isTemplateAnchored(supabaseAdmin, (cred as any).template_id);
    if (tplCheck.anchored) {
      const { processCredentialAnchor } = await import("./worker.server");
      const res = await processCredentialAnchor(data.credentialId);
      return {
        ok: res.ok,
        repaired: {
          credential_hash: repaired.credential_hash,
          learner_commitment: repaired.learner_commitment,
          template_ref: repaired.template_ref,
        },
        anchorResult: res,
      };
    }

    return {
      ok: true,
      repaired: {
        credential_hash: repaired.credential_hash,
        learner_commitment: repaired.learner_commitment,
        template_ref: repaired.template_ref,
      },
      anchorResult: { ok: false, skipped: true, error: tplCheck.reason ?? "Template not anchored yet" },
    };
  });

/**
 * Platform-admin only: backfill chain fields for every credential row
 * that is missing any of credential_hash / learner_commitment / template_ref / vc_json.
 */
export const backfillAllPendingCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_platform_admin", { _user_id: userId });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureCredentialChainFields } = await import("./worker.server");

    const { data: rows, error } = await supabaseAdmin
      .from("credentials")
      .select("*")
      .or(
        "credential_hash.is.null,learner_commitment.is.null,template_ref.is.null,vc_json.is.null",
      );
    if (error) throw new Error(error.message);

    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const row of (rows ?? []) as Record<string, any>[]) {
      try {
        await ensureCredentialChainFields(supabaseAdmin, row);
        results.push({ id: row.id, ok: true });
      } catch (e) {
        results.push({ id: row.id, ok: false, error: (e as Error).message });
      }
    }
    return { processed: results.length, results };
  });

/**
 * Drain the chain anchor queues. Restricted to issuer admins, issuer staff,
 * and platform admins — triggered manually from the Blockchain Queue page.
 */
export const processAnchorQueueFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: isAdmin }, { data: roles }] = await Promise.all([
      supabase.rpc("is_platform_admin", { _user_id: userId }),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const roleSet = new Set(((roles as { role: string }[] | null) ?? []).map((r) => r.role));
    if (!isAdmin && !roleSet.has("issuer_admin") && !roleSet.has("issuer_staff")) {
      throw new Error("Forbidden");
    }

    const MAX_PER_RUN = 10;
    const MAX_ATTEMPTS = 5;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();

    const [tplRes, credRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("template_anchor_jobs")
        .select("*")
        .in("status", ["queued", "failed"])
        .lt("attempts", MAX_ATTEMPTS)
        .order("created_at", { ascending: true })
        .limit(MAX_PER_RUN),
      (supabaseAdmin as any)
        .from("credential_anchor_jobs")
        .select("*")
        .in("status", ["queued", "failed"])
        .lt("attempts", MAX_ATTEMPTS)
        .order("created_at", { ascending: true })
        .limit(MAX_PER_RUN),
    ]);
    if (tplRes.error) throw new Error(tplRes.error.message);
    if (credRes.error) throw new Error(credRes.error.message);

    const { processCredentialAnchor, processTemplateAnchor } = await import(
      "@/lib/chain/worker.server"
    );

    const results: { jobId: string; entity: string; ok: boolean; error?: string }[] = [];

    for (const job of (tplRes.data ?? []) as Record<string, any>[]) {
      if (job.next_attempt_at && new Date(job.next_attempt_at) > new Date()) continue;
      await (supabaseAdmin as any)
        .from("template_anchor_jobs")
        .update({ status: "running", attempts: (job.attempts ?? 0) + 1, last_attempt_at: nowIso } as never)
        .eq("id", job.id);

      let res: { ok: boolean; error?: string; txHash?: string };
      try {
        res = await processTemplateAnchor(job.template_id, job.template_version ?? "1.0");
      } catch (e) {
        res = { ok: false, error: (e as Error).message };
      }

      const attempts = (job.attempts ?? 0) + 1;
      const backoffMs = Math.min(60_000 * 2 ** attempts, 60 * 60_000);
      await (supabaseAdmin as any)
        .from("template_anchor_jobs")
        .update({
          status: res.ok ? "done" : "failed",
          last_error: res.ok ? null : (res.error ?? "unknown error"),
          transaction_hash: res.txHash ?? job.transaction_hash ?? null,
          next_attempt_at: res.ok ? null : new Date(Date.now() + backoffMs).toISOString(),
        } as never)
        .eq("id", job.id);

      results.push({ jobId: job.id, entity: "template", ok: res.ok, error: res.error });
    }

    for (const job of (credRes.data ?? []) as Record<string, any>[]) {
      if (job.next_attempt_at && new Date(job.next_attempt_at) > new Date()) continue;

      const { data: cred } = await supabaseAdmin
        .from("credentials")
        .select("template_id")
        .eq("id", job.credential_id)
        .maybeSingle();
      const templateId = (cred as any)?.template_id as string | null | undefined;
      let templateBlocked = false;
      let blockReason = "Waiting for template to be anchored on blockchain.";
      if (!templateId) {
        templateBlocked = true;
        blockReason = "Credential has no template";
      } else {
        const { data: tpl } = await supabaseAdmin
          .from("templates")
          .select("blockchain_status")
          .eq("id", templateId)
          .maybeSingle();
        if ((tpl as any)?.blockchain_status !== "confirmed") {
          templateBlocked = true;
        }
      }

      if (templateBlocked) {
        const attempts = (job.attempts ?? 0) + 1;
        const backoffMs = 2 * 60_000;
        await (supabaseAdmin as any)
          .from("credential_anchor_jobs")
          .update({
            status: "failed",
            attempts,
            last_error: blockReason,
            last_attempt_at: nowIso,
            next_attempt_at: new Date(Date.now() + backoffMs).toISOString(),
          } as never)
          .eq("id", job.id);
        results.push({ jobId: job.id, entity: "credential", ok: false, error: blockReason });
        continue;
      }

      await (supabaseAdmin as any)
        .from("credential_anchor_jobs")
        .update({ status: "running", attempts: (job.attempts ?? 0) + 1, last_attempt_at: nowIso } as never)
        .eq("id", job.id);

      let res: { ok: boolean; error?: string; txHash?: string };
      try {
        res = await processCredentialAnchor(job.credential_id);
      } catch (e) {
        res = { ok: false, error: (e as Error).message };
      }

      const attempts = (job.attempts ?? 0) + 1;
      const backoffMs = Math.min(60_000 * 2 ** attempts, 60 * 60_000);
      await (supabaseAdmin as any)
        .from("credential_anchor_jobs")
        .update({
          status: res.ok ? "done" : "failed",
          last_error: res.ok ? null : (res.error ?? "unknown error"),
          transaction_hash: res.txHash ?? job.transaction_hash ?? null,
          next_attempt_at: res.ok ? null : new Date(Date.now() + backoffMs).toISOString(),
        } as never)
        .eq("id", job.id);

      results.push({ jobId: job.id, entity: "credential", ok: res.ok, error: res.error });
    }

    return { processed: results.length, results };
  });
