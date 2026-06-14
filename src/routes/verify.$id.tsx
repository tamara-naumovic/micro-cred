import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  FileWarning,
  GraduationCap,
  ShieldCheck,
  XOctagon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { CredentialBlockchainVerificationCard } from "@/components/CredentialBlockchainVerificationCard";
import { useStore } from "@/lib/store";
import { fetchPublicCredential } from "@/lib/credentials";

export const Route = createFileRoute("/verify/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Verify ${params.id} — MicroCred` },
      { name: "description", content: "Public verification of a micro-credential." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { id } = Route.useParams();
  const { credentials } = useStore();
  const mockCred = credentials.find((c) => c.id === id);

  // Try DB first (treat $id as share_token). Fall back to mock if nothing.
  const dbQuery = useQuery({
    queryKey: ["public-credential", id],
    queryFn: () => fetchPublicCredential(id),
    retry: false,
  });

  if (dbQuery.isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 md:px-8">
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Verifying…</CardContent></Card>
      </main>
    );
  }

  if (dbQuery.data) {
    return <RealVerify cred={dbQuery.data} shareToken={id} />;
  }

  // No DB hit — mock fallback
  if (!mockCred) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 md:px-8">
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <FileWarning className="mx-auto h-10 w-10 text-warning-foreground" />
            <h1 className="font-display text-xl font-semibold">Credential not found</h1>
            <p className="text-sm text-muted-foreground">
              No publicly verifiable credential matches this link.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!mockCred.sharing.isPublic) {
    return <PrivateNotice />;
  }

  return <MockVerify cred={mockCred} />;
}

/* ---------------- Real (DB) ---------------- */

type PublicCred = NonNullable<Awaited<ReturnType<typeof fetchPublicCredential>>>;

