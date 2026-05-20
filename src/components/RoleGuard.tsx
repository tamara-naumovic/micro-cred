import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";

export function RoleGuard({
  role,
  children,
}: {
  role: Role | Role[];
  children: ReactNode;
}) {
  const { activeUser } = useStore();
  const { user, loading } = useAuth();
  const allowed = Array.isArray(role) ? role : [role];

  // Wait for auth + activeUser bridge to settle before deciding
  if (loading) return null;
  if (user && !activeUser) return null; // bridging session -> activeUser

  if (!activeUser) return <Navigate to="/login" />;
  if (!allowed.includes(activeUser.role)) return <Navigate to="/login" />;
  return <>{children}</>;
}
