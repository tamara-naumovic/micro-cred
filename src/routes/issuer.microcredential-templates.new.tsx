import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
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
import type { Level, LearningSource, MicroCredentialTemplate, Participation } from "@/lib/types";

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

  if (!activeUser) return null;
  const issuerOrg = organizations.find((o) => o.id === activeUser.organizationId);
  const staffUsers = users.filter(
    (u) => u.role === "issuer" && u.subRole === "staff" && u.organizationId === activeUser.organizationId,
  );


  const submit = async (status: "draft" | "active") => {
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }
    if (!activeUser.organizationId) {
      toast.error("Your account is not linked to an issuer organisation");
      return;
    }
    if (expiryMode === "fixed_date" && !expiryDate) {
      toast.error("Please pick an expiration date");
      return;
    }
    const id = crypto.randomUUID();
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
      ects: ects ? Number(ects) : undefined,
      level,
      assessment: assessment || "Defined per cohort",
      participation,
      qualityAssurance: "Internal QA",
      prerequisites: "—",
      supervision: "—",
      stackability: "—",
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
  };

  return (
    <PageShell title="Create Micro-credential" description="Define a new micro-credential offered by your organisation.">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Data Visualization Essentials" />
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
            <div className="md:col-span-2">
              <Label>Skills (comma-separated)</Label>
              <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Data analysis, Tableau, Storytelling" />
            </div>
            <div className="md:col-span-2">
              <Label>Learning outcomes (one per line)</Label>
              <Textarea rows={3} value={outcomes} onChange={(e) => setOutcomes(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Assessment</Label>
              <Input value={assessment} onChange={(e) => setAssessment(e.target.value)} placeholder="Final project + oral defence" />
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
            <Button variant="outline" onClick={() => submit("draft")}>Save as draft</Button>
            <Button onClick={() => submit("active")}>Publish micro-credential</Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
