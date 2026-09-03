"use client";

import { useMemo } from "react";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { blocksForDay } from "@/lib/seed";
import { workWeek } from "@/lib/date";
import { LegendItem, Panel, RingMeter } from "./ui";

/**
 * One ratio in the centre (the week's credited completion) with the block
 * outcomes that produce it as ring segments. Every segment is named in the
 * legend with its count, so the ring is never the only way to read this.
 */
export function WeekRing({ scope }: { scope: "me" | "team" }) {
  const now = useNow();
  const { logs, users, currentUserId } = useTaskey();

  const tally = useMemo(() => {
    const people =
      scope === "team"
        ? users.filter((u) => u.role === "employee")
        : users.filter((u) => u.id === currentUserId);
    const week = workWeek(now);
    const t = { done: 0, partial: 0, missed: 0, pending: 0 };

    for (const person of people) {
      for (const date of week) {
        const log = logs.find((l) => l.userId === person.id && l.date === date);
        const blocks = log?.blocks ?? blocksForDay(person.id, date);
        for (const b of blocks) {
          if (b.status === "done") t.done++;
          else if (b.status === "partial") t.partial++;
          else if (b.status === "missed") t.missed++;
          else t.pending++;
        }
      }
    }
    const total = t.done + t.partial + t.missed + t.pending;
    return { ...t, total, pct: total ? (t.done + t.partial * 0.5) / total : 0 };
  }, [logs, users, currentUserId, now, scope]);

  return (
    <Panel
      title="This week"
      subtitle={scope === "team" ? "Across the team" : "Your blocks"}
    >
      <RingMeter
        segments={[
          { value: tally.done, tone: "ok", label: "Completed" },
          { value: tally.partial, tone: "warn", label: "Partly done" },
          { value: tally.missed, tone: "danger", label: "Missed" },
          { value: tally.pending, tone: "neutral", label: "Not logged yet" },
        ]}
        centerValue={`${Math.round(tally.pct * 100)}%`}
        centerLabel="credited"
      />

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        <LegendItem tone="ok" label="Completed" value={tally.done} />
        <LegendItem tone="warn" label="Partly done" value={tally.partial} />
        <LegendItem tone="danger" label="Missed" value={tally.missed} />
        <LegendItem tone="neutral" label="Not logged" value={tally.pending} />
      </div>

      <p className="mt-3 border-t border-line pt-3 text-[11px] leading-snug text-faint">
        A partly-done block counts half, which is how the KPI score counts it too.
      </p>
    </Panel>
  );
}
