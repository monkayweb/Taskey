"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { useTaskey } from "@/lib/store";
import { useWeekKpis } from "@/lib/selectors";
import { useNow } from "@/lib/now";
import { blocksForDay } from "@/lib/seed";
import { blockMinutes, dayKey, workWeek } from "@/lib/date";
import { Panel, pctText } from "./ui";

const DAY_INITIAL = ["M", "T", "W", "T", "F"];

interface DayBar {
  date: string;
  label: string;
  total: number;
  /** done + half credit for partly-done, matching how the KPI score counts it. */
  credited: number;
  partial: number;
  missed: number;
  pending: number;
  isToday: boolean;
  isFuture: boolean;
}

/**
 * Blocks completed per working day. One measure, so one hue: violet columns
 * against a same-ramp track showing what was scheduled. No legend, because the
 * title names the series.
 */
export function WeeklyProgress({ scope }: { scope: "me" | "team" }) {
  const now = useNow();
  const { logs, users, currentUserId } = useTaskey();
  const kpis = useWeekKpis();

  const stats = useMemo(() => {
    const today = dayKey(now);
    const week = workWeek(now);
    const people =
      scope === "team"
        ? users.filter((u) => u.role === "employee")
        : users.filter((u) => u.id === currentUserId);

    const bars: DayBar[] = week.map((date, i) => {
      const bar: DayBar = {
        date,
        label: DAY_INITIAL[i],
        total: 0,
        credited: 0,
        partial: 0,
        missed: 0,
        pending: 0,
        isToday: date === today,
        isFuture: date > today,
      };

      for (const person of people) {
        const log = logs.find((l) => l.userId === person.id && l.date === date);
        const blocks = log?.blocks ?? blocksForDay(person.id, date);
        bar.total += blocks.length;
        for (const b of blocks) {
          if (b.status === "done") bar.credited += 1;
          else if (b.status === "partial") {
            bar.credited += 0.5;
            bar.partial++;
          } else if (b.status === "missed") bar.missed++;
          else bar.pending++;
        }
      }
      return bar;
    });

    let loggedMinutes = 0;
    let scheduledMinutes = 0;
    for (const person of people) {
      for (const date of week) {
        const log = logs.find((l) => l.userId === person.id && l.date === date);
        const blocks = log?.blocks ?? blocksForDay(person.id, date);
        for (const b of blocks) {
          const mins = blockMinutes(b.start, b.end);
          scheduledMinutes += mins;
          if (b.status === "done") loggedMinutes += mins;
          else if (b.status === "partial") loggedMinutes += mins / 2;
        }
        for (const t of log?.extraTasks ?? []) loggedMinutes += t.minutes;
      }
    }

    // Follow-up performance comes from the KPI rollup so there is exactly one
    // definition of "chased in time" in the codebase.
    const rows = kpis.filter((k) =>
      scope === "team" ? true : k.user.id === currentUserId,
    );
    const onTime = rows.reduce((a, k) => a + k.followUpsOnTime, 0);
    const breached = rows.reduce((a, k) => a + k.followUpsBreached, 0);

    const peak = Math.max(...bars.map((b) => b.total), 1);
    const step = Math.max(Math.ceil(peak / 4), 1);

    return {
      bars,
      axisMax: step * 4,
      ticks: [4, 3, 2, 1, 0].map((i) => i * step),
      credited: bars.reduce((a, b) => a + b.credited, 0),
      scheduled: bars.reduce((a, b) => a + b.total, 0),
      loggedMinutes,
      scheduledMinutes,
      followUpTotal: onTime + breached,
      followUpRate: onTime + breached === 0 ? 1 : onTime / (onTime + breached),
    };
  }, [logs, users, currentUserId, kpis, now, scope]);

  const { bars, axisMax, ticks } = stats;

  // Label the best day only, never a number on every bar.
  const bestIndex = bars.reduce(
    (best, b, i) => (b.credited > bars[best].credited ? i : best),
    0,
  );

  return (
    <Panel
      title="Blocks completed this week"
      subtitle={
        scope === "team"
          ? "Across the team, per working day"
          : "Your time blocks, per working day"
      }
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_164px]">
        {/* --- columns ------------------------------------------------- */}
        <div className="flex gap-2.5">
          <div className="relative w-5 shrink-0" style={{ height: 190 }}>
            {ticks.map((t, i) => (
              <span
                key={i}
                className="absolute right-0 -translate-y-1/2 font-mono text-[10px] tabular-nums text-faint"
                style={{ top: (i / (ticks.length - 1)) * 160 + 6 }}
              >
                {t}
              </span>
            ))}
          </div>

          <div className="relative flex-1" style={{ height: 190 }}>
            {/* recessive gridlines, behind the marks */}
            {ticks.map((_, i) => (
              <div
                key={i}
                className="absolute inset-x-0 border-t border-line"
                style={{ top: (i / (ticks.length - 1)) * 160 + 6 }}
              />
            ))}

            <div className="absolute inset-x-0 flex items-end" style={{ top: 6, height: 160 }}>
              {bars.map((bar, i) => {
                const trackH = (bar.total / axisMax) * 100;
                const fillH = bar.total ? (bar.credited / bar.total) * 100 : 0;
                return (
                  <div
                    key={bar.date}
                    className="group relative flex h-full flex-1 flex-col justify-end px-1"
                  >
                    {/* capacity track. The data end is flat to the baseline */}
                    <div
                      className="relative mx-auto w-full max-w-[34px] overflow-hidden rounded-t-md bg-track transition-colors group-hover:bg-accent-soft"
                      style={{ height: `${Math.max(trackH, 2)}%` }}
                    >
                      <div
                        className={clsx(
                          "absolute inset-x-0 bottom-0 rounded-t-[4px]",
                          bar.isFuture ? "bg-accent/30" : "bg-accent",
                        )}
                        style={{ height: `${fillH}%` }}
                      />
                    </div>

                    {i === bestIndex && bar.credited > 0 && (
                      <span className="pointer-events-none absolute inset-x-0 -top-[2px] text-center font-mono text-[10px] tabular-nums text-accent-ink">
                        {bar.credited}
                      </span>
                    )}

                    <span
                      className={clsx(
                        "absolute -bottom-6 inset-x-0 text-center text-[11px] font-medium",
                        bar.isToday ? "text-accent" : "text-faint",
                      )}
                    >
                      {bar.label}
                    </span>

                    {/* hover layer */}
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-1/2 z-20 hidden w-max -translate-x-1/2
                                 rounded-xl bg-ink px-2.5 py-1.5 text-left text-[11px] leading-snug text-white
                                 shadow-[var(--shadow-pop)] group-hover:block"
                    >
                      <p className="font-semibold">{bar.date}</p>
                      {bar.total === 0 ? (
                        <p className="text-white/70">Nothing scheduled</p>
                      ) : (
                        <p className="text-white/80">
                          {bar.credited} of {bar.total} credited
                          {bar.partial > 0 && ` · ${bar.partial} partly`}
                          {bar.missed > 0 && ` · ${bar.missed} missed`}
                          {bar.pending > 0 && ` · ${bar.pending} not logged`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* --- side stats --------------------------------------------- */}
        <div className="flex flex-col justify-center gap-2">
          <SideStat
            label="Hours logged"
            value={`${(stats.loggedMinutes / 60).toFixed(1)}h`}
            of={`of ${(stats.scheduledMinutes / 60).toFixed(0)}h scheduled`}
            pct={stats.scheduledMinutes ? stats.loggedMinutes / stats.scheduledMinutes : 0}
          />
          <SideStat
            label="Blocks credited"
            value={`${stats.credited} / ${stats.scheduled}`}
            of="partly done counts half"
            pct={stats.scheduled ? stats.credited / stats.scheduled : 0}
          />
          <SideStat
            label="Chased in time"
            value={pctText(stats.followUpRate)}
            of={
              stats.followUpTotal === 0
                ? "no quotes out yet"
                : `of ${stats.followUpTotal} quote${stats.followUpTotal === 1 ? "" : "s"} sent`
            }
            pct={stats.followUpRate}
          />
        </div>
      </div>
    </Panel>
  );
}

function SideStat({
  label,
  value,
  of,
  pct,
}: {
  label: string;
  value: string;
  of: string;
  pct: number;
}) {
  const tone =
    pct >= 0.85
      ? "bg-ok-soft text-ok"
      : pct >= 0.6
        ? "bg-warn-soft text-warn"
        : "bg-danger-soft text-danger";
  return (
    <div className="rounded-xl bg-sunken px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted">{label}</p>
        <span
          className={clsx(
            "rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
            tone,
          )}
        >
          {pctText(pct)}
        </span>
      </div>
      <p className="mt-0.5 font-mono text-[15px] font-medium tabular-nums">{value}</p>
      <p className="text-[10px] text-faint">{of}</p>
    </div>
  );
}
