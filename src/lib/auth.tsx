import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { MockUser, Role } from "./types";
import { useStore } from "./store";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

function mapDbRole(dbRole: string): { role: Role; subRole?: "admin" | "staff" } {
  if (dbRole === "platform_admin") return { role: "admin" };
  if (dbRole === "issuer_admin") return { role: "issuer", subRole: "admin" };
  if (dbRole === "issuer_staff") return { role: "issuer", subRole: "staff" };
  return { role: "earner" };
}

const ROLE_PRIORITY: Record<string, number> = {
  platform_admin: 4,
  issuer_admin: 3,
  issuer_staff: 2,
  earner: 1,
  verifier: 0,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { setActiveUser } = useStore();

  async function bridgeToActiveUser(u: User | null) {
    if (!u) {
      setActiveUser(null);
      return;
    }
    try {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("display_name, email, student_id").eq("id", u.id).maybeSingle(),
        supabase.from("user_roles").select("role, organization_id").eq("user_id", u.id),
      ]);
      // Never guess "earner" when roles are missing. During invite / first-login
      // flows the profile row can exist before the final role row becomes
      // visible, and a fallback here routes the user to the wrong dashboard.
      if (!roles || roles.length === 0) {
        setActiveUser(null);
        return;
      }
      const sorted = [...(roles ?? [])].sort(
        (a, b) => (ROLE_PRIORITY[b.role as string] ?? 0) - (ROLE_PRIORITY[a.role as string] ?? 0),
      );
      const primary = sorted[0];
      const mapped = mapDbRole(primary.role as string);
      const mock: MockUser = {
        id: u.id,
        name: profile?.display_name || u.email?.split("@")[0] || "User",
        email: profile?.email || u.email || "",
        role: mapped.role,
        subRole: mapped.subRole,
        organizationId: primary?.organization_id ?? undefined,
        studentId: profile?.student_id ?? undefined,
      };
      setActiveUser(mock);
    } catch (e) {
      console.error("[auth] bridge failed", e);
    }
  }


  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setTimeout(() => bridgeToActiveUser(s?.user ?? null), 0);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      bridgeToActiveUser(s?.user ?? null).finally(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      session,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setActiveUser(null);
      },
    }),
    [user, session, loading, setActiveUser],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
