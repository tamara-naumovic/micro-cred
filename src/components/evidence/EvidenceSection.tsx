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
  const { t } = useTranslation("earner");
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
      toast.success(opts?.successToast ?? t("evidence.downloadReady"));
    } catch (e) {
      if (tid) toast.dismiss(tid);
      const msg = (e as Error)?.message ?? t("evidence.downloadFailed");
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("evidence.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("evidence.description")}
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          <EvidenceButton
            icon={<FileText className="h-4 w-4" />}
            label={t("evidence.pdf.label")}
            description={t("evidence.pdf.description")}
            busyLabel={t("evidence.preparing")}
            busy={busy === "pdf"}
            disabled={!!busy && busy !== "pdf"}
            onClick={() => download("pdf")}
          />
          <EvidenceButton
            icon={<FileJson className="h-4 w-4" />}
            label={t("evidence.json.label")}
            description={t("evidence.json.description")}
            busyLabel={t("evidence.preparing")}
            busy={busy === "json"}
            disabled={!!busy && busy !== "json"}
            onClick={() => download("json")}
          />
          <EvidenceButton
            icon={<ShieldCheck className="h-4 w-4" />}
            label={t("evidence.receipt.label")}
            description={t("evidence.receipt.description")}
            busyLabel={t("evidence.preparing")}
            busy={busy === "receipt"}
            disabled={!!busy && busy !== "receipt"}
            onClick={() => download("receipt")}
          />
          <EvidenceButton
            icon={<Package className="h-4 w-4" />}
            label={t("evidence.package.label")}
            description={t("evidence.package.description")}
            busyLabel={t("evidence.preparing")}
            busy={busy === "package"}
            disabled={!!busy && busy !== "package"}
            onClick={() =>
              download("package", {
                loadingToast: t("evidence.package.loadingToast"),
                successToast: t("evidence.package.successToast"),
              })
            }
          />
        </div>

        {isOwner && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Lock className="h-3 w-3" /> {t("evidence.privateFiles")}
              </div>
              {privateProofAvailable ? (
                <PrivateProofDialog
                  busy={busy === "private_proof"}
                  disabled={!!busy && busy !== "private_proof"}
                  onConfirm={() => download("private_proof")}
                />
              ) : (
                <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  {t("evidence.privateUnavailable")}
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
  busyLabel,
  busy,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  busyLabel: string;
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
              {busyLabel}
            </span>
          )}
        </div>

        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
      </div>
      <Download className="mt-1 h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
    </button>
  );
}
