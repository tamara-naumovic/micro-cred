// Cron-invoked worker that drains the chain_anchor_jobs queue.
// Handles both template and credential anchor operations.
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
        const { data: jobs, error } = await supabaseAdmin
          .from("chain_anchor_jobs")
          .select("*")
          .in("status", ["queued", "failed"])
          .lt("attempts", MAX_ATTEMPTS)
          .order("created_at", { ascending: true })
          .limit(MAX_PER_RUN);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const { processCredentialAnchor, processTemplateAnchor } = await import(
          "@/lib/chain/worker.server"
        );

        const results: { jobId: string; entity: string; ok: boolean; error?: string }[] = [];
        for (const job of (jobs ?? []) as Record<string, any>[]) {
          // Honor next_attempt_at backoff if set
          if (job.next_attempt_at && new Date(job.next_attempt_at) > new Date()) continue;
          const entity = (job.entity_type ?? "credential") as "template" | "credential";
          const entityId = job.entity_id ?? job.credential_id;
          const operation = job.operation ?? "anchor_credential";

          await supabaseAdmin
            .from("chain_anchor_jobs")
            .update({ status: "running", attempts: (job.attempts ?? 0) + 1, last_attempt_at: nowIso } as never)
            .eq("id", job.id);

          let res: { ok: boolean; error?: string; txHash?: string };
          try {
            if (entity === "template") {
              const { data: rec } = await supabaseAdmin
                .from("template_blockchain_records")
                .select("template_version")
                .eq("template_id", entityId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              const version = (rec as any)?.template_version ?? "1.0";
              res = await processTemplateAnchor(entityId, version);
            } else {
              // Credential anchor or revoke — both call the credential worker which reads current lifecycle.
              void operation;
              res = await processCredentialAnchor(entityId);
            }
          } catch (e) {
            res = { ok: false, error: (e as Error).message };
          }

          const attempts = (job.attempts ?? 0) + 1;
          const backoffMs = Math.min(60_000 * 2 ** attempts, 60 * 60_000);
          await supabaseAdmin
            .from("chain_anchor_jobs")
            .update({
              status: res.ok ? "done" : "failed",
              last_error: res.ok ? null : (res.error ?? "unknown error"),
              transaction_hash: res.txHash ?? job.transaction_hash ?? null,
              next_attempt_at: res.ok ? null : new Date(Date.now() + backoffMs).toISOString(),
            } as never)
            .eq("id", job.id);

          results.push({ jobId: job.id, entity, ok: res.ok, error: res.error });
        }

        return new Response(JSON.stringify({ processed: results.length, results }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
