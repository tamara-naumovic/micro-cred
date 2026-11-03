import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import {
  CLIENT_EVENT_TYPES, IDLE_PAUSE_MS, accumulateActive, nextAttemptNumber, outcomeOnComplete,
  outcomeOnSkip, pageEventFor, sanitizeMeta, type Outcome,
} from "./logic";

export type EvalScenario = {
  id: string; code: string; sort_order: number; success_rule_key: string; start_path: string | null; branch_group: string | null;
  title_en: string; title_sr: string; situation_en: string; situation_sr: string;
  steps_en: string[]; steps_sr: string[]; success_en: string; success_sr: string;
};
export type EvalAttempt = {
  id: string; session_id: string; assignment_id: string; scenario_id: string; attempt_number: number;
  status: string; outcome: string; started_at: string; ended_at: string | null; last_resumed_at: string | null;
  active_duration_ms: number; help_duration_ms: number; help_count: number; instructor_help_count: number;
  feedback_text: string | null;
};
type Assignment = { id: string; campaign_id: string; enabled: boolean; consent_status: string };

type Ctx = {
  assignment: Assignment | null;
  scenarios: EvalScenario[];
  attempts: EvalAttempt[];
  activeAttempt: EvalAttempt | null;
  activeScenario: EvalScenario | null;
  questionnaireUrl: string | null;
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  showInvite: boolean;
  helpOpen: boolean;
  accept: () => Promise<void>;
  postpone: () => Promise<void>;
  decline: () => Promise<void>;
  finishParticipation: () => Promise<void>;
  start: (s: EvalScenario) => Promise<string | null>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  skip: () => Promise<void>;
  complete: (selfReportedDone: boolean, feedback: string) => Promise<void>;
  openHelp: () => Promise<void>;
  closeHelp: () => Promise<void>;
  instructorHelp: (kind: "requested" | "received") => Promise<void>;
};

const EvalCtx = createContext<Ctx | null>(null);
export const useEvaluation = () => useContext(EvalCtx);

/** Called by sign-out so evaluation state is saved before the session ends (E11). */
let beforeSignOutHook: (() => Promise<void>) | null = null;
export async function runEvaluationBeforeSignOut() {
  try { await beforeSignOutHook?.(); } catch { /* never block sign-out */ }
}

const db = supabase as any;
const POSTPONE_KEY = (id: string) => `eval-postponed-${id}`;

