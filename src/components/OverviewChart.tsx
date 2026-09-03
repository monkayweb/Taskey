"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { format, parseISO, startOfWeek, subMonths, subWeeks } from "date-fns";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { dayKey, workWeek } from "@/lib/date";
import { LegendItem, Panel, Tabs, type Tone } from "./ui";

type Range = "week" | "month" | "quarter";

const RANGES: { value: Range; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
];

/**
 * Three series, so the colours are the status palette rather than the brand.
 * The order matters: amber between green and red is what clears the
 * colour-vision separation check, so never reorder these.
 */
const SERIES: { key: "done" | "partial" | "missed"; label: string; tone: Tone }[] = [
  { key: "done", label: "Completed", tone: "ok" },
  { key: "partial", label: "Partly done", tone: "warn" },
  { key: "missed", label: "Missed", tone: "danger" },
];

const BAR_FILL: Record<string, string> = {
  done: "bg-ok-fill",
  partial: "bg-warn-fill",
  missed: "bg-danger-fill",
};

interface Bucket {
  key: string;
  label: string;
  done: number;
  partial: number;
  missed: number;
}

export function OverviewChart({ scope }: { scope: "me" | "team" }) {
  const now = useNow();
  const [range, setRange] = useState<Range>("week");
  const { logs, users, currentUserId } = useTaskey();

  const { buckets, axisMax, ticks, totals } = useMemo(() => {
    const people =
      scope === "team"
        ? users.filter((u) => u.role === "employee")
        : users.filter((u) => u.id === currentUserId);
    const ids = new Set(people.map((p) => p.id));

    // Buckets are laid out first so empty periods still occupy the axis.
    let order: string[] = [];
    const labels: Record<string, string> = {};
    let bucketOf: (date: string) => string;

    if (range === "week") {
      order = workWeek(now);
      order.forEach((d, i) => {
        labels[d] = ["Mon", "Tue", "Wed", "Thu", "Fri"][i];
      });
      bucketOf = (d) => d;
    } else if (range === "month") {
      for (let i = 3; i >= 0; i--) {
        const k = dayKey(startOfWeek(subWeeks(now, i), { weekStartsOn: 1 }));
        order.push(k);
        labels[k] = format(parseISO(k), "d MMM");
      }
      bucketOf = (d) =>
        dayKey(startOfWeek(parseISO(d), { weekStartsOn: 1 }));
    } else {
      for (let i = 2; i >= 0; i--) {
        const k = format(subMonths(now, i), "yyyy-MM");
        order.push(k);
        labels[k] = format(subMonths(now, i), "MMM");
      }
      bucketOf = (d) => d.slice(0, 7);
    }

    const map = new Map<string, Bucket>(
      order.map((k) => [k, { key: k, label: labels[k], done: 0, partial: 0, missed: 0 }]),
    );

    // Only submitted logs count: an unsubmitted day has outcomes yet to be
    // declared, and showing them as zero would read as a bad day.
    for (const log of logs) {
      if (!ids.has(log.userId) || !log.submittedAt) continue;
      const b = map.get(bucketOf(log.date));
      if (!b) continue;
      for (const block of log.blocks) {
        if (block.status === "done") b.done++;
        else if (block.status === "partial") b.partial++;
        else if (block.status === "missed") b.missed++;
      }
    }

    const buckets = order.map((k) => map.get(k)!);
    const peak = Math.max(
      ...buckets.flatMap((b) => [b.done, b.partial, b.missed]),
      1,
    );
    const step = Math.max(Math.ceil(peak / 4), 1);

    return {
      buckets,
      axisMax: step * 4,
      ticks: [4, 3, 2, 1, 0].map((i) => i * step),
      totals: {
        done: buckets.reduce((a, b) => a + b.done, 0),
        partial: buckets.reduce((a, b) => a + b.partial, 0),
        missed: buckets.reduce((a, b) => a + b.missed, 0),
      },
    };
  }, [logs, users, currentUserId, now, range, scope]);

  const plotH = 176;

  return (
    <Panel
      title="Overview"
      subtitle={
        scope === "team"
          ? "Block outcomes across the team, from submitted days only"
          : "Your block outcomes, from submitted days only"
      }
      action={<Tabs value={range} options={RANGES} onChange={setRange} />}
    >
      <div className="mt-2 flex gap-3">
        <div className="relative w-6 shrink-0" style={{ height: plotH + 24 }}>
          {ticks.map((t, i) => (
            <span
              key={i}
              className="absolute right-0 -translate-y-1/2 font-mono text-[10px] tabular-nums text-faint"
              style={{ top: (i / (ticks.length - 1)) * plotH }}
            >
              {t}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1" style={{ height: plotH + 24 }}>
          {ticks.map((_, i) => (
            <div
              key={i}
              className="absolute inset-x-0 border-t border-line"
              style={{ top: (i / (ticks.length - 1)) * plotH }}
            />
          ))}

          <div
            className="absolute inset-x-0 top-0 flex items-end"
            style={{ height: plotH }}
          >
            {buckets.map((b) => (
              <div key={b.key} className="group relative flex h-full flex-1 flex-col justify-end">
                {/* one group of three thin bars, 2px apart */}
                <div className="mx-auto flex h-full w-full max-w-[96px] items-end justify-center gap-1">
                  {SERIES.map((s) => {
                    const v = b[s.key];
                    return (
                      <div
                        key={s.key}
                        className={clsx(
                          "w-[17px] rounded-t-[4px] transition-opacity",
                          BAR_FILL[s.key],
                          v === 0 && "opacity-0",
                        )}
                        style={{ height: `${(v / axisMax) * 100}%` }}
                      />
                    );
                  })}
                </div>

                <span className="absolute -bottom-6 inset-x-0 truncate text-center text-[11px] text-faint">
                  {b.label}
                </span>

                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-max -translate-x-1/2
                             rounded-xl bg-ink px-2.5 py-1.5 text-left text-[11px] leading-snug text-white
                             shadow-[var(--shadow-pop)] group-hover:block"
                >
                  <p className="font-semibold">{b.label}</p>
                  {b.done + b.partial + b.missed === 0 ? (
                    <p className="text-white/70">No submitted days</p>
                  ) : (
                    <p className="text-white/80">
                      {b.done} completed · {b.partial} partly · {b.missed} missed
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend names every series, which is also the relief for amber's
          low contrast against white. */}
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-line pt-3">
        {SERIES.map((s) => (
          <LegendItem
            key={s.key}
            tone={s.tone}
            label={s.label}
            value={totals[s.key]}
          />
        ))}
      </div>
    </Panel>
  );
}
