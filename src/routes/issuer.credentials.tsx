import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/issuer/credentials")({
  head: () => ({ meta: [{ title: "Issued Credentials — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <List />
    </RoleGuard>
  ),
});

function List() {
  const { activeUser, credentials } = useStore();
  const [q, setQ] = useState("");
  if (!activeUser) return null;
  const mine = credentials
    .filter((c) => c.issuerId === activeUser.organizationId)
    .filter((c) =>
      !q ||
      c.title.toLowerCase().includes(q.toLowerCase()) ||
      c.earnerName.toLowerCase().includes(q.toLowerCase()) ||
      c.id.toLowerCase().includes(q.toLowerCase()),
    );

  return (
    <PageShell
      title="Issued Credentials"
      description="All micro-credentials your organisation has issued."
      actions={<Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />}
    >
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Earner</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verify</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mine.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.id}</TableCell>
                  <TableCell>{c.earnerName}</TableCell>
                  <TableCell>{c.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(c.issuedAt).toLocaleDateString()}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell>
                    <Link to="/verify/$id" params={{ id: c.id }} className="inline-flex items-center text-sm text-primary hover:underline">
                      Verify <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {mine.length === 0 && (
                <TableRow><TableCell colSpan={6} className="p-8 text-center text-sm text-muted-foreground">No credentials match.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
