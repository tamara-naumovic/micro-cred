// Cron-invoked worker that drains both anchor job queues.
// Handles template_anchor_jobs and credential_anchor_jobs separately.
// Called by pg_cron with the project anon key in the `apikey` header.

import { createFileRoute } from "@tanstack/react-router";

const MAX_PER_RUN = 10;
const MAX_ATTEMPTS = 5;

export const Route = createFileRoute("/api/public/hooks/process-chain-anchors")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const apikey = request.headers.get("apikey") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!expected || !apikey || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const nowIso = new Date().toISOString();

        // Fetch eligible jobs from both queues.
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
        if (tplRes.error) {
          return new Response(JSON.stringify({ error: tplRes.error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        if (credRes.error) {
          return new Response(JSON.stringify({ error: credRes.error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const { processCredentialAnchor, processTemplateAnchor } = await import(
          "@/lib/chain/worker.server"
        );

        const results: { jobId: string; entity: string; ok: boolean; error?: string }[] = [];

        // Process template jobs first — credentials may unblock once their template is anchored.
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

        // Credential jobs — block if template isn't confirmed on-chain.
        for (const job of (credRes.data ?? []) as Record<string, any>[]) {
          if (job.next_attempt_at && new Date(job.next_attempt_at) > new Date()) continue;

          // Check template status
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
            // Short backoff so the credential picks up quickly after template confirms.
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

        return new Response(JSON.stringify({ processed: results.length, results }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
