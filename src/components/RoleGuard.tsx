import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";

export function RoleGuard({
  role,
  children,
}: {
  role: Role | Role[];
  children: ReactNode;
}) {
  const { activeUser } = useStore();
  const allowed = Array.isArray(role) ? role : [role];
  if (!activeUser) return <Navigate to="/login" />;
  if (!allowed.includes(activeUser.role)) return <Navigate to="/login" />;
  return <>{children}</>;
}
