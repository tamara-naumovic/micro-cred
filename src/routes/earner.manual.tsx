import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Award,
  Bell,
  BookOpen,
  ClipboardList,
  FilePlus2,
  LayoutDashboard,
  PlayCircle,
  Settings,
  UserCircle,
} from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { resetEarnerTour, startEarnerTour } from "@/lib/tour/earnerTour";

export const Route = createFileRoute("/earner/manual")({
  head: () => ({ meta: [{ title: "Manual — MicroCred" }] }),
  component: () => (
    <RoleGuard role="earner">
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
};

const SECTIONS: Section[] = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    to: "/earner",
    linkLabel: "Open Dashboard",
    body:
      "Landing page with an overview of active credentials, applications in progress, credentials expiring soon and publicly shared credentials. Includes shortcuts to your latest credentials and applications.",
  },
  {
    icon: Award,
    title: "My Credentials",
    to: "/earner/credentials",
    linkLabel: "Open My Credentials",
    body:
      "All of your issued credentials. Open a credential to see the full details, evidence, blockchain proof (anchor transaction), verification QR code and public sharing options.",
  },
  {
    icon: Award,
    title: "Credential Details",
    to: "/earner/credentials",
    linkLabel: "Open My Credentials",
    body:
      "Each credential shows its status, issuer, issue and expiry dates, grade, skills and learning outcomes. You can view blockchain anchoring details (transaction hash, block number, contract), evidence submitted during the application, and a verification QR code. If a credential is pending, you can accept it to activate anchoring or reject it with a reason for the issuer.",
  },
  {
    icon: ClipboardList,
    title: "Applications",
    to: "/earner/applications",
    linkLabel: "Open Applications",
    body:
      'Track application status: Submitted → In review → Evidence collected → Verified → Issued. If an application is Rejected you can either accept the rejection or open "Edit & resend" to submit a corrected version. The issuer can also renew the expiry of an already issued credential.',
  },
  {
    icon: FilePlus2,
    title: "Apply for Credential",
    to: "/earner/apply",
    linkLabel: "Open Apply",
    body:
      "Browse available micro-credential templates by issuer, field or level. Open a template, review the requirements and evidence to attach, then submit your application.",
  },
  {
    icon: UserCircle,
    title: "Public Profile",
    to: "/earner/profile",
    linkLabel: "Open Public Profile",
    body:
      "Your public profile listing the credentials you have marked as public. Share the link with employers and institutions — every credential includes on-chain verification.",
  },
  {
    icon: Award,
    title: "Privacy Settings",
    to: "/earner/credentials",
    linkLabel: "Open My Credentials",
    body:
      "On every credential detail page you can control what appears on the public verification page. Toggle whether the credential is publicly visible at all, and individually show or hide the source, grade, expiry date, level, prerequisites, supervision details and stackability. Learning outcomes and quality-assurance documents are always visible to anyone with the verification link.",
  },
  {
    icon: Bell,
    title: "Notifications",
    to: "/earner/notifications",
    linkLabel: "Open Notifications",
    body:
      "Updates on application status changes, newly issued credentials, expirations and messages from issuers.",
  },
  {
    icon: Settings,
    title: "Settings",
    to: "/earner/settings",
    linkLabel: "Open Settings",
    body: "Account settings, security and notification preferences.",
  },
];

function Manual() {
  const { activeUser } = useStore();
  if (!activeUser) return null;

  return (
    <PageShell
      title="Manual"
      description="A guide to the platform — what each section does and how to use it."
      actions={
        <Button
          variant="outline"
          onClick={() => {
            resetEarnerTour(activeUser.id);
            startEarnerTour(activeUser.id, { force: true });
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
            MicroCred lets you collect and share verifiable micro-credentials. Every issued
            credential is anchored on the blockchain and can be independently verified.
          </p>
          <p>
            Below you'll find more detail on each part of the platform. Use the "Open ..." links to
            jump straight to the matching page.
          </p>
        </CardContent>
      </Card>


      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => {
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
