import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, CalendarIcon, Send } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { StaffPicker } from "@/components/StaffPicker";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { Level, LearningSource, MicroCredentialTemplate, Participation, TemplateStatus } from "@/lib/types";

export const Route = createFileRoute("/issuer/microcredential_templates/$id")({
  head: () => ({ meta: [{ title: "Micro-credential — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <Guarded />
    </RoleGuard>
  ),
});

function Guarded() {
  const { activeUser } = useStore();
  if (!activeUser) return null;
  if (activeUser.subRole !== "admin") return <Navigate to="/issuer/microcredential_templates" />;
  return <EditForm />;
}

function EditForm() {
  const { id } = Route.useParams();
  const { activeUser, templates, upsertTemplate, users, templateAssignees, assignTemplateUsers } = useStore();
  const navigate = useNavigate();
  const tpl = templates.find((t) => t.id === id);
  const initialAssigned = useMemo(
    () => templateAssignees.filter((a) => a.templateId === id).map((a) => a.userId),
    [templateAssignees, id],
  );

  const [title, setTitle] = useState(tpl?.title ?? "");
  const [description, setDescription] = useState(tpl?.description ?? "");
  const [source, setSource] = useState<LearningSource>(tpl?.source ?? "formal");
  const [level, setLevel] = useState<Level>(tpl?.level ?? "Foundation");
  const [participation, setParticipation] = useState<Participation>(tpl?.participation ?? "hybrid");
  const [ects, setEcts] = useState<string>(tpl?.ects != null ? String(tpl.ects) : "");
  const [skills, setSkills] = useState(tpl?.skills.join(", ") ?? "");
  const [outcomes, setOutcomes] = useState(tpl?.outcomes.join("\n") ?? "");
  const [assessment, setAssessment] = useState(tpl?.assessment ?? "");
  const [status, setStatus] = useState<TemplateStatus>(tpl?.status ?? "draft");
  const [expiryMode, setExpiryMode] = useState<"never" | "fixed_date">(tpl?.expiryMode ?? "never");
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(
    tpl?.expiryDate ? new Date(tpl.expiryDate) : undefined,
  );
  const [assignedStaff, setAssignedStaff] = useState<string[]>(initialAssigned);

  if (!activeUser) return null;
  if (!tpl) {
    return (
      <PageShell title="Micro-credential not found">
        <Button variant="outline" onClick={() => navigate({ to: "/issuer/microcredential_templates" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />Back
        </Button>
      </PageShell>
    );
  }

  const staffUsers = users.filter(
    (u) => u.role === "issuer" && u.subRole === "staff" && u.organizationId === activeUser.organizationId,
  );

  const save = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }
    if (expiryMode === "fixed_date" && !expiryDate) {
      toast.error("Please pick an expiration date");
      return;
    }
    const next: MicroCredentialTemplate = {
      ...tpl,
      title,
      description,
      source,
      level,
      participation,
      ects: ects ? Number(ects) : undefined,
      skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
      outcomes: outcomes.split("\n").map((s) => s.trim()).filter(Boolean),
      assessment: assessment || "Defined per cohort",
      status,
      expiryMode,
      expiryDate: expiryMode === "fixed_date" && expiryDate ? expiryDate.toISOString() : undefined,
    };
    upsertTemplate(next);
    try {
      await assignTemplateUsers(tpl.id, assignedStaff);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update staff assignments");
    }
    toast.success("Micro-credential updated");
    navigate({ to: "/issuer/microcredential_templates" });
  };

  return (
    <PageShell
      title={tpl.title}
      description="Update the micro-credential specification and staff assignments."
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to="/issuer/microcredential_templates"><ArrowLeft className="mr-2 h-4 w-4" />All micro-credentials</Link>
          </Button>
          <Button asChild>
            <Link to="/issuer/issue"><Send className="mr-2 h-4 w-4" />Issue this micro-credential</Link>
          </Button>
        </>
      }
    >
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label>Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as LearningSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="non_formal">Non-formal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Level</Label>
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
              <Label>Participation</Label>
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
              <Label>ECTS (optional)</Label>
              <Input value={ects} onChange={(e) => setEcts(e.target.value)} type="number" min={0} max={60} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TemplateStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Skills (comma-separated)</Label>
              <Input value={skills} onChange={(e) => setSkills(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Learning outcomes (one per line)</Label>
              <Textarea rows={3} value={outcomes} onChange={(e) => setOutcomes(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Assessment</Label>
              <Input value={assessment} onChange={(e) => setAssessment(e.target.value)} />
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
              <Label>Assigned staff</Label>
              {staffUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No staff yet for your institution.</p>
              ) : (
                <StaffPicker staff={staffUsers} selected={assignedStaff} onChange={setAssignedStaff} />
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate({ to: "/issuer/microcredential_templates" })}>Cancel</Button>
            <Button onClick={save}>Save changes</Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
