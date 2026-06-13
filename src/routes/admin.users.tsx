import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { UserPlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProvisionFields, SubmitButton, useProvisionState } from "@/components/admin/ProvisionFields";
import { useStore } from "@/lib/store";
import {
  adminCreateUser,
  adminDeleteUser,
  adminUpdateUser,
  assignEarnerInstitution,
  removeEarnerInstitution,
} from "@/lib/admin-users.functions";
import type { MockUser } from "@/lib/types";

type AppRole = "earner" | "issuer_admin" | "issuer_staff" | "platform_admin";

function mockUserToAppRole(u: MockUser): AppRole {
  if (u.role === "admin") return "platform_admin";
  if (u.role === "issuer") return u.subRole === "staff" ? "issuer_staff" : "issuer_admin";
  return "earner";
}



export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users — MicroCred Admin" }] }),
  component: () => (
    <RoleGuard role="admin">
      <UsersPage />
    </RoleGuard>
  ),
});

function UsersPage() {
  const { users, organizations, earnerInstitutions } = useStore();
  const [q, setQ] = useState("");

  const orgNameById = useMemo(() => new Map(organizations.map((o) => [o.id, o.name])), [organizations]);
  const earnerOrgs = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const ei of earnerInstitutions) {
      const arr = m.get(ei.earnerId) ?? [];
      arr.push(orgNameById.get(ei.organizationId) ?? "?");
      m.set(ei.earnerId, arr);
    }
    return m;
  }, [earnerInstitutions, orgNameById]);

  const rows = users.filter(
    (u) =>
      !q ||
      u.name.toLowerCase().includes(q.toLowerCase()) ||
      u.email.toLowerCase().includes(q.toLowerCase()) ||
      u.role.includes(q.toLowerCase()),
  );

  return (
    <PageShell
      title="Users"
      description="All registered users across roles."
      actions={
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by name, email or role"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-72"
          />
          <AddUserDialog />
        </div>
      }
    >
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Institution / linked</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {u.role}
                      {u.subRole ? ` · ${u.subRole}` : ""}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {u.role === "earner"
                      ? (earnerOrgs.get(u.id)?.join(", ") || "—")
                      : (u.organizationId ? orgNameById.get(u.organizationId) ?? "—" : "—")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {u.role === "earner" && <ManageEarnerOrgsDialog earnerId={u.id} earnerName={u.name} />}
                      <EditUserDialog user={u} />
                      <DeleteUserDialog user={u} />
                    </div>
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

function AddUserDialog() {
  const { organizations } = useStore();
  const create = useServerFn(adminCreateUser);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<AppRole>("earner");
  const [orgId, setOrgId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [form, setForm, reset] = useProvisionState();

  const needsOrg = role === "issuer_admin" || role === "issuer_staff";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (needsOrg && !orgId) {
      toast.error("Pick an institution for this role");
      return;
    }
    setBusy(true);
    try {
      await create({
        data: {
          email: form.email,
          displayName: form.displayName,
          role,
          organizationId: needsOrg ? orgId : undefined,
          mode: form.mode,
          password: form.password,
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/set-password` : undefined,
        },
      });
      toast.success(form.mode === "invite" ? "Invitation sent" : "User created");
      reset();
      setOrgId("");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" /> Add user
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            Create a new account or invite a person to MicroCred.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="earner">Earner (student)</SelectItem>
                  <SelectItem value="issuer_staff">Issuer staff</SelectItem>
                  <SelectItem value="issuer_admin">Issuer admin</SelectItem>
                  <SelectItem value="platform_admin">Platform admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {needsOrg && (
              <div>
                <Label>Institution</Label>
                <Select value={orgId} onValueChange={setOrgId}>
                  <SelectTrigger><SelectValue placeholder="Select institution" /></SelectTrigger>
                  <SelectContent>
                    {organizations.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <ProvisionFields value={form} onChange={setForm} disabled={busy} />
          <DialogFooter>
            <SubmitButton busy={busy}>Create</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManageEarnerOrgsDialog({ earnerId, earnerName }: { earnerId: string; earnerName: string }) {
  const { organizations, earnerInstitutions } = useStore();
  const assign = useServerFn(assignEarnerInstitution);
  const remove = useServerFn(removeEarnerInstitution);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const linked = new Set(
    earnerInstitutions.filter((e) => e.earnerId === earnerId).map((e) => e.organizationId),
  );

  async function toggle(orgId: string, currentlyLinked: boolean) {
    setBusy(true);
    try {
      if (currentlyLinked) {
        await remove({ data: { earnerId, organizationId: orgId } });
      } else {
        await assign({ data: { earnerId, organizationId: orgId } });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Manage</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Institutions for {earnerName}</DialogTitle>
          <DialogDescription>
            Toggle the institutions this student is linked to.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {organizations.map((o) => {
            const isLinked = linked.has(o.id);
            return (
              <div key={o.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="font-medium">{o.name}</div>
                  <div className="text-xs text-muted-foreground">{o.country}</div>
                </div>
                <Button
                  size="sm"
                  variant={isLinked ? "secondary" : "outline"}
                  disabled={busy}
                  onClick={() => toggle(o.id, isLinked)}
                >
                  {isLinked ? "Unlink" : "Link"}
                </Button>
              </div>
            );
          })}
          {organizations.length === 0 && (
            <p className="text-sm text-muted-foreground">No institutions yet.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
