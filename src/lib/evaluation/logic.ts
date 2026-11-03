// Pure rules for the Evaluation Mode module (no I/O). Covered by logic.test.ts.

export type AttemptStatus = "not_started" | "in_progress" | "paused" | "completed" | "skipped" | "abandoned";
export type Outcome = "verified_success" | "self_reported_success" | "partial" | "failed" | "not_assessed";

export const IDLE_PAUSE_MS = 60_000;

export const DEFAULT_SCENARIO_VERSION = "v1";

/** Only an empty successful read falls back; errors must remain errors. */
export async function loadScenarioVersion<T>(
  version: string | null | undefined,
  fetchVersion: (version: string) => Promise<T[]>,
): Promise<T[]> {
  const requested = version || DEFAULT_SCENARIO_VERSION;
  const scenarios = await fetchVersion(requested);
  if (scenarios.length || requested === DEFAULT_SCENARIO_VERSION) return scenarios;
  return fetchVersion(DEFAULT_SCENARIO_VERSION);
}

export function availableScenarioVersions(rows: { version: string }[]): string[] {
  return [...new Set(rows.map((row) => row.version).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }));
}

/** Active time accumulated so far, including the currently running interval. */
export function accumulateActive(activeMs: number, lastResumedAt: string | null, status: string, now: number): number {
  if (status !== "in_progress" || !lastResumedAt) return activeMs;
  const delta = now - new Date(lastResumedAt).getTime();
  return activeMs + Math.max(0, delta);
}

/** Outcome after the user skips: skipping is never a failure. */
export function outcomeOnSkip(current: Outcome): Outcome {
  return current === "verified_success" ? current : "not_assessed";
}

/** Outcome after "Finish scenario": keep a server-verified success, else self-report if the user says so. */
export function outcomeOnComplete(current: Outcome, selfReportedDone: boolean): Outcome {
  if (current === "verified_success") return current;
  return selfReportedDone ? "self_reported_success" : "not_assessed";
}

/** Re-opening a scenario always creates a new attempt; history is preserved. */
export function nextAttemptNumber(attempts: { scenario_id: string; attempt_number: number }[], scenarioId: string): number {
  const nums = attempts.filter((a) => a.scenario_id === scenarioId).map((a) => a.attempt_number);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

/** Latest attempt per scenario determines the displayed status. */
export function scenarioStatus(attempts: { scenario_id: string; attempt_number: number; status: string }[], scenarioId: string): AttemptStatus {
  const list = attempts.filter((a) => a.scenario_id === scenarioId).sort((a, b) => b.attempt_number - a.attempt_number);
  return (list[0]?.status as AttemptStatus) ?? "not_started";
}

export const ALLOWED_META_KEYS = ["page_type", "scenario_code", "result", "error_category", "entity_type", "elapsed_ms", "help_kind"] as const;

/** Drop any metadata key not on the whitelist and any non-primitive value. */
export function sanitizeMeta(meta: Record<string, unknown> | undefined): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!meta) return out;
  for (const k of ALLOWED_META_KEYS) {
    const v = meta[k];
    if (typeof v === "string") out[k] = v.slice(0, 80);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

export const CLIENT_EVENT_TYPES = new Set([
  "session_started", "session_finished", "scenario_started", "scenario_paused", "scenario_resumed",
  "scenario_skipped", "scenario_completed", "scenario_abandoned", "help_opened", "help_closed",
  "instructor_help_requested", "instructor_help_received", "dashboard_viewed", "catalog_viewed",
  "template_details_viewed", "applications_viewed", "credential_details_viewed", "credentials_viewed",
  "share_link_copied", "public_profile_viewed", "notification_opened", "settings_viewed",
  "logout_completed", "relevant_api_error", "page_viewed",
]);

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Map a pathname to a semantic page event (only earner pages are tracked). */
export function pageEventFor(pathname: string): string | null {
  if (pathname === "/earner") return "dashboard_viewed";
  if (pathname === "/earner/microcredential-templates") return "catalog_viewed";
  if (pathname.startsWith("/earner/microcredential-templates/")) return "template_details_viewed";
  if (pathname.startsWith("/earner/applications")) return "applications_viewed";
  if (pathname === "/earner/credentials") return "credentials_viewed";
  if (pathname.startsWith("/earner/credentials/")) return "credential_details_viewed";
  if (pathname.startsWith("/earner/profile")) return "public_profile_viewed";
  if (pathname.startsWith("/earner/notifications")) return "notification_opened";
  if (pathname.startsWith("/earner/settings")) return "settings_viewed";
  if (pathname.startsWith("/earner")) return "page_viewed";
  return null;
}
