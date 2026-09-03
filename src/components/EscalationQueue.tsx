"use client";

import { useState } from "react";
import { CheckCheck, Eye, LifeBuoy } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { clockTime, relativeDays, shortDate } from "@/lib/date";
import { SEVERITY_LABEL, SEVERITY_TONE } from "@/lib/labels";
import { Avatar, Badge, Empty, Panel } from "./ui";

/**
 * Where the "I'm overwhelmed" button lands. Acknowledging is deliberately
 * separate from resolving so the employee can see they've been heard before
 * the problem is actually fixed.
 */
export function EscalationQueue() {
  const now = useNow();
  const { escalations, users, acknowledgeEscalation, resolveEscalation } =
    useTaskey();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showResolved, setShowResolved] = useState(false);

  const live = escalations.filter((e) => e.status !== "resolved");
  const visible = showResolved ? escalations : live;

  return (
    <Panel
      title="Workload escalations"
      subtitle="Raised by the team the moment they know they can't finish."
      action={
        <label className="flex items-center gap-1.5 text-[11px] text-muted">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="size-3.5 accent-[var(--color-accent)]"
          />
          Show resolved
        </label>
      }
      bodyClassName=""
    >
      {visible.length === 0 ? (
        <Empty
          icon={<LifeBuoy size={22} />}
          title="No open escalations"
          detail="Nobody has flagged a bottleneck. The button is in every employee's sidebar."
        />
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((e) => {
            const who = users.find((u) => u.id === e.userId)!;
            return (
              <li key={e.id} className="px-5 py-3">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                  <Avatar name={who.name} tint={who.tint} size={26} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-medium">{who.name}</p>
                      <Badge tone={SEVERITY_TONE[e.severity]}>
                        {SEVERITY_LABEL[e.severity]}
                      </Badge>
                      {e.status === "acknowledged" && <Badge tone="accent">Seen</Badge>}
                      {e.status === "resolved" && <Badge tone="ok">Resolved</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      Raised {relativeDays(e.createdAt, now)} at{" "}
                      {clockTime(e.createdAt)}
                      {e.resolvedAt && ` · resolved ${shortDate(e.resolvedAt)}`}
                    </p>

                    {e.note && (
                      <p className="mt-2 rounded-xl bg-sunken px-3 py-2 text-[13px]">
                        “{e.note}”
                      </p>
                    )}

                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {e.items.map((item) => (
                        <li key={`${item.kind}:${item.refId}`}>
                          <Badge tone="warn">
                            <span className="text-[10px] uppercase opacity-70">
                              {item.kind}
                            </span>
                            {item.label}
                          </Badge>
                        </li>
                      ))}
                    </ul>

                    {e.adminNote && (
                      <p className="mt-2 text-xs text-muted">
                        <span className="font-medium text-ink">Outcome:</span>{" "}
                        {e.adminNote}
                      </p>
                    )}

                    {e.status !== "resolved" && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {e.status === "open" && (
                          <button
                            type="button"
                            onClick={() => acknowledgeEscalation(e.id)}
                            className="btn btn-ghost btn-sm"
                          >
                            <Eye size={14} />
                            Mark as seen
                          </button>
                        )}
                        <input
                          value={notes[e.id] ?? ""}
                          onChange={(ev) =>
                            setNotes((n) => ({ ...n, [e.id]: ev.target.value }))
                          }
                          placeholder="What did you do about it?"
                          className="field h-8 min-w-[180px] flex-1 py-0 text-[13px]"
                        />
                        <button
                          type="button"
                          onClick={() => resolveEscalation(e.id, notes[e.id])}
                          className="btn btn-primary btn-sm"
                        >
                          <CheckCheck size={14} />
                          Resolve
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
