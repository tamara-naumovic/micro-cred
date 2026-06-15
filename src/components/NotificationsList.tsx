import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import type { Role } from "@/lib/types";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationsList({ role }: { role: Role }) {
  const { notifications, activeUser, markAllRead } = useStore();

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {items.length} notification{items.length === 1 ? "" : "s"}
          {unreadCount > 0 ? ` · ${unreadCount} unread` : ""}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllRead(role, activeUser?.id)}
          disabled={unreadCount === 0}
        >
          <CheckCheck className="mr-2 h-4 w-4" /> Mark all as read
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <Bell className="h-8 w-8 opacity-40" />
            No notifications yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const content = (
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
                        <span className="inline-block h-2 w-2 rounded-full bg-primary" aria-label="Unread" />
                      )}
                      <div className="font-medium">{n.title}</div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                      {timeAgo(n.createdAt)}
                    </Badge>
                  </div>
                  {n.body && (
                    <div className="text-sm text-muted-foreground">{n.body}</div>
                  )}
                </CardContent>
              </Card>
            );
            return n.link ? (
              <Link key={n.id} to={n.link} className="block">
                {content}
              </Link>
            ) : (
              <div key={n.id}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
