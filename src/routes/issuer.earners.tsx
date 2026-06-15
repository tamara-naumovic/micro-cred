import { createFileRoute, Navigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, Upload, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { BulkUsersUpload } from "@/components/admin/BulkUsersUpload";
import { useStore } from "@/lib/store";
import { orgBulkCreateEarners, orgCreateEarner, removeEarnerInstitution } from "@/lib/admin-users.functions";

const PAGE_SIZE = 10;


export const Route = createFileRoute("/issuer/earners")({
  head: () => ({ meta: [{ title: "Earners — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <EarnersPage />
    </RoleGuard>
  ),
});

function EarnersPage() {
  const { activeUser, earnerInstitutions, users } = useStore();
  const create = useServerFn(orgCreateEarner);
  const unlink = useServerFn(removeEarnerInstitution);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm, reset] = useProvisionState();

  const orgId = activeUser?.organizationId ?? "";

  const rows = useMemo(() => {
    if (!orgId) return [];
    const ids = new Set(
      earnerInstitutions.filter((e) => e.organizationId === orgId).map((e) => e.earnerId),
    );
    return users.filter((u) => ids.has(u.id));
  }, [earnerInstitutions, users, orgId]);

  if (!activeUser) return null;
  if (activeUser.subRole !== "admin") return <Navigate to="/issuer" />;
  if (!orgId) {
    return (
      <PageShell title="Earners">
        <Card><CardContent className="p-8 text-sm text-muted-foreground">Your account is not linked to an institution.</CardContent></Card>
      </PageShell>
    );
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({
        data: {
          organizationId: orgId,
          email: form.email,
          displayName: form.displayName,
          mode: form.mode,
          password: form.password,
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/set-password` : undefined,
        },
      });
      toast.success(form.mode === "invite" ? "Invitation sent" : "Earner added");
      reset();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onUnlink(earnerId: string) {
    setBusy(true);
    try {
      await unlink({ data: { earnerId, organizationId: orgId } });
      toast.success("Unlinked");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      title="Earners"
      description="Students linked to your institution."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-4 w-4" /> Add earner</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add earner</DialogTitle>
              <DialogDescription>
                Existing accounts are linked to your institution. New accounts are
                provisioned and linked in one step.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onCreate} className="space-y-4">
              <ProvisionFields value={form} onChange={setForm} disabled={busy} />
              <DialogFooter>
                <SubmitButton busy={busy}>Add</SubmitButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="p-8 text-center text-sm text-muted-foreground">
                    No earners linked yet.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" disabled={busy} onClick={() => onUnlink(u.id)}>
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
