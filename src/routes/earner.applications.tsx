import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RoleGuard } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { LifecycleTimeline } from "@/components/LifecycleTimeline";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/earner/applications")({
  head: () => ({ meta: [{ title: "Applications — MicroCred" }] }),
  component: () => (
    <RoleGuard role="earner">
      <Apps />
    </RoleGuard>
  ),
});

function Apps() {
  const { activeUser, applications } = useStore();
  const { t } = useTranslation("earner");
  const [openId, setOpen] = useState<string | null>(null);

  if (!activeUser) return null;
  const mine = applications.filter((a) => a.earnerId === activeUser.id);
  const open = mine.find((a) => a.id === openId) ?? null;

  return (
    <PageShell
      title={t("applications.title")}
      description={t("applications.description")}
      actions={
        <Button asChild>
          <Link to="/earner/apply">{t("applications.newApplication")}</Link>
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("applications.listTitle", { count: mine.length })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mine.map((a) => (
              <button
                key={a.id}
                onClick={() => setOpen(a.id)}
                className={`flex w-full items-center justify-between rounded-md border p-3 text-left text-sm transition ${openId === a.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}
              >
                <div className="min-w-0">
                  <div className="font-medium">{a.templateTitle}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.issuerName} · {new Date(a.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </button>
            ))}
            {mine.length === 0 && <p className="text-sm text-muted-foreground">{t("applications.empty")}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("applications.lifecycle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {open ? (
              <LifecycleTimeline events={open.timeline} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("applications.lifecycleEmpty")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
