import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail — CredSeal Admin" },
      { name: "description", content: "Tamper-evident record of role-based actions across CredSeal." },
      { property: "og:title", content: "Audit Trail — CredSeal Admin" },
      { property: "og:description", content: "Tamper-evident record of role-based actions across CredSeal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGuard role="admin">
      <Audit />
    </RoleGuard>
  ),
});

function Audit() {
  const { audit } = useStore();
  const { t, i18n } = useTranslation("admin");
  return (
    <PageShell title={t("audit.title")} description={t("audit.description")}>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("audit.table.timestamp")}</TableHead>
                <TableHead>{t("audit.table.actor")}</TableHead>
                <TableHead>{t("audit.table.action")}</TableHead>
                <TableHead>{t("audit.table.target")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(a.at).toLocaleString(i18n.language)}
                  </TableCell>
                  <TableCell>{a.actor}</TableCell>
                  <TableCell>{a.action}</TableCell>
                  <TableCell className="font-mono text-xs">{a.target}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
