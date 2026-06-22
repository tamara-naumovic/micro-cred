import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Upload, AlertTriangle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { publishTemplateAndAnchor, getChainAvailabilityFn } from "@/lib/chain/anchor.functions";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { StaffPicker } from "@/components/StaffPicker";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import type {
  Level,
  LearningSource,
  MicroCredentialTemplate,
  Participation,
  QaType,
  StackabilityType,
  SupervisionType,
} from "@/lib/types";

export const Route = createFileRoute("/issuer/microcredential-templates/new")({
  head: () => ({ meta: [{ title: "Create Micro-credential — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <Guarded />
    </RoleGuard>
  ),
});

function Guarded() {
  const { t } = useTranslation("issuer");
  const { activeUser } = useStore();
  const isStaff = activeUser?.subRole === "staff";
  useEffect(() => {
    if (isStaff) {
      toast.error(t("templates.new.noPermission"));
    }
  }, [isStaff]);
  if (!activeUser) return null;
  if (activeUser.subRole !== "admin")
    return <Navigate to="/issuer/microcredential-templates" replace />;
  return <Form />;
}

function Form() {
  const { t } = useTranslation("issuer");
  const { activeUser, upsertTemplate, organizations, users, assignTemplateUsers } = useStore();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState<LearningSource>("formal");
  const [level, setLevel] = useState<Level>("Foundation");
  const [participation, setParticipation] = useState<Participation>("hybrid");
  const [ects, setEcts] = useState<string>("");
  const [ectsNotApplicable, setEctsNotApplicable] = useState(false);
  const [skills, setSkills] = useState("");
  const [outcomes, setOutcomes] = useState("");
  const [assessment, setAssessment] = useState("");
  const [expiryMode, setExpiryMode] = useState<"never" | "fixed_date">("never");
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);
  const [assignedStaff, setAssignedStaff] = useState<string[]>([]);

  // QA
  const [qaType, setQaType] = useState<QaType | "">("");
  const [qaFiles, setQaFiles] = useState<File[]>([]);
  const [qaDragOver, setQaDragOver] = useState(false);

  // Optional new fields
  const [prereqNone, setPrereqNone] = useState(true);
  const [prereqText, setPrereqText] = useState("");
  const [supervisionType, setSupervisionType] = useState<SupervisionType | "">("");
  const [stackabilityType, setStackabilityType] = useState<StackabilityType | "">("");

  const [submitting, setSubmitting] = useState(false);
  const [anchorMode, setAnchorMode] = useState<"now" | "later">("later");
  const [chainStatus, setChainStatus] = useState<string>("ok");
  const publishFn = useServerFn(publishTemplateAndAnchor);
  const availFn = useServerFn(getChainAvailabilityFn);
  useEffect(() => {
    availFn().then((r: any) => setChainStatus(r?.status ?? "ok")).catch(() => setChainStatus("rpc_unavailable"));
  }, [availFn]);

  if (!activeUser) return null;
  const issuerOrg = organizations.find((o) => o.id === activeUser.organizationId);
  const staffUsers = users.filter(
    (u) => u.role === "issuer" && u.subRole === "staff" && u.organizationId === activeUser.organizationId,
  );

  const QA_OPTIONS: { value: QaType; label: string }[] = [
    { value: "internal", label: t("templates.qaOptions.internal") },
    { value: "external", label: t("templates.qaOptions.external") },
    { value: "internal_and_external", label: t("templates.qaOptions.internal_and_external") },
    { value: "other", label: t("templates.qaOptions.other") },
    { value: "not_specified", label: t("templates.qaOptions.not_specified") },
  ];

  const SUPERVISION_OPTIONS: { value: SupervisionType; label: string }[] = [
    { value: "unsupervised_no_id", label: t("templates.supervisionOptions.unsupervised_no_id") },
    { value: "supervised_no_id", label: t("templates.supervisionOptions.supervised_no_id") },
    { value: "supervised_online_with_id", label: t("templates.supervisionOptions.supervised_online_with_id") },
    { value: "supervised_onsite_with_id", label: t("templates.supervisionOptions.supervised_onsite_with_id") },
  ];

  const STACKABILITY_OPTIONS: { value: StackabilityType; label: string }[] = [
    { value: "stand_alone", label: t("templates.stackabilityOptions.stand_alone") },
    { value: "independent_integrated", label: t("templates.stackabilityOptions.independent_integrated") },
    { value: "stackable", label: t("templates.stackabilityOptions.stackable") },
  ];

  const submit = async (status: "draft" | "publish") => {
    if (!activeUser.organizationId) {
      toast.error(t("templates.new.toasts.noOrg"));
      return;
    }
    // Required fields
    const requiredErrors: string[] = [];
    if (!title.trim()) requiredErrors.push("Title");
    if (!description.trim()) requiredErrors.push("Description");
    if (source === "formal" && !ects.trim()) requiredErrors.push("ECTS");
    if (!skills.trim()) requiredErrors.push("Skills");
    if (!outcomes.trim()) requiredErrors.push("Learning outcomes");
    if (!assessment.trim()) requiredErrors.push("Assessment");
    if (!qaType) requiredErrors.push("Quality assurance type");
    if (qaType && qaType !== "not_specified" && qaFiles.length === 0) requiredErrors.push("Quality assurance document");
    if (expiryMode === "fixed_date" && !expiryDate) requiredErrors.push("Expiration date");
    if (requiredErrors.length > 0) {
      toast.error(t("templates.new.toasts.required", { fields: requiredErrors.join(", ") }));
      return;
    }

    setSubmitting(true);
    const id = crypto.randomUUID();
    const qaPaths: string[] = [];
    try {
      for (const f of qaFiles) {
        const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${activeUser.organizationId}/${id}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("qa-documents")
          .upload(path, f, { upsert: false, contentType: f.type || undefined });
        if (upErr) {
          toast.error(t("templates.new.toasts.uploadFail", { name: f.name, message: upErr.message }));
          setSubmitting(false);
          return;
        }
        qaPaths.push(path);
      }

      const tpl: MicroCredentialTemplate = {
        id,
        title,
        description,
        issuerId: activeUser.organizationId,
        issuerName: issuerOrg?.name ?? activeUser.organization ?? "Issuer",
        country: issuerOrg?.country ?? "Serbia",
        source,
        outcomes: outcomes.split("\n").map((s) => s.trim()).filter(Boolean),
        skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
        ects: source === "non_formal" && (ectsNotApplicable || !ects.trim()) ? undefined : Number(ects),
        level,
        assessment,
        participation,
        qualityAssurance: QA_OPTIONS.find((o) => o.value === qaType)?.label ?? "",
        qaType: qaType as QaType,
        qaDocumentPath: qaPaths[0],
        qaDocumentPaths: qaPaths,
        prerequisites: prereqNone ? "" : prereqText.trim(),
        prerequisitesNone: prereqNone,
        supervision: supervisionType ? SUPERVISION_OPTIONS.find((o) => o.value === supervisionType)?.label ?? "" : "",
        supervisionType: supervisionType || undefined,
        stackability: stackabilityType
          ? STACKABILITY_OPTIONS.find((o) => o.value === stackabilityType)?.label ?? ""
          : "",
        stackabilityType: stackabilityType || undefined,
        expiryMode,
        expiryDate: expiryMode === "fixed_date" && expiryDate ? expiryDate.toISOString() : undefined,
        status: status === "publish" ? "draft" : status,
        version: "1.0",
      };
      // Save row first (as draft); the server fn will flip to published and create the version snapshot.
      upsertTemplate(tpl);
      if (assignedStaff.length > 0) {
        try {
          await assignTemplateUsers(id, assignedStaff);
        } catch (e: any) {
          toast.error(e?.message ?? t("templates.new.toasts.assignFail"));
        }
      }
      if (status === "publish") {
        // Small delay so the upsert (fire-and-forget) lands before we publish on the server.
        await new Promise((r) => setTimeout(r, 400));
        try {
          const res: any = await publishFn({ data: { templateId: id, anchorMode } });
          toast.success(
            res?.mode === "now"
              ? t("templates.new.toasts.publishedAnchored")
              : t("templates.new.toasts.publishedQueued"),
          );
        } catch (e: any) {
          toast.error(t("templates.new.toasts.anchorFail", { message: e?.message ?? "unknown error" }));
        }
      } else {
        toast.success(t("templates.new.toasts.savedDraft"));
      }
      navigate({ to: "/issuer/microcredential-templates" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell title={t("templates.new.title")} description={t("templates.new.description")}>
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>{t("templates.new.fields.title")}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("templates.new.fields.titlePlaceholder")} />
            </div>
            <div className="md:col-span-2">
              <Label>{t("templates.new.fields.description")}</Label>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label>{t("templates.new.fields.source")}</Label>
              <Select value={source} onValueChange={(v) => setSource(v as LearningSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">{t("templates.new.fields.sourceFormal")}</SelectItem>
                  <SelectItem value="non_formal">{t("templates.new.fields.sourceNonFormal")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("templates.new.fields.level")}</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["Foundation", "Intermediate", "Advanced", "Expert", "N/A"] as Level[]).map((l) => (
                    <SelectItem key={l} value={l}>{t(`templateLevel.${l}`, { ns: "common" })}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("templates.new.fields.participation")}</Label>
              <Select value={participation} onValueChange={(v) => setParticipation(v as Participation)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["online", "onsite", "hybrid", "blended", "self_paced"] as Participation[]).map((p) => (
                    <SelectItem key={p} value={p}>{t(`templateParticipation.${p}`, { ns: "common" })}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{source === "formal" ? t("templates.new.fields.ectsRequired") : t("templates.new.fields.ectsOptional")}</Label>
              <Input
                value={ectsNotApplicable ? "" : ects}
                onChange={(e) => setEcts(e.target.value)}
                type="number"
                min={0}
                max={60}
                disabled={source === "non_formal" && ectsNotApplicable}
                placeholder={source === "non_formal" && ectsNotApplicable ? t("templates.new.fields.ectsPlaceholder") : undefined}
              />
              {source === "non_formal" && (
                <div className="mt-2 flex items-center gap-2">
                  <Checkbox
                    id="ects-na"
                    checked={ectsNotApplicable}
                    onCheckedChange={(c) => {
                      const v = !!c;
                      setEctsNotApplicable(v);
                      if (v) setEcts("");
                    }}
                  />
                  <Label htmlFor="ects-na" className="font-normal cursor-pointer">{t("templates.new.fields.ectsNotApplicable")}</Label>
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <Label>{t("templates.new.fields.skills")}</Label>
              <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder={t("templates.new.fields.skillsPlaceholder")} />
            </div>
            <div className="md:col-span-2">
              <Label>{t("templates.new.fields.outcomes")}</Label>
              <Textarea rows={3} value={outcomes} onChange={(e) => setOutcomes(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>{t("templates.new.fields.assessment")}</Label>
              <Input value={assessment} onChange={(e) => setAssessment(e.target.value)} placeholder={t("templates.new.fields.assessmentPlaceholder")} />
            </div>

            {/* Quality Assurance */}
            <div className="md:col-span-2 space-y-3 rounded-md border p-4">
              <Label>{t("templates.new.fields.qaType")}</Label>
              <Select value={qaType} onValueChange={(v) => setQaType(v as QaType)}>
                <SelectTrigger><SelectValue placeholder={t("templates.new.fields.qaTypePlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {QA_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {qaType && qaType !== "not_specified" && (
                <div>
                  <Label className="text-sm">{t("templates.new.fields.qaDocs")}</Label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setQaDragOver(true); }}
                    onDragLeave={() => setQaDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setQaDragOver(false);
                      const dropped = Array.from(e.dataTransfer.files);
                      if (dropped.length) setQaFiles((prev) => [...prev, ...dropped]);
                    }}
                    className={cn(
                      "mt-1 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition-colors",
                      qaDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30",
                    )}
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <div className="text-sm">
                      {t("templates.new.fields.qaDropHint")}{" "}
                      <label className="cursor-pointer text-primary underline">
                        {t("templates.new.fields.qaBrowse")}
                        <input
                          type="file"
                          multiple
                          accept="application/pdf,image/*"
                          className="hidden"
                          onChange={(e) => {
                            const picked = Array.from(e.target.files ?? []);
                            if (picked.length) setQaFiles((prev) => [...prev, ...picked]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("templates.new.fields.qaFileHint")}</p>
                  </div>
                  {qaFiles.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {qaFiles.map((f, idx) => (
                        <li key={`${f.name}-${idx}`} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
                          <span className="truncate"><Upload className="inline h-3 w-3 mr-1" />{f.name}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setQaFiles((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Prerequisites */}
            <div className="md:col-span-2 space-y-2 rounded-md border p-4">
              <Label>{t("templates.new.fields.prerequisites")}</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="prereq-none"
                  checked={prereqNone}
                  onCheckedChange={(c) => setPrereqNone(!!c)}
                />
                <Label htmlFor="prereq-none" className="font-normal cursor-pointer">{t("templates.new.fields.prereqNone")}</Label>
              </div>
              {!prereqNone && (
                <Textarea
                  rows={3}
                  value={prereqText}
                  onChange={(e) => setPrereqText(e.target.value)}
                  placeholder={t("templates.new.fields.prereqPlaceholder")}
                />
              )}
            </div>

            {/* Supervision */}
            <div className="md:col-span-2 space-y-2 rounded-md border p-4">
              <Label>{t("templates.new.fields.supervision")}</Label>
              <Select value={supervisionType} onValueChange={(v) => setSupervisionType(v as SupervisionType)}>
                <SelectTrigger><SelectValue placeholder={t("templates.new.fields.selectPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {SUPERVISION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stackability */}
            <div className="md:col-span-2 space-y-2 rounded-md border p-4">
              <Label>{t("templates.new.fields.stackability")}</Label>
              <Select value={stackabilityType} onValueChange={(v) => setStackabilityType(v as StackabilityType)}>
                <SelectTrigger><SelectValue placeholder={t("templates.new.fields.selectPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {STACKABILITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-2 rounded-md border p-4">
              <Label>{t("templates.new.fields.expiration")}</Label>
              <RadioGroup value={expiryMode} onValueChange={(v) => setExpiryMode(v as "never" | "fixed_date")}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="never" id="ex-never" />
                  <Label htmlFor="ex-never" className="font-normal cursor-pointer">{t("templates.new.fields.expiryNever")}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="fixed_date" id="ex-date" />
                  <Label htmlFor="ex-date" className="font-normal cursor-pointer">{t("templates.new.fields.expiryFixed")}</Label>
                  {expiryMode === "fixed_date" && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-[220px] justify-start text-left font-normal", !expiryDate && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {expiryDate ? format(expiryDate, "PPP") : <span>{t("templates.new.fields.expiryPickDate")}</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={expiryDate} onSelect={setExpiryDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </RadioGroup>
            </div>

            <div className="md:col-span-2 space-y-2 rounded-md border p-4">
              <Label>{t("templates.new.fields.assignStaff")}</Label>
              {staffUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("templates.new.fields.noStaff")}</p>
              ) : (
                <StaffPicker staff={staffUsers} selected={assignedStaff} onChange={setAssignedStaff} />
              )}
            </div>
          </div>

          <div className="rounded-md border p-4 space-y-3">
            <div>
              <Label>{t("templates.new.fields.blockchain")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("templates.new.fields.blockchainDesc")}
              </p>
            </div>
            <RadioGroup value={anchorMode} onValueChange={(v) => setAnchorMode(v as "now" | "later")} className="space-y-2">
              <div className="flex items-start gap-2">
                <RadioGroupItem value="now" id="anchor-now" disabled={chainStatus !== "ok"} />
                <Label htmlFor="anchor-now" className="font-normal">
                  {t("templates.new.fields.anchorNow")}
                  <span className="block text-xs text-muted-foreground">{t("templates.new.fields.anchorNowDesc")}</span>
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="later" id="anchor-later" />
                <Label htmlFor="anchor-later" className="font-normal">
                  {t("templates.new.fields.anchorLater")}
                  <span className="block text-xs text-muted-foreground">{t("templates.new.fields.anchorLaterDesc")}</span>
                </Label>
              </div>
            </RadioGroup>
            {chainStatus !== "ok" && (
              <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                <span>{t("templates.new.fields.chainUnavailable")}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" disabled={submitting} onClick={() => submit("draft")}>
              {t("templates.new.buttons.saveDraft")}
            </Button>
            <Button disabled={submitting} onClick={() => submit("publish")}>
              {t("templates.new.buttons.publish")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
