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
  const { organizations, reset: storeReset } = useStore();
  const create = useServerFn(adminCreateUser);
  const assign = useServerFn(assignEarnerInstitution);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<AppRole>("earner");
  const [orgId, setOrgId] = useState<string>("");
  const [earnerOrgIds, setEarnerOrgIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm, reset] = useProvisionState();

  const needsOrg = role === "issuer_admin" || role === "issuer_staff";
  const isEarner = role === "earner";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (needsOrg && !orgId) {
      toast.error("Pick an institution for this role");
      return;
    }
    setBusy(true);
    try {
      const res = await create({
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
      if (isEarner && earnerOrgIds.length > 0 && res?.userId) {
        await Promise.all(
          earnerOrgIds.map((oid) =>
            assign({ data: { earnerId: res.userId, organizationId: oid } }).catch(() => null),
          ),
        );
      }
      toast.success(form.mode === "invite" ? "Invitation sent" : "User created");
      reset();
      setOrgId("");
      setEarnerOrgIds([]);
      setOpen(false);
      storeReset();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create user");
    } finally {
      setBusy(false);
    }
  }

  function toggleEarnerOrg(id: string) {
    setEarnerOrgIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
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
          {isEarner && organizations.length > 0 && (
            <div>
              <Label>Institutions (optional)</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Link this earner to one or more institutions. You can also do this later from the user list.
              </p>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {organizations.map((o) => {
                  const checked = earnerOrgIds.includes(o.id);
                  return (
                    <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEarnerOrg(o.id)}
                        disabled={busy}
                      />
                      <span className="text-sm">{o.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{o.country}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
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
  const { organizations, earnerInstitutions, reset: storeReset } = useStore();
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
      storeReset();
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

function EditUserDialog({ user }: { user: MockUser }) {
  const { organizations, reset } = useStore();
  const update = useServerFn(adminUpdateUser);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<AppRole>(mockUserToAppRole(user));
  const [orgId, setOrgId] = useState<string>(user.organizationId ?? "");

  const needsOrg = role === "issuer_admin" || role === "issuer_staff";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (needsOrg && !orgId) {
      toast.error("Pick an institution for this role");
      return;
    }
    setBusy(true);
    try {
      await update({
        data: {
          userId: user.id,
          email: email !== user.email ? email : undefined,
          displayName: displayName !== user.name ? displayName : undefined,
          role,
          organizationId: needsOrg ? orgId : null,
        },
      });
      toast.success("User updated");
      setOpen(false);
      reset();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Edit user">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>Update profile and role for this user.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Display name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
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
          <DialogFooter>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({ user }: { user: MockUser }) {
  const { reset } = useStore();
  const del = useServerFn(adminDeleteUser);
  const [busy, setBusy] = useState(false);

  async function onConfirm() {
    setBusy(true);
    try {
      await del({ data: { userId: user.id } });
      toast.success("User deleted");
      reset();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Delete user">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the account, profile, and role assignments. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {busy ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
