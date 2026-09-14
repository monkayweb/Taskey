"use client";

import { useMemo } from "react";
import { useTaskey } from "./store";
import { useNow } from "./now";
import {
  assignmentFlags,
  byPriority,
  leadFlags,
  missingLogFlags,
  projectFlags,
  isActiveEmployee,
} from "./rules";
import { kpiForUser, type KpiRow } from "./kpi";
import { dayKey, periodRange, workWeek, type PeriodKey } from "./date";
import type { Assignment, Flag } from "./types";

/** The first day anybody logged, so a long window starts where data does. */
export const earliestLog = (logs: { date: string }[]) =>
  logs.reduce<string | undefined>(
    (min, l) => (!min || l.date < min ? l.date : min),
    undefined,
  );

/** Every live flag across the business, highest priority first. */
export function useFlags(): Flag[] {
  const now = useNow();
  const { leads, projects, users, templates, logs, assignments } = useTaskey();

  return useMemo(() => {
    const today = dayKey(now);
    const week = workWeek(now);
    const flags: Flag[] = [
      ...assignments.flatMap((a) => assignmentFlags(a, now)),
      ...leads.flatMap((l) => leadFlags(l, now)),
      ...projects.flatMap((p) => projectFlags(p, now, users)),
      ...users
        .filter(isActiveEmployee)
        .flatMap((u) =>
          missingLogFlags(u.id, u.name, week, templates, logs, today),
        ),
    ];
    return flags.sort(byPriority);
  }, [assignments, leads, projects, users, templates, logs, now]);
}

/** Everything live on one project sheet, so the sheet can say what is wrong. */
export function useProjectFlags(projectId: string): Flag[] {
  const now = useNow();
  const { projects, users } = useTaskey();
  return useMemo(() => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return [];
    return projectFlags(project, now, users).sort(byPriority);
  }, [projects, users, projectId, now]);
}

export function useMyFlags(userId: string): Flag[] {
  const flags = useFlags();
  return useMemo(
    () => flags.filter((f) => f.ownerId === userId && f.kind !== "log_missing"),
    [flags, userId],
  );
}

/**
 * The team over one period, highest score first. `back` steps to the previous
 * comparable period, which is what the score deltas are measured against.
 */
export function useWeekKpis(period: PeriodKey = "week", back = 0): KpiRow[] {
  const now = useNow();
  const { users, templates, logs, leads, projects, escalations } = useTaskey();

  return useMemo(() => {
    const week = periodRange(period, now, back, earliestLog(logs)).days;
    return users
      .filter(isActiveEmployee)
      .map((u) =>
        kpiForUser(u, week, templates, logs, leads, projects, escalations, now),
      )
      .sort((a, b) => b.score - a.score);
  }, [users, templates, logs, leads, projects, escalations, now, period, back]);
}

/**
 * One person over one period. Separate from useWeekKpis because that one only
 * covers the current team, and an archived employee's record still has to be
 * readable on their own page.
 */
export function useKpiFor(
  userId: string,
  period: PeriodKey = "week",
  back = 0,
): KpiRow | null {
  const now = useNow();
  const { users, templates, logs, leads, projects, escalations } = useTaskey();

  return useMemo(() => {
    const user = users.find((u) => u.id === userId);
    if (!user) return null;
    return kpiForUser(
      user,
      periodRange(period, now, back, earliestLog(logs)).days,
      templates,
      logs,
      leads,
      projects,
      escalations,
      now,
    );
  }, [
    users,
    userId,
    templates,
    logs,
    leads,
    projects,
    escalations,
    now,
    period,
    back,
  ]);
}

/** Open work first, then what was recently closed off. */
export function useAssignmentsFor(userId: string): Assignment[] {
  const assignments = useTaskey((s) => s.assignments);
  return useMemo(
    () =>
      assignments
        .filter((a) => a.assigneeIds.includes(userId))
        .sort(
          (a, b) =>
            Number(a.status === "done") - Number(b.status === "done") ||
            a.dueDate.localeCompare(b.dueDate),
        ),
    [assignments, userId],
  );
}

export function useTodayLog(userId: string) {
  const now = useNow();
  const logs = useTaskey((s) => s.logs);
  const today = dayKey(now);
  return logs.find((l) => l.userId === userId && l.date === today);
}
