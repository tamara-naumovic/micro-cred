import type { TimelineEvent } from "@/lib/types";
import { CircleDot } from "lucide-react";

export function LifecycleTimeline({ events }: { events: TimelineEvent[] }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">No events yet.</p>;
  return (
    <ol className="relative space-y-5 border-l border-border pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[26px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background ring-2 ring-primary/30">
            <CircleDot className="h-3 w-3 text-primary" />
          </span>
          <div className="text-sm font-medium">{e.action}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(e.at).toLocaleString()} · {e.actor}
          </div>
          {e.detail && <div className="mt-1 text-xs text-muted-foreground">{e.detail}</div>}
        </li>
      ))}
    </ol>
  );
}
