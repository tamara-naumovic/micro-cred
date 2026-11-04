import ExcelJS from "exceljs";
import { median, sanitizeMeta } from "./logic";

type Row = Record<string, any>;
export interface EvaluationExportData {
  campaign: Row;
  assignments: Row[];
  scenarios: Row[];
  attempts: Row[];
  events: Row[];
  sessions: Row[];
}

const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const palette = { heading: "173C38", white: "FFFFFF", band: "E8F1EF", text: "172B29", input: "0000FF", link: "008000" };
const n = (value: unknown) => Number(value ?? 0);

/** All campaign reads are paginated; a failed page must not produce a partial report. */
export async function readExportPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await fetchPage(from, from + 499);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}

export function scenarioMetrics(attempts: Row[]) {
  const completed = attempts.filter((a) => a.status === "completed");
  const count = (key: string, value: string) => attempts.filter((a) => a[key] === value).length;
  const sum = (key: string) => attempts.reduce((total, a) => total + n(a[key]), 0);
  return {
    attempts: attempts.length, participants: new Set(attempts.map((a) => a.assignment_id)).size,
    completed: completed.length, skipped: count("status", "skipped"), abandoned: count("status", "abandoned"),
    verified: count("outcome", "verified_success"), selfReported: count("outcome", "self_reported_success"),
    partial: count("outcome", "partial"), failed: count("outcome", "failed"), notAssessed: count("outcome", "not_assessed"),
    activeSeconds: sum("active_duration_ms") / 1000, helpSeconds: sum("help_duration_ms") / 1000,
    medianSeconds: completed.length ? n(median(completed.map((a) => n(a.active_duration_ms)))) / 1000 : null,
    helpCount: sum("help_count"), instructorCount: sum("instructor_help_count"), errors: sum("error_count"),
  };
}

