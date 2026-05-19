import { Hexagon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BlockchainPlaceholder } from "@/lib/types";

export function EbsiPlaceholderCard({
  blockchain,
  compact = false,
}: {
  blockchain?: BlockchainPlaceholder;
  compact?: boolean;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader className={compact ? "pb-3" : undefined}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Hexagon className="h-4 w-4 text-purple" />
          Future Blockchain / EBSI Integration
          <Badge variant="outline" className="ml-2 text-[10px] uppercase tracking-wider">
            Coming soon
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          This credential will be anchored to the EBSI trusted ledger as a W3C Verifiable Credential.
          Verification will then be cryptographic and offline-checkable.
        </p>
        <dl className="mt-3 grid gap-2 rounded-md bg-muted/40 p-3 font-mono text-xs">
          <Field label="DID" value={blockchain?.did ?? "—"} />
          <Field label="VC ID" value={blockchain?.vcId ?? "—"} />
          <Field label="Tx hash" value={blockchain?.txHash ?? "—"} />
          <Field label="EBSI status" value={blockchain?.ebsiStatus ?? "not_anchored"} />
        </dl>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all text-foreground">{value}</dd>
    </div>
  );
}
