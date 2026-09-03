"use client";

import { useState } from "react";
import clsx from "clsx";
import { Lock, Plus, Send, Sunrise, Sunset, Trash2 } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { clockTime } from "@/lib/date";
import { CATEGORY_LABEL } from "@/lib/labels";
import type { DailyLog, TaskCategory } from "@/lib/types";
import { TaskCard } from "./TaskCard";
import { Badge, Empty, Meter, Panel } from "./ui";

/** Split at midday so the page reads as two short lists, not one long one. */
const isMorning = (start: string) => Number(start.split(":")[0]) < 12;

export function TaskBoard({ log }: { log: DailyLog }) {
  const { submitLog, setSummaryNote } = useTaskey();
  const locked = !!log.lockedAt;

  const done = log.blocks.filter((b) => b.status === "done").length;
  const partial = log.blocks.filter((b) => b.status === "partial").length;
  const missed = log.blocks.filter((b) => b.status === "missed").length;
  const pending = log.blocks.filter((b) => b.status === "pending").length;

  const unexplained = log.blocks.filter(
    (b) => (b.status === "partial" || b.status === "missed") && !b.skipReason,
  ).length;
  const canSubmit = !locked && pending === 0 && unexplained === 0;

  const groups = [
    { key: "am", label: "Morning", icon: Sunrise, blocks: log.blocks.filter((b) => isMorning(b.start)) },
    { key: "pm", label: "Afternoon", icon: Sunset, blocks: log.blocks.filter((b) => !isMorning(b.start)) },
  ].filter((g) => g.blocks.length > 0);

  return (
    <div className="space-y-5">
      {/* --- progress header ------------------------------------------ */}
      <div className="card px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">
              {locked
                ? "Day submitted"
                : pending === 0
                  ? "Everything is logged"
                  : `${pending} block${pending === 1 ? "" : "s"} left to log`}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {locked
                ? `Sent at ${clockTime(log.submittedAt!)} and locked for good.`
                : "Mirrored from Google Calendar · Team"}
            </p>
          </div>
          {locked ? (
            <Badge tone="ok">
              <Lock size={11} />
              Locked
            </Badge>
          ) : (
            <span className="font-mono text-[22px] font-medium tabular-nums">
              {log.blocks.length - pending}
              <span className="text-faint">/{log.blocks.length}</span>
            </span>
          )}
        </div>

        <Meter
          className="mt-3"
          segments={[
            { value: done, tone: "ok", title: `${done} done` },
            { value: partial, tone: "warn", title: `${partial} partly done` },
            { value: missed, tone: "danger", title: `${missed} missed` },
            { value: pending, tone: "neutral", title: `${pending} not logged` },
          ]}
        />
        <p className="mt-2 text-xs text-muted">
          {done} done · {partial} partly done · {missed} missed
          {pending > 0 && ` · ${pending} not logged`}
        </p>
      </div>

      {/* --- the cards ------------------------------------------------- */}
      {log.blocks.length === 0 ? (
        <Panel>
          <Empty
            title="No calendar blocks today"
            detail="Nothing was scheduled for this date, so no log is expected."
          />
        </Panel>
      ) : (
        groups.map((group) => {
          const Icon = group.icon;
          return (
            <section key={group.key}>
              <div className="mb-3 flex items-center gap-2">
                <Icon size={15} className="text-faint" />
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
                  {group.label}
                </h2>
                <span className="text-[11px] text-faint">
                  {group.blocks.length} block{group.blocks.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {group.blocks.map((b) => (
                  <TaskCard key={b.id} block={b} logId={log.id} locked={locked} />
                ))}
              </div>
            </section>
          );
        })
      )}

      <ExtraTasks log={log} locked={locked} />

      {/* --- submission ------------------------------------------------ */}
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

function ExtraTasks({ log, locked }: { log: DailyLog; locked: boolean }) {
  const { addExtraTask, removeExtraTask } = useTaskey();
  const [label, setLabel] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [category, setCategory] = useState<TaskCategory>("other");

  function add() {
    if (!label.trim()) return;
    addExtraTask(log.id, { label: label.trim(), minutes, category });
    setLabel("");
    setMinutes(30);
  }

  return (
    <Panel
      title="Work that wasn't on the calendar"
      subtitle="Log the interruptions too, otherwise the day looks emptier than it was."
    >
      {log.extraTasks.length > 0 && (
        <ul className="mb-3 grid gap-2 sm:grid-cols-2">
          {log.extraTasks.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-2.5 rounded-xl bg-sunken px-3 py-2.5 text-[13px]"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{t.label}</span>
              <Badge>{CATEGORY_LABEL[t.category]}</Badge>
              <span className="font-mono text-[12px] tabular-nums text-muted">
                {t.minutes}m
              </span>
              {!locked && (
                <button
                  type="button"
                  onClick={() => removeExtraTask(log.id, t.id)}
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
          <p className="text-xs text-muted">Nothing extra logged.</p>
        )
      ) : (
        <div className="flex flex-wrap gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="What else took your time?"
            className={clsx("field h-9 min-w-[200px] flex-1 py-0 text-[13px]")}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TaskCategory)}
            className="field h-9 w-[130px] py-0 text-[13px]"
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
            className="field h-9 w-[80px] py-0 text-[13px]"
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
