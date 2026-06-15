import { Link } from "@tanstack/react-router";
import { XCircle, Clock, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BLOCKCHAIN_BADGE_CLASS,
  BLOCKCHAIN_LABEL,
  explorerTxUrl,
  type BlockchainStatus,
} from "@/lib/status-labels";

export interface IssuanceResultRow {
  recipientId: string;
  recipientName?: string;
  credentialId?: string;
  credentialStatus: string;
  blockchainStatus: string;
  txHash?: string;
  error?: string;
}

export function IssuanceResultDialog({
  open,
  onOpenChange,
  results,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  results: IssuanceResultRow[];
  onDone?: () => void;
}) {
  const sent = results.filter(
    (r) => r.credentialStatus === "issued" || r.credentialStatus === "pending_earner_acceptance",
  ).length;
  const failed = results.length - sent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Issuance results</DialogTitle>
        </DialogHeader>
        <p className="mb-2 text-sm text-muted-foreground">
          Credentials are sent to each earner for acceptance. They are not anchored on the blockchain until the earner accepts.
        </p>
        <div className="mb-3 flex gap-2 text-sm">
          <Badge variant="outline" className="bg-success/10 text-success-foreground border-success/30">
            {sent} sent for acceptance
          </Badge>
          {failed > 0 && (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
              {failed} not sent
            </Badge>
          )}
        </div>
        <div className="max-h-[60vh] overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Recipient</th>
                <th className="px-3 py-2 text-left">Credential</th>
                <th className="px-3 py-2 text-left">Blockchain</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const bcStatus = (r.blockchainStatus || "not_requested") as BlockchainStatus;
                const txUrl = explorerTxUrl(r.txHash);
                const sentOk = r.credentialStatus === "issued" || r.credentialStatus === "pending_earner_acceptance";
                return (
                  <tr key={`${r.recipientId}-${r.credentialId ?? "x"}`} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.recipientName ?? r.recipientId}</div>
                      {r.error && <div className="text-xs text-destructive">{r.error}</div>}
                    </td>
                    <td className="px-3 py-2">
                      {sentOk ? (
                        <span className="inline-flex items-center gap-1 text-warning-foreground">
                          <Clock className="h-3.5 w-3.5" />Awaiting acceptance
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <XCircle className="h-3.5 w-3.5" />Not issued
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={BLOCKCHAIN_BADGE_CLASS[bcStatus] ?? ""}>
                        {bcStatus === "queued" && <Clock className="mr-1 h-3 w-3" />}
                        {BLOCKCHAIN_LABEL[bcStatus] ?? bcStatus}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {r.credentialId && (
                          <Button size="sm" variant="outline" asChild>
                            <Link to="/issuer/credentials">View</Link>
                          </Button>
                        )}
                        {txUrl && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={txUrl} target="_blank" rel="noreferrer">
                              Tx<ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button onClick={() => { onOpenChange(false); onDone?.(); }}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
