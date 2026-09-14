"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Clock } from "lucide-react";

/** The full day in half hours, 00:00 to 23:30. */
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const mins = i * 30;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(
    mins % 60,
  ).padStart(2, "0")}`;
});

/** Where the list lands when nothing is chosen yet, so it does not open on
    midnight when almost every task is booked during the day. */
const DEFAULT_SCROLL = "08:00";

/**
 * Companion to <DatePicker>, same trigger and popover, so a due date and a
 * due time read as one control rather than two borrowed browser widgets.
 */
export function TimePicker({
  value,
  onChange,
  label = "Due time",
}: {
  value?: string;
  onChange: (time: string | undefined) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // 48 rows is a long way to scroll by hand, so the list opens on the time
  // that is already set.
  useEffect(() => {
    if (!open) return;
    const target = listRef.current?.querySelector<HTMLElement>(
      `[data-time="${value ?? DEFAULT_SCROLL}"]`,
    );
    target?.scrollIntoView({ block: "center" });
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        className={clsx(
          "flex h-9 w-full items-center gap-1.5 rounded-lg bg-surface px-2.5 text-[12px] font-medium ring-1 transition-colors",
          value ? "text-ink" : "text-muted",
          open
            ? "ring-2 ring-accent/40"
            : "ring-line-strong/70 hover:ring-accent/30",
        )}
      >
        <Clock size={14} className="shrink-0 text-faint" />
        {value ?? "Any time"}
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
            ref={listRef}
            className="absolute right-0 top-full z-20 mt-1.5 max-h-56 w-[112px] overflow-y-auto rounded-xl bg-surface p-1 ring-1 ring-line"
            style={{ boxShadow: "var(--shadow-pop)" }}
          >
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              className={clsx(
                "block w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors",
                value === undefined
                  ? "bg-accent font-semibold text-white"
                  : "text-muted hover:bg-sunken hover:text-ink",
              )}
            >
              Any time
            </button>
            {TIMES.map((t) => (
              <button
                key={t}
                type="button"
                data-time={t}
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                }}
                className={clsx(
                  "block w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] tabular-nums transition-colors",
                  t === value
                    ? "bg-accent font-semibold text-white"
                    : "text-ink hover:bg-accent-soft",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
