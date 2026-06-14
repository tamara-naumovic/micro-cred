import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Upload, AlertTriangle } from "lucide-react";
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
  const { activeUser } = useStore();
  if (!activeUser) return null;
  if (activeUser.subRole !== "admin") return <Navigate to="/issuer/microcredential-templates" />;
  return <Form />;
}

const QA_OPTIONS: { value: QaType; label: string }[] = [
  { value: "internal", label: "Internal" },
  { value: "external", label: "External" },
  { value: "internal_and_external", label: "Internal and external" },
  { value: "other", label: "Other" },
  { value: "not_specified", label: "Not specified" },
];

const SUPERVISION_OPTIONS: { value: SupervisionType; label: string }[] = [
  { value: "unsupervised_no_id", label: "Unsupervised with no identity verification" },
  { value: "supervised_no_id", label: "Supervised with no identity verification" },
  { value: "supervised_online_with_id", label: "Supervised online with identity verification" },
  { value: "supervised_onsite_with_id", label: "Supervised onsite with identity verification" },
];

const STACKABILITY_OPTIONS: { value: StackabilityType; label: string }[] = [
  { value: "stand_alone", label: "Stand-alone" },
  { value: "independent_integrated", label: "Independent micro-credential / integrated" },
  { value: "stackable", label: "Stackable towards another credential" },
];

