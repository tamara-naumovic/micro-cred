import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Download, FileText, FileJson, ShieldCheck, Package, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  generateCredentialEvidence,
  type EvidenceFileType,
} from "@/lib/evidence/package.functions";
import { triggerDownload } from "@/lib/evidence/use-download";
import { PrivateProofDialog } from "./PrivateProofDialog";


interface Props {
  credentialId: string;
  /** Whether the current viewer is the credential owner. Private-proof
   *  button is only shown to owners. */
  isOwner: boolean;
  /** When false (owner but learner_secret missing on the row), the private
   *  proof button is rendered disabled with the prescribed copy. */
  privateProofAvailable?: boolean;
}

export function EvidenceSection({
  credentialId,
  isOwner,
  privateProofAvailable = true,
}: Props) {
  const generate = useServerFn(generateCredentialEvidence);
  const [busy, setBusy] = useState<EvidenceFileType | null>(null);

  const download = async (
    fileType: EvidenceFileType,
    opts?: { loadingToast?: string; successToast?: string },
  ) => {
    if (busy) return;
    setBusy(fileType);
    const tid = opts?.loadingToast
      ? toast.loading(opts.loadingToast)
      : undefined;
    try {
      const file = await generate({ data: { credentialId, fileType } });
      triggerDownload(file);
      if (tid) toast.dismiss(tid);
      toast.success(opts?.successToast ?? "Download ready");
    } catch (e) {
      if (tid) toast.dismiss(tid);
      const msg = (e as Error)?.message ?? "Download failed";
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Credential files and evidence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Download your credential, machine-readable data and verification evidence.
          Private ownership proof must not be shared publicly.
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          <EvidenceButton
            icon={<FileText className="h-4 w-4" />}
            label="Download PDF"
            description="Human-readable credential certificate."
            busy={busy === "pdf"}
            disabled={!!busy && busy !== "pdf"}
            onClick={() => download("pdf")}
          />
          <EvidenceButton
            icon={<FileJson className="h-4 w-4" />}
            label="Download credential JSON"
            description="Machine-readable credential record."
            busy={busy === "json"}
            disabled={!!busy && busy !== "json"}
            onClick={() => download("json")}
          />
          <EvidenceButton
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Download verification receipt"
            description="Blockchain and integrity evidence."
            busy={busy === "receipt"}
            disabled={!!busy && busy !== "receipt"}
            onClick={() => download("receipt")}
          />
          <EvidenceButton
            icon={<Package className="h-4 w-4" />}
            label="Download complete package"
            description="All public credential files in one ZIP."
            busy={busy === "package"}
            disabled={!!busy && busy !== "package"}
            onClick={() =>
              download("package", {
                loadingToast: "Preparing your credential package…",
                successToast: "Package ready",
              })
            }
          />
        </div>

        {isOwner && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Lock className="h-3 w-3" /> Private files
              </div>
              {privateProofAvailable ? (
                <PrivateProofDialog
                  busy={busy === "private_proof"}
                  disabled={!!busy && busy !== "private_proof"}
                  onConfirm={() => download("private_proof")}
                />
              ) : (
                <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Private ownership proof is not available for this credential.
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EvidenceButton({
  icon,
  label,
  description,
  busy,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      className="group flex items-start gap-3 rounded-md border border-border bg-card p-3 text-left transition hover:border-primary/40 hover:bg-accent/40 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          {label}
          {busy && (
            <span className="text-xs font-normal text-muted-foreground">
              preparing…
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
      </div>
      <Download className="mt-1 h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
    </button>
  );
}
