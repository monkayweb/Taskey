"use client";

import { useState } from "react";
import clsx from "clsx";
import { format, parseISO } from "date-fns";
import { Check, CircleSlash, Lock, MinusCircle } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { blocksForDay } from "@/lib/seed";
import { dayKey, workWeek } from "@/lib/date";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/labels";
import type { BlockStatus, User } from "@/lib/types";
import { Avatar, Badge } from "./ui";

const HOUR_PX = 52;

const EDGE: Record<BlockStatus, string> = {
  done: "bg-ok-fill",
  partial: "bg-warn-fill",
  missed: "bg-danger-fill",
  pending: "bg-accent",
};

const STATUS_ICON: Record<BlockStatus, typeof Check | null> = {
  done: Check,
  partial: MinusCircle,
  missed: CircleSlash,
  pending: null,
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * The calendar view of the day, mirroring the source calendar's shape rather
 * than flattening it to a list. Read-only on purpose: the checklist below
 * owns the controls; this is the at-a-glance version, and it doubles as the
 * way to look back at an earlier day.
 */
export function AgendaRail({ me }: { me: User }) {
  const now = useNow();
  const today = dayKey(now);
  const week = workWeek(now);
  const { logs } = useTaskey();
  const [selected, setSelected] = useState(today);

  const log = logs.find((l) => l.userId === me.id && l.date === selected);
  const blocks = log?.blocks ?? blocksForDay(me.id, selected);

  const startHour = blocks.length
    ? Math.floor(Math.min(...blocks.map((b) => toMinutes(b.start))) / 60)
    : 8;
  const endHour = blocks.length
    ? Math.ceil(Math.max(...blocks.map((b) => toMinutes(b.end))) / 60)
    : 17;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  const nowOffset =
    selected === today
      ? ((now.getHours() * 60 + now.getMinutes()) / 60 - startHour) * HOUR_PX
      : null;
  const nowVisible =
    nowOffset !== null && nowOffset >= 0 && nowOffset <= (endHour - startHour) * HOUR_PX;

  return (
    <div className="card overflow-hidden">
      {/* --- who ------------------------------------------------------ */}
      <div className="flex items-center gap-2.5 px-4 pt-4">
        <Avatar name={me.name} tint={me.tint} size={38} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{me.name}</p>
          <p className="truncate text-xs text-muted">{me.jobTitle}</p>
        </div>
      </div>

      {/* --- day strip ------------------------------------------------ */}
      <div className="mt-4 px-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-semibold">{format(now, "MMMM")}</p>
          {log?.submittedAt && selected !== today && (
            <Badge tone="ok">
              <Lock size={10} />
              Submitted
            </Badge>
          )}
        </div>

        <div className="flex gap-1">
          {week.map((date) => {
            const d = parseISO(date);
            const active = date === selected;
            const isToday = date === today;
            const dayLog = logs.find((l) => l.userId === me.id && l.date === date);
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelected(date)}
                aria-pressed={active}
                className={clsx(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 transition-colors",
                  active
                    ? "bg-accent text-white shadow-sm"
                    : "text-muted ring-1 ring-line hover:bg-sunken",
                )}
              >
                <span className="font-mono text-[15px] font-medium tabular-nums leading-none">
                  {format(d, "d")}
                </span>
                <span
                  className={clsx(
                    "text-[10px] lowercase",
                    active ? "text-white/75" : "text-faint",
                  )}
                >
                  {format(d, "EEE")}
                </span>
                <span
                  className={clsx(
                    "mt-0.5 size-1 rounded-full",
                    dayLog?.submittedAt
                      ? active
                        ? "bg-white"
                        : "bg-ok-fill"
                      : isToday
                        ? active
                          ? "bg-white/60"
                          : "bg-accent"
                        : "bg-transparent",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* --- timeline ------------------------------------------------- */}
      <div className="mt-4 px-4 pb-4">
        {blocks.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted">
            Nothing scheduled on this day.
          </p>
        ) : (
          <div className="relative flex gap-2">
            {/* Labels are absolutely positioned so they stay locked to the
                hour gridlines instead of drifting by a row's height. */}
            <div
              className="relative w-10 shrink-0"
              style={{ height: (endHour - startHour) * HOUR_PX + 8 }}
            >
              {hours.map((h, i) => (
                <span
                  key={h}
                  className="absolute right-0 -translate-y-1/2 font-mono text-[10px] tabular-nums text-faint"
                  style={{ top: i * HOUR_PX }}
                >
                  {String(h).padStart(2, "0")}:00
                </span>
              ))}
            </div>

            <div
              className="relative flex-1"
              style={{ height: (endHour - startHour) * HOUR_PX + 8 }}
            >
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-line"
                  style={{ top: i * HOUR_PX }}
                />
              ))}

              {nowVisible && (
                <div
                  className="absolute inset-x-0 z-10 flex items-center"
                  style={{ top: nowOffset! }}
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-danger-fill" />
                  <span className="h-px flex-1 bg-danger-fill/50" />
                </div>
              )}

              {blocks.map((b) => {
                const top =
                  (toMinutes(b.start) / 60 - startHour) * HOUR_PX;
                const height = Math.max(
                  ((toMinutes(b.end) - toMinutes(b.start)) / 60) * HOUR_PX - 4,
                  26,
                );
                const Icon = STATUS_ICON[b.status];
                return (
                  <div
                    key={b.id}
                    title={`${b.start}–${b.end} ${b.label} · ${STATUS_LABEL[b.status]}`}
                    className="absolute inset-x-0 flex overflow-hidden rounded-lg bg-sunken pl-0"
                    style={{ top: top + 2, height }}
                  >
                    <span className={clsx("w-[3px] shrink-0", EDGE[b.status])} />
                    <div className="min-w-0 flex-1 px-2 py-1">
                      <div className="flex items-center gap-1">
                        <p className="min-w-0 flex-1 truncate text-[12px] font-medium leading-tight">
                          {b.label}
                        </p>
                        {Icon && (
                          <Icon
                            size={11}
                            className={
                              b.status === "done"
                                ? "shrink-0 text-ok"
                                : b.status === "partial"
                                  ? "shrink-0 text-warn"
                                  : "shrink-0 text-danger"
                            }
                          />
                        )}
                      </div>
                      {height > 34 && (
                        <p className="truncate font-mono text-[10px] tabular-nums text-faint">
                          {b.start}–{b.end} · {CATEGORY_LABEL[b.category]}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
