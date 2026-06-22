import { Link } from "@tanstack/react-router";
import { Award, CalendarClock, Clock, GraduationCap, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ShareDialog } from "@/components/ShareDialog";
import type { IssuedCredential } from "@/lib/types";

export function ChainPendingChip({ status }: { status?: string }) {
  const { t } = useTranslation("common");
  if (!status) return null;
  if (status === "confirmed" || status === "disabled" || status === "not_requested") return null;
  const label = status === "failed" ? t("credentialCard.blockchainRetrying") : t("credentialCard.blockchainPending");
  return (
    <Badge
      variant="outline"
      className="border bg-warning/15 text-warning-foreground border-warning/30 gap-1"
    >
      <Clock className="h-3 w-3" /> {label}
    </Badge>
  );
}


export function CredentialCard({
  credential,
  detailHref,
  shareable = true,
}: {
  credential: IssuedCredential;
  detailHref?: string;
  shareHref?: string;
  shareable?: boolean;
}) {
  const { t } = useTranslation("common");
  const c = credential;
  const showPending = c.status === "active" && c.blockchain?.chainStatus;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Award className="h-4 w-4" />
          </div>
          <div className="flex flex-wrap items-center gap-1 justify-end">
            <StatusBadge status={c.status} />
            {showPending && <ChainPendingChip status={c.blockchain?.chainStatus} />}
          </div>
        </div>
        <div>
          <div className="font-display text-lg font-semibold leading-tight">{c.title}</div>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <GraduationCap className="h-3 w-3" /> {c.issuerName}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 text-sm">
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="capitalize">
            {c.source === "formal" ? t("source.formal") : t("source.non_formal")}
          </Badge>
          {c.level !== "N/A" && <Badge variant="outline">{c.level}</Badge>}
          {c.ects && <Badge variant="outline">{c.ects} ECTS</Badge>}
        </div>
        {c.skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {c.skills.slice(0, 4).map((s) => (
              <span key={s} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {s}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarClock className="h-3 w-3" />
          {t("credentialCard.issued")} {new Date(c.issuedAt).toLocaleDateString()}
          {c.expiresAt && <> · {t("credentialCard.expires")} {new Date(c.expiresAt).toLocaleDateString()}</>}
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        {detailHref && (
          <Button asChild variant="outline" size="sm">
            <Link to={detailHref}>{t("credentialCard.details")}</Link>
          </Button>
        )}
        {shareable && (
          <ShareDialog
            url={c.verificationLink}
            title={c.title}
            summary={t("credentialCard.shareSummary", { issuer: c.issuerName })}
            qrId={`qr-card-${c.id}`}
            certification={{
              name: c.title,
              organizationName: c.issuerName,
              issueDate: c.issuedAt,
              expirationDate: c.expiresAt,
              certId: c.id,
            }}
            trigger={
              <Button variant="ghost" size="sm">
                <Share2 className="mr-1 h-3 w-3" /> {t("credentialCard.share")}
              </Button>
            }
          />
        )}
      </CardFooter>
    </Card>
  );
}

