import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Link2, Loader2, ShieldQuestion, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { verifyPublicCredentialOnChain } from "@/lib/chain/verify-public.functions";

type Result = Awaited<ReturnType<typeof verifyPublicCredentialOnChain>>;

export function PublicChainVerificationPanel({
  shareToken,
  storedTxHash,
  storedBlockNumber,
}: {
  shareToken: string;
  storedTxHash?: string | null;
  storedBlockNumber?: number | null;
}) {
  const { t } = useTranslation("common");
  const verifyFn = useServerFn(verifyPublicCredentialOnChain);
  const [result, setResult] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);

  const mut = useMutation({
    mutationFn: async () => verifyFn({ data: { shareToken } }),
    onMutate: () => {
      setFailed(false);
    },
    onSuccess: (r) => setResult(r as Result),
    onError: () => {
      setResult(null);
      setFailed(true);
    },
  });

  const hasRun = result != null || failed;
  const rpcFailed = failed || (result != null && result.verificationAvailable === false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4 text-primary" />
          {t("chainVerify.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!hasRun && !mut.isPending && (
          <p className="text-muted-foreground">{t("chainVerify.notRunYet")}</p>
        )}

        {(storedTxHash || storedBlockNumber != null) && (
          <dl className="grid gap-2 rounded-md bg-muted/40 p-3 font-mono text-xs">
            {storedTxHash && <Row label={t("chainVerify.storedTx")} value={storedTxHash} />}
            {storedBlockNumber != null && (
              <Row label={t("chainVerify.storedBlock")} value={String(storedBlockNumber)} />
            )}
          </dl>
        )}

        {mut.isPending && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("chainVerify.loading")}
          </div>
        )}

        {rpcFailed && !mut.isPending && (
          <div className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
            <div>
              <div>{t("chainVerify.rpcError")}</div>
              {result?.error?.message && (
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {result.error.message}
                </div>
              )}
            </div>
          </div>
        )}

        {result && result.verificationAvailable && !mut.isPending && (
          <VerificationDetails result={result} />
        )}

        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending
            ? t("chainVerify.loading")
            : hasRun
              ? t("chainVerify.again")
              : t("chainVerify.cta")}
        </Button>
      </CardContent>
    </Card>
  );
}

function VerificationDetails({ result }: { result: Result }) {
  const { t } = useTranslation("common");
  const c = result.credential;
  if (!c) return null;

  const verdictKey = !c.existsOnChain
    ? "notFound"
    : c.statusCode === 2
      ? "revoked"
      : c.statusCode === 3
        ? "superseded"
        : c.expired
          ? "expired"
          : c.valid && c.hashMatches
            ? "valid"
            : "invalid";
  const good = verdictKey === "valid";
  const Icon = good ? CheckCircle2 : verdictKey === "notFound" ? ShieldQuestion : XCircle;

  return (
    <div className="space-y-3">
      <div
        className={`flex items-center gap-2 rounded-md p-3 ${
          good ? "bg-success/10 text-success-foreground" : "bg-destructive/10 text-destructive"
        }`}
      >
        <Icon className="h-4 w-4" />
        <span className="font-medium">{t(`chainVerify.verdict.${verdictKey}`)}</span>
      </div>

      <dl className="grid gap-2 rounded-md bg-muted/40 p-3 font-mono text-xs">
        <Row label={t("chainVerify.network")} value={result.network} />
        <Row label={t("chainVerify.chainId")} value={String(result.chainId)} />
        <Row label={t("chainVerify.checkedAt")} value={new Date(result.checkedAt).toLocaleString()} />
        <Row label={t("chainVerify.onChainStatus")} value={c.status} />
        <Row
          label={t("chainVerify.hashMatch")}
          value={c.hashMatches ? t("chainVerify.yes") : t("chainVerify.no")}
        />
        <Row
          label={t("chainVerify.expired")}
          value={c.expired ? t("chainVerify.yes") : t("chainVerify.no")}
        />
        <Row
          label={t("chainVerify.templateResult")}
          value={
            result.template.verificationAvailable
              ? `${result.template.status}${result.template.valid ? "" : " ⚠"}`
              : t("chainVerify.unavailable")
          }
        />
        {c.issuerAddress && <Row label={t("chainVerify.issuerWallet")} value={c.issuerAddress} />}
        {c.issuerNameSnapshot && (
          <Row label={t("chainVerify.issuerName")} value={c.issuerNameSnapshot} />
        )}
        {result.database.transactionHash && (
          <Row label={t("chainVerify.storedTx")} value={result.database.transactionHash} />
        )}
        {result.database.blockNumber != null && (
          <Row label={t("chainVerify.storedBlock")} value={String(result.database.blockNumber)} />
        )}
        <Row label={t("chainVerify.dbLifecycle")} value={result.database.lifecycle ?? "—"} />
        <Row label={t("chainVerify.dbChainStatus")} value={result.database.chainStatus ?? "—"} />
      </dl>

      {result.consistency.warnings.length > 0 && (
        <div className="space-y-1 rounded-md bg-warning/10 p-3 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" /> {t("chainVerify.warnings")}
          </div>
          <ul className="list-disc space-y-1 pl-5">
            {result.consistency.warnings.map((w) => (
              <li key={w.code}>{t(`chainVerify.warning.${w.code}`, { defaultValue: w.message })}</li>
            ))}
          </ul>
        </div>
      )}

      {result.consistency.warnings.length === 0 && (
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
          {t("chainVerify.consistent")}
        </Badge>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all text-foreground">{value}</dd>
    </div>
  );
}
