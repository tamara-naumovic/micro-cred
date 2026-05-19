import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "primary",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "primary" | "success" | "warning" | "info" | "purple" | "destructive";
}) {
  const toneCls: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success-foreground",
    warning: "bg-warning/20 text-warning-foreground",
    info: "bg-info/15 text-info-foreground",
    purple: "bg-accent text-accent-foreground",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        {icon && (
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", toneCls[tone])}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="font-display text-2xl font-semibold leading-tight">{value}</div>
          {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
