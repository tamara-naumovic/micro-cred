import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { loadParticipantIds } from "@/lib/evaluation/participant-ids";
import { Button } from "@/components/ui/button";

export function EvaluationParticipantIds() {
  const { activeUser } = useStore();
  const { t } = useTranslation("evaluation");
  const userId = activeUser?.role === "earner" ? activeUser.id : undefined;
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["evaluation-participant-ids", userId],
    queryFn: () => userId ? loadParticipantIds(userId) : Promise.resolve([]),
    enabled: !!userId,
  });
  if (!userId || (data?.length === 0 && !isError)) return null;

  return (
    <section className="space-y-3 border-t border-border pt-6" aria-labelledby="evaluation-ids-title">
      <h2 id="evaluation-ids-title" className="text-base font-semibold">{t("participantIds.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("participantIds.description")}</p>
      {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label={t("participantIds.loading")} />}
      {isError && <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{t("participantIds.error")}</p><Button variant="outline" size="sm" onClick={() => void refetch()}>{t("participantIds.retry")}</Button></div>}
      {data?.map((entry) => (
        <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="min-w-0 space-y-1">
            <div className="break-words text-sm font-medium">{entry.evaluation_campaigns?.name ?? t("participantIds.campaign")}</div>
            <div className="break-all font-mono text-sm">{entry.anonymous_export_id}</div>
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            void navigator.clipboard.writeText(entry.anonymous_export_id).then(
              () => toast.success(t("finish.idCopied")),
              () => toast.error(t("finish.idCopyFailed")),
            );
          }}><Copy className="mr-2 h-4 w-4" />{t("finish.copyId")}</Button>
        </div>
      ))}
    </section>
  );
}