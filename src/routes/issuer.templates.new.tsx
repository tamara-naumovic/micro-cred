import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import type { Level, LearningSource, MicroCredentialTemplate, Participation } from "@/lib/types";

export const Route = createFileRoute("/issuer/templates/new")({
  head: () => ({ meta: [{ title: "Create Template — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <Form />
    </RoleGuard>
  ),
});

function Form() {
  const { activeUser, upsertTemplate, organizations } = useStore();
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

  if (!activeUser) return null;
  const issuerOrg = organizations.find((o) => o.id === activeUser.organizationId);

  const submit = (status: "draft" | "active") => {
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }
    if (!activeUser.organizationId) {
      toast.error("Your account is not linked to an issuer organisation");
      return;
    }
    const tpl: MicroCredentialTemplate = {
      id: crypto.randomUUID(),
      title,
      description,
      issuerId: activeUser.organizationId ?? "org-fos",
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
      status,
      version: "1.0",
    };
    upsertTemplate(tpl);
    toast.success(`Template ${status === "draft" ? "saved as draft" : "published"}`);
    navigate({ to: "/issuer/templates" });
  };

  return (
    <PageShell title="Create Template" description="Define a new micro-credential offered by your organisation.">
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
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => submit("draft")}>Save as draft</Button>
            <Button onClick={() => submit("active")}>Publish template</Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
