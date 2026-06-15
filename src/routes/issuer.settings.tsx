import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileDown, Upload, Trash2 } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/issuer/settings")({
  head: () => ({ meta: [{ title: "Settings — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <PageShell title="Settings" description="Manage your account preferences and institution profile.">
        <div className="grid gap-6">
          <InstitutionProfileCard />
          <ChangePasswordForm />
        </div>
      </PageShell>
    </RoleGuard>
  ),
});

function InstitutionProfileCard() {
  const { activeUser, organizations } = useStore();
  const isAdmin = activeUser?.subRole === "admin";
  const org = useMemo(
    () => organizations.find((o) => o.id === activeUser?.organizationId),
    [organizations, activeUser?.organizationId],
  );

  const [about, setAbout] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAbout(org?.about ?? "");
    setWebsite(org?.website ?? "");
  }, [org?.id, org?.about, org?.website]);

  if (!activeUser || !org) return null;

  const save = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ about: about.trim() || null, website: website.trim() || null })
        .eq("id", org.id);
      if (error) throw new Error(error.message);
      toast.success("Institution profile updated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const uploadDoc = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${org.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("accreditation-docs")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) throw new Error(upErr.message);
      // Best-effort remove previous doc
      if (org.accreditationDocumentUrl) {
        await supabase.storage.from("accreditation-docs").remove([org.accreditationDocumentUrl]);
      }
      const { error } = await supabase
        .from("organizations")
        .update({ accreditation_document_url: path })
        .eq("id", org.id);
      if (error) throw new Error(error.message);
      toast.success("Accreditation document uploaded");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeDoc = async () => {
    if (!org.accreditationDocumentUrl) return;
    setUploading(true);
    try {
      await supabase.storage.from("accreditation-docs").remove([org.accreditationDocumentUrl]);
      const { error } = await supabase
        .from("organizations")
        .update({ accreditation_document_url: null })
        .eq("id", org.id);
      if (error) throw new Error(error.message);
      toast.success("Accreditation document removed");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setUploading(false);
    }
  };

  const openDoc = async () => {
    if (!org.accreditationDocumentUrl) return;
    const { data, error } = await supabase.storage
      .from("accreditation-docs")
      .createSignedUrl(org.accreditationDocumentUrl, 3600);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "Could not open document");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Institution public profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Name</Label>
            <Input value={org.name} disabled />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Country</Label>
            <Input value={org.country ?? ""} disabled />
          </div>
        </div>
        <div>
          <Label htmlFor="org-website">Website</Label>
          <Input
            id="org-website"
            placeholder="https://example.org"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            disabled={!isAdmin}
          />
        </div>
        <div>
          <Label htmlFor="org-about">About</Label>
          <Textarea
            id="org-about"
            rows={5}
            placeholder="Describe your institution. This appears on the public profile."
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            disabled={!isAdmin}
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Accreditation document
          </Label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {org.accreditationDocumentUrl ? (
              <>
                <Button size="sm" variant="outline" onClick={openDoc}>
                  <FileDown className="mr-2 h-4 w-4" />
                  {org.accreditationDocumentUrl.split("/").pop()}
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="ghost" onClick={removeDoc} disabled={uploading} aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No document uploaded.</p>
            )}
            {isAdmin && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadDoc(f);
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? "Uploading…" : org.accreditationDocumentUrl ? "Replace" : "Upload"}
                </Button>
              </>
            )}
          </div>
        </div>
        {isAdmin ? (
          <div className="flex justify-end">
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Only issuer admins can edit the institution profile.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
