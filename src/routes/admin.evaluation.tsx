import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { median, toCsv } from "@/lib/evaluation/logic";
import { loadEarnerScenarios, loadEarnerScenarioVersions } from "@/lib/evaluation/scenarios";

export const Route = createFileRoute("/admin/evaluation")({
  head: () => ({
    meta: [
      { title: "Evaluation — ISKRA Admin" },
      { name: "description", content: "Task-based usability evaluation campaigns and results for ISKRA." },
      { property: "og:title", content: "Evaluation — ISKRA Admin" },
      { property: "og:description", content: "Task-based usability evaluation campaigns and results for ISKRA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGuard role="admin">
      <EvaluationAdmin />
    </RoleGuard>
  ),
});

const db = supabase as any;
type Row = Record<string, any>;

function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
const secs = (ms: number | null) => (ms == null ? "—" : `${Math.round(ms / 1000)} s`);

function EvaluationAdmin() {
  const { t, i18n } = useTranslation("evaluation");
  const { activeUser } = useStore();
  const sr = i18n.language?.startsWith("sr");
  const [campaigns, setCampaigns] = useState<Row[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [attempts, setAttempts] = useState<Row[]>([]);
  const [scenarios, setScenarios] = useState<Row[]>([]);
  const [earners, setEarners] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [versions, setVersions] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", version: "v1", starts_at: "", ends_at: "", use_questionnaire_url: "" });

  const loadCampaigns = useCallback(async () => {
    const { data } = await db.from("evaluation_campaigns").select("*").order("created_at", { ascending: false });
    setCampaigns(data ?? []);
    setCampaignId((c) => c ?? data?.[0]?.id ?? null);
  }, []);

  const loadCampaign = useCallback(async (id: string) => {
    const camp = campaigns.find((c) => c.id === id);
    const [{ data: a }, sc] = await Promise.all([
      db.from("evaluation_assignments").select("*").eq("campaign_id", id).order("invited_at"),
      loadEarnerScenarios<Row>(camp?.version),
    ]);
    setAssignments(a ?? []);
    setScenarios(sc);
    const ids = (a ?? []).map((x: Row) => x.id);
    if (ids.length) {
      const { data: at } = await db.from("evaluation_attempts").select("*").in("assignment_id", ids).order("started_at");
      setAttempts(at ?? []);
    } else setAttempts([]);
  }, [campaigns]);

  useEffect(() => { void loadCampaigns(); }, [loadCampaigns]);
  useEffect(() => {
    void loadEarnerScenarioVersions().then((available) => {
      setVersions(available);
      setForm((current) => ({ ...current, version: available.includes(current.version) ? current.version : available[0] ?? "" }));
    }).catch((error) => toast.error(error.message));
  }, []);
  useEffect(() => { if (campaignId) void loadCampaign(campaignId); }, [campaignId, loadCampaign]);
  useEffect(() => {
    (async () => {
      const { data: roles } = await db.from("user_roles").select("user_id").eq("role", "earner");
      const ids = [...new Set((roles ?? []).map((r: Row) => r.user_id))];
      if (!ids.length) return;
      const { data: profs } = await db.from("profiles").select("id, display_name, email").in("id", ids);
      setEarners(profs ?? []);
    })();
  }, []);

  const profileById = useMemo(() => new Map(earners.map((e) => [e.id, e])), [earners]);
  const assignedIds = new Set(assignments.map((a) => a.user_id));
  const matches = search.trim().length >= 2
    ? earners.filter((e) => !assignedIds.has(e.id) && `${e.display_name} ${e.email}`.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];

  const createCampaign = async () => {
    if (!form.name.trim() || !form.version.trim()) return;
    const { error } = await db.from("evaluation_campaigns").insert({
      name: form.name.trim(), version: form.version.trim(),
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : new Date().toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      use_questionnaire_url: form.use_questionnaire_url.trim() || null, created_by: activeUser?.id,
    });
    if (error) return toast.error(error.message);
    setForm({ name: "", version: versions.includes("v1") ? "v1" : versions[0] ?? "", starts_at: "", ends_at: "", use_questionnaire_url: "" });
    setCampaignId(null);
    await loadCampaigns();
  };

  const camp = campaigns.find((c) => c.id === campaignId);
  const toggleCampaign = async () => {
    if (!camp) return;
    await db.from("evaluation_campaigns").update({ status: camp.status === "active" ? "closed" : "active" }).eq("id", camp.id);
    await loadCampaigns();
  };
  const invite = async (userId: string) => {
    const { error } = await db.from("evaluation_assignments").insert({ campaign_id: campaignId, user_id: userId });
    if (error) return toast.error(error.message);
    setSearch("");
    await loadCampaign(campaignId!);
  };
  const toggleEnabled = async (a: Row) => {
    await db.from("evaluation_assignments").update({ enabled: !a.enabled, disabled_at: a.enabled ? new Date().toISOString() : null }).eq("id", a.id);
    await loadCampaign(campaignId!);
  };

  const summary = useMemo(() => scenarios.map((s) => {
    const list = attempts.filter((a) => a.scenario_id === s.id);
    const participants = new Set(list.map((a) => a.assignment_id));
    const helped = new Set(list.filter((a) => a.help_count > 0).map((a) => a.assignment_id));
    const instr = new Set(list.filter((a) => a.instructor_help_count > 0).map((a) => a.assignment_id));
    const completed = list.filter((a) => a.status === "completed");
    return {
      code: s.code, title: sr ? s.title_sr : s.title_en,
      attempts: list.length, participants: participants.size,
      completed: completed.length, skipped: list.filter((a) => a.status === "skipped").length,
      verified: list.filter((a) => a.outcome === "verified_success").length,
      self_reported: list.filter((a) => a.outcome === "self_reported_success").length,
      median_active_ms: median(completed.map((a) => Number(a.active_duration_ms))),
      help_participants: helped.size, instructor_participants: instr.size,
    };
  }), [scenarios, attempts, sr]);

  const pseudo = (assignmentId: string) => assignments.find((a) => a.id === assignmentId)?.anonymous_export_id ?? "";
  const code = (scenarioId: string) => scenarios.find((s) => s.id === scenarioId)?.code ?? "";

  const exportAll = async () => {
    const tag = (camp?.name ?? "campaign").replace(/\W+/g, "_");
    download(`${tag}_participants.csv`, toCsv(assignments.map((a) => ({
      participant: a.anonymous_export_id, consent_status: a.consent_status, enabled: a.enabled,
      invited_at: a.invited_at, consented_at: a.consented_at, declined_at: a.declined_at, finished_at: a.finished_at,
    }))));
    download(`${tag}_scenario_attempts.csv`, toCsv(attempts.map((a) => ({
      participant: pseudo(a.assignment_id), scenario: code(a.scenario_id), attempt_number: a.attempt_number,
      status: a.status, outcome: a.outcome, outcome_source: a.outcome_source, started_at: a.started_at, ended_at: a.ended_at,
      active_duration_ms: a.active_duration_ms, help_duration_ms: a.help_duration_ms, help_count: a.help_count,
      instructor_help_count: a.instructor_help_count, feedback: a.feedback_text,
    }))));
    const ids = assignments.map((a) => a.id);
    const { data: evs } = ids.length ? await db.from("evaluation_events").select("*").in("assignment_id", ids).order("occurred_at").limit(20000) : { data: [] };
    const attemptMap = new Map(attempts.map((a) => [a.id, a]));
    download(`${tag}_events.csv`, toCsv((evs ?? []).map((e: Row) => ({
      participant: pseudo(e.assignment_id), scenario: e.attempt_id ? code(attemptMap.get(e.attempt_id)?.scenario_id) : "",
      attempt_number: e.attempt_id ? attemptMap.get(e.attempt_id)?.attempt_number : "", event_type: e.event_type,
      source: e.source, occurred_at: e.occurred_at, metadata: e.metadata,
    }))));
    download(`${tag}_summary.csv`, toCsv(summary.map(({ title: _t, ...r }) => r)));
  };

  const selectedAttempts = attempts.filter((a) => a.assignment_id === selected);

  return (
    <PageShell title={t("admin.title")} description={t("admin.description")}
      actions={camp && <Button onClick={() => void exportAll()}><Download className="mr-2 h-4 w-4" />{t("admin.export")}</Button>}>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("admin.campaigns")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {campaigns.map((c) => (
              <button key={c.id} onClick={() => { setCampaignId(c.id); setSelected(null); }}
                className={`w-full rounded-md border p-2 text-left text-sm ${c.id === campaignId ? "border-primary bg-accent" : "border-border"}`}>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.version} · {c.status === "active" ? t("admin.active") : t("admin.closed")}</div>
              </button>
            ))}
            <div className="space-y-2 border-t border-border pt-3">
              <div className="text-sm font-medium">{t("admin.newCampaign")}</div>
              <Input placeholder={t("admin.name")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input aria-label={t("admin.version")} placeholder={t("admin.version")} value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
              {versions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {versions.map((version) => (
                    <button key={version} type="button" onClick={() => setForm({ ...form, version })}
                      className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent">{version}</button>
                  ))}
                </div>
              )}
              {form.version.trim() && !versions.includes(form.version.trim()) && (
                <p className="text-xs text-muted-foreground">{t("admin.versionFallback")}</p>
              )}
              <Label className="text-xs">{t("admin.startsAt")}</Label>
              <Input type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              <Label className="text-xs">{t("admin.endsAt")}</Label>
              <Input type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              <Input placeholder={t("admin.questionnaire")} value={form.use_questionnaire_url} onChange={(e) => setForm({ ...form, use_questionnaire_url: e.target.value })} />
              <Button className="w-full" disabled={!form.name.trim() || !form.version.trim()} onClick={() => void createCampaign()}>{t("admin.create")}</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("admin.participants")}</CardTitle>
            {camp && <Button size="sm" variant="outline" onClick={() => void toggleCampaign()}>{camp.status === "active" ? t("admin.close") : t("admin.reopen")}</Button>}
          </CardHeader>
          <CardContent>
            {!camp ? <p className="text-sm text-muted-foreground">{t("admin.noCampaign")}</p> : (
              <>
                <div className="relative mb-4">
                  <Input placeholder={t("admin.searchEarner")} value={search} onChange={(e) => setSearch(e.target.value)} />
                  {matches.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow">
                      {matches.map((m) => (
                        <div key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span>{m.display_name} <span className="text-muted-foreground">· {m.email}</span></span>
                          <Button size="sm" variant="outline" onClick={() => void invite(m.id)}>{t("admin.add")}</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>{t("admin.pseudonym")}</TableHead><TableHead>{t("admin.name")}</TableHead>
                    <TableHead>{t("admin.consent")}</TableHead><TableHead>{t("admin.attempts")}</TableHead><TableHead>{t("admin.enabled")}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {assignments.map((a) => {
                      const p = profileById.get(a.user_id);
                      return (
                        <TableRow key={a.id} className={`cursor-pointer ${selected === a.id ? "bg-accent" : ""}`} onClick={() => setSelected(a.id)}>
                          <TableCell className="font-mono text-xs">{a.anonymous_export_id}</TableCell>
                          <TableCell className="text-sm">{p?.display_name ?? "—"}<div className="text-xs text-muted-foreground">{p?.email}</div></TableCell>
                          <TableCell><Badge variant="outline">{t(`admin.consentStatus.${a.consent_status}`)}</Badge></TableCell>
                          <TableCell>{attempts.filter((x) => x.assignment_id === a.id).length}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}><Switch checked={a.enabled} onCheckedChange={() => void toggleEnabled(a)} /></TableCell>
                        </TableRow>
                      );
                    })}
                    {!assignments.length && <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">{t("admin.none")}</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {selected && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-base">{t("admin.detail")} {pseudo(selected)}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("admin.scenario")}</TableHead><TableHead>#</TableHead><TableHead>Status</TableHead>
                <TableHead>{t("admin.outcome")}</TableHead><TableHead>{t("admin.time")}</TableHead>
                <TableHead>{t("admin.helpCount")}</TableHead><TableHead>{t("admin.instructorRate")}</TableHead><TableHead>{t("admin.comment")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {selectedAttempts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{code(a.scenario_id)}</TableCell>
                    <TableCell>{a.attempt_number}</TableCell>
                    <TableCell>{t(`status.${a.status}`)}</TableCell>
                    <TableCell>{t(`outcome.${a.outcome}`)}</TableCell>
                    <TableCell>{secs(Number(a.active_duration_ms))}</TableCell>
                    <TableCell>{a.help_count}</TableCell>
                    <TableCell>{a.instructor_help_count}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs">{a.feedback_text}</TableCell>
                  </TableRow>
                ))}
                {!selectedAttempts.length && <TableRow><TableCell colSpan={8} className="text-sm text-muted-foreground">{t("admin.none")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {camp && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-base">{t("admin.summary")}</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">{t("admin.dataNote")}</p>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("admin.scenario")}</TableHead><TableHead>{t("admin.attempts")}</TableHead>
                <TableHead>{t("admin.completed")}</TableHead><TableHead>{t("admin.skipped")}</TableHead>
                <TableHead>{t("admin.verified")}</TableHead><TableHead>{t("admin.selfReported")}</TableHead>
                <TableHead>{t("admin.medianTime")}</TableHead><TableHead>{t("admin.helpRate")}</TableHead><TableHead>{t("admin.instructorRate")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {summary.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell><span className="font-mono text-xs">{r.code}</span> <span className="text-sm">{r.title}</span></TableCell>
                    <TableCell>{r.attempts}</TableCell><TableCell>{r.completed}</TableCell><TableCell>{r.skipped}</TableCell>
                    <TableCell>{r.verified}</TableCell><TableCell>{r.self_reported}</TableCell>
                    <TableCell>{secs(r.median_active_ms)}</TableCell>
                    <TableCell>{r.help_participants}/{r.participants}</TableCell><TableCell>{r.instructor_participants}/{r.participants}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
