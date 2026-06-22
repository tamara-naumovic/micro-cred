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
      "Početna stranica sa pregledom aktivnih kredencijala, aplikacija u toku, kredencijala koji uskoro ističu i javno deljenih kredencijala. Tu su i prečice ka poslednjim kredencijalima i aplikacijama.",
  },
  {
    icon: Award,
    title: "My Credentials",
    to: "/earner/credentials",
    linkLabel: "Open My Credentials",
    body:
      "Svi vaši izdati kredencijali. Otvorite detalje da vidite kompletne podatke, evidence, blockchain proof (anchor transakciju), QR kod za verifikaciju i opcije deljenja na javnom profilu.",
  },
  {
    icon: ClipboardList,
    title: "Applications",
    to: "/earner/applications",
    linkLabel: "Open Applications",
    body:
      "Pratite status aplikacija: Submitted → In review → Evidence collected → Verified → Issued. Ako je aplikacija odbijena (Rejected) možete je prihvatiti ili otvoriti „Edit & resend" da pošaljete ispravljenu verziju. Issuer može produžiti rok važenja postojećeg kredencijala.",
  },
  {
    icon: FilePlus2,
    title: "Apply for Credential",
    to: "/earner/apply",
    linkLabel: "Open Apply",
    body:
      "Pretražite dostupne micro-credential template-e po izdavaocu, oblasti ili nivou. Otvorite template, pregledajte zahteve i evidence koje treba priložiti, i pošaljite aplikaciju.",
  },
  {
    icon: UserCircle,
    title: "Public Profile",
    to: "/earner/profile",
    linkLabel: "Open Public Profile",
    body:
      "Vaš javni profil sa kredencijalima koje ste označili kao javne. Link možete deliti sa poslodavcima i institucijama — svaki kredencijal sadrži verifikaciju na blockchain-u.",
  },
  {
    icon: Bell,
    title: "Notifications",
    to: "/earner/notifications",
    linkLabel: "Open Notifications",
    body:
      "Obaveštenja o promenama statusa aplikacija, izdavanju novih kredencijala, isteku i porukama od izdavaoca.",
  },
  {
    icon: Settings,
    title: "Settings",
    to: "/earner/settings",
    linkLabel: "Open Settings",
    body: "Podešavanja naloga, bezbednost i preference obaveštenja.",
  },
];

function Manual() {
  const { activeUser } = useStore();
  if (!activeUser) return null;

  return (
    <PageShell
      title="Manual"
      description="Vodič kroz platformu — šta svaki deo radi i kako se koristi."
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
            MicroCred vam omogućava da prikupljate i delite verifikovane micro-credentials. Svaki
            izdati kredencijal je zapisan na blockchain-u i može se nezavisno verifikovati.
          </p>
          <p>
            Ispod su detaljnija objašnjenja za svaki deo platforme. Kliknite na link „Open ..." da
            otvorite odgovarajuću stranicu.
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
