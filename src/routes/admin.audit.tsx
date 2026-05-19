import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({ meta: [{ title: "Audit Trail — MicroCred Admin" }] }),
  component: () => (
    <RoleGuard role="admin">
      <Audit />
    </RoleGuard>
  ),
});

function Audit() {
  const { audit } = useStore();
  return (
    <PageShell title="Audit Trail" description="Tamper-evident record of role-based actions.">
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Timestamp</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {audit.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</TableCell>
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
