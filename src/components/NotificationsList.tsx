import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import type { Role } from "@/lib/types";

function useTimeAgo() {
  const { t } = useTranslation("earner");
  return (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return t("notifications.timeAgo.secs", { n: s });
    const m = Math.floor(s / 60);
    if (m < 60) return t("notifications.timeAgo.mins", { n: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t("notifications.timeAgo.hours", { n: h });
    const d = Math.floor(h / 24);
    if (d < 30) return t("notifications.timeAgo.days", { n: d });
    return new Date(iso).toLocaleDateString();
  };
}

export function NotificationsList({ role }: { role: Role }) {
  const { notifications, activeUser, markAllRead, markRead } = useStore();
  const { t, i18n } = useTranslation("earner");
  const navigate = useNavigate();
  const timeAgo = useTimeAgo();

  const buildParams = (p?: Record<string, unknown>) => {
    if (!p) return {};
    const out: Record<string, unknown> = { ...p };
    if (typeof p.expiresAt === "string") {
      try {
        out.expiresAt = new Date(p.expiresAt).toLocaleDateString(i18n.language);
      } catch {
        // keep raw value
      }
    }
    return out;
  };

  const items = useMemo(
    () =>
      notifications.filter(
        (n) =>
          n.forRole === role &&
          (!n.forUserId || n.forUserId === activeUser?.id),
      ),
    [notifications, role, activeUser?.id],
  );

  const unreadCount = items.filter((n) => !n.read).length;

  const handleClick = (id: string, read: boolean, link?: string) => {
    if (!read) markRead(id);
    if (link) navigate({ to: link });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {t("notifications.count", { count: items.length })}
          {unreadCount > 0 ? ` · ${t("notifications.unread", { count: unreadCount })}` : ""}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllRead(role, activeUser?.id)}
          disabled={unreadCount === 0}
        >
          <CheckCheck className="mr-2 h-4 w-4" /> {t("notifications.markAllRead")}
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <Bell className="h-8 w-8 opacity-40" />
            {t("notifications.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleClick(n.id, n.read, n.link)}
              className="block w-full text-left"
            >
              <Card
                className={
                  "transition hover:bg-muted/30 " +
                  (!n.read ? "border-primary/40 bg-primary/[0.03]" : "")
                }
              >
                <CardContent className="flex flex-col gap-1 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {!n.read && (
                        <span
                          className="inline-block h-2 w-2 rounded-full bg-primary"
                          aria-label={t("notifications.unreadAria")}
                        />
                      )}
                      <div className="font-medium">
                        {n.titleKey
                          ? t(`notifications.${n.titleKey}`, { defaultValue: n.title, ...(n.params ?? {}) })
                          : n.title}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                      {timeAgo(n.createdAt)}
                    </Badge>
                  </div>
                  {(n.bodyKey || n.body) && (
                    <div className="text-sm text-muted-foreground">
                      {n.bodyKey
                        ? t(`notifications.${n.bodyKey}`, { defaultValue: n.body, ...(n.params ?? {}) })
                        : n.body}
                    </div>
                  )}
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
