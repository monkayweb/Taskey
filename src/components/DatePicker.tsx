"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { dayKey } from "@/lib/date";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * A calendar in the app's own type and colour, rather than whatever the
 * browser and OS decide <input type="date"> looks like today.
 */
export function DatePicker({
  value,
  min,
  onChange,
  label = "Due date",
}: {
  value: string;
  min?: string;
  onChange: (date: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(parseISO(value)));
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = parseISO(value);
  const today = new Date();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => {
          // Reopening after the date changed elsewhere lands on that month.
          if (!open) setMonth(startOfMonth(selected));
          setOpen((o) => !o);
        }}
        aria-label={label}
        aria-expanded={open}
        className={clsx(
          "flex h-9 w-full items-center gap-2 rounded-lg bg-surface px-3 text-[12px] font-medium text-ink ring-1 transition-colors",
          open ? "ring-2 ring-accent/40" : "ring-line-strong/70 hover:ring-accent/30",
        )}
      >
        <CalendarDays size={14} className="shrink-0 text-faint" />
        {format(selected, "EEE d MMM yyyy")}
      </button>

      {open && (
        <>
          {/* Click anywhere else to dismiss. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            className="absolute left-0 top-full z-20 mt-1.5 w-[252px] rounded-xl bg-surface p-3 ring-1 ring-line"
            style={{ boxShadow: "var(--shadow-pop)" }}
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMonth((m) => addMonths(m, -1))}
                aria-label="Previous month"
                className="grid size-7 place-items-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink"
              >
                <ChevronLeft size={15} />
              </button>
              <p className="text-[12px] font-semibold">
                {format(month, "MMMM yyyy")}
              </p>
              <button
                type="button"
                onClick={() => setMonth((m) => addMonths(m, 1))}
                aria-label="Next month"
                className="grid size-7 place-items-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map((d, i) => (
                <span
                  key={i}
                  className="grid h-6 place-items-center text-[10px] font-semibold text-faint"
                >
                  {d}
                </span>
              ))}

              {days.map((d) => {
                const key = dayKey(d);
                const outside = !isSameMonth(d, month);
                const disabled = !!min && key < min;
                const isSelected = isSameDay(d, selected);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled}
                    aria-pressed={isSelected}
                    onClick={() => {
                      onChange(key);
                      setOpen(false);
                    }}
                    className={clsx(
                      "grid h-8 place-items-center rounded-lg text-[12px] tabular-nums transition-colors",
                      isSelected
                        ? "bg-accent font-bold text-white"
                        : disabled
                          ? "cursor-not-allowed text-faint/45"
                          : outside
                            ? "text-faint hover:bg-sunken"
                            : "font-medium text-ink hover:bg-accent-soft",
                      // Today keeps a marker even when something else is picked.
                      !isSelected &&
                        isSameDay(d, today) &&
                        "ring-1 ring-accent/45",
                    )}
                  >
                    {format(d, "d")}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
