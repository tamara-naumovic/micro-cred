import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/admin/registrations")({
  head: () => ({
    meta: [
      { title: "Registration Requests — CredSeal Admin" },
      { name: "description", content: "Approve or reject institutions applying to join the CredSeal platform." },
      { property: "og:title", content: "Registration Requests — CredSeal Admin" },
      { property: "og:description", content: "Approve or reject institutions applying to join the CredSeal platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGuard role="admin">
      <Regs />
    </RoleGuard>
  ),
});

function Regs() {
  const { registrations, approveRegistration, rejectRegistration } = useStore();
  const { t, i18n } = useTranslation("admin");
  return (
    <PageShell title={t("registrations.title")} description={t("registrations.description")}>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("registrations.table.organization")}</TableHead>
                <TableHead>{t("registrations.table.type")}</TableHead>
                <TableHead>{t("registrations.table.contact")}</TableHead>
                <TableHead>{t("registrations.table.submitted")}</TableHead>
                <TableHead>{t("registrations.table.status")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.organizationName}</div>
                    <div className="text-xs text-muted-foreground">{r.country}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{r.type}</Badge></TableCell>
                  <TableCell className="text-sm">{r.contactName}<div className="text-xs text-muted-foreground">{r.contactEmail}</div></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.submittedAt).toLocaleDateString(i18n.language)}
                  </TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell>
                    {r.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => { approveRegistration(r.id); toast.success(t("registrations.approved")); }}>
                          <Check className="mr-1 h-3 w-3" />{t("registrations.approve")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { rejectRegistration(r.id); toast.info(t("registrations.rejected")); }}>
                          <X className="mr-1 h-3 w-3" />{t("registrations.reject")}
                        </Button>
                      </div>
                    )}
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
