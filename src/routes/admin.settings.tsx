import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Platform Settings — MicroCred Admin" }] }),
  component: () => (
    <RoleGuard role="admin">
      <Settings />
    </RoleGuard>
  ),
});

function Settings() {
  const { reset } = useStore();
  return (
    <PageShell title="Platform Settings" description="Global configuration and prototype controls.">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Issuance policy</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Toggle label="Require provider sign-off before issuance" defaultChecked />
            <Toggle label="Allow direct issuance by issuers" defaultChecked />
            <Toggle label="Allow bulk issuance via CSV" defaultChecked />
            <Toggle label="Auto-anchor new credentials to Bloxberg" defaultChecked />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Prototype data</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Reset all in-browser data and reload mock content.</p>
            <Button variant="outline" onClick={() => { reset(); toast.success("Mock data reset"); }}>
              <RotateCcw className="mr-2 h-4 w-4" />Reset prototype data
            </Button>
          </CardContent>
        </Card>
        <ChangePasswordForm />
      </div>
    </PageShell>
  );
}

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="font-normal">{label}</Label>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
