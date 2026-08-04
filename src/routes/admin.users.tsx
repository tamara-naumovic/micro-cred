import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
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
  head: () => ({
    meta: [
      { title: "Users — CredSeal Admin" },
      { name: "description", content: "All registered CredSeal users across roles and institutions." },
      { property: "og:title", content: "Users — CredSeal Admin" },
      { property: "og:description", content: "All registered CredSeal users across roles and institutions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGuard role="admin">
      <UsersPage />
    </RoleGuard>
  ),
});

function UsersPage() {
  const { users, organizations, earnerInstitutions } = useStore();
  const { t } = useTranslation("admin");
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
      title={t("users.title")}
      description={t("users.description")}
      actions={
        <div className="flex items-center gap-2">
          <Input
            placeholder={t("users.search")}
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
                <TableHead>{t("users.table.name")}</TableHead>
                <TableHead>{t("users.table.email")}</TableHead>
                <TableHead>{t("users.table.role")}</TableHead>
                <TableHead>{t("users.table.institution")}</TableHead>
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
                      {u.role === "issuer" && (u.subRoles?.length
                        ? ` · ${u.subRoles.join(" + ")}`
                        : u.subRole ? ` · ${u.subRole}` : "")}
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

type RoleCategory = "earner" | "issuer" | "platform_admin";

function mockUserToCategory(u: MockUser): RoleCategory {
  if (u.role === "admin") return "platform_admin";
  if (u.role === "issuer") return "issuer";
  return "earner";
}

function rolesFromCategory(
  cat: RoleCategory,
  issuerAdmin: boolean,
  issuerStaff: boolean,
): AppRole[] {
  if (cat === "earner") return ["earner"];
  if (cat === "platform_admin") return ["platform_admin"];
  const roles: AppRole[] = [];
  if (issuerAdmin) roles.push("issuer_admin");
  if (issuerStaff) roles.push("issuer_staff");
  return roles;
}

function AddUserDialog() {
  const { organizations, reset: storeReset } = useStore();
  const { t } = useTranslation("admin");
  const create = useServerFn(adminCreateUser);
  const assign = useServerFn(assignEarnerInstitution);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<RoleCategory>("earner");
  const [issuerAdmin, setIssuerAdmin] = useState(true);
  const [issuerStaff, setIssuerStaff] = useState(false);
  const [orgId, setOrgId] = useState<string>("");
  const [earnerOrgIds, setEarnerOrgIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm, reset] = useProvisionState();

  const needsOrg = category === "issuer";
  const isEarner = category === "earner";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const roles = rolesFromCategory(category, issuerAdmin, issuerStaff);
    if (roles.length === 0) {
      toast.error(t("users.toasts.pickSubRole"));
      return;
    }
    if (needsOrg && !orgId) {
      toast.error(t("users.toasts.pickInstitution"));
      return;
    }
    setBusy(true);
    try {
      const res = await create({
        data: {
          email: form.email,
          displayName: form.displayName,
          roles,
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
      toast.success(form.mode === "invite" ? t("users.toasts.invited") : t("users.toasts.created"));
      reset();
      setOrgId("");
      setEarnerOrgIds([]);
      setOpen(false);
      storeReset();
    } catch (e: any) {
      toast.error(e?.message ?? t("users.toasts.createFailed"));
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
          <UserPlus className="mr-2 h-4 w-4" /> {t("users.add.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("users.add.title")}</DialogTitle>
          <DialogDescription>{t("users.add.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>{t("users.fields.role")}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as RoleCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="earner">{t("users.roles.earner")}</SelectItem>
                  <SelectItem value="issuer">{t("users.roles.issuer")}</SelectItem>
                  <SelectItem value="platform_admin">{t("users.roles.platform_admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {needsOrg && (
              <div>
                <Label>{t("users.fields.institution")}</Label>
                <Select value={orgId} onValueChange={setOrgId}>
                  <SelectTrigger><SelectValue placeholder={t("users.fields.selectInstitution")} /></SelectTrigger>
                  <SelectContent>
                    {organizations.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {needsOrg && (
            <div className="rounded-md border border-border p-3">
              <Label className="text-sm">{t("users.fields.subRoles")}</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                {t("users.fields.subRolesHint")}
              </p>
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={issuerAdmin}
                    onChange={(e) => setIssuerAdmin(e.target.checked)}
                    disabled={busy}
                  />
                  <span className="text-sm">{t("users.fields.institutionAdmin")}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={issuerStaff}
                    onChange={(e) => setIssuerStaff(e.target.checked)}
                    disabled={busy}
                  />
                  <span className="text-sm">{t("users.fields.staff")}</span>
                </label>
              </div>
            </div>
          )}
          {isEarner && organizations.length > 0 && (
            <div>
              <Label>{t("users.fields.institutionsOptional")}</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                {t("users.fields.institutionsOptionalHint")}
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
            <SubmitButton busy={busy}>{t("users.add.submit")}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManageEarnerOrgsDialog({ earnerId, earnerName }: { earnerId: string; earnerName: string }) {
  const { organizations, earnerInstitutions, reset: storeReset } = useStore();
  const { t } = useTranslation("admin");
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
      toast.error(e?.message ?? t("users.toasts.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">{t("users.manage")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("users.earnerOrgs.title", { name: earnerName })}</DialogTitle>
          <DialogDescription>{t("users.earnerOrgs.description")}</DialogDescription>
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
                  {isLinked ? t("users.earnerOrgs.unlink") : t("users.earnerOrgs.link")}
                </Button>
              </div>
            );
          })}
          {organizations.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("users.earnerOrgs.empty")}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user }: { user: MockUser }) {
  const { organizations, reset } = useStore();
  const { t } = useTranslation("admin");
  const update = useServerFn(adminUpdateUser);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [category, setCategory] = useState<RoleCategory>(mockUserToCategory(user));
  const initialSubs = user.subRoles ?? (user.subRole ? [user.subRole] : []);
  const [issuerAdmin, setIssuerAdmin] = useState(initialSubs.includes("admin"));
  const [issuerStaff, setIssuerStaff] = useState(initialSubs.includes("staff"));
  const [orgId, setOrgId] = useState<string>(user.organizationId ?? "");

  const needsOrg = category === "issuer";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const roles = rolesFromCategory(category, issuerAdmin, issuerStaff);
    if (roles.length === 0) {
      toast.error(t("users.toasts.pickSubRole"));
      return;
    }
    if (needsOrg && !orgId) {
      toast.error(t("users.toasts.pickInstitution"));
      return;
    }
    setBusy(true);
    try {
      await update({
        data: {
          userId: user.id,
          email: email !== user.email ? email : undefined,
          displayName: displayName !== user.name ? displayName : undefined,
          roles,
          organizationId: needsOrg ? orgId : null,
        },
      });
      toast.success(t("users.toasts.updated"));
      setOpen(false);
      reset();
    } catch (err: any) {
      toast.error(err?.message ?? t("users.toasts.updateFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={t("users.editAria")}>
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("users.edit.title")}</DialogTitle>
          <DialogDescription>{t("users.edit.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>{t("users.edit.displayName")}</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("users.edit.email")}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label>{t("users.fields.role")}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as RoleCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="earner">{t("users.roles.earner")}</SelectItem>
                  <SelectItem value="issuer">{t("users.roles.issuer")}</SelectItem>
                  <SelectItem value="platform_admin">{t("users.roles.platform_admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {needsOrg && (
              <div>
                <Label>{t("users.fields.institution")}</Label>
                <Select value={orgId} onValueChange={setOrgId}>
                  <SelectTrigger><SelectValue placeholder={t("users.fields.selectInstitution")} /></SelectTrigger>
                  <SelectContent>
                    {organizations.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {needsOrg && (
            <div className="rounded-md border border-border p-3">
              <Label className="text-sm">{t("users.fields.subRoles")}</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                {t("users.fields.subRolesHint")}
              </p>
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={issuerAdmin}
                    onChange={(e) => setIssuerAdmin(e.target.checked)}
                    disabled={busy}
                  />
                  <span className="text-sm">{t("users.fields.institutionAdmin")}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={issuerStaff}
                    onChange={(e) => setIssuerStaff(e.target.checked)}
                    disabled={busy}
                  />
                  <span className="text-sm">{t("users.fields.staff")}</span>
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy}>{busy ? t("users.edit.saving") : t("users.edit.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({ user }: { user: MockUser }) {
  const { reset } = useStore();
  const { t } = useTranslation("admin");
  const del = useServerFn(adminDeleteUser);
  const [busy, setBusy] = useState(false);

  async function onConfirm() {
    setBusy(true);
    try {
      await del({ data: { userId: user.id } });
      toast.success(t("users.toasts.deleted"));
      reset();
    } catch (err: any) {
      toast.error(err?.message ?? t("users.toasts.deleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={t("users.deleteAria")}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("users.delete.title", { name: user.name })}</AlertDialogTitle>
          <AlertDialogDescription>{t("users.delete.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("users.delete.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {busy ? t("users.delete.deleting") : t("users.delete.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
