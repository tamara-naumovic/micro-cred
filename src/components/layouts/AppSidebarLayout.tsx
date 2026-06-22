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
import { useStore } from "@/lib/store";
import type { MockUser, Role } from "@/lib/types";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  dataTour?: string;
}

type NavGroups = { group: string; items: NavItem[] }[];

const EARNER_NAV: NavGroups = [
  {
    group: "Workspace",
    items: [
      { to: "/earner", label: "Dashboard", icon: LayoutDashboard, dataTour: "nav-dashboard" },
      { to: "/earner/credentials", label: "My Credentials", icon: Award, dataTour: "nav-my-credentials" },
      { to: "/earner/applications", label: "Applications", icon: ClipboardList, dataTour: "nav-applications" },
      { to: "/earner/apply", label: "Apply for Credential", icon: FilePlus2, dataTour: "nav-apply" },
    ],
  },
  {
    group: "Sharing",
    items: [
      { to: "/earner/profile", label: "Public Profile", icon: UserCircle, dataTour: "nav-profile" },
      { to: "/earner/notifications", label: "Notifications", icon: Bell, dataTour: "nav-notifications" },
      { to: "/earner/manual", label: "Manual", icon: BookOpen, dataTour: "nav-manual" },
      { to: "/earner/settings", label: "Settings", icon: Settings },
    ],
  },
];

const ISSUER_ADMIN_NAV: NavGroups = [
  { group: "Overview", items: [{ to: "/issuer", label: "Overview", icon: LayoutDashboard }] },
  {
    group: "Micro-credentials",
    items: [
      { to: "/issuer/microcredential-templates", label: "Micro-credentials", icon: BookOpen },
      { to: "/issuer/microcredential-templates/new", label: "Create Micro-credential", icon: FilePlus2 },
      { to: "/issuer/staff", label: "Staff", icon: Users },
      { to: "/issuer/earners", label: "Earners", icon: GraduationCap },
    ],
  },
  {
    group: "Issuance",
    items: [
      { to: "/issuer/requests", label: "Issuance Requests", icon: Inbox },
      { to: "/issuer/issue", label: "Direct Issuance", icon: Send },
      { to: "/issuer/issue/bulk", label: "Bulk Issuance", icon: UploadCloud },
      { to: "/issuer/credentials", label: "Issued Credentials", icon: Award },
      { to: "/issuer/revocations", label: "Revocations", icon: XOctagon },
      { to: "/issuer/anchoring-queue", label: "Blockchain Queue", icon: Link2 },
    ],
  },
  {
    group: "Network",
    items: [
      { to: "/issuer/profile", label: "Public Profile", icon: BadgeCheck },
      { to: "/issuer/notifications", label: "Notifications", icon: Bell },
      { to: "/issuer/settings", label: "Settings", icon: Settings },
    ],
  },
];

const ISSUER_STAFF_NAV: NavGroups = [
  { group: "Overview", items: [{ to: "/issuer", label: "Overview", icon: LayoutDashboard }] },
  {
    group: "Micro-credentials",
    items: [
      { to: "/issuer/microcredential-templates", label: "My Micro-credentials", icon: BookOpen },
    ],
  },
  {
    group: "Issuance",
    items: [
      { to: "/issuer/requests", label: "Issuance Requests", icon: Inbox },
      { to: "/issuer/issue", label: "Direct Issuance", icon: Send },
      { to: "/issuer/issue/bulk", label: "Bulk Issuance", icon: UploadCloud },
      { to: "/issuer/credentials", label: "Issued Credentials", icon: Award },
      { to: "/issuer/anchoring-queue", label: "Blockchain Queue", icon: Link2 },
    ],
  },
  {
    group: "Account",
    items: [
      { to: "/issuer/notifications", label: "Notifications", icon: Bell },
      { to: "/issuer/settings", label: "Settings", icon: Settings },
    ],
  },
];

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

function getNav(user: MockUser): NavGroups {
  if (user.role === "earner") return EARNER_NAV;
  if (user.role === "admin") return ADMIN_NAV;
  if (user.role === "issuer") return user.subRole === "staff" ? ISSUER_STAFF_NAV : ISSUER_ADMIN_NAV;
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
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (r) => r.location.pathname });

  if (!activeUser) {
    return null;
  }

  const groups = getNav(activeUser);
  const RoleIcon = ROLE_ICON[activeUser.role];
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
                    {ROLE_LABEL[activeUser.role]}
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
                <RoleIcon className="h-3 w-3" /> {ROLE_LABEL[activeUser.role]}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
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
                aria-label="Notifications"
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
                  <DropdownMenuItem onClick={() => navigate({ to: "/login" })}>
                    Switch role
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      const { supabase } = await import("@/integrations/supabase/client");
                      await supabase.auth.signOut().catch(() => {});
                      setActiveUser(null);
                      navigate({ to: "/" });
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
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
