import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "earner" | "issuer_admin" | "issuer_staff" | "platform_admin";

async function assertPlatformAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "platform_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: platform admin only");
}

async function assertOrgAdmin(supabase: any, userId: string, orgId: string) {
  const { data, error } = await supabase.rpc("has_role_in_org", {
    _user_id: userId,
    _role: "issuer_admin",
    _org_id: orgId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: institution admin only");
}

/**
 * Provision a user via Supabase admin API (password OR invite mode) and assign
 * the requested role. Returns the new auth user id.
 *
 * Pure helper — caller is responsible for authorizing the actor first.
 */
async function provisionUser(opts: {
  email: string;
  displayName: string;
  roles: AppRole[];
  organizationId?: string;
  mode: "password" | "invite";
  password?: string;
  redirectTo?: string;
}): Promise<{ userId: string; alreadyExisted: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = opts.email.trim().toLowerCase();

  if (!opts.roles || opts.roles.length === 0) {
    throw new Error("At least one role is required");
  }

  // Try to find an existing profile by email first
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  let userId: string;
  let alreadyExisted = false;

  if (existing?.id) {
    userId = existing.id as string;
    alreadyExisted = true;
  } else if (opts.mode === "password") {
    if (!opts.password || opts.password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: opts.password,
      email_confirm: true,
      user_metadata: { display_name: opts.displayName },
    });
    if (error || !data?.user) throw new Error(error?.message ?? "Failed to create user");
    userId = data.user.id;
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: opts.displayName },
      redirectTo: opts.redirectTo,
    });
    if (error || !data?.user) throw new Error(error?.message ?? "Failed to invite user");
    userId = data.user.id;
  }

  // Defensive: ensure profile row exists even if the auth trigger didn't run.
  await supabaseAdmin
    .from("profiles")
    .upsert(
      { id: userId, email, display_name: opts.displayName },
      { onConflict: "id" },
    );

  // The handle_new_user trigger inserts a default 'earner' role. Remove it
  // unless 'earner' is one of the requested roles.
  if (!opts.roles.includes("earner")) {
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "earner")
      .is("organization_id", null);
  }

  for (const role of opts.roles) {
    const isIssuer = role === "issuer_admin" || role === "issuer_staff";
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role,
      organization_id: isIssuer ? opts.organizationId ?? null : null,
    });
    if (roleErr && !String(roleErr.message).toLowerCase().includes("duplicate")) {
      throw new Error(roleErr.message);
    }
  }

  return { userId, alreadyExisted };
}


// ============================================================================
// Platform admin: create any user
// ============================================================================
export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      email: string;
      displayName: string;
      roles: AppRole[];
      organizationId?: string;
      mode: "password" | "invite";
      password?: string;
      redirectTo?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const needsOrg = data.roles.some((r) => r === "issuer_admin" || r === "issuer_staff");
    if (needsOrg && !data.organizationId) {
      throw new Error("organizationId is required for institution roles");
    }
    const r = await provisionUser(data);
    return r;
  });

// ============================================================================
// Platform admin: update a user's profile + role
// ============================================================================
export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      userId: string;
      email?: string;
      displayName?: string;
      roles?: AppRole[];
      organizationId?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const needsOrg = (data.roles ?? []).some(
      (r) => r === "issuer_admin" || r === "issuer_staff",
    );
    if (data.roles && needsOrg && !data.organizationId) {
      throw new Error("organizationId is required for institution roles");
    }

    const email = data.email?.trim().toLowerCase();

    // Update auth.users email / metadata
    if (email || data.displayName) {
      const payload: Record<string, unknown> = {};
      if (email) payload.email = email;
      if (data.displayName) payload.user_metadata = { display_name: data.displayName };
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, payload);
      if (error) throw new Error(error.message);
    }

    // Update profile row
    const profilePatch: { email?: string; display_name?: string } = {};
    if (email) profilePatch.email = email;
    if (data.displayName) profilePatch.display_name = data.displayName;
    if (Object.keys(profilePatch).length > 0) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(profilePatch)
        .eq("id", data.userId);
      if (error) throw new Error(error.message);
    }

    // Replace role assignment if requested
    if (data.roles && data.roles.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId);
      if (delErr) throw new Error(delErr.message);

      for (const role of data.roles) {
        const isIssuer = role === "issuer_admin" || role === "issuer_staff";
        const { error: insErr } = await supabaseAdmin.from("user_roles").insert({
          user_id: data.userId,
          role,
          organization_id: isIssuer ? data.organizationId ?? null : null,
        });
        if (insErr && !String(insErr.message).toLowerCase().includes("duplicate")) {
          throw new Error(insErr.message);
        }
      }
    }

    return { ok: true };
  });