function RealVerify({
  cred,
  shareToken,
}: {
  cred: PublicCred;
  shareToken: string;
}) {
  const isRevoked = cred.status === "revoked";
  const isExpired = cred.status === "expired";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 md:px-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" /> Back to home</Link>
      </Button>

      <Card>
        <CardContent className="space-y-5 p-6 md:p-8">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BadgeCheck className="h-6 w-6" />
            </div>
            <StatusBadge status={cred.status} />
          </div>

          <div>
            <h1 className="font-display text-2xl font-semibold leading-tight">{cred.title}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <GraduationCap className="h-4 w-4" /> Issued by{" "}
              <span className="font-medium text-foreground">{cred.issuer_name}</span>
            </div>
          </div>

          {(isRevoked || isExpired) && (
            <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${isRevoked ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
              <XOctagon className="mt-0.5 h-4 w-4" />
              <div className="font-medium">{isRevoked ? "This credential has been revoked." : "This credential has expired."}</div>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Field label="Earner" value={cred.earner_name} />
            {cred.source && (
              <Field label="Learning source" value={cred.source === "formal" ? "Formal education" : "Non-formal"} />
            )}
            
            <Field
              label="Issued"
              value={new Date(cred.issued_at).toLocaleDateString()}
              icon={<CalendarClock className="h-3 w-3" />}
            />
            {cred.expires_at && <Field label="Expires" value={new Date(cred.expires_at).toLocaleDateString()} />}
            {cred.grade && <Field label="Grade" value={cred.grade} />}
            {cred.level && cred.level !== "N/A" && <Field label="Level" value={cred.level} />}
            {cred.ects && <Field label="Workload" value={`${cred.ects} ECTS`} />}
          </dl>

          {cred.skills && cred.skills.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Skills & competencies</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {cred.skills.map((s) => (
                  <Badge key={s} variant="secondary">{s}</Badge>
                ))}
              </div>
            </div>
          )}

          <TemplateInfo cred={cred} />

          <CredentialBlockchainVerificationCard
            audience="public"
            data={{
              credentialId: (cred as any).id,
              vcId: (cred as any).vc_id ?? null,
              templateRef: (cred as any).template_ref ?? null,
              network: "bloxberg",
              chainId: 8995,
              contractAddress: (cred as any).chain_contract_address ?? null,
              blockchainStatus: (cred as any).chain_status ?? "not_requested",
              documentHash: (cred as any).credential_hash ?? null,
              learnerCommitment: (cred as any).learner_commitment ?? null,
              transactionHash: (cred as any).chain_tx_hash ?? null,
              blockNumber: (cred as any).chain_block_number ?? null,
              issuerAddress: (cred as any).chain_issuer_address ?? null,
            }}
          />
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Share token: <span className="font-mono">{shareToken}</span>
      </p>
    </main>
  );
}

/* ---------------- Mock fallback ---------------- */

function MockVerify({ cred }: { cred: NonNullable<ReturnType<typeof useStore>["credentials"][number]> }) {
  const isRevoked = cred.status === "revoked";
  const isExpired = cred.status === "expired";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 md:px-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" /> Back to home</Link>
      </Button>

      <Card>
        <CardContent className="space-y-5 p-6 md:p-8">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BadgeCheck className="h-6 w-6" />
            </div>
            <StatusBadge status={cred.status} />
          </div>

          <div>
            <h1 className="font-display text-2xl font-semibold leading-tight">{cred.title}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <GraduationCap className="h-4 w-4" /> Issued by{" "}
              <Link to="/issuers/$id" params={{ id: cred.issuerId }} className="font-medium text-primary hover:underline">
                {cred.issuerName}
              </Link>
            </div>
          </div>

          {(isRevoked || isExpired) && (
            <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${isRevoked ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
              <XOctagon className="mt-0.5 h-4 w-4" />
              <div>
                <div className="font-medium">{isRevoked ? "This credential has been revoked." : "This credential has expired."}</div>
                {isRevoked && cred.revocationReason && <div className="mt-1 text-xs">{cred.revocationReason}</div>}
              </div>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Field label="Earner" value={cred.earnerName} />
            {cred.sharing.showSource && (
              <Field label="Learning source" value={cred.source === "formal" ? "Formal education" : `Non-formal · ${cred.subcategory?.replace(/_/g, " ") ?? ""}`} />
            )}
            <Field label="Issuer" value={cred.issuerName} />
            <Field label="Issued" value={new Date(cred.issuedAt).toLocaleDateString()} icon={<CalendarClock className="h-3 w-3" />} />
            {cred.expiresAt && cred.sharing.showExpiry && (
              <Field label="Expires" value={new Date(cred.expiresAt).toLocaleDateString()} />
            )}
            {cred.sharing.showGrade && cred.grade && <Field label="Grade" value={cred.grade} />}
            {cred.level !== "N/A" && <Field label="Level" value={cred.level} />}
            {cred.ects && <Field label="Workload" value={`${cred.ects} ECTS`} />}
          </dl>

          {cred.sharing.showSkills && cred.skills.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Skills & competencies</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {cred.skills.map((s) => (
                  <Badge key={s} variant="secondary">{s}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success-foreground">
            <ShieldCheck className="h-4 w-4" />
            Demo credential — visibility toggles are session-only.
          </div>
        </CardContent>
      </Card>


      <p className="mt-6 text-center text-xs text-muted-foreground">
        Credential ID: <span className="font-mono">{cred.id}</span>
      </p>
    </main>
  );
}

function PrivateNotice() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 md:px-8">
      <Card>
        <CardContent className="space-y-3 p-8 text-center">
          <FileWarning className="mx-auto h-10 w-10 text-warning-foreground" />
          <h1 className="font-display text-xl font-semibold">Credential is private</h1>
          <p className="text-sm text-muted-foreground">
            The earner has not made this credential publicly verifiable.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1 text-sm">{icon} {value}</dd>
    </div>
  );
}

const QA_LABEL: Record<string, string> = {
  internal: "Internal",
  external: "External",
  internal_and_external: "Internal and external",
  other: "Other",
  not_specified: "Not specified",
};
const SUPERVISION_LABEL: Record<string, string> = {
  unsupervised_no_id: "Unsupervised with no identity verification",
  supervised_no_id: "Supervised with no identity verification",
  supervised_online_with_id: "Supervised online with identity verification",
  supervised_onsite_with_id: "Supervised onsite with identity verification",
};
const STACKABILITY_LABEL: Record<string, string> = {
  stand_alone: "Stand-alone",
  independent_integrated: "Independent micro-credential / integrated",
  stackable: "Stackable towards another credential",
};

function TemplateInfo({ cred }: { cred: PublicCred }) {
  const anyOf = cred as any;
  const rows: { label: string; value: string }[] = [];
  if (anyOf.qa_type) rows.push({ label: "Quality assurance", value: QA_LABEL[anyOf.qa_type] ?? anyOf.qa_type });
  if (anyOf.prerequisites_none) rows.push({ label: "Prerequisites", value: "No prerequisites" });
  else if (anyOf.prerequisites) rows.push({ label: "Prerequisites", value: anyOf.prerequisites });
  if (anyOf.supervision_type) rows.push({ label: "Supervision & identity verification", value: SUPERVISION_LABEL[anyOf.supervision_type] ?? anyOf.supervision_type });
  if (anyOf.stackability_type) rows.push({ label: "Integration / Stackability", value: STACKABILITY_LABEL[anyOf.stackability_type] ?? anyOf.stackability_type });
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Credential details</div>
      <dl className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-6 text-sm">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">{r.label}</dt>
            <dd className="mt-0.5 text-sm">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
