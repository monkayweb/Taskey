"use client";

import { useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  CalendarClock,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  FolderKanban,
} from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { useMyFlags } from "@/lib/selectors";
import { dayKey, prettyDate, relativeDays, shortDate } from "@/lib/date";
import { money } from "@/lib/rules";
import { phaseBalance, serviceById } from "@/lib/services";
import { taskRecord, waitingOn, weeklyClosures } from "@/lib/dashboard";
import {
  capitalise,
  CATEGORY_LABEL,
  ROLE_BLURB,
  ROLE_LABEL,
} from "@/lib/labels";
import { Avatar, Badge, Empty, Panel, StatTile } from "@/components/ui";
import { StackedBars } from "@/components/charts";
import { FlagCard } from "@/components/FlagCard";
import type { Assignment, User } from "@/lib/types";

/**
 * Your own day, for everybody who is not running the practice.
 *
 * It answers one question in the first screenful: what do I do next. The
 * record at the bottom is the same measure management sees on your employee
 * page, deliberately, so a review is never a surprise.
 */
export function MyDashboard({ me }: { me: User }) {
  const now = useNow();
  const today = dayKey(now);
  const { assignments, projects } = useTaskey();
  const flags = useMyFlags(me.id);

  const mine = useMemo(
    () => assignments.filter((a) => a.assigneeIds.includes(me.id)),
    [assignments, me.id],
  );
  const record = useMemo(() => taskRecord(mine, today), [mine, today]);
  const weeks = useMemo(() => weeklyClosures(mine, now), [mine, now]);

  // Late first, then by date and then by the time of day it was booked for.
  const next = useMemo(
    () =>
      mine
        .filter((a) => a.status === "open")
        .sort(
          (a, b) =>
            a.dueDate.localeCompare(b.dueDate) ||
            (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99"),
        )
        .slice(0, 6),
    [mine],
  );

  const carrying = useMemo(
    () =>
      projects
        .filter((p) => p.ownerId === me.id && p.status !== "complete")
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [projects, me.id],
  );

  const closedThisWeek = weeks[weeks.length - 1];

  return (
    <div className="min-w-0 space-y-8 p-5 md:p-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Avatar name={me.name} tint={me.tint} size={44} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[18px] font-bold tracking-tight">
            {greeting(now)}, {me.name.split(" ")[0]}
          </h1>
          <p className="mt-0.5 text-[12px] text-muted">
            {capitalise(prettyDate(now))} · {ROLE_LABEL[me.workRole]}
          </p>
        </div>
      </div>

      {/* --- your day, in four numbers -------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="Due today"
          value={record.dueToday}
          hint={
            record.dueToday === 0
              ? "Nothing booked for today"
              : "Booked for today"
          }
          filled
        />
        <StatTile
          label="Past its date"
          value={record.overdue}
          hint={
            record.overdue === 0
              ? "Nothing of yours is late"
              : "Close these first"
          }
          tone={record.overdue > 0 ? "danger" : "ok"}
          icon={<CalendarClock size={14} />}
        />
        <StatTile
          label="Open in total"
          value={record.open}
          hint="Handed to you, and from project steps"
          icon={<ClipboardList size={14} />}
        />
        <StatTile
          label="Closed on time"
          value={
            record.rate === null ? "—" : `${Math.round(record.rate * 100)}%`
          }
          hint={
            record.rate === null
              ? "Nothing closed yet"
              : `${record.onTime} of ${record.closed} all told`
          }
          tone={
            record.rate !== null && record.rate < 0.7 ? "warn" : "neutral"
          }
          icon={<CheckCheck size={14} />}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.35fr_1fr]">
        {/* --- what to do next --------------------------------------- */}
        <Panel
          title="Do this next"
          subtitle="Your list, in the order it should be worked."
          action={
            <Link href="/tasks" className="btn btn-ghost btn-sm">
              All tasks
              <ChevronRight size={13} />
            </Link>
          }
          bodyClassName=""
        >
          {next.length === 0 ? (
            <Empty
              icon={<CheckCheck size={19} />}
              title="Nothing open"
              detail="Standing duties appear here on the days they run, and project steps arrive the moment a sheet reaches you."
            />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {next.map((a) => (
                <li key={a.id}>
                  <TaskRow task={a} today={today} now={now} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* --- what is quietly slipping ------------------------------- */}
        <section>
          <h2 className="text-[15px] font-semibold tracking-tight">
            Needs you
          </h2>
          <p className="mt-0.5 text-[12px] text-muted">
            {flags.length === 0
              ? "Nothing of yours is behind."
              : "Whatever is late, or about to be."}
          </p>

          <div className="mt-4 space-y-3">
            {flags.length === 0 ? (
              <div className="card">
                <Empty
                  icon={<CheckCheck size={19} />}
                  title="All clear"
                  detail={`${ROLE_BLURB[me.workRole]}. Nothing on that is late right now.`}
                />
              </div>
            ) : (
              flags
                .slice(0, 3)
                .map((f) => <FlagCard key={`${f.kind}:${f.refId}`} flag={f} />)
            )}
            {flags.length > 3 && (
              <p className="text-[12px] text-faint">
                And {flags.length - 3} more across your projects.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_1.35fr]">
        {/* --- the sheets you carry ---------------------------------- */}
        <Panel
          title="Projects you carry"
          subtitle="Each one hands you its next step when it reaches you."
          bodyClassName=""
        >
          {carrying.length === 0 ? (
            <p className="px-5 pb-5 text-[12px] text-muted">
              None at the moment.
            </p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {carrying.slice(0, 6).map((p) => {
                const late = !p.submittedAt && p.dueDate < today;
                const balance = p.submittedAt ? phaseBalance(p) : 0;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-sunken/60"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                        <FolderKanban size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="min-w-0 max-w-full truncate text-[13px] font-semibold">
                            {p.client}
                          </span>
                          <Badge>{serviceById(p.serviceId).short}</Badge>
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted sm:truncate">
                          {waitingOn(p, now)}
                          {balance > 0 ? ` · ${money(balance)} due` : ""}
                        </span>
                      </span>
                      <span
                        className={clsx(
                          "shrink-0 text-right text-[11px] tabular-nums",
                          late ? "font-semibold text-danger" : "text-faint",
                        )}
                      >
                        {shortDate(p.dueDate)}
                      </span>
                      <ChevronRight size={14} className="shrink-0 text-faint" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* --- your own record --------------------------------------- */}
        <Panel
          title="Your last eight weeks"
          subtitle={
            closedThisWeek
              ? `${closedThisWeek.good + closedThisWeek.bad} closed this week. Management sees this same chart.`
              : "Management sees this same chart."
          }
        >
          <StackedBars
            buckets={weeks}
            goodLabel="On time"
            badLabel="Late"
            empty="Nothing closed in the last eight weeks. Close a task and this week's bar appears."
          />

          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
            <div>
              <dt className="eyebrow min-h-[26px] leading-tight sm:min-h-0">Closed all told</dt>
              <dd className="mt-1 text-[18px] font-medium tabular-nums">
                {record.closed}
              </dd>
            </div>
            <div>
              <dt className="eyebrow min-h-[26px] leading-tight sm:min-h-0">Closed late</dt>
              <dd
                className={clsx(
                  "mt-1 text-[18px] font-medium tabular-nums",
                  record.late > 0 && "text-warn",
                )}
              >
                {record.late}
              </dd>
            </div>
            <div>
              <dt className="eyebrow min-h-[26px] leading-tight sm:min-h-0">When late, by</dt>
              <dd className="mt-1 text-[18px] font-medium tabular-nums">
                {record.avgDaysLate === null
                  ? "—"
                  : `${record.avgDaysLate.toFixed(1)}d`}
              </dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}

/** One open task of yours, opening it on the tasks list. */
function TaskRow({
  task: a,
  today,
  now,
}: {
  task: Assignment;
  today: string;
  now: Date;
}) {
  const projects = useTaskey((s) => s.projects);
  const project = a.projectId
    ? projects.find((p) => p.id === a.projectId)
    : undefined;
  const late = a.dueDate < today;

  return (
    <Link
      href={`/tasks?task=${a.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-sunken/60 sm:px-5"
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 max-w-full truncate text-[13px] font-semibold">
            {a.title}
          </span>
          {a.priority === "urgent" && <Badge tone="danger">Urgent</Badge>}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted sm:truncate">
          {project ? `${project.client} · ` : ""}
          {CATEGORY_LABEL[a.category]}
          {a.dueTime ? ` · ${a.dueTime}` : ""}
        </span>
      </span>

      <span className="w-20 shrink-0 text-right">
        <span
          className={clsx(
            "block text-[12px] font-semibold tabular-nums",
            late ? "text-danger" : "text-ink",
          )}
        >
          {shortDate(a.dueDate)}
        </span>
        <span
          className={clsx(
            "block text-[11px]",
            late ? "text-danger" : "text-faint",
          )}
        >
          {capitalise(relativeDays(a.dueDate, now))}
        </span>
      </span>
      <ChevronRight size={14} className="shrink-0 text-faint" />
    </Link>
  );
}

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
