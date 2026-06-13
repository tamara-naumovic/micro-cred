import { createFileRoute, Navigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store";
import {
  addIssuerStaff,
  listIssuerStaff,
  removeIssuerStaff,
} from "@/lib/issuer-staff.functions";

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
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const orgId = activeUser?.organizationId;

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

  const onAdd = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await add({ data: { email, organizationId: orgId } });
      toast.success("Staff added");
      setEmail("");
      await refresh();
      router.invalidate();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add staff");
    } finally {
      setBusy(false);
    }
  };

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
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="staff-email">Add staff by email</Label>
              <Input
                id="staff-email"
                type="email"
                placeholder="employee@institution.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The person must already have an account on the platform.
              </p>
            </div>
            <Button onClick={onAdd} disabled={busy || !email.trim()}>
              <UserPlus className="mr-2 h-4 w-4" />Add staff
            </Button>
          </div>
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
