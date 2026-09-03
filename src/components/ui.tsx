"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

export type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";

const TONE_BADGE: Record<Tone, string> = {
  neutral: "bg-sunken text-muted ring-line",
  accent: "bg-accent-soft text-accent-ink ring-accent/15",
  ok: "bg-ok-soft text-ok ring-ok/15",
  warn: "bg-warn-soft text-warn ring-warn/15",
  danger: "bg-danger-soft text-danger ring-danger/15",
};

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-ink",
  accent: "text-accent",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
};

/** Validated data-fill steps — brighter than the text tokens of the same name. */
const TONE_FILL: Record<Tone, string> = {
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
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
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
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className="card px-5 py-4">
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow">{label}</p>
        {icon && (
          <span
            className={clsx(
              "grid size-7 shrink-0 place-items-center rounded-full",
              tone === "neutral" ? "bg-accent-soft text-accent" : TONE_BADGE[tone],
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p
        className={clsx(
          "mt-2 font-mono text-[28px] tabular-nums leading-none tracking-tight",
          TONE_TEXT[tone],
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
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
      {detail && <p className="max-w-sm text-xs leading-relaxed text-muted">{detail}</p>}
    </div>
  );
}

export function Avatar({
  name,
  tint,
  size = 28,
  ring,
}: {
  name: string;
  tint: string;
  size?: number;
  ring?: boolean;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        ring && "ring-2 ring-surface",
      )}
      style={{
        width: size,
        height: size,
        background: tint,
        fontSize: size * 0.4,
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
          <Avatar name={p.name} tint={p.tint} size={size} ring />
        </span>
      ))}
      {rest > 0 && (
        <span
          className="-ml-2 grid place-items-center rounded-full bg-accent-soft font-semibold text-accent-ink ring-2 ring-surface"
          style={{ width: size, height: size, fontSize: size * 0.38 }}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

export const pctText = (n: number) => `${Math.round(n * 100)}%`;
