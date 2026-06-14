import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getChainAvailabilityFn } from "@/lib/chain/anchor.functions";

export type AnchorMode = "now" | "later";

export function AnchorModeSelector({
  value,
  onChange,
  scope,
}: {
  value: AnchorMode;
  onChange: (v: AnchorMode) => void;
  scope: "template" | "credential";
}) {
  const [status, setStatus] = useState<string>("ok");
  const check = useServerFn(getChainAvailabilityFn);
  useEffect(() => {
    check().then((r: any) => setStatus(r?.status ?? "ok")).catch(() => setStatus("rpc_unavailable"));
  }, [check]);

  const noun = scope === "template" ? "template" : "credential";

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div>
        <Label>Blockchain registration</Label>
        <p className="text-xs text-muted-foreground">
          {scope === "template"
            ? "Publishing happens immediately; anchoring is a separate, optional blockchain step."
            : "Credentials are issued immediately and remain valid regardless of blockchain status."}
        </p>
      </div>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as AnchorMode)}
        className="space-y-2"
      >
        <div className="flex items-start gap-2">
          <RadioGroupItem value="now" id={`${scope}-anchor-now`} disabled={status !== "ok"} />
          <Label htmlFor={`${scope}-anchor-now`} className="font-normal">
            Issue and anchor now
            <span className="block text-xs text-muted-foreground">
              Submit each {noun}'s proof transaction to Bloxberg immediately.
            </span>
          </Label>
        </div>
        <div className="flex items-start gap-2">
          <RadioGroupItem value="later" id={`${scope}-anchor-later`} />
          <Label htmlFor={`${scope}-anchor-later`} className="font-normal">
            Issue now, anchor later
            <span className="block text-xs text-muted-foreground">
              Records are queued for blockchain anchoring on the next worker run.
            </span>
          </Label>
        </div>
      </RadioGroup>
      {status !== "ok" && (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
          <span>
            Bloxberg integration is not currently available. Records will be queued and can be anchored later.
          </span>
        </div>
      )}
    </div>
  );
}
