import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FlaskConical, Pause, Play, SkipForward, LifeBuoy, CheckCircle2, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useEvaluation, type EvalScenario } from "@/lib/evaluation/EvaluationProvider";
import { accumulateActive, scenarioStatus } from "@/lib/evaluation/logic";

function useLoc() {
  const { i18n } = useTranslation();
  const sr = i18n.language?.startsWith("sr");
  return (s: EvalScenario, f: "title" | "situation" | "success") => (sr ? s[`${f}_sr`] : s[`${f}_en`]);
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function EvaluationHeaderButton() {
  const ev = useEvaluation();
  const { t } = useTranslation("evaluation");
  if (!ev || ev.assignment?.consent_status !== "accepted") {
    if (ev?.assignment?.consent_status === "invited")
      return (
        <Button variant="outline" size="sm" className="gap-2" onClick={() => ev.setPanelOpen(true)}>
          <FlaskConical className="h-4 w-4" /> <span className="hidden md:inline">{t("header.invited")}</span>
        </Button>
      );
    return null;
  }
  return (
    <Button variant="outline" size="sm" className="gap-2 border-primary/40" onClick={() => ev.setPanelOpen(true)}>
      <FlaskConical className="h-4 w-4 text-primary" /> <span className="hidden md:inline">{t("header.inProgress")}</span>
    </Button>
  );
}

export function EvaluationInviteDialog() {
  const ev = useEvaluation();
  const { t } = useTranslation("evaluation");
  const open = !!ev && (ev.showInvite || (ev.panelOpen && ev.assignment?.consent_status === "invited"));
  if (!ev) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { ev.setPanelOpen(false); if (ev.showInvite) void ev.postpone(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("invite.title")}</DialogTitle>
          <DialogDescription>{t("invite.intro")}</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>{t("invite.data")}</li>
          <li>{t("invite.notCollected")}</li>
          <li>{t("invite.voluntary")}</li>
          <li>{t("invite.skip")}</li>
        </ul>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => { void ev.decline(); ev.setPanelOpen(false); }}>{t("invite.decline")}</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { void ev.postpone(); ev.setPanelOpen(false); }}>{t("invite.later")}</Button>
            <Button onClick={() => void ev.accept()}>{t("invite.accept")}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EvaluationDrawer() {
  const ev = useEvaluation();
  const { t } = useTranslation("evaluation");
  const loc = useLoc();
  const navigate = useNavigate();
  const [confirmFinish, setConfirmFinish] = useState(false);
  if (!ev || ev.assignment?.consent_status !== "accepted") return null;
  const statuses = ev.scenarios.map((s) => scenarioStatus(ev.attempts, s.id));
  const processed = statuses.filter((s) => s === "completed" || s === "skipped").length;
  const counts = (k: string) => statuses.filter((s) => s === k).length;

  const go = async (s: EvalScenario) => {
    const path = await ev.start(s);
    ev.setPanelOpen(false);
    if (path) navigate({ to: path });
  };

  return (
    <Sheet open={ev.panelOpen} onOpenChange={ev.setPanelOpen}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("drawer.title")}</SheetTitle>
          <SheetDescription>{t("drawer.intro")}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 text-sm font-medium">{t("drawer.progress", { done: processed, total: ev.scenarios.length })}</div>
        <div className="mt-4 space-y-3">
          {ev.scenarios.map((s, i) => {
            const st = statuses[i];
            const isActive = ev.activeAttempt?.scenario_id === s.id;
            return (
              <div key={s.id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono text-muted-foreground">{s.code}{s.branch_group ? ` · ${t("drawer.branch")}` : ""}</div>
                    <div className="font-medium">{loc(s, "title")}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{loc(s, "situation")}</p>
                  </div>
                  <Badge variant={st === "completed" ? "default" : "outline"}>{t(`status.${st}`)}</Badge>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant={isActive ? "default" : "outline"} onClick={() => void go(s)}>
                    {isActive ? t("actions.continue") : st === "not_started" ? t("actions.start") : st === "skipped" || st === "abandoned" ? t("actions.resume") : t("actions.repeat")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-6 space-y-2 border-t border-border pt-4">
          {confirmFinish ? (
            <div className="space-y-2 text-sm">
              <div className="font-medium">{t("finish.summary")}</div>
              <div className="text-muted-foreground">
                {t("status.completed")}: {counts("completed")} · {t("status.skipped")}: {counts("skipped")} · {t("status.in_progress")}: {counts("in_progress") + counts("paused")} · {t("status.not_started")}: {counts("not_started")}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setConfirmFinish(false)}>{t("actions.cancel")}</Button>
                <Button size="sm" onClick={() => void ev.finishParticipation()}>{t("finish.confirm")}</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setConfirmFinish(true)}>{t("finish.button")}</Button>
          )}
          {ev.questionnaireUrl && (
            <a className="block text-center text-sm text-primary underline" href={ev.questionnaireUrl} target="_blank" rel="noreferrer">{t("finish.questionnaire")}</a>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function EvaluationTaskPanel() {
  const ev = useEvaluation();
  const { t } = useTranslation("evaluation");
  const { i18n } = useTranslation();
  const loc = useLoc();
  const [collapsed, setCollapsed] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [done, setDone] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [instructorPending, setInstructorPending] = useState(false);
  const [instructorFeedback, setInstructorFeedback] = useState<"requested" | "received" | "error" | null>(null);
  const [, tick] = useState(0);
  useEffect(() => { const iv = window.setInterval(() => tick((x) => x + 1), 1000); return () => window.clearInterval(iv); }, []);
  useEffect(() => { setInstructorFeedback(null); }, [ev?.activeAttempt?.id, ev?.helpOpen]);
  if (!ev?.activeAttempt || !ev.activeScenario) return null;
  const a = ev.activeAttempt;
  const s = ev.activeScenario;
  const steps = i18n.language?.startsWith("sr") ? s.steps_sr : s.steps_en;
  const elapsed = accumulateActive(a.active_duration_ms, a.last_resumed_at, a.status, Date.now());
  const paused = a.status === "paused";
  const serverVerified = s.success_rule_key.startsWith("server");
  const recordInstructorHelp = async (kind: "requested" | "received") => {
    if (instructorPending) return;
    setInstructorPending(true);
    setInstructorFeedback(null);
    try {
      await ev.instructorHelp(kind);
      setInstructorFeedback(kind);
    } catch {
      setInstructorFeedback("error");
    } finally {
      setInstructorPending(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border bg-card text-card-foreground shadow-lg">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">{t("panel.label")} · {s.code} · {fmt(elapsed)}{paused ? ` · ${t("status.paused")}` : ""}</div>
          <div className="truncate text-sm font-medium">{loc(s, "title")}</div>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCollapsed((c) => !c)} aria-label={t("panel.toggle")}>
          {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>
      {!collapsed && (
        <div className="space-y-3 p-3 text-sm">
          {ev.helpOpen ? (
            <div className="space-y-2">
              <p className="text-muted-foreground">{t("help.opened")}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={instructorPending} onClick={() => void recordInstructorHelp("requested")}>{t("help.needInstructor")}</Button>
                <Button size="sm" variant="outline" disabled={instructorPending} onClick={() => void recordInstructorHelp("received")}>{t("help.instructorHelped")}</Button>
              </div>
              {instructorPending && <p role="status" className="text-xs text-muted-foreground">{t("help.saving")}</p>}
              {instructorFeedback && (
                <p role={instructorFeedback === "error" ? "alert" : "status"} className={instructorFeedback === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                  {t(`help.${instructorFeedback}`)}
                </p>
              )}
              <Button size="sm" className="w-full" disabled={instructorPending} onClick={() => void ev.closeHelp()}>{t("help.back")}</Button>
            </div>
          ) : finishing ? (
            <div className="space-y-2">
              {!serverVerified && (
                <label className="flex items-center gap-2">
                  <Checkbox checked={done} onCheckedChange={(v) => setDone(!!v)} /> {t("panel.selfReport")}
                </label>
              )}
              {serverVerified && <p className="text-xs text-muted-foreground">{t("panel.serverNote")}</p>}
              <Textarea rows={2} placeholder={t("panel.feedback")} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setFinishing(false)}>{t("actions.cancel")}</Button>
                <Button size="sm" onClick={async () => { await ev.complete(serverVerified ? false : done, feedback); setFinishing(false); setFeedback(""); }}>{t("actions.save")}</Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground">{loc(s, "situation")}</p>
              <ol className="list-decimal space-y-0.5 pl-5">{steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
              <p className="text-xs"><span className="font-medium">{t("panel.success")}:</span> {loc(s, "success")}</p>
              {a.outcome === "verified_success" && (
                <p className="flex items-center gap-1 text-xs font-medium text-primary"><CheckCircle2 className="h-3.5 w-3.5" /> {t("panel.verified")}</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {paused ? (
                  <Button size="sm" variant="outline" onClick={() => void ev.resume()}><Play className="mr-1 h-3.5 w-3.5" />{t("actions.resume")}</Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => void ev.pause()}><Pause className="mr-1 h-3.5 w-3.5" />{t("actions.pause")}</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => void ev.skip()}><SkipForward className="mr-1 h-3.5 w-3.5" />{t("actions.skip")}</Button>
                <Button size="sm" variant="outline" asChild>
                  <a href="/earner/manual" target="_blank" rel="noopener noreferrer" onClick={() => { void ev.openHelp(); }}>
                    <LifeBuoy className="mr-1 h-3.5 w-3.5" />{t("actions.help")}
                  </a>
                </Button>
                <Button size="sm" onClick={() => setFinishing(true)}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />{t("actions.finish")}</Button>
              </div>
              <button className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground underline" onClick={() => ev.setPanelOpen(true)}>
                <X className="h-3 w-3" /> {t("panel.allScenarios")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
