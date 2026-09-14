"use client";

import Link from "next/link";
import clsx from "clsx";
import { useTaskey } from "@/lib/store";
import { useWeekKpis } from "@/lib/selectors";
import { useNow } from "@/lib/now";
import { dayKey } from "@/lib/date";
import { scoreTone } from "@/lib/kpi";
import { Avatar, Badge, Panel } from "./ui";
import { activeEmployees } from "@/lib/rules";

/**
 * Who else is on today. Scores are management-only, because surfacing a
 * colleague's KPI to their peers isn't the job this panel is doing.
 */
export function TeamList({ showScores }: { showScores: boolean }) {
  const now = useNow();
  const today = dayKey(now);
  const { users, logs, currentUserId } = useTaskey();
  const kpis = useWeekKpis();

  const team = activeEmployees(users).filter((u) => u.id !== currentUserId);

  return (
    <Panel
      title="The team"
      action={
        showScores ? (
          <Link
            href="/admin"
            className="text-[11px] font-medium text-accent hover:text-accent-ink"
          >
            See all
          </Link>
        ) : undefined
      }
      bodyClassName="px-3 pb-3"
    >
      <ul className="space-y-1">
        {team.map((u) => {
          const submitted = logs.some(
            (l) => l.userId === u.id && l.date === today && l.submittedAt,
          );
          const kpi = kpis.find((k) => k.user.id === u.id);
          return (
            <li
              key={u.id}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-sunken"
            >
              <Avatar name={u.name} tint={u.tint} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{u.name}</p>
                <p className="truncate text-[11px] text-muted">{u.jobTitle}</p>
              </div>
              {showScores && kpi ? (
                <Badge tone={scoreTone(kpi.score)}>{kpi.score}</Badge>
              ) : (
                <span
                  title={submitted ? "Day submitted" : "Not submitted yet"}
                  className={clsx(
                    "size-1.5 shrink-0 rounded-full",
                    submitted ? "bg-ok-fill" : "bg-line-strong",
                  )}
                />
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
