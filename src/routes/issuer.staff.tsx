import { createFileRoute, Navigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProvisionFields, SubmitButton, useProvisionState } from "@/components/admin/ProvisionFields";
import { BulkUsersUpload } from "@/components/admin/BulkUsersUpload";
import { useStore } from "@/lib/store";
import { addIssuerStaff, bulkAddIssuerStaff, listIssuerStaff, removeIssuerStaff } from "@/lib/issuer-staff.functions";

const PAGE_SIZE = 10;


export const Route = createFileRoute("/issuer/staff")({
  head: () => ({ meta: [{ title: "Staff — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <StaffPage />
    </RoleGuard>
  ),
});

type Row = { userId: string; email: string; displayName: string; createdAt: string };

function StaffPage() {
  const { activeUser } = useStore();
  const router = useRouter();
  const list = useServerFn(listIssuerStaff);
  const add = useServerFn(addIssuerStaff);
  const remove = useServerFn(removeIssuerStaff);
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [existingEmail, setExistingEmail] = useState("");
  const [form, setForm, reset] = useProvisionState();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const orgId = activeUser?.organizationId ?? "";

  async function refresh() {
    if (!orgId) return;
    setLoading(true);
    try {
      const r = await list({ data: { organizationId: orgId } });
      setRows(r);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [orgId]);

  if (!activeUser) return null;
  if (activeUser.subRole !== "admin") return <Navigate to="/issuer" />;
  if (!orgId) {
    return (
      <PageShell title="Staff">
        <Card><CardContent className="p-8 text-sm text-muted-foreground">Your account is not linked to an institution.</CardContent></Card>
      </PageShell>
    );
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === "existing") {
        if (!existingEmail.trim()) return;
        await add({ data: { email: existingEmail, organizationId: orgId, mode: "existing" } });
        setExistingEmail("");
      } else {
        await add({
          data: {
            email: form.email,
            organizationId: orgId,
            displayName: form.displayName,
            mode: form.mode,
            password: form.password,
            redirectTo: typeof window !== "undefined" ? `${window.location.origin}/set-password` : undefined,
          },
        });
        reset();
      }
      toast.success("Staff added");
      await refresh();
      router.invalidate();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add staff");
    } finally {
      setBusy(false);
    }
  }

  const onRemove = async (userId: string) => {
    setBusy(true);
    try {
      await remove({ data: { userId, organizationId: orgId } });
      toast.success("Staff removed");
      await refresh();
      router.invalidate();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to remove staff");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell
      title="Staff"
      description="Employees of your institution who can issue micro-credentials assigned to them."
    >
      <Card className="mb-6">
        <CardContent className="p-5">
          <form onSubmit={onAdd} className="space-y-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "existing" | "new")}>
              <TabsList className="grid w-full grid-cols-2 sm:w-auto">
                <TabsTrigger value="existing">Existing user</TabsTrigger>
                <TabsTrigger value="new">Create new account</TabsTrigger>
              </TabsList>
              <TabsContent value="existing" className="mt-4">
                <Label htmlFor="staff-email">Email of existing user</Label>
                <Input
                  id="staff-email"
                  type="email"
                  placeholder="employee@institution.org"
                  value={existingEmail}
                  onChange={(e) => setExistingEmail(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The person must already have an account on the platform.
                </p>
              </TabsContent>
              <TabsContent value="new" className="mt-4">
                <ProvisionFields value={form} onChange={setForm} disabled={busy} />
              </TabsContent>
            </Tabs>
            <div className="flex justify-end">
              <SubmitButton busy={busy}>
                <UserPlus className="mr-2 h-4 w-4" />Add staff
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={4} className="p-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={4} className="p-8 text-center text-sm text-muted-foreground">No staff yet.</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell>{r.displayName || "—"}</TableCell>
                  <TableCell>{r.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => onRemove(r.userId)} disabled={busy}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
