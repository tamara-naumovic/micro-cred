import { createFileRoute, Navigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, ShieldCheck, ShieldOff, Trash2, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProvisionFields, SubmitButton, useProvisionState } from "@/components/admin/ProvisionFields";
import { BulkUsersUpload } from "@/components/admin/BulkUsersUpload";
import { useStore } from "@/lib/store";
import {
  addIssuerStaff,
  bulkAddIssuerStaff,
  listIssuerStaff,
  removeIssuerMember,
  setIssuerAdminRole,
  setIssuerStaffRole,
} from "@/lib/issuer-staff.functions";

const PAGE_SIZE = 10;


export const Route = createFileRoute("/issuer/staff")({
  head: () => ({ meta: [{ title: "Staff — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <StaffPage />
    </RoleGuard>
  ),
});

type Row = { userId: string; email: string; displayName: string; createdAt: string; isAdmin: boolean; isStaff: boolean };

function StaffPage() {
  const { t } = useTranslation("issuer");
  const { activeUser } = useStore();
  const router = useRouter();
  const list = useServerFn(listIssuerStaff);
  const add = useServerFn(addIssuerStaff);
  const remove = useServerFn(removeIssuerMember);
  const bulk = useServerFn(bulkAddIssuerStaff);
  const setAdmin = useServerFn(setIssuerAdminRole);
  const setStaff = useServerFn(setIssuerStaffRole);
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<"existing" | "new" | "bulk">("existing");
  const [existingEmail, setExistingEmail] = useState("");
  const [form, setForm, reset] = useProvisionState();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const orgId = activeUser?.organizationId ?? "";

  const roleAdminTerms = t("staff.search.roleAdmin").toLowerCase();
  const roleStaffTerms = t("staff.search.roleStaff").toLowerCase();

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const roleHaystack = r.isAdmin ? `${roleAdminTerms} ${roleStaffTerms}` : roleStaffTerms;
      return (
        (r.displayName ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        roleHaystack.includes(q)
      );
    });
  }, [rows, search, roleAdminTerms, roleStaffTerms]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredRows, page],
  );
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  useEffect(() => {
    setPage(1);
  }, [search]);


  async function refresh() {
    if (!orgId) return;
    setLoading(true);
    try {
      const r = await list({ data: { organizationId: orgId } });
      setRows(r);
    } catch (e: any) {
      toast.error(e.message ?? t("staff.toasts.failedLoad"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [orgId]);

  const isStaffSub = activeUser?.subRole === "staff";
  useEffect(() => {
    if (isStaffSub) {
      toast.error(t("staff.toasts.adminOnly"));
    }
  }, [isStaffSub]);

  if (!activeUser) return null;
  if (activeUser.subRole !== "admin") return <Navigate to="/issuer" replace />;
  if (!orgId) {
    return (
      <PageShell title={t("staff.title")}>
        <Card><CardContent className="p-8 text-sm text-muted-foreground">{t("staff.noOrg")}</CardContent></Card>
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
      toast.success(t("staff.toasts.added"));
      await refresh();
      router.invalidate();
    } catch (e: any) {
      toast.error(e.message ?? t("staff.toasts.failedAdd"));
    } finally {
      setBusy(false);
    }
  }

  const onRemove = async (userId: string) => {
    setBusy(true);
    try {
      await remove({ data: { userId, organizationId: orgId } });
      toast.success(t("staff.toasts.removed"));
      await refresh();
      router.invalidate();
    } catch (e: any) {
      toast.error(e.message ?? t("staff.toasts.failedRemove"));
    } finally {
      setBusy(false);
    }
  };

  const onToggleAdmin = async (userId: string, makeAdmin: boolean) => {
    setBusy(true);
    try {
      await setAdmin({ data: { userId, organizationId: orgId, makeAdmin } });
      toast.success(makeAdmin ? t("staff.toasts.promoted") : t("staff.toasts.demoted"));
      await refresh();
      router.invalidate();
    } catch (e: any) {
      toast.error(e.message ?? t("staff.toasts.failedRoleChange"));
    } finally {
      setBusy(false);
    }
  };

  const onToggleStaff = async (userId: string, makeStaff: boolean) => {
    setBusy(true);
    try {
      await setStaff({ data: { userId, organizationId: orgId, makeStaff } });
      toast.success(makeStaff ? t("staff.toasts.staffGranted") : t("staff.toasts.staffRevoked"));
      await refresh();
      router.invalidate();
    } catch (e: any) {
      toast.error(e.message ?? t("staff.toasts.failedStaffChange"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell
      title={t("staff.title")}
      description={t("staff.description")}
    >
      <Card className="mb-6">
        <CardContent className="p-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "existing" | "new" | "bulk")}>
            <TabsList className="grid w-full grid-cols-3 sm:w-auto">
              <TabsTrigger value="existing">{t("staff.tabs.existing")}</TabsTrigger>
              <TabsTrigger value="new">{t("staff.tabs.new")}</TabsTrigger>
              <TabsTrigger value="bulk">{t("staff.tabs.bulk")}</TabsTrigger>
            </TabsList>
            <TabsContent value="existing" className="mt-4">
              <form onSubmit={onAdd} className="space-y-4">
                <div>
                  <Label htmlFor="staff-email">{t("staff.existingForm.label")}</Label>
                  <Input
                    id="staff-email"
                    type="email"
                    placeholder={t("staff.existingForm.placeholder")}
                    value={existingEmail}
                    onChange={(e) => setExistingEmail(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("staff.existingForm.hint")}
                  </p>
                </div>
                <div className="flex justify-end">
                  <SubmitButton busy={busy}>
                    <UserPlus className="mr-2 h-4 w-4" />{t("staff.addButton")}
                  </SubmitButton>
                </div>
              </form>
            </TabsContent>
            <TabsContent value="new" className="mt-4">
              <form onSubmit={onAdd} className="space-y-4">
                <ProvisionFields value={form} onChange={setForm} disabled={busy} />
                <div className="flex justify-end">
                  <SubmitButton busy={busy}>
                    <UserPlus className="mr-2 h-4 w-4" />{t("staff.addButton")}
                  </SubmitButton>
                </div>
              </form>
            </TabsContent>
            <TabsContent value="bulk" className="mt-4">
              <BulkUsersUpload
                label="staff"
                onSubmit={async (rs) => {
                  const res = await bulk({ data: { organizationId: orgId, rows: rs } });
                  await refresh();
                  router.invalidate();
                  return res;
                }}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="border-b p-3">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("staff.search.placeholder")}
                className="pl-9"
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("staff.table.name")}</TableHead>
                <TableHead>{t("staff.table.email")}</TableHead>
                <TableHead>{t("staff.table.added")}</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={4} className="p-8 text-center text-sm text-muted-foreground">{t("staff.table.loading")}</TableCell></TableRow>
              )}
              {!loading && filteredRows.length === 0 && (
                <TableRow><TableCell colSpan={4} className="p-8 text-center text-sm text-muted-foreground">{search.trim() ? t("staff.search.noResults") : t("staff.table.empty")}</TableCell></TableRow>
              )}
              {pageRows.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{r.displayName || "—"}</span>
                      {r.isAdmin && (
                        <Badge variant="secondary" className="text-xs">{t("staff.table.alsoAdmin")}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{r.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {r.userId !== activeUser?.id && (
                        r.isAdmin ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => onToggleAdmin(r.userId, false)}
                            disabled={busy}
                            title={t("staff.table.revokeAdmin")}
                            aria-label={t("staff.table.revokeAdmin")}
                          >
                            <ShieldOff className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => onToggleAdmin(r.userId, true)}
                            disabled={busy}
                            title={t("staff.table.promoteAdmin")}
                            aria-label={t("staff.table.promoteAdmin")}
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </Button>
                        )
                      )}
                      <Button size="icon" variant="ghost" onClick={() => onRemove(r.userId)} disabled={busy}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredRows.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t p-3 text-sm">
              <div className="text-muted-foreground">
                {t("staff.pagination.page", { page, pageCount, total: filteredRows.length })}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" /> {t("staff.pagination.prev")}
                </Button>
                <Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                  {t("staff.pagination.next")} <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
