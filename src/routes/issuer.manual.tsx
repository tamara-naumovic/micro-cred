import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Award,
  BadgeCheck,
  Bell,
  BookOpen,
  FilePlus2,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Link2,
  PlayCircle,
  Send,
  Settings,
  UploadCloud,
  Users,
  XOctagon,
} from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { resetIssuerTour, startIssuerTour } from "@/lib/tour/issuerTour";

export const Route = createFileRoute("/issuer/manual")({
  head: () => ({ meta: [{ title: "Manual — MicroCred" }] }),
  component: () => (
    <RoleGuard role="issuer">
      <Manual />
    </RoleGuard>
  ),
});

type Section = {
  icon: typeof BookOpen;
  title: string;
  to: string;
  linkLabel: string;
  body: string;
  adminOnly?: boolean;
};

const SECTIONS: Section[] = [
  {
    icon: LayoutDashboard,
    title: "Overview",
    to: "/issuer",
    linkLabel: "Open Overview",
    body:
      "Institution dashboard with key metrics (published micro-credentials, issued credentials, active learners and staff), credential lifecycle, pending actions, blockchain status and recent activity.",
  },
  {
    icon: BookOpen,
    title: "Micro-credentials",
    to: "/issuer/microcredential-templates",
    linkLabel: "Open Micro-credentials",
    body:
      "Catalog of micro-credential templates for your institution. Admins see all templates; staff see only the templates they are assigned to. Open a template to view requirements, evidence, supervisors and quality-assurance documents.",
  },
  {
    icon: FilePlus2,
    title: "Create Micro-credential",
    to: "/issuer/microcredential-templates/new",
    linkLabel: "Open Create Micro-credential",
    adminOnly: true,
    body:
      "Define a new template: title, description, level, learning outcomes, prerequisites, evidence requirements, supervisors, stackability and quality-assurance documents. Publish when ready so learners can apply.",
  },
  {
    icon: Users,
    title: "Staff",
    to: "/issuer/staff",
    linkLabel: "Open Staff",
    adminOnly: true,
    body:
      "Manage staff members in your institution and assign them to specific micro-credentials. Assigned staff can review applications and issue credentials only for their templates.",
  },
  {
    icon: GraduationCap,
    title: "Earners",
    to: "/issuer/earners",
    linkLabel: "Open Earners",
    adminOnly: true,
    body:
      "Directory of learners who have applied for or received credentials from your institution. Review their history and issued credentials.",
  },
  {
    icon: Inbox,
    title: "Issuance Requests",
    to: "/issuer/requests",
    linkLabel: "Open Issuance Requests",
    body:
      'Incoming applications. Review submitted evidence, request changes, mark as "Evidence collected" and "Verified", then issue the credential. You can also reject with a reason — the earner can edit and resend.',
  },
  {
    icon: Send,
    title: "Direct Issuance",
    to: "/issuer/issue",
    linkLabel: "Open Direct Issuance",
    body:
      "Issue a credential directly to a single earner without an application — useful for invited recipients or pre-verified achievements.",
  },
  {
    icon: UploadCloud,
    title: "Bulk Issuance",
    to: "/issuer/issue/bulk",
    linkLabel: "Open Bulk Issuance",
    body:
      "Upload a CSV to issue the same micro-credential to many earners at once. Validate the file, review the preview, then submit the batch.",
  },
  {
    icon: Award,
    title: "Issued Credentials",
    to: "/issuer/credentials",
    linkLabel: "Open Issued Credentials",
    body:
      'All credentials your institution has issued. Use search (by earner, title or ID) and filters (template, lifecycle status) to narrow the list — the search box has an "x" to reset it. The first time you open this page a short guided tour walks you through the available actions. Per-row actions depend on the lifecycle: "Edit & resend" for rejected credentials (update grade and/or expiry, then resend to the earner for acceptance); "Accept rejection" to permanently delete a rejected credential; "Renew expiry" for issued or expired credentials with an expiry date (walks through review → evidence collected → verified, then issues the new expiry on chain without requiring earner acceptance).',
  },
  {
    icon: XOctagon,
    title: "Revocations",
    to: "/issuer/revocations",
    linkLabel: "Open Revocations",
    adminOnly: true,
    body:
      "Revoke previously issued credentials with a reason. Revocations are anchored on the blockchain so verifiers always see the current status.",
  },
  {
    icon: Link2,
    title: "Blockchain Queue",
    to: "/issuer/anchoring-queue",
    linkLabel: "Open Blockchain Queue",
    body:
      "Anchoring status of issued credentials: pending, submitted, confirmed or failed. Retry failed anchors and inspect transaction details.",
  },
  {
    icon: BadgeCheck,
    title: "Public Profile",
    to: "/issuer/profile",
    linkLabel: "Open Public Profile",
    adminOnly: true,
    body:
      "Public page of your institution that learners and employers can visit. Lists your published micro-credentials and lets visitors verify any credential you have issued.",
  },
  {
    icon: Bell,
    title: "Notifications",
    to: "/issuer/notifications",
    linkLabel: "Open Notifications",
    body:
      "Updates on new applications, evidence submissions, anchoring failures, revocations and other relevant events.",
  },
  {
    icon: Settings,
    title: "Settings",
    to: "/issuer/settings",
    linkLabel: "Open Settings",
    body: "Account settings, security, blockchain configuration and notification preferences.",
  },
];

function Manual() {
  const { activeUser } = useStore();
  if (!activeUser) return null;
  const isStaff = activeUser.subRole === "staff";
  const sections = SECTIONS.filter((s) => !(s.adminOnly && isStaff));

  return (
    <PageShell
      title="Manual"
      description="A guide to the platform — what each section does and how to use it."
      actions={
        <Button
          variant="outline"
          onClick={() => {
            const sub = activeUser.subRole ?? "admin";
            resetIssuerTour(activeUser.id);
            startIssuerTour(activeUser.id, sub, { force: true });
          }}
        >
          <PlayCircle className="mr-2 h-4 w-4" /> Restart guided tour
        </Button>
      }
    >
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Getting started</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            MicroCred lets your institution design, issue and manage verifiable micro-credentials.
            Every issued credential is anchored on the blockchain so anyone can independently verify
            it.
          </p>
          <p>
            Below you'll find more detail on each part of the platform. Use the "Open ..." links to
            jump straight to the matching page.
            {isStaff
              ? " As a staff member you see the sections relevant to the micro-credentials you are assigned to."
              : ""}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.to}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-primary" />
                  {s.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{s.body}</p>
                <Button variant="link" asChild className="px-0">
                  <Link to={s.to}>{s.linkLabel} →</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
