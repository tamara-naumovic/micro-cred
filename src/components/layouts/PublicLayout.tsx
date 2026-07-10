import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export function PublicLayout() {
  const { activeUser } = useStore();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
          <Link to="/" className="flex items-center gap-2">
            <BrandMark size={36} />
            <div className="leading-tight">
              <div className="font-display text-base font-semibold">CredSeal</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Verified skills · Trusted credentials
              </div>
            </div>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/" label="Home" exact />
            <NavLink to="/issuers" label="Issuers" />
            {!activeUser && <NavLink to="/login" label="Sign in" />}
          </nav>
          <div className="flex items-center gap-2">
            {activeUser ? (
              <Button
                size="sm"
                onClick={() => navigate({ to: `/${activeUser.role}` as never })}
              >
                Open dashboard
              </Button>
            ) : (
              path !== "/login" && (
                <Button size="sm" onClick={() => navigate({ to: "/login" })}>
                  Sign in
                </Button>
              )
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border bg-muted/30 py-8 text-center text-xs text-muted-foreground whitespace-pre-wrap">
        CredSeal · Research prototype for the doctoral micro-credential platform&nbsp;
      </footer>
    </div>
  );
}

function NavLink({ to, label, exact }: { to: string; label: string; exact?: boolean }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      activeProps={{ className: "rounded-md px-3 py-1.5 text-sm font-medium bg-secondary text-secondary-foreground" }}
    >
      {label}
    </Link>
  );
}
