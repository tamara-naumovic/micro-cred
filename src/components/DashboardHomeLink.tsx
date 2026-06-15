import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

function getDashboardPath(role?: string) {
  if (role === "earner") return "/earner";
  if (role === "issuer") return "/issuer";
  if (role === "admin") return "/admin";
  return "/";
}

export function DashboardHomeLink({ label = "Back to home" }: { label?: string }) {
  const { activeUser } = useStore();
  const to = getDashboardPath(activeUser?.role);
  return (
    <Button variant="ghost" size="sm" asChild className="mb-4">
      <Link to={to}>
        <ArrowLeft className="mr-1 h-4 w-4" /> {label}
      </Link>
    </Button>
  );
}
