import { createFileRoute } from "@tanstack/react-router";
import { Hexagon, ShieldCheck, KeyRound, Network } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/issuer/ebsi")({
  head: () => ({ meta: [{ title: "EBSI Integration — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <Ebsi />
    </RoleGuard>
  ),
});

function Ebsi() {
  return (
    <PageShell
      title="EBSI Integration"
      description="Future readiness for the European Blockchain Services Infrastructure (EBSI) and W3C Verifiable Credentials."
    >
      <Card className="mb-6 border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Hexagon className="h-4 w-4 text-purple" /> EBSI status
            <Badge variant="outline" className="ml-2">Not connected</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>This research prototype simulates the credential lifecycle without anchoring to a live ledger. In production, signed VCs will be anchored to the EBSI trusted ledger and revocations propagated via Status List 2021.</p>
          <Button variant="outline" disabled className="mt-3"><Network className="mr-2 h-4 w-4" />Connect to EBSI (mock)</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Issuer DID</CardTitle></CardHeader>
          <CardContent className="font-mono text-xs text-muted-foreground">did:ebsi:zX...placeholder</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><KeyRound className="h-4 w-4" />Signing key</CardTitle></CardHeader>
          <CardContent className="font-mono text-xs text-muted-foreground">EdDSA · Ed25519 (mock)</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Trust framework</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground">Trusted Issuers Registry (TIR) — onboarding planned</CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