// ============================================================================
// Platform admin: delete a user
// ============================================================================
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Error("You cannot delete your own account");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================================
// Any signed-in user: update their own profile (about text, etc.)
// ============================================================================
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { about?: string }) => d)
  .handler(async ({ data, context }) => {
    const about = (data.about ?? "").slice(0, 1000);
    const { error } = await context.supabase
      .from("profiles")
      .update({ about })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMyLanguage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { language: "en" | "sr" }) => {
    if (d.language !== "en" && d.language !== "sr") {
      throw new Error("Unsupported language");
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ language: data.language })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("about, display_name, email, language")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      about: (data?.about as string | null) ?? "",
      displayName: (data?.display_name as string | null) ?? "",
      email: (data?.email as string | null) ?? "",
      language: ((data?.language as string | null) ?? "en") as "en" | "sr",
    };
  });

// ============================================================================
// Platform admin: create institution + its admin in a single step
// ============================================================================
export const adminCreateInstitution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      name: string;
      country: string;
      website?: string;
      about?: string;
      accreditationDocumentPath?: string;
      adminEmail: string;
      adminDisplayName: string;
      mode: "password" | "invite";
      adminPassword?: string;
      redirectTo?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: data.name,
        type: "issuer",
        country: data.country,
        website: data.website ?? null,
        about: data.about ?? null,
        accreditation_document_url: data.accreditationDocumentPath ?? null,
      })
      .select("id")
      .single();
    if (orgErr || !org) throw new Error(orgErr?.message ?? "Failed to create institution");

    try {
      const r = await provisionUser({
        email: data.adminEmail,
        displayName: data.adminDisplayName,
        roles: ["issuer_admin"],
        organizationId: org.id as string,
        mode: data.mode,
        password: data.adminPassword,
        redirectTo: data.redirectTo,
      });
      return { organizationId: org.id as string, ...r };
    } catch (e) {
      // Roll back the org so the admin can retry cleanly
      await supabaseAdmin.from("organizations").delete().eq("id", org.id as string);
      throw e;
    }
  });

// ============================================================================
// Platform admin OR institution admin (for own org): assign earner ↔ institution
// ============================================================================
export const assignEarnerInstitution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { earnerId: string; organizationId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: isPA } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "platform_admin",
    });
    if (!isPA) {
      await assertOrgAdmin(context.supabase, context.userId, data.organizationId);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("earner_institutions")
      .insert({
        earner_id: data.earnerId,
        organization_id: data.organizationId,
        assigned_by: context.userId,
      });
    if (error && !String(error.message).toLowerCase().includes("duplicate")) {
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const removeEarnerInstitution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { earnerId: string; organizationId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: isPA } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "platform_admin",
    });
    if (!isPA) {
      await assertOrgAdmin(context.supabase, context.userId, data.organizationId);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("earner_institutions")
      .delete()
      .eq("earner_id", data.earnerId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================================
// Institution admin: create an earner (or attach an existing one) to own org
// ============================================================================
export const orgCreateEarner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organizationId: string;
      email: string;
      displayName: string;
      mode: "password" | "invite";
      password?: string;
      redirectTo?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.organizationId);
    const r = await provisionUser({
      email: data.email,
      displayName: data.displayName,
      roles: ["earner"],
      mode: data.mode,
      password: data.password,
      redirectTo: data.redirectTo,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("earner_institutions").insert({
      earner_id: r.userId,
      organization_id: data.organizationId,
      assigned_by: context.userId,
    });
    if (error && !String(error.message).toLowerCase().includes("duplicate")) {
      throw new Error(error.message);
    }
    return r;
  });

export const orgBulkCreateEarners = createServerFn({ method: "POST" })
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
      try {
        const r = await provisionUser({
          email: row.email,
          displayName: row.name,
          roles: ["earner"],
          mode: "password",
          password: row.password,
        });
        const { error } = await supabaseAdmin.from("earner_institutions").insert({
          earner_id: r.userId,
          organization_id: data.organizationId,
          assigned_by: context.userId,
        });
        if (error && !String(error.message).toLowerCase().includes("duplicate")) {
          throw new Error(error.message);
        }
        created++;
      } catch (e: any) {
        errors.push(`${row.email}: ${e?.message ?? "failed"}`);
      }
    }
    return { created, failed: errors.length, errors };
  });

