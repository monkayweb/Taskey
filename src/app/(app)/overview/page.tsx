"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock, FileText, Target } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useMyFlags, useTodayLog, useWeekKpis } from "@/lib/selectors";
import { useNow } from "@/lib/now";
import { blockMinutes, dayKey, workWeek } from "@/lib/date";
import { OverviewChart } from "@/components/OverviewChart";
import { WeekRing } from "@/components/WeekRing";
import { InProgressPanel } from "@/components/InProgressPanel";
import { TeamList } from "@/components/TeamList";
import { UrgentCard } from "@/components/UrgentCard";
import { OverwhelmedButton } from "@/components/OverwhelmedButton";
import { Meter, Panel, StatSquare, pctText } from "@/components/ui";

export default function OverviewPage() {
  const now = useNow();
  const today = dayKey(now);
  const { currentUserId, users, ensureLog, projects, escalations, logs } =
    useTaskey();
  const me = users.find((u) => u.id === currentUserId)!;
  const isEmployee = me.role === "employee";

  useEffect(() => {
    if (isEmployee) ensureLog(me.id, today);
  }, [me.id, isEmployee, today, ensureLog]);

  const log = useTodayLog(me.id);
  const flags = useMyFlags(me.id);
  const kpis = useWeekKpis();
  const myKpi = kpis.find((k) => k.user.id === me.id);

  const myProjects = projects.filter(
    (p) => p.ownerId === me.id && p.status !== "complete",
  );
  const myEscalation = escalations.find(
    (e) => e.userId === me.id && e.status !== "resolved",
  );

  const week = workWeek(now);
  const hoursLogged =
    logs
      .filter((l) => l.userId === me.id && week.includes(l.date) && l.submittedAt)
      .reduce((total, l) => {
        const blocks = l.blocks.reduce((a, b) => {
          const mins = blockMinutes(b.start, b.end);
          return a + (b.status === "done" ? mins : b.status === "partial" ? mins / 2 : 0);
        }, 0);
        return total + blocks + l.extraTasks.reduce((a, t) => a + t.minutes, 0);
      }, 0) / 60;

  const done = log?.blocks.filter((b) => b.status === "done").length ?? 0;
  const partial = log?.blocks.filter((b) => b.status === "partial").length ?? 0;
  const missed = log?.blocks.filter((b) => b.status === "missed").length ?? 0;
  const pending = log?.blocks.filter((b) => b.status === "pending").length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">
            {isEmployee ? `Hi, ${me.name.split(" ")[0]}` : "Team overview"}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {isEmployee
              ? "Here is where your day stands. Your tasks live on the next page."
              : "You have no calendar tasks. Switch to a team member in the sidebar to see their day."}
          </p>
        </div>
        <div className="md:hidden">{isEmployee && <OverwhelmedButton compact />}</div>
      </div>

      {myEscalation && (
        <div className="card bg-warn-soft px-5 py-4 ring-warn/20">
          <p className="text-[13px] font-semibold text-warn">
            Your escalation is{" "}
            {myEscalation.status === "acknowledged"
              ? "with management"
              : "waiting to be seen"}
          </p>
          <p className="mt-1 text-xs text-warn/90">
            {myEscalation.items.length} item
            {myEscalation.items.length === 1 ? "" : "s"} flagged
            {myEscalation.note ? `: “${myEscalation.note}”` : ""}
          </p>
        </div>
      )}

      <UrgentCard flags={flags} tasksHref="/tasks" />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {log && log.blocks.length > 0 && (
            <Panel
              title="Today's checklist"
              subtitle={
                log.submittedAt
                  ? "Submitted and locked"
                  : `${pending} of ${log.blocks.length} tasks still to log`
              }
              action={
                <Link href="/tasks" className="btn btn-primary btn-sm">
                  {log.submittedAt ? "Review" : "Open tasks"}
                  <ArrowRight size={14} />
                </Link>
              }
            >
              <Meter
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
            </Panel>
          )}

          <OverviewChart scope={isEmployee ? "me" : "team"} />

          {myKpi && (
            <Panel
              title="This week at a glance"
              subtitle="Counted from your own submissions"
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatSquare
                  tone="accent"
                  icon={<BadgeCheck size={15} />}
                  value={myKpi.score}
                  label="KPI score"
                />
                <StatSquare
                  tone="purple"
                  icon={<Clock size={15} />}
                  value={`${hoursLogged.toFixed(1)}h`}
                  label="Hours logged"
                />
                <StatSquare
                  tone="pink"
                  icon={<FileText size={15} />}
                  value={myKpi.quotesSent}
                  label="Quotes sent"
                />
                <StatSquare
                  tone="neutral"
                  icon={<Target size={15} />}
                  value={pctText(myKpi.completionRate)}
                  label="Daily tasks credited"
                />
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-5">
          <InProgressPanel projects={myProjects} />
          <WeekRing scope={isEmployee ? "me" : "team"} />
          <TeamList showScores={me.role === "admin"} />
        </div>
      </div>
    </div>
  );
}