/** Deliberately export an allowlist, never user/account UUIDs or raw event metadata. */
export async function buildEvaluationWorkbook(data: EvaluationExportData, sr = false) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ISKRA";
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  const summary = workbook.addWorksheet(sr ? "Sumarni rezultati" : "Scenario summary");
  const title = (s: Row) => String((sr ? s.title_sr : s.title_en) ?? s.code);
  const note = sr
    ? "Vreme: sekunde; datumi: UTC. Medijana: samo završeni pokušaji. Preskočeno nije neuspeh. Ocene težine i odgovori iz eksternog upitnika trenutno se ne prikupljaju. Komentari su slobodan tekst i mogu sadržati lične podatke. Aktivni pokušaji prikazuju poslednje sačuvano vreme."
    : "Time: seconds; dates: UTC. Median: completed attempts only. Skipped is not failure. Difficulty ratings and external questionnaire answers are not currently collected. Free-text comments may contain personal information. Active attempts show last saved durations.";
  const intro = (sheet: ExcelJS.Worksheet, participant?: Row) => {
    sheet.addRow(["ISKRA", data.campaign.name]);
    sheet.addRow([sr ? "Verzija kampanje" : "Campaign version", data.campaign.version]);
    sheet.addRow([sr ? "Verzije scenarija" : "Scenario versions", [...new Set(data.scenarios.map((s) => s.version))].join(", ")]);
    sheet.addRow([sr ? "Izvoz (UTC)" : "Exported (UTC)", new Date().toISOString()]);
    if (participant) {
      sheet.addRow([sr ? "Pseudonim / Pristanak / Praćenje" : "Pseudonym / Consent / Tracking", participant.anonymous_export_id, participant.consent_status, participant.enabled]);
      sheet.addRow([sr ? "Pozvan / Prihvatio / Završio (UTC)" : "Invited / Consented / Finished (UTC)", participant.invited_at, participant.consented_at, participant.finished_at]);
      const sessions = data.sessions.filter((s) => s.assignment_id === participant.id);
      sheet.addRow([sr ? "Početak testiranja (UTC) / Broj sesija" : "Testing started (UTC) / Sessions", sessions.map((s) => s.started_at).sort()[0] ?? null, sessions.length]);
    }
    while (sheet.rowCount < 8) sheet.addRow([]);
    sheet.getCell("A9").value = note;
    sheet.mergeCells("A9:H9");
    sheet.getRow(9).height = 60;
    sheet.getCell("A9").alignment = { wrapText: true, vertical: "top" };
  };
  intro(summary);
  const ranges = new Map<string, { sheet: string; start: number; end: number }[]>();
  const attemptHeaders = sr
    ? ["Scenario", "Naslov", "Pokušaj", "Status", "Ishod", "Izvor ishoda", "Početak (UTC)", "Kraj (UTC)", "Aktivno vreme (s)", "Vreme pomoći (s)", "Broj pomoći", "Pomoć nastavnika", "Broj grešaka", "Komentar", "Završeno aktivno vreme (s)", "Zahtevi nastavniku"]
    : ["Scenario", "Title", "Attempt", "Status", "Outcome", "Outcome source", "Started (UTC)", "Ended (UTC)", "Active time (s)", "Help time (s)", "Help count", "Instructor help count", "Error count", "Feedback", "Completed active time (s)", "Instructor requests"];
  data.assignments.forEach((participant, index) => {
    const sheet = workbook.addWorksheet(`P${index + 1}-${String(participant.anonymous_export_id).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 18)}`);
    intro(sheet, participant);
    sheet.addRow(attemptHeaders);
    for (const scenario of data.scenarios) {
      const attempts = data.attempts.filter((a) => a.assignment_id === participant.id && a.scenario_id === scenario.id).sort((a, b) => a.attempt_number - b.attempt_number);
      const start = sheet.rowCount + 1;
      if (!attempts.length) sheet.addRow([scenario.code, title(scenario), null, "not_started", "not_assessed"]);
      for (const a of attempts) {
        const requests = data.events.filter((e) => e.attempt_id === a.id && e.event_type === "instructor_help_requested").length;
        const row = sheet.addRow([scenario.code, title(scenario), a.attempt_number, a.status, a.outcome, a.outcome_source, a.started_at, a.ended_at, n(a.active_duration_ms) / 1000, n(a.help_duration_ms) / 1000, n(a.help_count), n(a.instructor_help_count), n(a.error_count), a.feedback_text ?? null, a.status === "completed" ? n(a.active_duration_ms) / 1000 : null, requests]);
        for (const col of [9, 10, 15]) row.getCell(col).numFmt = '0.000;[Red](0.000);"-"';
      }
      const existing = ranges.get(scenario.id) ?? [];
      existing.push({ sheet: sheet.name, start, end: sheet.rowCount });
      ranges.set(scenario.id, existing);
    }
    sheet.addRow([]);
    const sessionHeader = sheet.addRow(sr ? ["Sesija", "Početak (UTC)", "Kraj (UTC)", "Status"] : ["Session", "Started (UTC)", "Ended (UTC)", "Status"]);
    data.sessions.filter((s) => s.assignment_id === participant.id).forEach((s, i) => sheet.addRow([i + 1, s.started_at, s.finished_at, s.status]));
    sheet.addRow([]);
    const eventHeader = sheet.addRow(sr ? ["Vreme događaja (UTC)", "Scenario", "Pokušaj", "Tip događaja", "Izvor", "Metapodaci"] : ["Event time (UTC)", "Scenario", "Attempt", "Event type", "Source", "Metadata"]);
    for (const e of data.events.filter((e) => e.assignment_id === participant.id)) {
      const a = data.attempts.find((a) => a.id === e.attempt_id);
      sheet.addRow([e.occurred_at, data.scenarios.find((s) => s.id === a?.scenario_id)?.code ?? null, a?.attempt_number ?? null, e.event_type, e.source, JSON.stringify(sanitizeMeta(e.metadata))]);
    }
    formatSheet(sheet, [10, sessionHeader.number, eventHeader.number], 16);
    const end = ranges.get(data.scenarios.at(-1)?.id)?.find((r) => r.sheet === sheet.name)?.end ?? 10;
    sheet.autoFilter = { from: "A10", to: `P${end}` };
  });
  summary.addRow(sr
    ? ["Scenario", "Naslov", "Pokušaji", "Učesnici", "Završeno", "Preskočeno", "Prekinuto", "Potvrđen uspeh", "Samoprijavljen uspeh", "Delimično", "Neuspeh", "Neprocenjeno", "Aktivno ukupno (s)", "Pomoć ukupno (s)", "Medijana završenih (s)", "Broj pomoći", "Pomoć nastavnika", "Greške", "Zahtevi nastavniku"]
    : ["Scenario", "Title", "Attempts", "Participants", "Completed", "Skipped", "Abandoned", "Verified success", "Self-reported success", "Partial", "Failed", "Not assessed", "Total active (s)", "Total help (s)", "Median completed (s)", "Help count", "Instructor help", "Errors", "Instructor requests"]);
  for (const s of data.scenarios) {
    const list = data.attempts.filter((a) => a.scenario_id === s.id);
    const m = scenarioMetrics(list);
    const rs = ranges.get(s.id) ?? [];
    const ref = (r: typeof rs[number], col: string) => `'${r.sheet}'!${col}${r.start}:${col}${r.end}`;
    const aggregate = (fn: string, col: string, criterion?: string) => rs.map((r) => `${fn}(${ref(r, col)}${criterion ? `,"${criterion}"` : ""})`).join("+") || "0";
    const formula = (f: string, result: number | null) => ({ formula: f, result: result ?? "" });
    const row = summary.addRow([s.code, title(s), formula(aggregate("COUNT", "C"), m.attempts), formula(rs.map((r) => `IF(COUNT(${ref(r, "C")})>0,1,0)`).join("+") || "0", m.participants),
      ...[["completed", m.completed], ["skipped", m.skipped], ["abandoned", m.abandoned]].map(([status, result]) => formula(aggregate("COUNTIF", "D", String(status)), Number(result))),
      ...[["verified_success", m.verified], ["self_reported_success", m.selfReported], ["partial", m.partial], ["failed", m.failed]].map(([outcome, result]) => formula(aggregate("COUNTIF", "E", String(outcome)), Number(result))),
      formula(rs.map((r) => `COUNTIFS(${ref(r, "E")},"not_assessed",${ref(r, "C")},">0")`).join("+") || "0", m.notAssessed),
      formula(aggregate("SUM", "I"), m.activeSeconds), formula(aggregate("SUM", "J"), m.helpSeconds),
      formula(rs.length ? `IF(COUNT(${rs.map((r) => ref(r, "O")).join(",")})=0,"",MEDIAN(${rs.map((r) => ref(r, "O")).join(",")}))` : '""', m.medianSeconds),
      formula(aggregate("SUM", "K"), m.helpCount), formula(aggregate("SUM", "L"), m.instructorCount), formula(aggregate("SUM", "M"), m.errors),
      formula(aggregate("SUM", "P"), data.events.filter((e) => e.event_type === "instructor_help_requested" && list.some((a) => a.id === e.attempt_id)).length)]);
    for (const col of [13, 14, 15]) row.getCell(col).numFmt = '0.000;[Red](0.000);"-"';
    row.getCell(4).note = sr ? "Različiti učesnici sa najmanje jednim pokušajem." : "Distinct participants with at least one attempt.";
  }
  formatSheet(summary, [10], 19);
  summary.autoFilter = { from: "A10", to: `S${Math.max(10, summary.rowCount)}` };
  return workbook;
}

