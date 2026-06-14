import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { XOctagon } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/issuer/revocations")({
  head: () => ({ meta: [{ title: "Revocations — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <Revocations />
    </RoleGuard>
  ),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Revocations() {
  const { activeUser, credentials, revokeCredential } = useStore();
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  if (!activeUser) return null;
  const mine = credentials.filter((c) => c.issuerId === activeUser.organizationId);
  const active = mine.filter((c) => c.status === "active");
  const revoked = mine.filter((c) => c.status === "revoked");

  async function handleRevoke(id: string) {
    if (!reason.trim()) {
      toast.error("Provide a reason");
      return;
    }
    setPending(true);
    try {
      if (UUID_RE.test(id)) {
        const { revokeCredentialOnChain } = await import("@/lib/chain/anchor.functions");
        const res = await revokeCredentialOnChain({ data: { credentialId: id, reason } });
        if (res.mode === "on_chain_revoke_queued") {
          toast.success("Revocation queued for on-chain anchoring");
        } else {
          toast.success("Credential revoked");
        }
        revokeCredential(id, reason);
      } else {
        revokeCredential(id, reason);
        toast.success("Credential revoked");
      }
      setTarget(null);
      setReason("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <PageShell title="Revocations" description="Mark credentials as revoked when integrity issues are confirmed.">
      <Card className="mb-6">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>ID</TableHead><TableHead>Earner</TableHead><TableHead>Title</TableHead><TableHead></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {active.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.id}</TableCell>
                  <TableCell>{c.earnerName}</TableCell>
                  <TableCell>{c.title}</TableCell>
                  <TableCell>
                    <Dialog open={target === c.id} onOpenChange={(o) => setTarget(o ? c.id : null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline"><XOctagon className="mr-2 h-4 w-4" />Revoke</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Revoke {c.id}</DialogTitle></DialogHeader>
                        <Input placeholder="Reason for revocation" value={reason} onChange={(e) => setReason(e.target.value)} />
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
                          <Button
                            onClick={() => {
                              if (!reason.trim()) return toast.error("Provide a reason");
                              revokeCredential(c.id, reason);
                              toast.success("Credential revoked");
                              setTarget(null); setReason("");
                            }}
                          >Confirm revocation</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
              {active.length === 0 && <TableRow><TableCell colSpan={4} className="p-6 text-center text-sm text-muted-foreground">No active credentials.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <h2 className="mb-3 font-display text-lg font-semibold">Revocation history</h2>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>ID</TableHead><TableHead>Earner</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {revoked.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.id}</TableCell>
                  <TableCell>{c.earnerName}</TableCell>
                  <TableCell className="text-sm">{c.revocationReason ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                </TableRow>
              ))}
              {revoked.length === 0 && <TableRow><TableCell colSpan={4} className="p-6 text-center text-sm text-muted-foreground">No revocations on record.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
