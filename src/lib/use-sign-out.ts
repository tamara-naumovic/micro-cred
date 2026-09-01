import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setActiveUser } = useStore();

  return useCallback(
    async (opts?: { reason?: "idle"; redirectTo?: string }) => {
      await queryClient.cancelQueries();
      queryClient.clear();
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.auth.signOut().catch(() => {});
      setActiveUser(null);
      navigate({
        to: opts?.redirectTo ?? "/login",
        search: opts?.reason === "idle" ? { reason: "idle" } : undefined,
        replace: true,
      });
    },
    [queryClient, navigate, setActiveUser],
  );
}
