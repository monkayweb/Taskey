"use client";

import clsx from "clsx";
import { Check, CircleSlash, Clock, Lock, MinusCircle } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { blockMinutes } from "@/lib/date";
import { CATEGORY_LABEL, SKIP_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/labels";
import type { BlockStatus, DailyBlock, SkipReason } from "@/lib/types";
import { Badge } from "./ui";

const OPTIONS: { value: BlockStatus; label: string; icon: typeof Check }[] = [
  { value: "done", label: "Done", icon: Check },
  { value: "partial", label: "Partly", icon: MinusCircle },
  { value: "missed", label: "Missed", icon: CircleSlash },
];

const SKIP_OPTIONS = Object.keys(SKIP_LABEL) as SkipReason[];

/** Tinted edge and ground per outcome, so a glance across the grid reads. */
const SHELL: Record<BlockStatus, string> = {
  pending: "bg-surface ring-line",
  done: "bg-ok-soft/50 ring-ok/20",
  partial: "bg-warn-soft/50 ring-warn/20",
  missed: "bg-danger-soft/40 ring-danger/20",
};

const ACTIVE: Record<BlockStatus, string> = {
  pending: "",
  done: "bg-ok-fill text-white",
  partial: "bg-warn-fill text-white",
  missed: "bg-danger-fill text-white",
};

export function TaskCard({
  block,
  logId,
  locked,
}: {
  block: DailyBlock;
  logId: string;
  locked: boolean;
}) {
  const setBlockStatus = useTaskey((s) => s.setBlockStatus);
  const needsReason =
    (block.status === "partial" || block.status === "missed") && !block.skipReason;

  return (
    <div
      className={clsx(
        "flex flex-col rounded-2xl p-4 ring-1 transition-colors",
        SHELL[block.status],
      )}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {/* --- when and what -------------------------------------------- */}
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[13px] font-medium tabular-nums">
          <Clock size={13} className="text-faint" />
          {block.start} – {block.end}
        </span>
        <Badge>{CATEGORY_LABEL[block.category]}</Badge>
      </div>

      <h3 className="mt-2.5 text-[16px] font-semibold leading-snug tracking-tight">
        {block.label}
      </h3>
      <p className="mt-0.5 text-xs text-muted">
        {blockMinutes(block.start, block.end)} minutes booked
      </p>

      {/* --- outcome --------------------------------------------------- */}
      {locked ? (
        <div className="mt-4 space-y-1.5 border-t border-line/70 pt-3">
          <Badge tone={STATUS_TONE[block.status]}>
            <Lock size={10} />
            {STATUS_LABEL[block.status]}
          </Badge>
          {block.skipReason && (
            <p className="text-xs leading-snug text-muted">
              {SKIP_LABEL[block.skipReason]}
              {block.note ? `: ${block.note}` : ""}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            {OPTIONS.map((o) => {
              const Icon = o.icon;
              const active = block.status === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBlockStatus(logId, block.id, o.value)}
                  className={clsx(
                    "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl text-[13px] font-medium transition-colors",
                    active
                      ? ACTIVE[o.value]
                      : "bg-sunken text-muted ring-1 ring-line hover:text-ink",
                  )}
                >
                  <Icon size={14} />
                  {o.label}
                </button>
              );
            })}
          </div>

          {(block.status === "partial" || block.status === "missed") && (
            <div className="space-y-1.5 pt-0.5">
              <select
                value={block.skipReason ?? ""}
                onChange={(e) =>
                  setBlockStatus(logId, block.id, block.status, {
                    skipReason: (e.target.value || undefined) as SkipReason,
                  })
                }
                className={clsx(
                  "field h-9 py-0 text-[13px]",
                  needsReason && "ring-danger/50",
                )}
                aria-label="Why was this not completed?"
              >
                <option value="">Why? (required)</option>
                {SKIP_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {SKIP_LABEL[r]}
                  </option>
                ))}
              </select>
              <input
                value={block.note ?? ""}
                onChange={(e) =>
                  setBlockStatus(logId, block.id, block.status, {
                    note: e.target.value,
                  })
                }
                placeholder="Optional detail"
                className="field h-9 py-0 text-[13px]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
