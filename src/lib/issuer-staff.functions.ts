import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type StaffMember = {
  userId: string;
  email: string;
  displayName: string;
  createdAt: string;
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
  .inputValidator((d: { email: string; organizationId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const { data: prof, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prof) throw new Error("No user found with that email. Ask them to sign up first.");
    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: prof.id, role: "issuer_staff", organization_id: data.organizationId });
    if (insErr && !String(insErr.message).toLowerCase().includes("duplicate")) {
      throw new Error(insErr.message);
    }
    return { ok: true, userId: prof.id };
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
