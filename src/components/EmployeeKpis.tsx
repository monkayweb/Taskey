"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { useNow } from "@/lib/now";
import { dayKey } from "@/lib/date";
import {
  closedByCategory,
  promises,
  taskRecord,
  weeklyClosures,
} from "@/lib/dashboard";
import { CATEGORY_LABEL } from "@/lib/labels";
import type { Assignment, Project, User } from "@/lib/types";
import { Panel } from "./ui";
import { RankedBars, StackedBars } from "./charts";

// ---------------------------------------------------------------------------
// One person's record, in numbers.
//
// Everything here is derived from work that actually happened: tasks closed
// against the date they were due, and the projects they carry. The charts and
// the definitions are the shared ones, so this page, the employee's own
// dashboard and management's KPI screen cannot disagree about who was late.
// ---------------------------------------------------------------------------

export function EmployeeKpis({
  user,
  tasks,
  projects,
}: {
  user: User;
  /** Every task of theirs, open and closed. */
  tasks: Assignment[];
  /** Every project, so the ones they carry can be measured. */
  projects: Project[];
}) {
  const now = useNow();
  const today = dayKey(now);

  const record = useMemo(() => taskRecord(tasks, today), [tasks, today]);
  const weeks = useMemo(() => weeklyClosures(tasks, now), [tasks, now]);
  const categories = useMemo(() => closedByCategory(tasks), [tasks]);

  const theirs = useMemo(
    () => projects.filter((p) => p.ownerId === user.id),
    [projects, user.id],
  );
  const kept = useMemo(() => promises(theirs), [theirs]);

  const nothingYet = record.closed === 0 && record.open === 0;

  return (
    <div className="space-y-6">
      {/* --- the numbers, on top ------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Closed on time"
          value={
            record.rate === null ? "—" : `${Math.round(record.rate * 100)}%`
          }
          hint={
            record.rate === null
              ? "Nothing closed yet"
              : `${record.onTime} of ${record.closed} tasks`
          }
          lead
        />
        <Tile
          label="Open now"
          value={record.open}
          hint={
            record.overdue > 0
              ? `${record.overdue} past their due date`
              : "Nothing late"
          }
          tone={record.overdue > 0 ? "danger" : "ok"}
        />
        <Tile
          label="Average lateness"
          value={
            record.avgDaysLate === null
              ? "—"
              : `${record.avgDaysLate.toFixed(1)}d`
          }
          hint={
            record.avgDaysLate === null
              ? "Nothing closed late"
              : `across ${record.late} late task${record.late === 1 ? "" : "s"}`
          }
          tone={
            record.avgDaysLate && record.avgDaysLate > 2 ? "danger" : "neutral"
          }
        />
        <Tile
          label="Submissions on time"
          value={
            kept.submitted === 0
              ? "—"
              : `${kept.submittedOnTime}/${kept.submitted}`
          }
          hint={
            kept.submitted === 0
              ? "None lodged yet"
              : "Against the date we promised"
          }
        />
      </div>

      {nothingYet ? (
        <Panel>
          <p className="py-6 text-center text-[13px] text-muted">
            Nothing to measure yet. As soon as {user.name.split(" ")[0]} has
            tasks and closes them, this fills in on its own.
          </p>
        </Panel>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
          <Panel
            title="Tasks closed, by week"
            subtitle="The last eight weeks, against the date each task was due."
          >
            <StackedBars buckets={weeks} goodLabel="On time" badLabel="Late" />
          </Panel>

          <Panel
            title="What they close"
            subtitle={`${record.closed} task${record.closed === 1 ? "" : "s"} closed, by kind of work.`}
          >
            <RankedBars
              rows={categories.map((r) => ({
                label: CATEGORY_LABEL[r.category],
                value: r.count,
              }))}
              empty="Nothing closed yet."
            />

            {/* Two facts about their projects that are not tasks at all. */}
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
              <div>
                <dt className="eyebrow">Client chases sent</dt>
                <dd className="mt-1 text-[18px] font-medium tabular-nums">
                  {kept.chases}
                </dd>
              </div>
              <div>
                <dt className="eyebrow">QC sent back</dt>
                <dd
                  className={clsx(
                    "mt-1 text-[18px] font-medium tabular-nums",
                    kept.qcReturns > 0 && "text-warn",
                  )}
                >
                  {kept.qcReturns}
                </dd>
              </div>
            </dl>
          </Panel>
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  tone = "neutral",
  lead,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: "neutral" | "ok" | "danger";
  lead?: boolean;
}) {
  return (
    <div
      className={clsx("px-5 py-4", lead ? "rounded-2xl bg-accent" : "card")}
    >
      <p className={clsx("eyebrow", lead && "text-white/70")}>{label}</p>
      <p
        className={clsx(
          "mt-2 text-[26px] tabular-nums leading-none tracking-tight",
          lead
            ? "font-semibold text-white"
            : tone === "danger"
              ? "text-danger"
              : tone === "ok"
                ? "text-ok"
                : "text-ink",
        )}
      >
        {value}
      </p>
      <p className={clsx("mt-2 text-[11px]", lead ? "text-white/75" : "text-faint")}>
        {hint}
      </p>
    </div>
  );
}
