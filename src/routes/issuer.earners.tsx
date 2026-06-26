import { createFileRoute, Navigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
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
import {
  assignEarnerInstitution,
  orgBulkCreateEarners,
  orgCreateEarner,
  removeEarnerInstitution,
} from "@/lib/admin-users.functions";

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
  const { t } = useTranslation("issuer");
  const { activeUser, earnerInstitutions, users, refresh } = useStore();
  const router = useRouter();
  const create = useServerFn(orgCreateEarner);
  const bulk = useServerFn(orgBulkCreateEarners);
  const assign = useServerFn(assignEarnerInstitution);
  const unlink = useServerFn(removeEarnerInstitution);
  const [tab, setTab] = useState<"existing" | "new" | "bulk">("existing");
  const [existingEmail, setExistingEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm, reset] = useProvisionState();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const orgId = activeUser?.organizationId ?? "";

  const allRows = useMemo(() => {
    if (!orgId) return [];
    const ids = new Set(
      earnerInstitutions.filter((e) => e.organizationId === orgId).map((e) => e.earnerId),
    );
    return users.filter((u) => ids.has(u.id));
  }, [earnerInstitutions, users, orgId]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((u) => u.name.toLowerCase().includes(q));
  }, [allRows, search]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page],
  );
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  useEffect(() => {
    setPage(1);
  }, [search]);


  if (!activeUser) return null;
  if (activeUser.subRole !== "admin") return <Navigate to="/issuer" />;
  if (!orgId) {
    return (
      <PageShell title={t("earners.title")}>
        <Card><CardContent className="p-8 text-sm text-muted-foreground">{t("earners.noOrg")}</CardContent></Card>
      </PageShell>
    );
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === "existing") {
        const email = existingEmail.trim().toLowerCase();
        if (!email) return;
        const user = users.find((u) => u.email.toLowerCase() === email);
        if (!user) throw new Error("No user found with that email");
        if (user.role !== "earner") throw new Error("That user is not an earner");
        await assign({ data: { earnerId: user.id, organizationId: orgId } });
        setExistingEmail("");
        toast.success(t("earners.toasts.linked"));
      } else {
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
        reset();
        toast.success(form.mode === "invite" ? t("earners.toasts.invited") : t("earners.toasts.added"));
      }
      await refresh();
      router.invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? t("earners.toasts.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function onUnlink(earnerId: string) {
    setBusy(true);
    try {
      await unlink({ data: { earnerId, organizationId: orgId } });
      toast.success(t("earners.toasts.unlinked"));
      await refresh();
      router.invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? t("earners.toasts.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      title={t("earners.title")}
      description={t("earners.description")}
    >
      <Card className="mb-6">
        <CardContent className="p-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "existing" | "new" | "bulk")}>
            <TabsList className="grid w-full grid-cols-3 sm:w-auto">
              <TabsTrigger value="existing">{t("earners.tabs.existing")}</TabsTrigger>
              <TabsTrigger value="new">{t("earners.tabs.new")}</TabsTrigger>
              <TabsTrigger value="bulk">{t("earners.tabs.bulk")}</TabsTrigger>
            </TabsList>
            <TabsContent value="existing" className="mt-4">
              <form onSubmit={onAdd} className="space-y-4">
                <div>
                  <Label htmlFor="earner-email">{t("earners.existingForm.label")}</Label>
                  <Input
                    id="earner-email"
                    type="email"
                    placeholder={t("earners.existingForm.placeholder")}
                    value={existingEmail}
                    onChange={(e) => setExistingEmail(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("earners.existingForm.hint")}
                  </p>
                </div>
                <div className="flex justify-end">
                  <SubmitButton busy={busy}>
                    <UserPlus className="mr-2 h-4 w-4" />{t("earners.addButton")}
                  </SubmitButton>
                </div>
              </form>
            </TabsContent>
            <TabsContent value="new" className="mt-4">
              <form onSubmit={onAdd} className="space-y-4">
                <ProvisionFields value={form} onChange={setForm} disabled={busy} />
                <div className="flex justify-end">
                  <SubmitButton busy={busy}>
                    <UserPlus className="mr-2 h-4 w-4" />{t("earners.addButton")}
                  </SubmitButton>
                </div>
              </form>
            </TabsContent>
            <TabsContent value="bulk" className="mt-4">
              <BulkUsersUpload
                label="earners"
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("earners.table.name")}</TableHead>
                <TableHead>{t("earners.table.email")}</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="p-8 text-center text-sm text-muted-foreground">
                    {t("earners.table.empty")}
                  </TableCell>
                </TableRow>
              )}
              {pageRows.map((u) => (
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
          {rows.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t p-3 text-sm">
              <div className="text-muted-foreground">
                {t("earners.pagination.page", { page, pageCount, total: rows.length })}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" /> {t("earners.pagination.prev")}
                </Button>
                <Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                  {t("earners.pagination.next")} <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
