"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  Check,
  CircleSlash,
  Lock,
  MinusCircle,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { useTaskey } from "@/lib/store";
import { blockMinutes, clockTime } from "@/lib/date";
import {
  CATEGORY_LABEL,
  SKIP_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
} from "@/lib/labels";
import type { BlockStatus, DailyLog, SkipReason, TaskCategory } from "@/lib/types";
import { Badge, Empty, Meter, Panel } from "./ui";

const STATUS_OPTIONS: { value: BlockStatus; label: string; icon: typeof Check }[] = [
  { value: "done", label: "Done", icon: Check },
  { value: "partial", label: "Partly", icon: MinusCircle },
  { value: "missed", label: "Missed", icon: CircleSlash },
];

const SKIP_OPTIONS = Object.keys(SKIP_LABEL) as SkipReason[];

/** A partly-done or missed block has to say why before the log can be sent. */
function blockNeedsReason(status: BlockStatus, reason?: SkipReason) {
  return (status === "partial" || status === "missed") && !reason;
}

export function DailyChecklist({ log }: { log: DailyLog }) {
  const { setBlockStatus, addExtraTask, removeExtraTask, setSummaryNote, submitLog } =
    useTaskey();
  const locked = !!log.lockedAt;

  const done = log.blocks.filter((b) => b.status === "done").length;
  const partial = log.blocks.filter((b) => b.status === "partial").length;
  const missed = log.blocks.filter((b) => b.status === "missed").length;
  const pending = log.blocks.filter((b) => b.status === "pending").length;

  const unexplained = log.blocks.filter((b) =>
    blockNeedsReason(b.status, b.skipReason),
  ).length;
  const canSubmit = !locked && pending === 0 && unexplained === 0;

  return (
    <div className="space-y-4">
      <Panel
        title="Today's time blocks"
        subtitle={
          log.blocks.length > 0
            ? `Mirrored from ${"Google Calendar · Team"}. Tick each block off at the end of your shift`
            : undefined
        }
        action={
          locked ? (
            <Badge tone="ok">
              <Lock size={11} /> Submitted {clockTime(log.submittedAt!)}
            </Badge>
          ) : (
            <Badge tone={pending ? "neutral" : "accent"}>
              {log.blocks.length - pending}/{log.blocks.length} logged
            </Badge>
          )
        }
        bodyClassName=""
      >
        {log.blocks.length === 0 ? (
          <Empty
            title="No calendar blocks today"
            detail="Nothing was scheduled on your calendar for this date, so no log is expected."
          />
        ) : (
          <>
            <div className="px-5 pt-1">
              <Meter
                className="h-2"
                segments={[
                  { value: done, tone: "ok", title: `${done} done` },
                  { value: partial, tone: "warn", title: `${partial} partly done` },
                  { value: missed, tone: "danger", title: `${missed} missed` },
                  { value: pending, tone: "neutral", title: `${pending} not logged` },
                ]}
              />
            </div>
            <ul className="divide-y divide-line">
              {log.blocks.map((block) => {
                const needsReason = blockNeedsReason(block.status, block.skipReason);
                return (
                  <li key={block.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                      <div className="w-[86px] shrink-0 pt-0.5">
                        <p className="font-mono text-[13px] tabular-nums leading-tight">
                          {block.start}
                        </p>
                        <p className="font-mono text-[11px] tabular-nums text-faint">
                          {block.end}
                        </p>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={clsx(
                              "text-[14px] font-medium",
                              block.status === "missed" && "text-muted",
                            )}
                          >
                            {block.label}
                          </p>
                          <Badge>{CATEGORY_LABEL[block.category]}</Badge>
                          <span className="text-[11px] text-faint">
                            {blockMinutes(block.start, block.end)} min
                          </span>
                        </div>

                        {locked ? (
                          <div className="mt-1.5 space-y-1">
                            <Badge tone={STATUS_TONE[block.status]}>
                              {STATUS_LABEL[block.status]}
                            </Badge>
                            {block.skipReason && (
                              <p className="text-xs text-muted">
                                {SKIP_LABEL[block.skipReason]}
                                {block.note ? `: ${block.note}` : ""}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2 space-y-2">
                            <div className="inline-flex overflow-hidden rounded-full ring-1 ring-line">
                              {STATUS_OPTIONS.map((opt, i) => {
                                const Icon = opt.icon;
                                const active = block.status === opt.value;
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() =>
                                      setBlockStatus(log.id, block.id, opt.value)
                                    }
                                    aria-pressed={active}
                                    className={clsx(
                                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                                      i > 0 && "border-l border-line",
                                      active
                                        ? opt.value === "done"
                                          ? "bg-ok-soft text-ok"
                                          : opt.value === "partial"
                                            ? "bg-warn-soft text-warn"
                                            : "bg-danger-soft text-danger"
                                        : "bg-surface text-muted hover:bg-sunken",
                                    )}
                                  >
                                    <Icon size={13} />
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>

                            {(block.status === "partial" ||
                              block.status === "missed") && (
                              <div className="grid gap-2 sm:grid-cols-[minmax(0,240px)_1fr]">
                                <select
                                  value={block.skipReason ?? ""}
                                  onChange={(e) =>
                                    setBlockStatus(log.id, block.id, block.status, {
                                      skipReason: (e.target.value ||
                                        undefined) as SkipReason,
                                    })
                                  }
                                  className={clsx(
                                    "field h-9 py-0 text-[13px]",
                                    needsReason && "border-danger/50",
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
                                    setBlockStatus(log.id, block.id, block.status, {
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
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>

      <ExtraTasks
        log={log}
        locked={locked}
        onAdd={(task) => addExtraTask(log.id, task)}
        onRemove={(id) => removeExtraTask(log.id, id)}
      />

      <Panel title="End-of-day submission">
        {locked ? (
          <div className="space-y-2">
            <p className="text-[13px]">
              Submitted at{" "}
              <span className="font-mono">{clockTime(log.submittedAt!)}</span> and
              locked. The summary has gone to management.
            </p>
            {log.summaryNote && (
              <p className="rounded-xl bg-sunken px-3 py-2 text-xs text-muted">
                {log.summaryNote}
              </p>
            )}
            <p className="text-xs text-muted">
              {done} done · {partial} partly done · {missed} missed
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="eyebrow mb-1.5 block" htmlFor="summary">
                Anything to add before you send?
              </label>
              <textarea
                id="summary"
                rows={2}
                value={log.summaryNote ?? ""}
                onChange={(e) => setSummaryNote(log.id, e.target.value)}
                placeholder="e.g. Quiet morning, then three walk-ins after lunch."
                className="field resize-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted">
                {pending > 0
                  ? `${pending} block${pending === 1 ? "" : "s"} still to log.`
                  : unexplained > 0
                    ? `${unexplained} block${unexplained === 1 ? " needs" : "s need"} a reason.`
                    : "Ready to send. Once submitted this log is locked."}
              </p>
              <button
                type="button"
                onClick={() => submitLog(log.id)}
                disabled={!canSubmit}
                className="btn btn-primary btn-md"
              >
                <Send size={15} />
                Submit day
              </button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function ExtraTasks({
  log,
  locked,
  onAdd,
  onRemove,
}: {
  log: DailyLog;
  locked: boolean;
  onAdd: (t: { label: string; minutes: number; category: TaskCategory }) => void;
  onRemove: (id: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [category, setCategory] = useState<TaskCategory>("other");

  function add() {
    if (!label.trim()) return;
    onAdd({ label: label.trim(), minutes, category });
    setLabel("");
    setMinutes(30);
  }

  return (
    <Panel
      title="Work that wasn't on the calendar"
      subtitle="Log the interruptions too, otherwise the day looks emptier than it was."
      bodyClassName=""
    >
      {log.extraTasks.length > 0 && (
        <ul className="divide-y divide-line">
          {log.extraTasks.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 px-5 py-2.5 text-[13px]"
            >
              <span className="min-w-0 flex-1 truncate">{t.label}</span>
              <Badge>{CATEGORY_LABEL[t.category]}</Badge>
              <span className="font-mono text-[12px] tabular-nums text-muted">
                {t.minutes}m
              </span>
              {!locked && (
                <button
                  type="button"
                  onClick={() => onRemove(t.id)}
                  className="text-faint transition-colors hover:text-danger"
                  aria-label={`Remove ${t.label}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {locked ? (
        log.extraTasks.length === 0 && (
          <p className="px-5 py-4 text-xs text-muted">Nothing extra logged.</p>
        )
      ) : (
        <div className="flex flex-wrap gap-2 p-4 pt-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="What else took your time?"
            className="field h-9 min-w-[200px] flex-1 py-0 text-[13px]"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TaskCategory)}
            className="field h-9 w-[120px] py-0 text-[13px]"
            aria-label="Category"
          >
            {(Object.keys(CATEGORY_LABEL) as TaskCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={5}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="field h-9 w-[76px] py-0 text-[13px]"
            aria-label="Minutes"
          />
          <button type="button" onClick={add} className="btn btn-ghost btn-md">
            <Plus size={15} />
            Add
          </button>
        </div>
      )}
    </Panel>
  );
}
