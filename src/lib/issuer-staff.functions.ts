import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type StaffMember = {
  userId: string;
  email: string;
  displayName: string;
  createdAt: string;
  isAdmin: boolean;
};

async function assertOrgAdmin(supabase: any, userId: string, organizationId: string) {
  const { data, error } = await supabase.rpc("has_role_in_org", {
    _user_id: userId,
    _role: "issuer_admin",
    _org_id: organizationId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: not an institution admin");
}

export const listIssuerStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string }) => d)
  .handler(async ({ data, context }): Promise<StaffMember[]> => {
    await assertOrgAdmin(context.supabase, context.userId, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, created_at")
      .eq("role", "issuer_staff")
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    const userIds = (roles ?? []).map((r: any) => r.user_id);
    if (userIds.length === 0) return [];
    const { data: profs, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name")
      .in("id", userIds);
    if (pErr) throw new Error(pErr.message);
    const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return (roles ?? []).map((r: any) => {
      const p: any = byId.get(r.user_id) ?? {};
      return {
        userId: r.user_id,
        email: p.email ?? "",
        displayName: p.display_name ?? "",
        createdAt: r.created_at,
      };
    });
  });

export const addIssuerStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      email: string;
      organizationId: string;
      displayName?: string;
      mode?: "existing" | "password" | "invite";
      password?: string;
      redirectTo?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const mode = data.mode ?? "existing";

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();

    let userId: string | null = prof?.id ?? null;

    if (!userId) {
      if (mode === "existing") {
        throw new Error("No user found with that email. Switch to 'Create new account' to provision one.");
      }
      if (mode === "password") {
        if (!data.password || data.password.length < 6) {
          throw new Error("Password must be at least 6 characters");
        }
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: data.password,
          email_confirm: true,
          user_metadata: { display_name: data.displayName ?? "" },
        });
        if (error || !created?.user) throw new Error(error?.message ?? "Failed to create user");
        userId = created.user.id;
      } else {
        const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: { display_name: data.displayName ?? "" },
          redirectTo: data.redirectTo,
        });
        if (error || !invited?.user) throw new Error(error?.message ?? "Failed to invite user");
        userId = invited.user.id;
      }

      // Ensure profile exists even if the auth trigger didn't run
      await supabaseAdmin
        .from("profiles")
        .upsert(
          { id: userId, email, display_name: data.displayName ?? "" },
          { onConflict: "id" },
        );

      // Trigger inserted a default earner role — staff accounts don't need it
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "earner")
        .is("organization_id", null);
    }

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "issuer_staff", organization_id: data.organizationId });
    if (insErr && !String(insErr.message).toLowerCase().includes("duplicate")) {
      throw new Error(insErr.message);
    }
    return { ok: true, userId };
  });

export const removeIssuerStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; organizationId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "issuer_staff")
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    // Cleanup template assignments
    await supabaseAdmin.from("template_assignees").delete().eq("user_id", data.userId);
    return { ok: true };
  });

export const bulkAddIssuerStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organizationId: string;
      rows: { name: string; email: string; password: string }[];
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let created = 0;
    const errors: string[] = [];

    for (const row of data.rows) {
      const email = row.email.trim().toLowerCase();
      try {
        if (!row.password || row.password.length < 6) {
          throw new Error("password must be at least 6 chars");
        }
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .ilike("email", email)
          .maybeSingle();
        let userId: string | null = prof?.id ?? null;
        if (!userId) {
          const { data: c, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: row.password,
            email_confirm: true,
            user_metadata: { display_name: row.name },
          });
          if (error || !c?.user) throw new Error(error?.message ?? "create failed");
          userId = c.user.id;

          // Ensure profile exists even if the auth trigger didn't run
          await supabaseAdmin
            .from("profiles")
            .upsert(
              { id: userId, email, display_name: row.name },
              { onConflict: "id" },
            );

          await supabaseAdmin
            .from("user_roles")
            .delete()
            .eq("user_id", userId)
            .eq("role", "earner")
            .is("organization_id", null);
        }
        const { error: insErr } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role: "issuer_staff", organization_id: data.organizationId });
        if (insErr && !String(insErr.message).toLowerCase().includes("duplicate")) {
          throw new Error(insErr.message);
        }
        created++;
      } catch (e: any) {
        errors.push(`${email}: ${e?.message ?? "failed"}`);
      }
    }
    return { created, failed: errors.length, errors };
  });

