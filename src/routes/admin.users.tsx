import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users — MicroCred Admin" }] }),
  component: () => (
    <RoleGuard role="admin">
      <UsersPage />
    </RoleGuard>
  ),
});

function UsersPage() {
  const { users } = useStore();
  const [q, setQ] = useState("");
  const rows = users.filter(
    (u) => !q || u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()) || u.role.includes(q.toLowerCase()),
  );
  return (
    <PageShell
      title="Users"
      description="All registered users across roles."
      actions={<Input placeholder="Search by name, email or role" value={q} onChange={(e) => setQ(e.target.value)} className="w-72" />}
    >
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Organisation</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{u.role}</Badge></TableCell>
                  <TableCell className="text-sm">{u.organization ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
