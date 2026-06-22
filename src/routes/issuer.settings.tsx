import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
      <SettingsPage />
    </RoleGuard>
  ),
});

function SettingsPage() {
  const { t } = useTranslation("issuer");
  return (
    <PageShell title={t("settings.title")} description={t("settings.description")}>
      <div className="grid gap-6">
        <InstitutionProfileCard />
        <ChangePasswordForm />
      </div>
    </PageShell>
  );
}

function InstitutionProfileCard() {
  const { t } = useTranslation("issuer");
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
      toast.success(t("settings.toasts.profileUpdated"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("settings.toasts.saveFailed"));
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
      if (org.accreditationDocumentUrl) {
        await supabase.storage.from("accreditation-docs").remove([org.accreditationDocumentUrl]);
      }
      const { error } = await supabase
        .from("organizations")
        .update({ accreditation_document_url: path })
        .eq("id", org.id);
      if (error) throw new Error(error.message);
      toast.success(t("settings.toasts.docUploaded"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("settings.toasts.uploadFailed"));
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
      toast.success(t("settings.toasts.docRemoved"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("settings.toasts.removeFailed"));
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
      toast.error(error?.message ?? t("settings.toasts.docOpenFailed"));
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.sections.institutionProfile")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("settings.fields.name")}
            </Label>
            <Input value={org.name} disabled />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("settings.fields.country")}
            </Label>
            <Input value={org.country ?? ""} disabled />
          </div>
        </div>
        <div>
          <Label htmlFor="org-website">{t("settings.fields.website")}</Label>
          <Input
            id="org-website"
            placeholder={t("settings.fields.websitePlaceholder")}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            disabled={!isAdmin}
          />
        </div>
        <div>
          <Label htmlFor="org-about">{t("settings.fields.about")}</Label>
          <Textarea
            id="org-about"
            rows={5}
            placeholder={t("settings.fields.aboutPlaceholder")}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            disabled={!isAdmin}
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("settings.fields.accreditationDocument")}
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
              <p className="text-sm text-muted-foreground">{t("settings.noDocument")}</p>
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
                  {uploading
                    ? t("settings.buttons.uploading")
                    : org.accreditationDocumentUrl
                      ? t("settings.buttons.replace")
                      : t("settings.buttons.upload")}
                </Button>
              </>
            )}
          </div>
        </div>
        {isAdmin ? (
          <div className="flex justify-end">
            <Button onClick={save} disabled={busy}>
              {busy ? t("settings.buttons.saving") : t("settings.buttons.save")}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("settings.adminOnly")}</p>
        )}
      </CardContent>
    </Card>
  );
}
