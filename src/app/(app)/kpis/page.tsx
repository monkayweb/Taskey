"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, BadgeCheck, Clock, Send, TrendingUp } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { dayKey } from "@/lib/date";
import { money } from "@/lib/rules";
import { paidToDate } from "@/lib/services";
import {
  closedByCategory,
  monthlySubmissions,
  practiceNumbers,
  promises,
  sheetsByService,
  taskRecord,
  teamRows,
  weeklyClosures,
} from "@/lib/dashboard";
import { CATEGORY_LABEL } from "@/lib/labels";
import { Avatar, Empty, Panel, StatTile } from "@/components/ui";
import { BAD, GOOD, Key, RankedBars, StackedBars } from "@/components/charts";

/**
 * The numbers, for management only.
 *
 * Two rules hold this screen together. Every measure is against a date the
 * practice itself set, so nothing here is an opinion; and where a chart splits
 * work into good and bad, the mass is the brand indigo and only the problem is
 * red, because green against red is unreadable for a colour-blind reader.
 */
export default function KpiPage() {
  const now = useNow();
  const today = dayKey(now);
  const { projects, assignments, users, currentUserId } = useTaskey();
  const me = users.find((u) => u.id === currentUserId)!;

  const [weeks, setWeeks] = useState<8 | 12>(8);

  const n = useMemo(() => practiceNumbers(projects, now), [projects, now]);
  const record = useMemo(
    () => taskRecord(assignments, today),
    [assignments, today],
  );
  const kept = useMemo(() => promises(projects), [projects]);
  const closures = useMemo(
    () => weeklyClosures(assignments, now, weeks),
    [assignments, now, weeks],
  );
  const submissions = useMemo(
    () => monthlySubmissions(projects, now),
    [projects, now],
  );
  const team = useMemo(
    () => teamRows(users, assignments, projects, today),
    [users, assignments, projects, today],
  );

  // Management only. The nav hides this, and a deep link should refuse it
  // rather than quietly show the practice's numbers to the whole team.
  if (me.role !== "admin") {
    return (
      <div className="min-w-0 p-5 md:p-8">
        <div className="card mx-auto max-w-[30rem]">
          <Empty
            icon={<TrendingUp size={19} />}
            title="This one is management's"
            detail="Your own record is on your dashboard, and it is the same measure shown here."
          />
          <div className="flex justify-center pb-6">
            <Link href="/dashboard" className="btn btn-primary btn-md">
              <ArrowLeft size={14} />
              Back to your day
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const nothingYet = record.closed === 0 && kept.submitted === 0;

  // On-time rate per person, for the people who have closed anything at all.
  const byPerson = team
    .filter((r) => r.record.closed > 0)
    .map((r) => ({
      id: r.user.id,
      label: r.user.name,
      tint: r.user.tint,
      value: Math.round(r.record.rate! * 100),
      hint: `${r.record.onTime} of ${r.record.closed} closed on time${r.record.late > 0 ? ` · ${r.record.late} late` : ""}`,
    }))
    .sort((a, b) => b.value - a.value);

  const received = projects.reduce((a, p) => a + paidToDate(p), 0);
  const billed = projects.reduce((a, p) => a + p.fee, 0);

  return (
    <div className="min-w-0 space-y-8 p-5 md:p-8">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold tracking-tight">The numbers</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            Everything measured against a date the practice set itself, so none
            of this needs anybody to report on it.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="btn btn-ghost btn-sm ml-auto shrink-0"
        >
          <ArrowLeft size={13} />
          Overview
        </Link>
      </div>

      {nothingYet ? (
        <div className="card">
          <Empty
            icon={<TrendingUp size={19} />}
            title="Nothing to measure yet"
            detail="These charts fill in on their own as tasks are closed and sheets are submitted. Nothing here is typed in by hand."
          />
        </div>
      ) : (
        <>
          {/* --- the four headline measures ------------------------- */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile
              label="Tasks closed on time"
              value={
                record.rate === null
                  ? "—"
                  : `${Math.round(record.rate * 100)}%`
              }
              hint={
                record.rate === null
                  ? "Nothing closed yet"
                  : `${record.onTime} of ${record.closed} across the team`
              }
              filled
            />
            <StatTile
              label="Submitted on time"
              value={
                kept.submitted === 0
                  ? "—"
                  : `${kept.submittedOnTime}/${kept.submitted}`
              }
              hint={
                kept.submitted === 0
                  ? "Nothing lodged yet"
                  : "Against the window each client was promised"
              }
              tone={
                kept.submitted > 0 && kept.submittedOnTime < kept.submitted
                  ? "warn"
                  : "ok"
              }
              icon={<Send size={14} />}
            />
            <StatTile
              label="Payment to submission"
              value={
                kept.avgDaysToSubmit === null
                  ? "—"
                  : `${kept.avgDaysToSubmit.toFixed(1)}d`
              }
              hint={
                kept.avgWindow === null
                  ? "No submissions yet"
                  : `Average, against ${kept.avgWindow.toFixed(0)} days allowed`
              }
              tone={
                kept.avgDaysToSubmit !== null &&
                kept.avgWindow !== null &&
                kept.avgDaysToSubmit > kept.avgWindow
                  ? "danger"
                  : "neutral"
              }
              icon={<Clock size={14} />}
            />
            <StatTile
              label="QC passed first time"
              value={
                kept.qcSignedOff === 0
                  ? "—"
                  : `${Math.round((kept.qcFirstTime / kept.qcSignedOff) * 100)}%`
              }
              hint={
                kept.qcSignedOff === 0
                  ? "Nothing signed off yet"
                  : `${kept.qcReturns} pack${kept.qcReturns === 1 ? "" : "s"} sent back to be corrected`
              }
              tone={kept.qcReturns > 0 ? "warn" : "ok"}
              icon={<BadgeCheck size={14} />}
            />
          </div>

          {/* --- the two time series ------------------------------- */}
          <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
            <Panel
              title="Tasks closed, by week"
              subtitle="Every task the team closed, against the date each was due."
              action={
                <div className="flex items-center gap-1 rounded-full bg-sunken p-0.5">
                  {([8, 12] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setWeeks(w)}
                      aria-pressed={weeks === w}
                      className={clsx(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                        weeks === w
                          ? "bg-surface text-ink"
                          : "text-faint hover:text-ink",
                      )}
                    >
                      {w} weeks
                    </button>
                  ))}
                </div>
              }
            >
              <StackedBars
                buckets={closures}
                goodLabel="On time"
                badLabel="Late"
                height={170}
                empty="Nothing closed inside this window."
              />
            </Panel>

            <Panel
              title="Submissions, by month"
              subtitle="Against the window each service promises, counted from the payment date."
            >
              <StackedBars
                buckets={submissions}
                goodLabel="Inside the window"
                badLabel="Over"
                height={170}
                empty="Nothing submitted in the last six months."
              />
            </Panel>
          </div>

          {/* --- people, and the kind of work --------------------- */}
          <div className="grid items-start gap-6 xl:grid-cols-3">
            <Panel
              title="Closed on time, by person"
              subtitle="Only people who have closed something."
            >
              {byPerson.length === 0 ? (
                <p className="py-3 text-[12px] text-muted">
                  Nobody has closed a task yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {byPerson.map((r) => (
                    <li key={r.id}>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.label} tint={r.tint} size={24} />
                        <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                          {r.label}
                        </span>
                        <span className="shrink-0 text-[12px] font-semibold tabular-nums">
                          {r.value}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-track">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(r.value, 3)}%`,
                            background: r.value >= 70 ? GOOD : BAD,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-faint">{r.hint}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex items-center gap-3 border-t border-line pt-3">
                <Key colour={GOOD} label="70% or better" />
                <Key colour={BAD} label="Under 70%" />
              </div>
            </Panel>

            <Panel
              title="What the team closes"
              subtitle={`${record.closed} task${record.closed === 1 ? "" : "s"} closed, by kind of work.`}
            >
              <RankedBars
                rows={closedByCategory(assignments).map((r) => ({
                  label: CATEGORY_LABEL[r.category],
                  value: r.count,
                }))}
                empty="Nothing closed yet."
              />
            </Panel>

            <Panel
              title="Sheets by service"
              subtitle="Everything ever opened, by what the practice sold."
            >
              <RankedBars
                rows={sheetsByService(projects)}
                empty="No sheets opened yet."
              />
            </Panel>
          </div>

          {/* --- the money --------------------------------------- */}
          <Panel
            title="The money"
            subtitle="Received against billed, and what is owed on work already submitted."
          >
            <div className="grid gap-6 sm:grid-cols-[1.4fr_1fr]">
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[12px] text-muted">
                    Received against {money(billed)} billed
                  </span>
                  <span className="text-[12px] font-semibold tabular-nums">
                    {billed === 0
                      ? "—"
                      : `${Math.round((received / billed) * 100)}%`}
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-track">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${billed === 0 ? 0 : Math.min((received / billed) * 100, 100)}%`,
                      background: GOOD,
                    }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-faint">
                  {money(received)} in. A balance falls due the day its phase
                  is submitted, which is what the outstanding figure counts.
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-4">
                <div>
                  {/* Held at two lines so the figure beside it keeps the
                      same baseline when this label wraps on a phone. */}
                  <dt className="eyebrow min-h-[26px] leading-tight sm:min-h-0">
                    Owed on submitted work
                  </dt>
                  <dd
                    className={clsx(
                      "mt-1 text-[20px] font-medium tabular-nums",
                      n.owed > 0 ? "text-danger" : "text-ink",
                    )}
                  >
                    {money(n.owed)}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow min-h-[26px] leading-tight sm:min-h-0">
                    Clients chased
                  </dt>
                  <dd className="mt-1 text-[20px] font-medium tabular-nums">
                    {kept.chases}
                  </dd>
                </div>
              </dl>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
