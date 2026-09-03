"use client";

import { useEffect } from "react";
import { CalendarClock, FileText, Gauge, TrendingUp } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useMyFlags, useTodayLog, useWeekKpis } from "@/lib/selectors";
import { useNow } from "@/lib/now";
import { dayKey } from "@/lib/date";
import { scoreTone } from "@/lib/kpi";
import { DailyChecklist } from "@/components/DailyChecklist";
import { DailyActions } from "@/components/DailyActions";
import { OverwhelmedButton } from "@/components/OverwhelmedButton";
import { HeroBanner } from "@/components/HeroBanner";
import { ProgressCards } from "@/components/ProgressCards";
import { WeeklyProgress } from "@/components/WeeklyProgress";
import { AgendaRail } from "@/components/AgendaRail";
import { TeamList } from "@/components/TeamList";
import { Empty, Panel, StatTile } from "@/components/ui";

export default function TodayPage() {
  const now = useNow();
  const today = dayKey(now);
  const { currentUserId, users, ensureLog, projects, escalations } = useTaskey();
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

  const submitted = !!log?.submittedAt;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_312px]">
      {/* --- main column ---------------------------------------------- */}
      <div className="min-w-0 space-y-5">
        <HeroBanner
          title={isEmployee ? "Today's checklist" : "Team overview"}
          subtitle={
            isEmployee
              ? submitted
                ? "Your day is submitted and locked. Anything still flagged below is waiting on you."
                : "Tick off your time blocks before you clock out — everything else on this page is generated for you."
              : "You have no calendar blocks of your own. Switch to a team member in the sidebar to see their checklist."
          }
          ctaLabel={isEmployee ? (submitted ? "Review my day" : "Go to submission") : "Open admin dashboard"}
          ctaHref={isEmployee ? "#submission" : "/admin"}
        />

        {myEscalation && (
          <div className="card bg-warn-soft px-5 py-4">
            <p className="text-[13px] font-semibold text-warn">
              Your escalation is{" "}
              {myEscalation.status === "acknowledged"
                ? "with management"
                : "waiting to be seen"}
            </p>
            <p className="mt-1 text-xs text-warn/90">
              {myEscalation.items.length} item
              {myEscalation.items.length === 1 ? "" : "s"} flagged
              {myEscalation.note ? ` — “${myEscalation.note}”` : ""}
            </p>
          </div>
        )}

        {myKpi && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="This week's score"
              value={myKpi.score}
              hint="Delivery, discipline, responsiveness"
              tone={scoreTone(myKpi.score)}
              icon={<Gauge size={14} />}
            />
            <StatTile
              label="Logs submitted"
              value={`${myKpi.logsSubmitted}/${myKpi.logsExpected}`}
              hint="End-of-day submissions"
              tone={myKpi.logsSubmitted < myKpi.logsExpected ? "warn" : "ok"}
              icon={<TrendingUp size={14} />}
            />
            <StatTile
              label="Quotes to chase"
              value={myKpi.followUpsBreached}
              hint={`${myKpi.followUpsOnTime} inside the window`}
              tone={myKpi.followUpsBreached > 0 ? "danger" : "ok"}
              icon={<FileText size={14} />}
            />
          </div>
        )}

        <ProgressCards projects={myProjects} />

        <WeeklyProgress scope={isEmployee ? "me" : "team"} />

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

        <div className="md:hidden">{isEmployee && <OverwhelmedButton compact />}</div>
      </div>

      {/* --- right rail ----------------------------------------------- */}
      <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
        {isEmployee && <AgendaRail me={me} />}
        <TeamList showScores={me.role === "admin"} />
      </div>
    </div>
  );
}
