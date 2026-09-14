"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Bucket } from "@/lib/dashboard";

// ---------------------------------------------------------------------------
// The charts, and the two colours they are allowed.
//
// On time against late wants green and red, and that pair fails colour-blind
// separation badly: ΔE 4.1 for deuteranopia, where the target is 8 and the
// floor for "legal with a label" is 6. So the mass of work is the brand
// indigo and only lateness is red, which clears every check at ΔE 24.
//
// Everything else is magnitude rather than identity, so it is one hue.
// ---------------------------------------------------------------------------

export const GOOD = "#4f57d2";
export const BAD = "#d03b3b";

/**
 * Two series over time, stacked, with the problem on top where the eye lands.
 * A 2px gap keeps the fills from touching, the count sits above the bar, and
 * the same numbers are in a table for anybody who cannot use the chart.
 */
export function StackedBars({
  buckets,
  goodLabel,
  badLabel,
  height = 150,
  empty = "Nothing in this window yet.",
}: {
  buckets: Bucket[];
  goodLabel: string;
  badLabel: string;
  height?: number;
  /** Shown instead of an empty grid when every bar would be zero. */
  empty?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const anything = buckets.some((b) => b.good + b.bad > 0);
  const peak = Math.max(...buckets.map((b) => b.good + b.bad), 1);
  const top = peak <= 4 ? 4 : Math.ceil(peak / 5) * 5;

  // A grid of nothing, with a legend above it, reads as a broken chart. Say
  // there is nothing yet instead.
  if (!anything)
    return <p className="py-8 text-center text-[13px] text-muted">{empty}</p>;

  // The tallest bar stops short of the ceiling, because the count sits above
  // it and would otherwise collide with the top rule.
  const plot = height - 20;
  const scale = (n: number) => (n / top) * plot;

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <Key colour={GOOD} label={goodLabel} />
        <Key colour={BAD} label={badLabel} />
      </div>

      <div className="relative">
        <div className="absolute inset-x-0 top-0" style={{ height }}>
          {[0, 0.5, 1].map((f) => (
            <div
              key={f}
              className="absolute inset-x-0 border-t border-line"
              style={{ top: height - plot + f * plot }}
            />
          ))}
          <span
            className="absolute right-0 text-[10px] tabular-nums text-faint"
            style={{ top: height - plot - 14 }}
          >
            {top}
          </span>
        </div>

        <div className="relative flex items-end gap-2" style={{ height }}>
          {buckets.map((b, i) => {
            const total = b.good + b.bad;
            return (
              <div
                key={b.label + i}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className="group relative flex h-full flex-1 flex-col justify-end px-[10px]"
              >
                {total > 0 && (
                  <span
                    className={clsx(
                      "absolute inset-x-0 text-center text-[10px] font-semibold tabular-nums",
                      hover === i ? "text-ink" : "text-faint",
                    )}
                    style={{ bottom: scale(total) + 6 }}
                  >
                    {total}
                  </span>
                )}

                {b.bad > 0 && (
                  <div
                    className="rounded-t-[4px]"
                    style={{
                      height: Math.max(scale(b.bad), 3),
                      background: BAD,
                      marginBottom: b.good > 0 ? 2 : 0,
                    }}
                  />
                )}
                {b.good > 0 && (
                  <div
                    style={{
                      height: Math.max(scale(b.good), 3),
                      background: GOOD,
                      borderRadius: b.bad > 0 ? 0 : "4px 4px 0 0",
                    }}
                  />
                )}
                {total === 0 && (
                  <div className="h-[3px] rounded-full bg-track" />
                )}

                {hover === i && total > 0 && (
                  <div
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-5 w-max -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-white"
                    style={{ boxShadow: "var(--shadow-pop)" }}
                  >
                    <p className="text-[11px] font-semibold">{b.title}</p>
                    <p className="mt-0.5 text-[11px] text-white/75">
                      {b.good} {goodLabel.toLowerCase()}
                      {b.bad > 0 ? ` · ${b.bad} ${badLabel.toLowerCase()}` : ""}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex gap-2">
          {buckets.map((b, i) => (
            <span
              key={b.label + i}
              className={clsx(
                "flex-1 text-center text-[10px] tabular-nums",
                hover === i ? "text-ink" : "text-faint",
              )}
            >
              {b.label}
            </span>
          ))}
        </div>
      </div>

      <table className="sr-only">
        <caption>
          {goodLabel} and {badLabel}, by period
        </caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">{goodLabel}</th>
            <th scope="col">{badLabel}</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.title}>
              <th scope="row">{b.title}</th>
              <td>{b.good}</td>
              <td>{b.bad}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One series ranked by size. Magnitude, so one hue and no legend: the title
 * of the panel names what is being counted.
 */
export function RankedBars({
  rows,
  empty = "Nothing yet.",
  colour = GOOD,
  suffix,
}: {
  rows: { label: string; value: number; hint?: string }[];
  empty?: string;
  colour?: string;
  /** Appended to each value, for units like "d" or "%". */
  suffix?: string;
}) {
  if (rows.length === 0)
    return <p className="py-3 text-[12px] text-muted">{empty}</p>;

  const peak = Math.max(...rows.map((r) => r.value), 1);

  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[12px] text-muted">
              {r.label}
            </span>
            <span className="shrink-0 text-[12px] font-semibold tabular-nums">
              {r.value}
              {suffix}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-track">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((r.value / peak) * 100, 4)}%`,
                background: colour,
              }}
            />
          </div>
          {r.hint && (
            <p className="mt-1 text-[11px] text-faint">{r.hint}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** A colour dot and its name, so identity is never carried by colour alone. */
export function Key({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted">
      <span
        className="size-2 rounded-full"
        style={{ background: colour }}
        aria-hidden
      />
      {label}
    </span>
  );
}