export function EvaluationProvider({ children }: { children: ReactNode }) {
  const { activeUser } = useStore();
  const isEarner = activeUser?.role === "earner";
  const userId = activeUser?.id;
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [scenarios, setScenarios] = useState<EvalScenario[]>([]);
  const [attempts, setAttempts] = useState<EvalAttempt[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questionnaireUrl, setQuestionnaireUrl] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [postponed, setPostponed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpStartedAt = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!isEarner || !userId) { setAssignment(null); return; }
    const { data: a } = await db.from("evaluation_assignments")
      .select("id, campaign_id, enabled, consent_status, evaluation_campaigns(status, use_questionnaire_url, version)")
      .eq("user_id", userId).eq("enabled", true).order("invited_at", { ascending: false }).limit(1).maybeSingle();
    if (!a || a.evaluation_campaigns?.status !== "active") { setAssignment(null); return; }
    setAssignment({ id: a.id, campaign_id: a.campaign_id, enabled: a.enabled, consent_status: a.consent_status });
    setQuestionnaireUrl(a.evaluation_campaigns?.use_questionnaire_url ?? null);
    try { setPostponed(sessionStorage.getItem(POSTPONE_KEY(a.id)) === "1"); } catch { /* ignore */ }
    if (a.consent_status !== "accepted") return;
    const [{ data: sc }, { data: at }, { data: ses }] = await Promise.all([
      db.from("evaluation_scenarios").select("*").eq("role", "earner").eq("version", a.evaluation_campaigns?.version ?? "v1").order("sort_order"),
      db.from("evaluation_attempts").select("*").eq("assignment_id", a.id).order("started_at"),
      db.from("evaluation_sessions").select("id").eq("assignment_id", a.id).eq("status", "active").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setScenarios(sc ?? []);
    setAttempts(at ?? []);
    setSessionId(ses?.id ?? null);
  }, [isEarner, userId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const accepted = assignment?.consent_status === "accepted";
  const activeAttempt = useMemo(
    () => attempts.find((x) => x.status === "in_progress" || x.status === "paused") ?? null, [attempts]);
  const activeScenario = useMemo(
    () => scenarios.find((s) => s.id === activeAttempt?.scenario_id) ?? null, [scenarios, activeAttempt]);

  const logEvent = useCallback(async (type: string, meta?: Record<string, unknown>, attemptId?: string | null) => {
    if (!assignment || !accepted || !CLIENT_EVENT_TYPES.has(type)) return;
    await db.from("evaluation_events").insert({
      client_event_id: crypto.randomUUID(), assignment_id: assignment.id, session_id: sessionId,
      attempt_id: attemptId === undefined ? activeAttempt?.id ?? null : attemptId, event_type: type, source: "client",
      metadata: sanitizeMeta(meta),
    });
  }, [assignment, accepted, sessionId, activeAttempt]);

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    if (!assignment) return null;
    const device = typeof window !== "undefined" && window.innerWidth < 768 ? "mobile" : "desktop";
    const { data } = await db.from("evaluation_sessions").insert({ assignment_id: assignment.id, device_category: device, platform_version: "v1" }).select("id").single();
    if (data?.id) setSessionId(data.id);
    return data?.id ?? null;
  }, [sessionId, assignment]);

  const patchAttempt = useCallback(async (id: string, patch: Partial<EvalAttempt>) => {
    const { data } = await db.from("evaluation_attempts").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
    if (data) setAttempts((xs) => xs.map((x) => (x.id === id ? data : x)));
    return data as EvalAttempt | null;
  }, [assignment]);

  const freeze = (a: EvalAttempt) => ({
    active_duration_ms: accumulateActive(a.active_duration_ms, a.last_resumed_at, a.status, Date.now()),
    last_resumed_at: null,
  });

  const pause = useCallback(async () => {
    if (!activeAttempt || activeAttempt.status !== "in_progress") return;
    await patchAttempt(activeAttempt.id, { ...freeze(activeAttempt), status: "paused" });
    await logEvent("scenario_paused");
  }, [activeAttempt, patchAttempt, logEvent]);

  const resume = useCallback(async () => {
    if (!activeAttempt || activeAttempt.status !== "paused") return;
    const extra: Partial<EvalAttempt> = {};
    if (helpStartedAt.current) {
      extra.help_duration_ms = activeAttempt.help_duration_ms + (Date.now() - helpStartedAt.current);
      helpStartedAt.current = null;
      setHelpOpen(false);
    }
    await patchAttempt(activeAttempt.id, { ...extra, status: "in_progress", last_resumed_at: new Date().toISOString() });
    await logEvent("scenario_resumed");
  }, [activeAttempt, patchAttempt, logEvent]);

  const start = useCallback(async (s: EvalScenario) => {
    if (!assignment) return null;
    if (activeAttempt && activeAttempt.scenario_id === s.id) {
      if (activeAttempt.status === "paused") await resume();
      return s.start_path;
    }
    if (activeAttempt) {
      await patchAttempt(activeAttempt.id, { ...freeze(activeAttempt), status: "paused" });
      await logEvent("scenario_paused");
    }
    const sid = await ensureSession();
    if (!sid) return null;
    const { data } = await db.from("evaluation_attempts").insert({
      session_id: sid, assignment_id: assignment.id, scenario_id: s.id,
      attempt_number: nextAttemptNumber(attempts, s.id), status: "in_progress",
      last_resumed_at: new Date().toISOString(),
    }).select("*").single();
    if (data) {
      setAttempts((xs) => [...xs, data]);
      await logEvent("scenario_started", { scenario_code: s.code }, data.id);
    }
    return s.start_path;
  }, [assignment, activeAttempt, attempts, ensureSession, patchAttempt, logEvent, resume]);

  const skip = useCallback(async () => {
    if (!activeAttempt) return;
    const id = activeAttempt.id;
    await logEvent("scenario_skipped");
    await patchAttempt(id, { ...freeze(activeAttempt), status: "skipped", outcome: outcomeOnSkip(activeAttempt.outcome as Outcome), ended_at: new Date().toISOString() });
  }, [activeAttempt, patchAttempt, logEvent]);

  const complete = useCallback(async (selfReportedDone: boolean, feedback: string) => {
    if (!activeAttempt) return;
    const outcome = outcomeOnComplete(activeAttempt.outcome as Outcome, selfReportedDone);
    await logEvent("scenario_completed", { result: outcome });
    await patchAttempt(activeAttempt.id, {
      ...freeze(activeAttempt), status: "completed", outcome, ended_at: new Date().toISOString(),
      feedback_text: feedback.trim() ? feedback.trim().slice(0, 2000) : null,
      ...(outcome === "self_reported_success" ? { outcome_source: "self_report" } as any : {}),
    });
  }, [activeAttempt, patchAttempt, logEvent]);

  const openHelp = useCallback(async () => {
    if (!activeAttempt) return;
    helpStartedAt.current = Date.now();
    setHelpOpen(true);
    await patchAttempt(activeAttempt.id, {
      ...(activeAttempt.status === "in_progress" ? freeze(activeAttempt) : {}),
      status: "paused", help_count: activeAttempt.help_count + 1,
    });
    await logEvent("help_opened", { help_kind: "manual" });
  }, [activeAttempt, patchAttempt, logEvent]);

  const closeHelp = useCallback(async () => { await resume(); await logEvent("help_closed"); }, [resume, logEvent]);

  const instructorHelp = useCallback(async (kind: "requested" | "received") => {
    if (!activeAttempt) return;
    if (kind === "received") await patchAttempt(activeAttempt.id, { instructor_help_count: activeAttempt.instructor_help_count + 1 });
    await logEvent(kind === "requested" ? "instructor_help_requested" : "instructor_help_received", { help_kind: "instructor" });
  }, [activeAttempt, patchAttempt, logEvent]);

  const consent = useCallback(async (action: string) => {
    if (!assignment) return;
    await db.rpc("eval_set_consent", { _assignment_id: assignment.id, _action: action });
    await load();
  }, [assignment, load]);

  const accept = useCallback(async () => {
    await consent("accept");
    setPanelOpen(true);
  }, [consent]);
  useEffect(() => {
    // create the session right after consent is first loaded
    if (accepted && !sessionId && assignment) void ensureSession().then((sid) => { if (sid) void logEvent("session_started", {}, null); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accepted, sessionId, assignment?.id]);

  const postpone = useCallback(async () => {
    if (!assignment) return;
    try { sessionStorage.setItem(POSTPONE_KEY(assignment.id), "1"); } catch { /* ignore */ }
    setPostponed(true);
    await consent("postpone");
  }, [assignment, consent]);
  const decline = useCallback(async () => { await consent("decline"); }, [consent]);
  const finishParticipation = useCallback(async () => {
    if (activeAttempt) await patchAttempt(activeAttempt.id, { ...freeze(activeAttempt), status: "abandoned", ended_at: new Date().toISOString() });
    await logEvent("session_finished", {}, null);
    await consent("finish");
    setPanelOpen(false);
  }, [activeAttempt, patchAttempt, logEvent, consent]);

  // Semantic page events while a scenario is active.
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  useEffect(() => {
    if (!activeAttempt || activeAttempt.status !== "in_progress") return;
    const ev = pageEventFor(pathname);
    if (ev) void logEvent(ev, { page_type: ev.replace("_viewed", "") });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, activeAttempt?.id]);

  // Auto-pause after 60s without interaction or when the tab is hidden.
  const lastInteraction = useRef(Date.now());
  useEffect(() => {
    if (!activeAttempt || activeAttempt.status !== "in_progress") return;
    const bump = () => { lastInteraction.current = Date.now(); };
    const evs = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const onVis = () => { if (document.visibilityState === "hidden") void pause(); };
    document.addEventListener("visibilitychange", onVis);
    const iv = window.setInterval(() => {
      if (Date.now() - lastInteraction.current > IDLE_PAUSE_MS) void pause();
    }, 5000);
    bump();
    return () => {
      evs.forEach((e) => window.removeEventListener(e, bump));
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(iv);
    };
  }, [activeAttempt, pause]);

  // Save evaluation state before sign-out; E11 success = signed out of a protected area.
  useEffect(() => {
    beforeSignOutHook = async () => {
      if (!activeAttempt) return;
      if (activeScenario?.code === "E11") {
        await logEvent("logout_completed", { scenario_code: "E11" });
        await patchAttempt(activeAttempt.id, { ...freeze(activeAttempt), status: "completed", outcome: "verified_success", ended_at: new Date().toISOString(), outcome_source: "logout" } as any);
      } else if (activeAttempt.status === "in_progress") {
        await patchAttempt(activeAttempt.id, { ...freeze(activeAttempt), status: "paused" });
      }
    };
    return () => { beforeSignOutHook = null; };
  }, [activeAttempt, activeScenario, logEvent, patchAttempt]);

  const value: Ctx | null = assignment ? {
    assignment, scenarios, attempts, activeAttempt, activeScenario, questionnaireUrl, panelOpen, setPanelOpen,
    showInvite: assignment.consent_status === "invited" && !postponed, helpOpen,
    accept, postpone, decline, finishParticipation, start, pause, resume, skip, complete, openHelp, closeHelp, instructorHelp,
  } : null;

  return <EvalCtx.Provider value={value}>{children}</EvalCtx.Provider>;
}
