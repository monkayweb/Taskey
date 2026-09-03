"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

export type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";

const TONE_BADGE: Record<Tone, string> = {
  neutral: "bg-sunken text-muted border-line",
  accent: "bg-accent-soft text-accent-ink border-accent/20",
  ok: "bg-ok-soft text-ok border-ok/20",
  warn: "bg-warn-soft text-warn border-warn/20",
  danger: "bg-danger-soft text-danger border-danger/20",
};

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-ink",
  accent: "text-accent",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
};

const TONE_BAR: Record<Tone, string> = {
  neutral: "bg-line-strong",
  accent: "bg-accent",
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
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
        "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5",
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
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={bodyClassName ?? "p-4"}>{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="card px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p
        className={clsx(
          "mt-1.5 font-mono text-2xl tabular-nums leading-none",
          TONE_TEXT[tone],
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Horizontal meter. `segments` render left-to-right in order. */
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
        "flex h-1.5 w-full overflow-hidden rounded-full bg-line",
        className,
      )}
    >
      {segments.map((s, i) =>
        s.value === 0 ? null : (
          <div
            key={i}
            title={s.title}
            className={TONE_BAR[s.tone]}
            style={{ width: `${(s.value / total) * 100}%` }}
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
    <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
      {icon && <div className="text-faint">{icon}</div>}
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {detail && <p className="max-w-sm text-xs text-muted">{detail}</p>}
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
        fontSize: size * 0.4,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export const pctText = (n: number) => `${Math.round(n * 100)}%`;
