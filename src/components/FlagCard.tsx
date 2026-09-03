"use client";

import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Clock, FileText, FolderKanban, MessageSquareDot } from "lucide-react";
import type { Flag, FlagKind } from "@/lib/types";
import { FLAG_LABEL, FLAG_TONE } from "@/lib/labels";
import { Badge } from "./ui";

const ICON: Record<FlagKind, typeof Clock> = {
  inquiry_idle: MessageSquareDot,
  followup_overdue: FileText,
  followup_due_today: Clock,
  milestone_overdue: FolderKanban,
  project_due_soon: FolderKanban,
  log_missing: Clock,
};

const SHELL: Record<Flag["severity"], string> = {
  critical: "bg-danger-soft/40 ring-danger/20",
  warning: "bg-warn-soft/50 ring-warn/20",
  info: "bg-surface ring-line",
};

const CHIP: Record<Flag["severity"], string> = {
  critical: "bg-danger-fill text-white",
  warning: "bg-warn-fill text-white",
  info: "bg-sunken text-muted",
};

/** One thing that needs a human, as a card rather than a list row. */
export function FlagCard({ flag }: { flag: Flag }) {
  const Icon = ICON[flag.kind];
  return (
    <Link
      href={flag.href}
      className={clsx(
        "group flex flex-col rounded-2xl p-4 ring-1 transition-shadow hover:shadow-[var(--shadow-pop)]",
        SHELL[flag.severity],
      )}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={clsx(
            "grid size-8 shrink-0 place-items-center rounded-xl",
            CHIP[flag.severity],
          )}
        >
          <Icon size={15} />
        </span>
        <Badge tone={FLAG_TONE[flag.severity]}>{FLAG_LABEL[flag.kind]}</Badge>
      </div>

      <h3 className="mt-3 text-[15px] font-semibold leading-snug tracking-tight">
        {flag.title}
      </h3>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-muted">{flag.detail}</p>

      <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-accent">
        Open
        <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
