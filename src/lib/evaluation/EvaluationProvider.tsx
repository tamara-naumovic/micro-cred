import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { loadEarnerScenarios } from "./scenarios";
import {
  CLIENT_EVENT_TYPES, HEARTBEAT_MS, INSTRUCTOR_DEDUPE_MS, TIMER_DEFINITION_VERSION, accumulateActive, recoverActive, nextAttemptNumber, outcomeOnComplete,
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
  feedback_text: string | null; help_started_at?: string | null; last_heartbeat_at?: string | null; timer_quality?: string;
};
type Assignment = { id: string; campaign_id: string; enabled: boolean; consent_status: string; anonymous_export_id: string };

type Ctx = {
  assignment: Assignment | null;
  scenarios: EvalScenario[];
  attempts: EvalAttempt[];
  activeAttempt: EvalAttempt | null;
  activeScenario: EvalScenario | null;
  questionnaireUrl: string | null;
  participantId: string;
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
let eventHook: ((type: string) => void) | null = null;
/** Lets platform components (e.g. share dialog) report a whitelisted event; no-op outside an active attempt. */
export function trackEvaluationEvent(type: string) { try { eventHook?.(type); } catch { /* ignore */ } }
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
  const recovered = useRef(false);
  const lastInstructor = useRef<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!isEarner || !userId) { setAssignment(null); return; }
    const { data: a } = await db.from("evaluation_assignments")
      .select("id, campaign_id, enabled, consent_status, anonymous_export_id, evaluation_campaigns(status, use_questionnaire_url, version)")
      .eq("user_id", userId).eq("enabled", true).order("invited_at", { ascending: false }).limit(1).maybeSingle();
    if (!a || a.evaluation_campaigns?.status !== "active") { setAssignment(null); return; }
    setAssignment({ id: a.id, campaign_id: a.campaign_id, enabled: a.enabled, consent_status: a.consent_status, anonymous_export_id: a.anonymous_export_id });
    setQuestionnaireUrl(a.evaluation_campaigns?.use_questionnaire_url ?? null);
    try { setPostponed(sessionStorage.getItem(POSTPONE_KEY(a.id)) === "1"); } catch { /* ignore */ }
    if (a.consent_status !== "accepted") return;
    const [sc, { data: at }, { data: ses }] = await Promise.all([
      loadEarnerScenarios<EvalScenario>(a.evaluation_campaigns?.version),
      db.from("evaluation_attempts").select("*").eq("assignment_id", a.id).order("started_at"),
      db.from("evaluation_sessions").select("id").eq("assignment_id", a.id).eq("status", "active").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setScenarios(sc);
    let list: EvalAttempt[] = at ?? [];
    // First load in this tab: an attempt still "in progress" was left by a reload / closed browser.
    // Credit its interval only up to the last heartbeat and mark the timing as uncertain.
    if (!recovered.current) {
      recovered.current = true;
      const stale = list.find((x) => x.status === "in_progress");
      if (stale) {
        const { data: fixed } = await db.from("evaluation_attempts").update({
          status: "paused", last_resumed_at: null, timer_quality: "uncertain",
          active_duration_ms: recoverActive(stale.active_duration_ms, stale.last_resumed_at, stale.last_heartbeat_at ?? null),
          updated_at: new Date().toISOString(),
        }).eq("id", stale.id).select("*").single();
        if (fixed) list = list.map((x) => (x.id === fixed.id ? fixed : x));
      }
    }
    const open = list.find((x) => x.status === "paused" && x.help_started_at);
    setHelpOpen(!!open);
    setAttempts(list);
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
    if (!assignment || !accepted || !CLIENT_EVENT_TYPES.has(type)) return false;
    const { error } = await db.from("evaluation_events").insert({
      client_event_id: crypto.randomUUID(), assignment_id: assignment.id, session_id: sessionId,
      attempt_id: attemptId === undefined ? activeAttempt?.id ?? null : attemptId, event_type: type, source: "client",
      metadata: sanitizeMeta(meta),
    });
    return !error;
  }, [assignment, accepted, sessionId, activeAttempt]);

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    if (!assignment) return null;
    const device = typeof window !== "undefined" && window.innerWidth < 768 ? "mobile" : "desktop";
    const { data } = await db.from("evaluation_sessions").insert({ assignment_id: assignment.id, device_category: device, platform_version: "v1" }).select("id").single();
    if (data?.id) setSessionId(data.id);
    return data?.id ?? null;
  }, [sessionId, assignment]);

  const refreshAfterFinalize = useCallback(async (id: string) => {
    try { await db.rpc("eval_finalize_attempt", { _attempt_id: id }); } catch { /* keep client state */ }
    const { data } = await db.from("evaluation_attempts").select("*").eq("id", id).single();
    if (data) setAttempts((xs) => xs.map((x) => (x.id === id ? data : x)));
  }, []);

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
    if (activeAttempt.help_started_at) {
      extra.help_duration_ms = activeAttempt.help_duration_ms + Math.max(0, Date.now() - new Date(activeAttempt.help_started_at).getTime());
      extra.help_started_at = null;
      setHelpOpen(false);
    }
    const now = new Date().toISOString();
    await patchAttempt(activeAttempt.id, { ...extra, status: "in_progress", last_resumed_at: now, last_heartbeat_at: now });
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
      last_resumed_at: new Date().toISOString(), last_heartbeat_at: new Date().toISOString(),
      timer_definition_version: TIMER_DEFINITION_VERSION,
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
    setPanelOpen(true);
  }, [activeAttempt, patchAttempt, logEvent]);

  const complete = useCallback(async (selfReportedDone: boolean, feedback: string) => {
    if (!activeAttempt) return;
    // Read the current row: the server may have verified the task since this tab last loaded it.
    const { data: fresh } = await db.from("evaluation_attempts").select("outcome").eq("id", activeAttempt.id).single();
    const outcome = outcomeOnComplete((fresh?.outcome ?? activeAttempt.outcome) as Outcome, selfReportedDone);
    await logEvent("scenario_completed", { result: outcome });
    await patchAttempt(activeAttempt.id, {
      ...freeze(activeAttempt), status: "completed", outcome, ended_at: new Date().toISOString(),
      feedback_text: feedback.trim() ? feedback.trim().slice(0, 2000) : null,
    });
    await refreshAfterFinalize(activeAttempt.id);
    setPanelOpen(true);
  }, [activeAttempt, patchAttempt, logEvent]);

  const openHelp = useCallback(async () => {
    if (!activeAttempt || activeAttempt.help_started_at) return;
    setHelpOpen(true);
    await patchAttempt(activeAttempt.id, {
      ...(activeAttempt.status === "in_progress" ? freeze(activeAttempt) : {}),
      status: "paused", help_count: activeAttempt.help_count + 1, help_started_at: new Date().toISOString(),
    });
    await logEvent("help_opened", { help_kind: "manual" });
  }, [activeAttempt, patchAttempt, logEvent]);

  const closeHelp = useCallback(async () => { await resume(); await logEvent("help_closed"); }, [resume, logEvent]);

  const instructorHelp = useCallback(async (kind: "requested" | "received") => {
    if (!activeAttempt) throw new Error("No active evaluation attempt");
    const key = `${activeAttempt.id}:${kind}`;
    const now = Date.now();
    if (now - (lastInstructor.current[key] ?? 0) < INSTRUCTOR_DEDUPE_MS) return; // double click
    lastInstructor.current[key] = now;
    const saved = await logEvent(kind === "requested" ? "instructor_help_requested" : "instructor_help_received", { help_kind: "instructor" });
    if (!saved) throw new Error("Could not record instructor help");
    if (kind === "received") {
      const updated = await patchAttempt(activeAttempt.id, { instructor_help_count: activeAttempt.instructor_help_count + 1 });
      if (!updated) throw new Error("Could not update instructor help count");
    }
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

  // Timer t2: no idle auto-pause (reading counts as activity). Hidden tab pauses; a heartbeat bounds
  // what a reload / closed browser can credit; pagehide tries to freeze the interval.
  useEffect(() => {
    if (!activeAttempt || activeAttempt.status !== "in_progress") return;
    const onVis = () => { if (document.visibilityState === "hidden") void pause(); };
    const onHide = () => { void pause(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    const id = activeAttempt.id;
    const iv = window.setInterval(() => {
      if (document.visibilityState === "visible") void db.from("evaluation_attempts").update({ last_heartbeat_at: new Date().toISOString() }).eq("id", id);
    }, HEARTBEAT_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      window.clearInterval(iv);
    };
  }, [activeAttempt, pause]);

  useEffect(() => {
    eventHook = (type) => { if (activeAttempt) void logEvent(type); };
    return () => { eventHook = null; };
  }, [activeAttempt, logEvent]);

  // Save evaluation state before sign-out; E11 success = signed out of a protected area.
  useEffect(() => {
    beforeSignOutHook = async () => {
      if (!activeAttempt) return;
      if (activeScenario?.code === "E11") {
        // Server records the logout (and verifies E11) before the session is destroyed.
        await db.rpc("eval_record_logout");
        await patchAttempt(activeAttempt.id, { ...freeze(activeAttempt), status: "completed", ended_at: new Date().toISOString() });
      } else if (activeAttempt.status === "in_progress") {
        await patchAttempt(activeAttempt.id, { ...freeze(activeAttempt), status: "paused" });
      }
    };
    return () => { beforeSignOutHook = null; };
  }, [activeAttempt, activeScenario, logEvent, patchAttempt]);

  const value: Ctx | null = assignment ? {
    assignment, scenarios, attempts, activeAttempt, activeScenario, questionnaireUrl, participantId: assignment.anonymous_export_id, panelOpen, setPanelOpen,
    showInvite: assignment.consent_status === "invited" && !postponed, helpOpen,
    accept, postpone, decline, finishParticipation, start, pause, resume, skip, complete, openHelp, closeHelp, instructorHelp,
  } : null;

  return <EvalCtx.Provider value={value}>{children}</EvalCtx.Provider>;
}
