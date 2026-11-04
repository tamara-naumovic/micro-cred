import { describe, it, expect } from "vitest";
import { accumulateActive, outcomeOnSkip, outcomeOnComplete, nextAttemptNumber, sanitizeMeta, scenarioStatus, loadScenarioVersion, availableScenarioVersions } from "./logic";

describe("evaluation rules", () => {
  it("falls back from an empty v2 to the default v1 scenarios", async () => {
    const calls: string[] = [];
    const result = await loadScenarioVersion("v2", async (version) => {
      calls.push(version);
      return version === "v1" ? [{ id: "v1-e1", code: "E1" }] : [];
    });
    expect(calls).toEqual(["v2", "v1"]);
    expect(result).toEqual([{ id: "v1-e1", code: "E1" }]);
  });
  it("keeps existing version-specific scenarios without loading v1", async () => {
    const calls: string[] = [];
    expect(await loadScenarioVersion("v2", async (version) => {
      calls.push(version);
      return [{ id: "v2-e1" }];
    })).toEqual([{ id: "v2-e1" }]);
    expect(calls).toEqual(["v2"]);
  });
  it("does not retry an empty v1 or hide a failed query", async () => {
    const calls: string[] = [];
    expect(await loadScenarioVersion("v1", async (version) => { calls.push(version); return []; })).toEqual([]);
    expect(calls).toEqual(["v1"]);
    await expect(loadScenarioVersion("v2", async () => { throw new Error("Denied"); })).rejects.toThrow("Denied");
  });
  it("offers only distinct versions present in the scenario data", () => {
    expect(availableScenarioVersions([{ version: "v1" }, { version: "v1" }, { version: "v10" }, { version: "v2" }])).toEqual(["v1", "v2", "v10"]);
    expect(availableScenarioVersions([])).toEqual([]);
  });
  it("skipped scenario is not_assessed, never failed", () => {
    expect(outcomeOnSkip("not_assessed")).toBe("not_assessed");
    expect(outcomeOnSkip("failed")).toBe("not_assessed");
  });
  it("server-verified success is kept on complete; self-report otherwise", () => {
    expect(outcomeOnComplete("verified_success", false)).toBe("verified_success");
    expect(outcomeOnComplete("not_assessed", true)).toBe("self_reported_success");
    expect(outcomeOnComplete("not_assessed", false)).toBe("not_assessed");
  });
  it("paused time is excluded from active duration", () => {
    const t0 = Date.parse("2026-01-01T10:00:00Z");
    expect(accumulateActive(5000, "2026-01-01T10:00:00Z", "paused", t0 + 999_999)).toBe(5000);
    expect(accumulateActive(5000, "2026-01-01T10:00:00Z", "in_progress", t0 + 3000)).toBe(8000);
  });
  it("re-opening creates a new attempt and keeps the old one", () => {
    const attempts = [{ scenario_id: "s1", attempt_number: 1, status: "skipped" }];
    expect(nextAttemptNumber(attempts, "s1")).toBe(2);
    expect(nextAttemptNumber(attempts, "s2")).toBe(1);
    expect(scenarioStatus([...attempts, { scenario_id: "s1", attempt_number: 2, status: "in_progress" }], "s1")).toBe("in_progress");
  });
  it("event metadata drops non-whitelisted keys like email", () => {
    expect(sanitizeMeta({ email: "a@b.c", scenario_code: "E3", token: "x" })).toEqual({ scenario_code: "E3" });
  });
});

import { computeScenarioMetrics, dedupeEvents, recoverActive } from "./logic";

describe("evaluation v2 rules", () => {
  it("after a reload, credits the running interval only up to the last heartbeat", () => {
    expect(recoverActive(1000, "2026-01-01T10:00:00Z", "2026-01-01T10:00:30Z")).toBe(31_000);
    expect(recoverActive(1000, "2026-01-01T10:00:00Z", null)).toBe(1000);
  });

  it("counts repeated instructor clicks within 3 s once", () => {
    const e = (t: string) => ({ attempt_id: "a", event_type: "instructor_help_received", occurred_at: t });
    expect(dedupeEvents([e("2026-01-01T10:00:00Z"), e("2026-01-01T10:00:01Z"), e("2026-01-01T10:00:10Z")])).toHaveLength(2);
  });

  it("verified rate excludes not-assessed and skipped attempts from the denominator", () => {
    const a = (id: string, status: string, outcome: string) => ({ id, assignment_id: "p", status, outcome, active_duration_ms: 1000, help_count: 0 });
    const m = computeScenarioMetrics([a("1", "completed", "verified_success"), a("2", "completed", "not_assessed"), a("3", "skipped", "not_assessed"), a("4", "completed", "partial")]);
    expect(m.verifiedRate).toBe(0.5);
    expect(m.notAssessed).toBe(2);
    expect(m.medianN).toBe(3);
  });

  it("help rate = attempts with a help_opened event / started attempts; instructor received counted separately", () => {
    const a = (id: string) => ({ id, assignment_id: "p", status: "completed", outcome: "not_assessed", active_duration_ms: 0, help_count: 0 });
    const m = computeScenarioMetrics([a("1"), a("2")], [
      { attempt_id: "1", event_type: "help_opened" },
      { attempt_id: "2", event_type: "instructor_help_received" },
    ]);
    expect(m.helpRate).toBe(0.5);
    expect(m.instructorRate).toBe(0.5);
    expect(m.instructorRequestedAttempts).toBe(0);
  });
});