function formatSheet(sheet: ExcelJS.Worksheet, headers: number[], columns: number) {
  sheet.views = [{ state: "frozen", ySplit: 10, xSplit: 2 }];
  sheet.properties.defaultRowHeight = 32;
  sheet.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  sheet.columns = Array.from({ length: columns }, (_, i) => ({ width: i === 1 ? 48 : i === 13 ? 55 : 24 }));
  sheet.eachRow((row) => row.eachCell((cell) => {
    cell.font = { name: "Arial", size: 10, color: { argb: typeof cell.value === "number" ? palette.input : palette.text } };
    cell.alignment = { vertical: "top", wrapText: true };
    if (cell.type === ExcelJS.ValueType.Formula) cell.font = { name: "Arial", size: 10, color: { argb: palette.link } };
  }));
  for (const number of [1, ...headers]) {
    const row = sheet.getRow(number);
    row.height = 42;
    for (let i = 1; i <= columns; i++) {
      const cell = row.getCell(i);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.heading } };
      cell.font = { name: "Arial", bold: true, size: 10, color: { argb: palette.white } };
    }
  }
  sheet.eachRow((row, index) => {
    if (index > 10 && index % 2 === 0 && !headers.includes(index)) row.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.band } }; });
    const values = Array.isArray(row.values) ? row.values : Object.values(row.values);
    const maxLength = Math.max(...values.filter((v) => typeof v === "string").map((v) => String(v).length), 0);
    if (index > 10) row.height = Math.min(409, Math.max(row.height ?? 32, Math.ceil(maxLength / 48) * 14));
  });
}

export async function evaluationWorkbookBlob(data: EvaluationExportData, sr: boolean): Promise<Blob> {
  const workbook = await buildEvaluationWorkbook(data, sr);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer)], { type: MIME });
}
