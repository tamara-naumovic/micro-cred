import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Award,
  BadgeCheck,
  Bell,
  BookOpen,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FilePlus2,
  GraduationCap,
  History,
  Inbox,
  LayoutDashboard,
  Link2,
  ListChecks,
  LogOut,
  Mail,
  Send,
  Settings,
  ShieldCheck,
  UploadCloud,
  UserCircle,
  Users,
  XOctagon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import type { MockUser, Role } from "@/lib/types";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  dataTour?: string;
}

type NavGroups = { group: string; items: NavItem[] }[];

function buildEarnerNav(t: (k: string) => string): NavGroups {
  return [
    {
      group: t("sidebar.groups.workspace"),
      items: [
        { to: "/earner", label: t("sidebar.earner.dashboard"), icon: LayoutDashboard, dataTour: "nav-dashboard" },
        { to: "/earner/credentials", label: t("sidebar.earner.credentials"), icon: Award, dataTour: "nav-my-credentials" },
        { to: "/earner/applications", label: t("sidebar.earner.applications"), icon: ClipboardList, dataTour: "nav-applications" },
        { to: "/earner/apply", label: t("sidebar.earner.apply"), icon: FilePlus2, dataTour: "nav-apply" },
      ],
    },
    {
      group: t("sidebar.groups.sharing"),
      items: [
        { to: "/earner/profile", label: t("sidebar.earner.profile"), icon: UserCircle, dataTour: "nav-profile" },
        { to: "/earner/notifications", label: t("sidebar.earner.notifications"), icon: Bell, dataTour: "nav-notifications" },
        { to: "/earner/manual", label: t("sidebar.earner.manual"), icon: BookOpen, dataTour: "nav-manual" },
        { to: "/earner/settings", label: t("sidebar.earner.settings"), icon: Settings },
      ],
    },
  ];
}

function buildIssuerAdminNav(t: (k: string) => string): NavGroups {
  return [
    { group: t("sidebar.groups.overview"), items: [{ to: "/issuer", label: t("sidebar.issuer.overview"), icon: LayoutDashboard, dataTour: "nav-issuer-overview" }] },
    {
      group: t("sidebar.groups.microcredentials"),
      items: [
        { to: "/issuer/microcredential-templates", label: t("sidebar.issuer.templates"), icon: BookOpen, dataTour: "nav-issuer-templates" },
        { to: "/issuer/microcredential-templates/new", label: t("sidebar.issuer.templateNew"), icon: FilePlus2, dataTour: "nav-issuer-template-new" },
        { to: "/issuer/staff", label: t("sidebar.issuer.staff"), icon: Users, dataTour: "nav-issuer-staff" },
        { to: "/issuer/earners", label: t("sidebar.issuer.earners"), icon: GraduationCap, dataTour: "nav-issuer-earners" },
      ],
    },
    {
      group: t("sidebar.groups.issuance"),
      items: [
        { to: "/issuer/requests", label: t("sidebar.issuer.requests"), icon: Inbox, dataTour: "nav-issuer-requests" },
        { to: "/issuer/issue", label: t("sidebar.issuer.issue"), icon: Send, dataTour: "nav-issuer-issue" },
        { to: "/issuer/issue/bulk", label: t("sidebar.issuer.bulk"), icon: UploadCloud, dataTour: "nav-issuer-bulk" },
        { to: "/issuer/credentials", label: t("sidebar.issuer.credentials"), icon: Award, dataTour: "nav-issuer-credentials" },
        { to: "/issuer/revocations", label: t("sidebar.issuer.revocations"), icon: XOctagon, dataTour: "nav-issuer-revocations" },
        { to: "/issuer/anchoring-queue", label: t("sidebar.issuer.anchoring"), icon: Link2, dataTour: "nav-issuer-anchoring" },
      ],
    },
    {
      group: t("sidebar.groups.account"),
      items: [
        { to: "/issuer/profile", label: t("sidebar.issuer.profile"), icon: BadgeCheck, dataTour: "nav-issuer-profile" },
        { to: "/issuer/notifications", label: t("sidebar.issuer.notifications"), icon: Bell, dataTour: "nav-issuer-notifications" },
        { to: "/issuer/manual", label: t("sidebar.issuer.manual"), icon: BookOpen, dataTour: "nav-issuer-manual" },
        { to: "/issuer/settings", label: t("sidebar.issuer.settings"), icon: Settings },
      ],
    },
  ];
}

