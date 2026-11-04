import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildEvaluationWorkbook, readExportPages, scenarioMetrics, type EvaluationExportData } from "./workbook";

const fixture: EvaluationExportData = {
  campaign: { name: "Study", version: "v2" },
  assignments: [{ id: "private-assignment", user_id: "secret-account-id", email: "secret@example.com", anonymous_export_id: "P-TEST", consent_status: "finished", enabled: true }, { id: "empty", anonymous_export_id: "P-EMPTY", consent_status: "invited" }],
  scenarios: [{ id: "s1", code: "E1", title_en: "Task", title_sr: "Zadatak", version: "v1" }, { id: "s2", code: "E2", title_en: "Next", version: "v1" }],
  attempts: [
    { id: "a1", assignment_id: "private-assignment", scenario_id: "s1", attempt_number: 1, status: "skipped", outcome: "not_assessed", active_duration_ms: 9000, help_duration_ms: 500, help_count: 1 },
    { id: "a2", assignment_id: "private-assignment", scenario_id: "s1", attempt_number: 2, status: "completed", outcome: "verified_success", active_duration_ms: 1234, help_duration_ms: 2500, help_count: 2, instructor_help_count: 1, error_count: 3, feedback_text: '=HYPERLINK("evil")' },
    { id: "a3", assignment_id: "private-assignment", scenario_id: "s1", attempt_number: 3, status: "completed", outcome: "self_reported_success", active_duration_ms: 2468 },
  ],
  events: [{ assignment_id: "private-assignment", attempt_id: "a2", event_type: "instructor_help_requested", metadata: { user_id: "secret-account-id", email: "secret@example.com", help_kind: "instructor" } }],
  sessions: [{ assignment_id: "private-assignment", id: "private-session", started_at: "2026-11-04T09:00:00Z", status: "active" }],
};

describe("evaluation XLSX export", () => {
  it("includes a summary and one sheet per pseudonymous participant", async () => {
    const wb = await buildEvaluationWorkbook(fixture);
    expect(wb.worksheets.map((s) => s.name)).toEqual(["Scenario summary", "P1-P-TEST", "P2-P-EMPTY"]);
    expect(wb.worksheets[1].getCell("C11").value).toBe(1);
    expect(wb.worksheets[1].getCell("C13").value).toBe(3);
    expect(wb.worksheets[2].getCell("D11").value).toBe("not_started");
    expect(wb.worksheets[2].getCell("E11").value).toBe("not_assessed");
  });
  it("exports all stored attempt metrics and feedback without losing milliseconds", async () => {
    const wb = await buildEvaluationWorkbook(fixture);
    const sheet = wb.worksheets[1];
    expect(sheet.getCell("I12").value).toBe(1.234);
    expect(sheet.getCell("J12").value).toBe(2.5);
    expect(sheet.getCell("K12").value).toBe(2);
    expect(sheet.getCell("L12").value).toBe(1);
    expect(sheet.getCell("M12").value).toBe(3);
    expect(sheet.getCell("P12").value).toBe(1);
    expect(sheet.getCell("H12").value).toBeNull();
  });
  it("uses completed-only medians and keeps skipped/verified/self-reported separate", () => {
    expect(scenarioMetrics(fixture.attempts)).toMatchObject({ attempts: 3, participants: 1, completed: 2, skipped: 1, verified: 1, selfReported: 1, failed: 0, notAssessed: 1, medianSeconds: 1.851, errors: 3, helpCount: 3 });
    expect(scenarioMetrics([]).medianSeconds).toBeNull();
  });
  it("writes dynamic summary formulas with correct cached results and no zero-denominator errors", async () => {
    const wb = await buildEvaluationWorkbook(fixture);
    expect(wb.worksheets[0].getCell("C11").value).toMatchObject({ result: 3 });
    expect(wb.worksheets[0].getCell("D11").value).toMatchObject({ result: 1 });
    expect(wb.worksheets[0].getCell("O11").value).toMatchObject({ result: 1.851 });
    expect(wb.worksheets[0].getCell("O12").formula).toContain('=0,"",MEDIAN(');
    expect(wb.worksheets[0].getCell("O12").result).toBe("");
    const empty = await buildEvaluationWorkbook({ ...fixture, assignments: [], attempts: [], events: [], sessions: [] });
    expect(empty.worksheets[0].getCell("C11").value).toEqual({ formula: "0", result: 0 });
  });
  it("never exports account identifiers or raw metadata; feedback remains text, not a formula", async () => {
    const wb = await buildEvaluationWorkbook(fixture);
    const serialized = JSON.stringify(wb.worksheets.map((s) => s.getSheetValues()));
    for (const secret of ["private-assignment", "secret-account-id", "secret@example.com", "private-session"]) expect(serialized).not.toContain(secret);
    const bytes = await wb.xlsx.writeBuffer();
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(bytes);
    expect(loaded.worksheets[1].getCell("N12").type).toBe(ExcelJS.ValueType.String);
    expect(loaded.worksheets[1].getCell("N12").value).toBe('=HYPERLINK("evil")');
  });
  it("reads beyond one database page without dropping any rows", async () => {
    const values = Array.from({ length: 1201 }, (_, id) => ({ id }));
    const result = await readExportPages(async (from, to) => ({ data: values.slice(from, to + 1), error: null }));
    expect(result).toEqual(values);
  });
  it("fails on a later database error instead of delivering a partial workbook", async () => {
    await expect(readExportPages(async (from) => from === 0 ? { data: Array(500).fill({}), error: null } : { data: null, error: { message: "Denied" } })).rejects.toThrow("Denied");
  });
});