import { createFileRoute } from "@tanstack/react-router";
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
  head: () => ({ meta: [{ title: "Registrations — MicroCred Admin" }] }),
  component: () => (
    <RoleGuard role="admin">
      <Regs />
    </RoleGuard>
  ),
});

function Regs() {
  const { registrations, approveRegistration, rejectRegistration } = useStore();
  return (
    <PageShell title="Registration Requests" description="Approve or reject organisations applying to join the platform.">
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead><TableHead>Type</TableHead><TableHead>Contact</TableHead><TableHead>Submitted</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
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
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.submittedAt).toLocaleDateString()}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell>
                    {r.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => { approveRegistration(r.id); toast.success("Approved"); }}><Check className="mr-1 h-3 w-3" />Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => { rejectRegistration(r.id); toast.info("Rejected"); }}><X className="mr-1 h-3 w-3" />Reject</Button>
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