function buildIssuerStaffNav(t: (k: string) => string): NavGroups {
  return [
    { group: t("sidebar.groups.overview"), items: [{ to: "/issuer", label: t("sidebar.issuer.overview"), icon: LayoutDashboard, dataTour: "nav-issuer-overview" }] },
    {
      group: t("sidebar.groups.microcredentials"),
      items: [
        { to: "/issuer/microcredential-templates", label: t("sidebar.issuer.templatesStaff"), icon: BookOpen, dataTour: "nav-issuer-templates" },
      ],
    },
    {
      group: t("sidebar.groups.issuance"),
      items: [
        { to: "/issuer/requests", label: t("sidebar.issuer.requests"), icon: Inbox, dataTour: "nav-issuer-requests" },
        { to: "/issuer/issue", label: t("sidebar.issuer.issue"), icon: Send, dataTour: "nav-issuer-issue" },
        { to: "/issuer/issue/bulk", label: t("sidebar.issuer.bulk"), icon: UploadCloud, dataTour: "nav-issuer-bulk" },
        { to: "/issuer/credentials", label: t("sidebar.issuer.credentials"), icon: Award, dataTour: "nav-issuer-credentials" },
        { to: "/issuer/anchoring-queue", label: t("sidebar.issuer.anchoring"), icon: Link2, dataTour: "nav-issuer-anchoring" },
      ],
    },
    {
      group: t("sidebar.groups.accountShort"),
      items: [
        { to: "/issuer/notifications", label: t("sidebar.issuer.notifications"), icon: Bell, dataTour: "nav-issuer-notifications" },
        { to: "/issuer/manual", label: t("sidebar.issuer.manual"), icon: BookOpen, dataTour: "nav-issuer-manual" },
        { to: "/issuer/settings", label: t("sidebar.issuer.settings"), icon: Settings },
      ],
    },
  ];
}

const ADMIN_NAV: NavGroups = [
  { group: "Overview", items: [{ to: "/admin", label: "Overview", icon: LayoutDashboard }] },
  {
    group: "People & Orgs",
    items: [
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/organizations", label: "Organizations", icon: Building2 },
      { to: "/admin/roles", label: "Roles & Permissions", icon: ShieldCheck },
      { to: "/admin/registrations", label: "Registrations", icon: Mail },
    ],
  },
  {
    group: "Platform",
    items: [
      { to: "/admin/activity", label: "Activity", icon: ListChecks },
      { to: "/admin/audit", label: "Audit Trail", icon: FileCheck2 },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

function getNav(user: MockUser, t: (k: string) => string): NavGroups {
  if (user.role === "earner") return buildEarnerNav(t);
  if (user.role === "admin") return ADMIN_NAV;
  if (user.role === "issuer") return user.subRole === "staff" ? buildIssuerStaffNav(t) : buildIssuerAdminNav(t);
  return [];
}

const ROLE_LABEL: Record<Role, string> = {
  earner: "Earner",
  issuer: "Issuer",
  admin: "System Admin",
};

const ROLE_ICON: Record<Role, typeof GraduationCap> = {
  earner: GraduationCap,
  issuer: Award,
  admin: Boxes,
};

export function AppSidebarLayout() {
  const { activeUser, setActiveUser, notifications } = useStore();
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });

  if (!activeUser) {
    return null;
  }

  const groups = getNav(activeUser, t);
  const RoleIcon = ROLE_ICON[activeUser.role];
  const roleLabel = t(`role.${activeUser.role}`, { defaultValue: ROLE_LABEL[activeUser.role] });
  const unread = notifications.filter(
    (n) => !n.read && n.forRole === activeUser.role && (!n.forUserId || n.forUserId === activeUser.id),
  ).length;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarContent>
            <div className="px-3 py-4">
              <Link to="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-semibold">MicroCred</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {roleLabel}
                  </div>
                </div>
              </Link>
            </div>
            {groups.map((g) => (
              <SidebarGroup key={g.group}>
                <SidebarGroupLabel>{g.group}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {g.items.map((item) => {
                      const Icon = item.icon;
                      const active =
                        item.to === `/${activeUser.role}`
                          ? currentPath === item.to
                          : currentPath === item.to || currentPath.startsWith(item.to + "/");
                      return (
                        <SidebarMenuItem key={item.to} data-tour={item.dataTour}>
                          <SidebarMenuButton asChild isActive={active}>
                            <Link to={item.to} className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
        </Sidebar>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Badge variant="outline" className="hidden gap-1 capitalize sm:inline-flex">
                <RoleIcon className="h-3 w-3" /> {roleLabel}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => {
                  const map: Record<Role, string> = {
                    earner: "/earner/notifications",
                    issuer: "/issuer/notifications",
                    admin: "/admin",
                  };
                  navigate({ to: map[activeUser.role] });
                }}
                aria-label={t("header.notifications")}
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                    {unread}
                  </span>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <RoleIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{activeUser.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="text-sm font-medium">{activeUser.name}</div>
                    <div className="text-xs text-muted-foreground">{activeUser.email}</div>
                    {activeUser.organization && (
                      <div className="text-xs text-muted-foreground">{activeUser.organization}</div>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {activeUser.role !== "admin" && (
                    <DropdownMenuItem
                      onClick={() =>
                        navigate({
                          to: activeUser.role === "earner" ? "/earner/profile" : "/issuer/profile",
                        })
                      }
                    >
                      <UserCircle className="mr-2 h-4 w-4" /> {t("header.publicProfile")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => {
                      const map: Record<Role, string> = {
                        earner: "/earner/settings",
                        issuer: "/issuer/settings",
                        admin: "/admin/settings",
                      };
                      navigate({ to: map[activeUser.role] });
                    }}
                  >
                    <Settings className="mr-2 h-4 w-4" /> {t("header.settings")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      const { supabase } = await import("@/integrations/supabase/client");
                      await supabase.auth.signOut().catch(() => {});
                      setActiveUser(null);
                      navigate({ to: "/" });
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" /> {t("header.signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
