// Cron-invoked worker that drains the chain_anchor_jobs queue.
// Called by pg_cron with the project anon key in the `apikey` header.

import { createFileRoute } from "@tanstack/react-router";
import { processAnchor } from "@/lib/chain/anchor.functions";

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
        const { data: jobs, error } = await supabaseAdmin
          .from("chain_anchor_jobs")
          .select("id, credential_id, attempts, status")
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

        const results: { credentialId: string; ok: boolean; error?: string }[] = [];
        for (const job of jobs ?? []) {
          const j = job as { id: string; credential_id: string; attempts: number };
          await supabaseAdmin
            .from("chain_anchor_jobs")
            .update({ status: "running", attempts: j.attempts + 1 } as never)
            .eq("id", j.id);

          const res = await processAnchor(j.credential_id);
          if (res.ok) {
            await supabaseAdmin
              .from("chain_anchor_jobs")
              .update({ status: "done", last_error: null } as never)
              .eq("id", j.id);
          } else {
            await supabaseAdmin
              .from("chain_anchor_jobs")
              .update({ status: "failed", last_error: res.error ?? "unknown error" } as never)
              .eq("id", j.id);
          }
          results.push({ credentialId: j.credential_id, ok: res.ok, error: res.error });
        }

        return new Response(JSON.stringify({ processed: results.length, results }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
