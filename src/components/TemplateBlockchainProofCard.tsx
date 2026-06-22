import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, ShieldCheck, AlertTriangle, RefreshCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  BLOCKCHAIN_BADGE_CLASS,
  BLOCKCHAIN_LABEL,
  TEMPLATE_BLOCKCHAIN_DESCRIPTION,
  TOOLTIPS,
  explorerAddrUrl,
  explorerTxUrl,
  type BlockchainStatus,
} from "@/lib/status-labels";
import {
  anchorTemplateNow,
  getChainAvailabilityFn,
} from "@/lib/chain/anchor.functions";

interface Record {
  template_id: string;
  template_version: string;
  network: string;
  chain_id: number;
  contract_address: string;
  document_hash: string;
  template_ref: string;
  blockchain_status: BlockchainStatus;
  transaction_hash: string | null;
  block_number: number | null;
  anchored_at: string | null;
  attempt_count: number | null;
  last_attempt_at: string | null;
  last_error: string | null;
}

export function TemplateBlockchainProofCard({
  templateId,
  canManage,
}: {
  templateId: string;
  canManage: boolean;
}) {
  const [record, setRecord] = useState<Record | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<string>("ok");
  const anchor = useServerFn(anchorTemplateNow);
  const checkAvail = useServerFn(getChainAvailabilityFn);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase
      .from("template_blockchain_records" as never) as any)
      .select("*")
      .eq("template_id", templateId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRecord((data as Record | null) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    if (canManage) {
      void checkAvail().then((r: any) => setAvailable(r?.status ?? "ok")).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, canManage]);


  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />Blockchain proof
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  if (!record) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />Blockchain proof
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>This template has not been published yet, so no blockchain record exists.</p>
          <p className="text-xs">{TOOLTIPS.templateAnchorPurpose}</p>
        </CardContent>
      </Card>
    );
  }

  const status = (record.blockchain_status ?? "not_requested") as BlockchainStatus;
  const txUrl = explorerTxUrl(record.transaction_hash);
  const addrUrl = explorerAddrUrl(record.contract_address);
  const canAnchorNow = canManage && available === "ok" &&
    ["not_requested", "queued", "failed"].includes(status);

  const onAnchor = async () => {
    setBusy(true);
    try {
      await anchor({ data: { templateId, version: record.template_version } });
      toast.success("Anchoring submitted");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Anchoring failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />Blockchain proof
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={BLOCKCHAIN_BADGE_CLASS[status]}>
            {BLOCKCHAIN_LABEL[status]}
          </Badge>
          <span className="text-xs text-muted-foreground">v{record.template_version}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {TEMPLATE_BLOCKCHAIN_DESCRIPTION[status]}
        </p>
        {available !== "ok" && (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
            <span>
              Bloxberg integration is not currently available. Records can still be queued for later anchoring.
            </span>
          </div>
        )}
        <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-xs">
          <Field label="Network" value={record.network} />
          <Field label="Chain ID" value={String(record.chain_id)} />
          <Field label="Attempts" value={String(record.attempt_count ?? 0)} />
          <Field label="Document hash" value={record.document_hash} mono span={3} />
          <Field label="Template ref" value={record.template_ref} mono span={3} />
          <Field label="Contract" value={record.contract_address || "—"} mono span={3} link={addrUrl} />
          {record.transaction_hash && (
            <Field label="Transaction" value={record.transaction_hash} mono span={3} link={txUrl} />
          )}
          {record.block_number != null && (
            <Field label="Block" value={String(record.block_number)} />
          )}
          {record.anchored_at && (
            <Field label="Anchored at" value={new Date(record.anchored_at).toLocaleString()} span={2} />
          )}
          {record.last_error && (
            <Field label="Last error" value={record.last_error} span={3} />
          )}
        </dl>
        {canManage && (
          <div className="flex flex-wrap gap-2 pt-1">
            {canAnchorNow && (
              <Button size="sm" onClick={onAnchor} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-2 h-3.5 w-3.5" />}
                {status === "failed" ? "Retry anchoring" : "Anchor now"}
              </Button>
            )}
            {txUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={txUrl} target="_blank" rel="noreferrer">
                  View transaction<ExternalLink className="ml-2 h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  mono,
  span,
  link,
}: {
  label: string;
  value: string;
  mono?: boolean;
  span?: 1 | 2 | 3;
  link?: string | null;
}) {
  const colSpan = span === 3 ? "col-span-3" : span === 2 ? "col-span-2" : "col-span-1";
  return (
    <div className={colSpan}>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={mono ? "break-all font-mono text-[11px]" : "text-xs"}>
        {link ? (
          <a href={link} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
