import { createFileRoute } from "@tanstack/react-router";

type Window = { label: string; days: number };
const WINDOWS: Window[] = [
  { label: "30 days", days: 30 },
  { label: "7 days", days: 7 },
  { label: "1 day", days: 1 },
];

export const Route = createFileRoute("/api/public/hooks/expiry-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Authorize: pg_cron must pass the project's publishable/anon key in the apikey header.
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let total = 0;

        for (const w of WINDOWS) {
          const start = new Date();
          start.setUTCHours(0, 0, 0, 0);
          start.setUTCDate(start.getUTCDate() + w.days);
          const end = new Date(start);
          end.setUTCDate(end.getUTCDate() + 1);

          const { data: creds } = await supabaseAdmin
            .from("credentials")
            .select("id, earner_id, title, expires_at")
            .eq("credential_lifecycle", "issued")
            .gte("expires_at", start.toISOString())
            .lt("expires_at", end.toISOString());

          for (const c of (creds ?? []) as Array<{
            id: string;
            earner_id: string;
            title: string;
            expires_at: string;
          }>) {
            if (!c.earner_id) continue;
            const link = `/earner/credentials/${c.id}`;
            const title = `Credential expires in ${w.label}`;

            // De-dupe: skip if the same reminder fired in the last 24h.
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: existing } = await supabaseAdmin
              .from("notifications")
              .select("id")
              .eq("for_user_id", c.earner_id)
              .eq("link", link)
              .eq("title", title)
              .gte("created_at", since)
              .limit(1);
            if (existing && existing.length > 0) continue;

            await supabaseAdmin.from("notifications").insert({
              for_user_id: c.earner_id,
              title,
              body: `"${c.title}" expires on ${new Date(c.expires_at).toUTCString()}.`,
              link,
              title_key: "events.credentialExpiryReminder.title",
              body_key: "events.credentialExpiryReminder.body",
              params: { window: w.label, title: c.title, expiresAt: c.expires_at },
            } as never);
            total += 1;
          }
        }

        return Response.json({ ok: true, inserted: total });
      },
    },
  },
});
