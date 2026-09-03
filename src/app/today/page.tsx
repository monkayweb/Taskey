"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CalendarClock, TrendingUp } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useMyFlags, useTodayLog, useWeekKpis } from "@/lib/selectors";
import { useNow } from "@/lib/now";
import { dayKey, relativeDays, shortDate } from "@/lib/date";
import { DailyChecklist } from "@/components/DailyChecklist";
import { DailyActions } from "@/components/DailyActions";
import { OverwhelmedButton } from "@/components/OverwhelmedButton";
import { Badge, Empty, Meter, Panel, StatTile, pctText } from "@/components/ui";
import { PROJECT_DUE_SOON_DAYS } from "@/lib/rules";

export default function TodayPage() {
  const now = useNow();
  const today = dayKey(now);
  const { currentUserId, users, ensureLog, projects, escalations } = useTaskey();
  const me = users.find((u) => u.id === currentUserId)!;

  // Today's log is created lazily on first visit from the calendar templates,
  // so a new hire's first day works with no setup.
  useEffect(() => {
    if (me.role === "employee") ensureLog(me.id, today);
  }, [me.id, me.role, today, ensureLog]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">My day</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {me.role === "admin"
              ? "You have no calendar blocks — switch to a team member to see their checklist."
              : "Tick off your time blocks before you clock out. Everything else on this page is generated for you."}
          </p>
        </div>
        <div className="md:hidden">
          {me.role === "employee" && <OverwhelmedButton compact />}
        </div>
      </div>

      {myEscalation && (
        <div className="card border-warn/30 bg-warn-soft px-4 py-3">
          <p className="text-[13px] font-medium text-warn">
            Your escalation is{" "}
            {myEscalation.status === "acknowledged"
              ? "with management"
              : "waiting to be seen"}
          </p>
          <p className="mt-0.5 text-xs text-warn/80">
            {myEscalation.items.length} item
            {myEscalation.items.length === 1 ? "" : "s"} flagged
            {myEscalation.note ? ` — “${myEscalation.note}”` : ""}
          </p>
        </div>
      )}

      {myKpi && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="This week's score"
            value={myKpi.score}
            hint="Delivery, discipline and responsiveness"
            tone={myKpi.score >= 85 ? "ok" : myKpi.score >= 65 ? "warn" : "danger"}
          />
          <StatTile
            label="Blocks completed"
            value={pctText(myKpi.completionRate)}
            hint={`${myKpi.blocksDone} done · ${myKpi.blocksMissed} missed`}
          />
          <StatTile
            label="Logs submitted"
            value={`${myKpi.logsSubmitted}/${myKpi.logsExpected}`}
            hint="End-of-day submissions this week"
            tone={myKpi.logsSubmitted < myKpi.logsExpected ? "warn" : "ok"}
          />
          <StatTile
            label="Quotes needing chase"
            value={myKpi.followUpsBreached}
            hint={`${myKpi.followUpsOnTime} inside the 3-day window`}
            tone={myKpi.followUpsBreached > 0 ? "danger" : "ok"}
          />
        </div>
      )}

      <DailyActions flags={flags} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {log ? (
            <DailyChecklist log={log} />
          ) : (
            <Panel title="Today's time blocks">
              <Empty
                icon={<CalendarClock size={22} />}
                title="No checklist for this account"
                detail="Only team members with calendar blocks get a daily log. Switch user in the sidebar to see one."
              />
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel
            title="Pinned projects"
            subtitle="Stays here until it ships — no status-update requests needed."
            bodyClassName=""
          >
            {myProjects.length === 0 ? (
              <Empty title="No active projects" />
            ) : (
              <ul className="divide-y divide-line">
                {myProjects.map((p) => {
                  const doneCount = p.milestones.filter((m) => m.done).length;
                  const overdue = p.milestones.filter(
                    (m) => !m.done && m.dueDate < today,
                  ).length;
                  return (
                    <li key={p.id} className="px-4 py-3">
                      <Link href="/projects" className="group block">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] font-medium group-hover:text-accent-ink">
                            {p.name}
                          </p>
                          {overdue > 0 ? (
                            <Badge tone="danger">{overdue} late</Badge>
                          ) : p.status === "on_hold" ? (
                            <Badge tone="neutral">On hold</Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          {p.client} · delivers {relativeDays(p.dueDate, now)}
                        </p>
                        <Meter
                          className="mt-2"
                          segments={[
                            { value: doneCount, tone: "ok" },
                            {
                              value: p.milestones.length - doneCount,
                              tone: "neutral",
                            },
                          ]}
                        />
                        <p className="mt-1 text-[11px] text-faint">
                          {doneCount}/{p.milestones.length} milestones ·{" "}
                          {shortDate(p.dueDate)}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="How this week is scored">
            <ul className="space-y-2 text-xs text-muted">
              <li className="flex gap-2">
                <TrendingUp size={14} className="mt-0.5 shrink-0 text-faint" />
                <span>
                  <strong className="font-medium text-ink">40%</strong> time blocks
                  completed — a partly-done block counts half.
                </span>
              </li>
              <li className="flex gap-2">
                <TrendingUp size={14} className="mt-0.5 shrink-0 text-faint" />
                <span>
                  <strong className="font-medium text-ink">30%</strong> end-of-day
                  logs actually submitted.
                </span>
              </li>
              <li className="flex gap-2">
                <TrendingUp size={14} className="mt-0.5 shrink-0 text-faint" />
                <span>
                  <strong className="font-medium text-ink">30%</strong> quotes
                  followed up inside 3 days.
                </span>
              </li>
              <li className="pt-1 text-[11px] text-faint">
                Projects within {PROJECT_DUE_SOON_DAYS} days stay pinned above.
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