function Form() {
  const { activeUser, upsertTemplate, organizations, users, assignTemplateUsers } = useStore();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState<LearningSource>("formal");
  const [level, setLevel] = useState<Level>("Foundation");
  const [participation, setParticipation] = useState<Participation>("hybrid");
  const [ects, setEcts] = useState<string>("");
  const [skills, setSkills] = useState("");
  const [outcomes, setOutcomes] = useState("");
  const [assessment, setAssessment] = useState("");
  const [expiryMode, setExpiryMode] = useState<"never" | "fixed_date">("never");
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);
  const [assignedStaff, setAssignedStaff] = useState<string[]>([]);

  // QA
  const [qaType, setQaType] = useState<QaType | "">("");
  const [qaFile, setQaFile] = useState<File | null>(null);

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

  const submit = async (status: "draft" | "active") => {
    if (!activeUser.organizationId) {
      toast.error("Your account is not linked to an issuer organisation");
      return;
    }
    // Required fields
    const requiredErrors: string[] = [];
    if (!title.trim()) requiredErrors.push("Title");
    if (!description.trim()) requiredErrors.push("Description");
    if (!ects.trim()) requiredErrors.push("ECTS");
    if (!skills.trim()) requiredErrors.push("Skills");
    if (!outcomes.trim()) requiredErrors.push("Learning outcomes");
    if (!assessment.trim()) requiredErrors.push("Assessment");
    if (!qaType) requiredErrors.push("Quality assurance type");
    if (qaType && qaType !== "not_specified" && !qaFile) requiredErrors.push("Quality assurance document");
    if (expiryMode === "fixed_date" && !expiryDate) requiredErrors.push("Expiration date");
    if (requiredErrors.length > 0) {
      toast.error(`Required: ${requiredErrors.join(", ")}`);
      return;
    }

    setSubmitting(true);
    const id = crypto.randomUUID();
    let qaPath: string | undefined;
    try {
      if (qaFile) {
        const safeName = qaFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        qaPath = `${activeUser.organizationId}/${id}/${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("qa-documents")
          .upload(qaPath, qaFile, { upsert: false, contentType: qaFile.type || undefined });
        if (upErr) {
          toast.error(`Failed to upload QA document: ${upErr.message}`);
          setSubmitting(false);
          return;
        }
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
        ects: Number(ects),
        level,
        assessment,
        participation,
        qualityAssurance: QA_OPTIONS.find((o) => o.value === qaType)?.label ?? "",
        qaType: qaType as QaType,
        qaDocumentPath: qaPath,
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
        status,
        version: "1.0",
      };
      upsertTemplate(tpl);
      if (assignedStaff.length > 0) {
        try {
          await assignTemplateUsers(id, assignedStaff);
        } catch (e: any) {
          toast.error(e?.message ?? "Failed to assign staff");
        }
      }
      toast.success(`Micro-credential ${status === "draft" ? "saved as draft" : "published"}`);
      navigate({ to: "/issuer/microcredential-templates" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell title="Create Micro-credential" description="Define a new micro-credential offered by your organisation.">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Data Visualization Essentials" />
            </div>
            <div className="md:col-span-2">
              <Label>Description *</Label>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label>Source *</Label>
              <Select value={source} onValueChange={(v) => setSource(v as LearningSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="non_formal">Non-formal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Level *</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["Foundation", "Intermediate", "Advanced", "Expert", "N/A"] as Level[]).map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Participation *</Label>
              <Select value={participation} onValueChange={(v) => setParticipation(v as Participation)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["online", "onsite", "hybrid", "blended", "self_paced"] as Participation[]).map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ECTS *</Label>
              <Input value={ects} onChange={(e) => setEcts(e.target.value)} type="number" min={0} max={60} />
            </div>
            <div className="md:col-span-2">
              <Label>Skills * (comma-separated)</Label>
              <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Data analysis, Tableau, Storytelling" />
            </div>
            <div className="md:col-span-2">
              <Label>Learning outcomes * (one per line)</Label>
              <Textarea rows={3} value={outcomes} onChange={(e) => setOutcomes(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Assessment *</Label>
              <Input value={assessment} onChange={(e) => setAssessment(e.target.value)} placeholder="Final project + oral defence" />
            </div>

            {/* Quality Assurance */}
            <div className="md:col-span-2 space-y-3 rounded-md border p-4">
              <Label>Type of Quality Assurance *</Label>
              <Select value={qaType} onValueChange={(v) => setQaType(v as QaType)}>
                <SelectTrigger><SelectValue placeholder="Select QA type" /></SelectTrigger>
                <SelectContent>
                  {QA_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {qaType && qaType !== "not_specified" && (
                <div>
                  <Label className="text-sm">QA confirmation document *</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => setQaFile(e.target.files?.[0] ?? null)}
                    />
                    {qaFile && <span className="text-xs text-muted-foreground"><Upload className="inline h-3 w-3 mr-1" />{qaFile.name}</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">PDF or image, max 10 MB.</p>
                </div>
              )}
            </div>

            {/* Prerequisites */}
            <div className="md:col-span-2 space-y-2 rounded-md border p-4">
              <Label>Prerequisites (optional)</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="prereq-none"
                  checked={prereqNone}
                  onCheckedChange={(c) => setPrereqNone(!!c)}
                />
                <Label htmlFor="prereq-none" className="font-normal cursor-pointer">No prerequisites</Label>
              </div>
              {!prereqNone && (
                <Textarea
                  rows={3}
                  value={prereqText}
                  onChange={(e) => setPrereqText(e.target.value)}
                  placeholder="Describe the prerequisites"
                />
              )}
            </div>

            {/* Supervision */}
            <div className="md:col-span-2 space-y-2 rounded-md border p-4">
              <Label>Supervision and identity verification (optional)</Label>
              <Select value={supervisionType} onValueChange={(v) => setSupervisionType(v as SupervisionType)}>
                <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
                <SelectContent>
                  {SUPERVISION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stackability */}
            <div className="md:col-span-2 space-y-2 rounded-md border p-4">
              <Label>Integration / Stackability (optional)</Label>
              <Select value={stackabilityType} onValueChange={(v) => setStackabilityType(v as StackabilityType)}>
                <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
                <SelectContent>
                  {STACKABILITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-2 rounded-md border p-4">
              <Label>Expiration *</Label>
              <RadioGroup value={expiryMode} onValueChange={(v) => setExpiryMode(v as "never" | "fixed_date")}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="never" id="ex-never" />
                  <Label htmlFor="ex-never" className="font-normal cursor-pointer">Does not expire</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="fixed_date" id="ex-date" />
                  <Label htmlFor="ex-date" className="font-normal cursor-pointer">Expires on</Label>
                  {expiryMode === "fixed_date" && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-[220px] justify-start text-left font-normal", !expiryDate && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {expiryDate ? format(expiryDate, "PPP") : <span>Pick a date</span>}
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
              <Label>Assign staff (optional)</Label>
              {staffUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No staff yet for your institution.</p>
              ) : (
                <StaffPicker staff={staffUsers} selected={assignedStaff} onChange={setAssignedStaff} />
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" disabled={submitting} onClick={() => submit("draft")}>Save as draft</Button>
            <Button disabled={submitting} onClick={() => submit("active")}>Publish micro-credential</Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
