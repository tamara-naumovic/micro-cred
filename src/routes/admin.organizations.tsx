import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProvisionFields, SubmitButton, useProvisionState } from "@/components/admin/ProvisionFields";
import { useStore } from "@/lib/store";
import { adminCreateInstitution } from "@/lib/admin-users.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/organizations")({
  head: () => ({ meta: [{ title: "Organisations — MicroCred Admin" }] }),
  component: () => (
    <RoleGuard role="admin">
      <Orgs />
    </RoleGuard>
  ),
});

function Orgs() {
  const { organizations } = useStore();
  return (
    <PageShell
      title="Institutions"
      description="Issuers registered on the platform."
      actions={<AddInstitutionDialog />}
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {organizations.map((o) => (
          <Card key={o.id}>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-base font-semibold">{o.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.country} · since {new Date(o.registeredAt).getFullYear()}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="capitalize">{o.type}</Badge>
                {o.accreditations?.map((a) => <Badge key={a} variant="outline">{a}</Badge>)}
              </div>
            </CardContent>
          </Card>
        ))}
        {organizations.length === 0 && (
          <p className="text-sm text-muted-foreground">No institutions yet.</p>
        )}
      </div>
    </PageShell>
  );
}

function AddInstitutionDialog() {
  const create = useServerFn(adminCreateInstitution);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [about, setAbout] = useState("");
  const [admin, setAdmin, resetAdmin] = useProvisionState();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({
        data: {
          name,
          country,
          website: website || undefined,
          about: about || undefined,
          adminEmail: admin.email,
          adminDisplayName: admin.displayName,
          mode: admin.mode,
          adminPassword: admin.password,
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/set-password` : undefined,
        },
      });
      toast.success("Institution created");
      setName(""); setCountry(""); setWebsite(""); setAbout("");
      resetAdmin();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create institution");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Add institution</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add institution</DialogTitle>
          <DialogDescription>
            Create the institution and provision its first admin account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="i-name">Name</Label>
              <Input id="i-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="i-country">Country</Label>
              <Input id="i-country" required value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="i-website">Website</Label>
            <Input id="i-website" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="i-about">About</Label>
            <Textarea id="i-about" rows={2} value={about} onChange={(e) => setAbout(e.target.value)} />
          </div>
          <Separator />
          <div>
            <p className="mb-2 text-sm font-medium">Institution admin</p>
            <ProvisionFields value={admin} onChange={setAdmin} disabled={busy} />
          </div>
          <DialogFooter>
            <SubmitButton busy={busy}>Create institution</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
