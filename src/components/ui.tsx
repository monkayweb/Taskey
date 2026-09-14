"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";

export type Tone =
  "neutral" | "accent" | "pink" | "purple" | "ok" | "warn" | "danger";

const TONE_BADGE: Record<Tone, string> = {
  pink: "bg-pink-soft text-pink ring-pink/15",
  purple: "bg-purple-soft text-purple ring-purple/15",
  neutral: "bg-sunken text-muted ring-line",
  accent: "bg-accent-soft text-accent-ink ring-accent/15",
  ok: "bg-ok-soft text-ok ring-ok/15",
  warn: "bg-warn-soft text-warn ring-warn/15",
  danger: "bg-danger-soft text-danger ring-danger/15",
};

const TONE_TEXT: Record<Tone, string> = {
  pink: "text-pink",
  purple: "text-purple",
  neutral: "text-ink",
  accent: "text-accent",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
};

const TONE_STROKE: Record<Tone, string> = {
  neutral: "stroke-line-strong",
  accent: "stroke-accent",
  pink: "stroke-pink",
  purple: "stroke-purple",
  ok: "stroke-ok-fill",
  warn: "stroke-warn-fill",
  danger: "stroke-danger-fill",
};

/** Validated data-fill steps, brighter than the text tokens of the same name. */
const TONE_FILL: Record<Tone, string> = {
  pink: "bg-pink",
  purple: "bg-purple",
  neutral: "bg-track",
  accent: "bg-accent",
  ok: "bg-ok-fill",
  warn: "bg-warn-fill",
  danger: "bg-danger-fill",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 ring-1",
        "text-[11px] font-medium leading-4 whitespace-nowrap",
        TONE_BADGE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={clsx("card overflow-hidden", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={bodyClassName ?? "px-5 pb-5"}>{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  filled,
  delta,
  deltaGoodWhenUp = true,
  deltaUnit = "",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  /**
   * The brand fill, for the one number on a page that leads. `tone` is
   * ignored when filled: a status colour on the accent would be unreadable,
   * so the standing on that measure belongs in the hint instead.
   */
  filled?: boolean;
  /** Change against the previous comparable period. Hidden when 0 or null. */
  delta?: number | null;
  /** Set false where a rise is the bad direction, e.g. missed work. */
  deltaGoodWhenUp?: boolean;
  deltaUnit?: string;
}) {
  return (
    <div
      className={clsx(
        // Two of these sit side by side on a phone, so the padding and the
        // number both step down rather than the label wrapping to three lines.
        "px-4 py-3.5 sm:px-5 sm:py-4",
        filled ? "rounded-2xl bg-accent" : "card",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={clsx("eyebrow", filled && "text-white/70")}>{label}</p>
        {icon && (
          <span
            className={clsx(
              "grid size-7 shrink-0 place-items-center rounded-full",
              filled
                ? "bg-white/15 text-white"
                : tone === "neutral"
                  ? "bg-accent-soft text-accent"
                  : TONE_BADGE[tone],
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-x-2.5 gap-y-1">
        <p
          className={clsx(
            "text-[22px] tabular-nums leading-none tracking-tight sm:text-[28px]",
            filled ? "font-semibold text-white" : TONE_TEXT[tone],
          )}
        >
          {value}
        </p>

        {delta !== null && delta !== undefined && delta !== 0 && (
          <span
            className={clsx(
              "mb-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
              filled
                ? "bg-white/15 text-white"
                : delta > 0 === deltaGoodWhenUp
                  ? "bg-ok-soft text-ok"
                  : "bg-danger-soft text-danger",
            )}
          >
            {delta > 0 ? (
              <ArrowUp size={11} strokeWidth={3} aria-hidden />
            ) : (
              <ArrowDown size={11} strokeWidth={3} aria-hidden />
            )}
            {Math.abs(delta)}
            {deltaUnit}
          </span>
        )}
      </div>
      {hint && (
        <p
          className={clsx(
            "mt-2 text-xs",
            filled ? "text-white/75" : "text-muted",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Horizontal meter. Segments render left-to-right with a 2px surface gap
 * between fills, so adjacent status colours never touch.
 */
export function Meter({
  segments,
  className,
}: {
  segments: { value: number; tone: Tone; title?: string }[];
  className?: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div
      className={clsx(
        "flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-track",
        className,
      )}
    >
      {segments.map((s, i) =>
        s.value === 0 ? null : (
          <div
            key={i}
            title={s.title}
            className={clsx("rounded-full", TONE_FILL[s.tone])}
            style={{ width: `calc(${(s.value / total) * 100}% - 2px)` }}
          />
        ),
      )}
    </div>
  );
}

export function Empty({
  icon,
  title,
  detail,
}: {
  icon?: ReactNode;
  title: string;
  detail?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
      {icon && (
        <div className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent">
          {icon}
        </div>
      )}
      <p className="text-[14px] font-medium text-ink">{title}</p>
      {detail && (
        <p className="max-w-sm text-xs leading-relaxed text-muted">{detail}</p>
      )}
    </div>
  );
}

export function Avatar({
  name,
  tint,
  size = 28,
}: {
  name: string;
  tint: string;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: tint,
        // Initials sit inside a circle, so they read smaller than a square
        // of the same size would suggest.
        fontSize: size * 0.34,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Overlapping avatars, as on the reference progress cards. */
export function AvatarStack({
  people,
  size = 22,
  max = 3,
}: {
  people: { name: string; tint: string }[];
  size?: number;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={p.name} className={i > 0 ? "-ml-2" : undefined}>
          <Avatar name={p.name} tint={p.tint} size={size} />
        </span>
      ))}
      {rest > 0 && (
        <span
          className="-ml-2 grid place-items-center rounded-full bg-accent-soft font-semibold text-accent-ink"
          style={{ width: size, height: size, fontSize: size * 0.33 }}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

export const pctText = (n: number) => `${Math.round(n * 100)}%`;

/** Quiet label above a row of controls. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-medium text-faint">{label}</p>
      {children}
      {hint && <p className="mt-1.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

/** A pressed-in-or-out choice. Used wherever a form picks one of a few things. */
export function Chip({
  on,
  tone = "accent",
  onClick,
  children,
  className,
}: {
  on: boolean;
  tone?: "accent" | "danger";
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={clsx(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition-colors",
        on
          ? tone === "danger"
            ? "bg-danger-fill text-white"
            : "bg-accent text-white"
          : tone === "danger"
            ? "bg-danger-soft text-danger hover:bg-danger-soft/70"
            : "bg-accent-soft text-accent-ink hover:bg-accent-soft/70",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Underlined period tabs, as on the overview panel. */
export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              "relative px-2.5 pb-1.5 pt-1 text-[13px] font-medium transition-colors",
              active ? "text-ink" : "text-faint hover:text-muted",
            )}
          >
            {o.label}
            {active && (
              <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-accent" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A ring meter: one ratio in the centre, with the parts that make it up as
 * ring segments. Segments carry a small gap so adjacent colours never touch,
 * and the legend names every one, so colour is never the only channel.
 */
export function RingMeter({
  segments,
  centerValue,
  centerLabel,
  size = 168,
  thickness = 16,
}: {
  segments: { value: number; tone: Tone; label: string }[];
  centerValue: ReactNode;
  centerLabel?: string;
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const gap = total > 0 ? 3 : 0;

  // Offsets are prefix sums rather than a running accumulator, so nothing is
  // reassigned during render.
  const visible = segments.filter((s) => s.value > 0);
  const lengths = visible.map((s) => (s.value / total) * circumference);
  const arcs = visible.map((s, i) => ({
    ...s,
    len: Math.max(lengths[i] - gap, 0.5),
    offset: lengths.slice(0, i).reduce((a, b) => a + b, 0),
  }));

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          className="stroke-track"
        />
        {arcs.map((a, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${a.len} ${circumference - a.len}`}
            strokeDashoffset={-a.offset}
            className={TONE_STROKE[a.tone]}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[30px] font-medium tabular-nums leading-none">
          {centerValue}
        </span>
        {centerLabel && (
          <span className="mt-1 text-[11px] text-muted">{centerLabel}</span>
        )}
      </div>
    </div>
  );
}

/** Legend row: a colour dot plus its name and value, so identity is textual. */
export function LegendItem({
  tone,
  label,
  value,
}: {
  tone: Tone;
  label: string;
  value?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className={clsx("size-2 shrink-0 rounded-full", TONE_FILL[tone])} />
      <span className="min-w-0 flex-1 truncate text-muted">{label}</span>
      {value !== undefined && (
        <span className="tabular-nums text-ink">{value}</span>
      )}
    </div>
  );
}

const SQUARE: Record<Tone, string> = {
  neutral: "bg-sunken text-ink",
  accent: "bg-accent text-white",
  pink: "bg-pink text-white",
  purple: "bg-purple text-white",
  ok: "bg-ok-fill text-white",
  warn: "bg-warn-fill text-white",
  danger: "bg-danger-fill text-white",
};

/** Filled stat square, as on the habits row. Colour here is decorative. */
export function StatSquare({
  tone,
  icon,
  value,
  label,
}: {
  tone: Tone;
  icon: ReactNode;
  value: ReactNode;
  label: string;
}) {
  return (
    <div className={clsx("rounded-2xl px-3 py-3", SQUARE[tone])}>
      <span className="grid size-7 place-items-center rounded-lg bg-white/20">
        {icon}
      </span>
      <p className="mt-2.5 text-[20px] font-medium tabular-nums leading-none">
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] opacity-85">{label}</p>
    </div>
  );
}

/**
 * A progress row with the name inside the filled bar, as on the In Progress
 * panel. All bars share one hue because they all mean the same thing; a bar
 * only changes colour when it is actually behind.
 */
export function ProgressRow({
  label,
  detail,
  pct,
  behind,
}: {
  label: string;
  detail: string;
  pct: number;
  behind?: boolean;
}) {
  // The bar width always tells the truth about pct, so the label only sits
  // inside it when the fill is wide enough to hold the text.
  const inside = pct >= 0.45;

  return (
    <div>
      <span
        className={clsx(
          "text-[11px] font-medium tabular-nums",
          behind ? "text-danger" : "text-accent",
        )}
      >
        {Math.round(pct * 100)}%
      </span>

      <div className="mt-1 flex items-center gap-2">
        <div className="h-7 min-w-0 flex-1 overflow-hidden rounded-full bg-track">
          {/* Nothing done yet means an empty track, not a coloured stub. */}
          <div
            className={clsx(
              "flex h-full items-center rounded-full",
              inside && "pl-3 pr-2",
              behind ? "bg-danger-fill" : "bg-accent",
            )}
            style={{ width: pct === 0 ? 0 : `${Math.max(pct * 100, 7)}%` }}
          >
            {inside && (
              <span className="truncate text-[12px] font-medium text-white">
                {label}
              </span>
            )}
          </div>
        </div>
        {!inside && (
          <span className="max-w-[58%] truncate text-[12px] font-medium">
            {label}
          </span>
        )}
      </div>

      <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-muted">
        {detail}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Waiting
// ---------------------------------------------------------------------------

/**
 * One block of something that has not arrived. Sized in the caller, because a
 * skeleton is only useful if it is the shape of the thing it stands in for.
 */
export function Skeleton({
  className,
  w,
  h = 12,
}: {
  className?: string;
  /** Any CSS width. A percentage varies the line lengths so it reads as text. */
  w?: string | number;
  h?: number;
}) {
  return (
    <span
      aria-hidden
      className={clsx("skeleton block", className)}
      style={{ width: w, height: h }}
    />
  );
}

/** A few lines of type, of uneven length, the way real prose sits. */
export function SkeletonLines({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  const widths = ["92%", "78%", "85%", "64%", "88%"];
  return (
    <span className={clsx("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} w={widths[i % widths.length]} h={10} />
      ))}
    </span>
  );
}

/** A stat tile before its number lands. */
export function SkeletonTile() {
  return (
    <div className="card px-5 py-4">
      <Skeleton w="45%" h={8} />
      <Skeleton className="mt-3" w="35%" h={22} />
      <Skeleton className="mt-3" w="70%" h={8} />
    </div>
  );
}

/** A panel with a heading and a few rows in it. */
export function SkeletonPanel({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 pb-3 pt-4">
        <Skeleton w="34%" h={13} />
        <Skeleton className="mt-2" w="58%" h={9} />
      </div>
      <div className="divide-y divide-line border-t border-line">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3">
            <Skeleton className="shrink-0 rounded-xl" w={32} h={32} />
            <span className="min-w-0 flex-1">
              <Skeleton w={`${70 - i * 8}%`} h={11} />
              <Skeleton className="mt-1.5" w={`${45 + i * 6}%`} h={9} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
