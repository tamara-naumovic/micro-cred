import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CredentialStatus, RequestStatus, TemplateStatus } from "@/lib/types";

type AnyStatus = CredentialStatus | RequestStatus | TemplateStatus | "approved" | "pending" | "rejected" | "changes_requested";

const LABELS: Record<string, string> = {
  active: "Active",
  pending: "Pending",
  processing: "Processing",
  expired: "Expired",
  revoked: "Revoked",
  renewed: "Renewed",
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  changes_requested: "Changes requested",
  approved_by_provider: "Approved by provider",
  sent_to_issuer: "Sent to issuer",
  issued: "Issued",
  rejected: "Rejected",
  approved: "Approved",
  archived: "Archived",
};

// Use semantic status tokens defined in styles.css
const TONE: Record<string, string> = {
  active: "bg-success/15 text-success-foreground border-success/30",
  issued: "bg-success/15 text-success-foreground border-success/30",
  approved: "bg-success/15 text-success-foreground border-success/30",
  approved_by_provider: "bg-success/15 text-success-foreground border-success/30",
  pending: "bg-warning/20 text-warning-foreground border-warning/30",
  changes_requested: "bg-warning/20 text-warning-foreground border-warning/30",
  under_review: "bg-info/15 text-info-foreground border-info/30",
  submitted: "bg-info/15 text-info-foreground border-info/30",
  processing: "bg-info/15 text-info-foreground border-info/30",
  sent_to_issuer: "bg-accent text-accent-foreground border-accent",
  renewed: "bg-accent text-accent-foreground border-accent",
  expired: "bg-muted text-muted-foreground border-border",
  draft: "bg-muted text-muted-foreground border-border",
  archived: "bg-muted text-muted-foreground border-border",
  revoked: "bg-destructive/10 text-destructive border-destructive/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
};

export function StatusBadge({ status, className }: { status: AnyStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border", TONE[status] ?? "", className)}>
      {LABELS[status] ?? status}
    </Badge>
  );
}
