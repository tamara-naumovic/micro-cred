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
