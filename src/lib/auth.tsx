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
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

// Map DB app_role -> frontend Role
function mapRole(dbRole: string): Role {
  if (dbRole === "issuer_admin") return "issuer";
  if (dbRole === "platform_admin") return "admin";
  return "earner";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { setActiveUser } = useStore();

  // Bridge: when Supabase user changes, sync to mock activeUser
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
      const primary = roles?.[0];
      const mock: MockUser = {
        id: u.id,
        name: profile?.display_name || u.email?.split("@")[0] || "User",
        email: profile?.email || u.email || "",
        role: primary ? mapRole(primary.role as string) : "earner",
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
      // defer to avoid deadlock per Supabase docs
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
      signUp: async (email, password, displayName) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: displayName },
          },
        });
        return { error: error?.message ?? null };
      },
      signInWithGoogle: async () => {
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/` },
        });
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
