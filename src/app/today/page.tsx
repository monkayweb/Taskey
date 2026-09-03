"use client";

import { useEffect } from "react";
import {
  BadgeCheck,
  CalendarClock,
  Clock,
  FileText,
  Target,
} from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useMyFlags, useTodayLog, useWeekKpis } from "@/lib/selectors";
import { useNow } from "@/lib/now";
import { blockMinutes, dayKey, workWeek } from "@/lib/date";
import { DailyChecklist } from "@/components/DailyChecklist";
import { DailyActions } from "@/components/DailyActions";
import { OverwhelmedButton } from "@/components/OverwhelmedButton";
import { OverviewChart } from "@/components/OverviewChart";
import { WeekRing } from "@/components/WeekRing";
import { InProgressPanel } from "@/components/InProgressPanel";
import { AgendaRail } from "@/components/AgendaRail";
import { TeamList } from "@/components/TeamList";
import { Empty, Panel, StatSquare, pctText } from "@/components/ui";

export default function TodayPage() {
  const now = useNow();
  const today = dayKey(now);
  const { currentUserId, users, ensureLog, projects, escalations, logs } =
    useTaskey();
  const me = users.find((u) => u.id === currentUserId)!;
  const isEmployee = me.role === "employee";

  // Today's log is created lazily on first visit from the calendar templates,
  // so a new hire's first day works with no setup.
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

  // Hours actually logged this week, credited the same way the score is.
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">
            {isEmployee ? `Hi, ${me.name.split(" ")[0]}` : "Team overview"}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {isEmployee
              ? log?.submittedAt
                ? "Your day is submitted and locked. Anything still flagged is waiting on you."
                : "Tick off your time blocks before you clock out. Everything else here is generated for you."
              : "You have no calendar blocks. Switch to a team member in the sidebar to see their checklist."}
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* --- main column ------------------------------------------- */}
        <div className="min-w-0 space-y-5">
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
                  label="Blocks credited"
                />
              </div>
            </Panel>
          )}

          <DailyActions flags={flags} />

          <div id="submission" className="scroll-mt-4">
            {log ? (
              <DailyChecklist log={log} />
            ) : (
              <Panel title="Today's time blocks">
                <Empty
                  icon={<CalendarClock size={20} />}
                  title="No checklist for this account"
                  detail="Only team members with calendar blocks get a daily log. Switch user in the sidebar to see one."
                />
              </Panel>
            )}
          </div>
        </div>

        {/* --- right rail -------------------------------------------- */}
        <div className="space-y-5">
          <InProgressPanel projects={myProjects} />
          <WeekRing scope={isEmployee ? "me" : "team"} />
          {isEmployee && <AgendaRail me={me} />}
          <TeamList showScores={me.role === "admin"} />
        </div>
      </div>
    </div>
  );
}
