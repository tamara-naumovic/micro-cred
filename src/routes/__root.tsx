import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { StoreProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { Toaster } from "@/components/ui/sonner";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { AppSidebarLayout } from "@/components/layouts/AppSidebarLayout";

const APP_PREFIXES = ["/earner", "/provider", "/issuer", "/admin"];

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CredSeal — Verified Skills. Trusted Credentials." },
      {
        name: "description",
        content:
          "CredSeal is a higher education micro-credentialing platform for issuing, sharing and verifying blockchain-anchored credentials.",
      },
      { property: "og:title", content: "CredSeal — Verified Skills. Trusted Credentials." },
      {
        property: "og:description",
        content:
          "Role-based platform for earners, course providers, issuers and verifiers. EBSI-ready architecture.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "CredSeal — Verified Skills. Trusted Credentials." },
      { name: "description", content: "A client-side application for managing microcredentials, built on a modern TypeScript stack." },
      { property: "og:description", content: "A client-side application for managing microcredentials, built on a modern TypeScript stack." },
      { name: "twitter:description", content: "A client-side application for managing microcredentials, built on a modern TypeScript stack." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/42bbb430-4576-4a4e-b52e-e78e5d89f447/id-preview-12fdbb87--d7a786ed-4d33-41d9-a8ff-f54b6985d11b.lovable.app-1778579157891.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/42bbb430-4576-4a4e-b52e-e78e5d89f447/id-preview-12fdbb87--d7a786ed-4d33-41d9-a8ff-f54b6985d11b.lovable.app-1778579157891.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <AuthProvider>
          <LanguageProvider>
            <LayoutSwitcher />
            <Toaster richColors position="top-right" />
          </LanguageProvider>
        </AuthProvider>
      </StoreProvider>
    </QueryClientProvider>
  );
}

function LayoutSwitcher() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isApp = APP_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
  return isApp ? <AppSidebarLayout /> : <PublicLayout />;
}

// Re-export Outlet to silence unused import warning
export { Outlet as _Outlet };
