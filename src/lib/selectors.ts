"use client";

import { useMemo } from "react";
import { useTaskey } from "./store";
import { useNow } from "./now";
import { byPriority, leadFlags, missingLogFlags, projectFlags } from "./rules";
import { kpiForUser, type KpiRow } from "./kpi";
import { dayKey, workWeek } from "./date";
import type { Flag } from "./types";

/** Every live flag across the business, highest priority first. */
export function useFlags(): Flag[] {
  const now = useNow();
  const { leads, projects, users, templates, logs } = useTaskey();

  return useMemo(() => {
    const today = dayKey(now);
    const week = workWeek(now);
    const flags: Flag[] = [
      ...leads.flatMap((l) => leadFlags(l, now)),
      ...projects.flatMap((p) => projectFlags(p, now)),
      ...users
        .filter((u) => u.role === "employee")
        .flatMap((u) =>
          missingLogFlags(u.id, u.name, week, templates, logs, today),
        ),
    ];
    return flags.sort(byPriority);
  }, [leads, projects, users, templates, logs, now]);
}

export function useMyFlags(userId: string): Flag[] {
  const flags = useFlags();
  return useMemo(
    () => flags.filter((f) => f.ownerId === userId && f.kind !== "log_missing"),
    [flags, userId],
  );
}

export function useWeekKpis(): KpiRow[] {
  const now = useNow();
  const { users, templates, logs, leads, projects, escalations } = useTaskey();

  return useMemo(() => {
    const week = workWeek(now);
    return users
      .filter((u) => u.role === "employee")
      .map((u) =>
        kpiForUser(u, week, templates, logs, leads, projects, escalations, now),
      )
      .sort((a, b) => b.score - a.score);
  }, [users, templates, logs, leads, projects, escalations, now]);
}

export function useTodayLog(userId: string) {
  const now = useNow();
  const logs = useTaskey((s) => s.logs);
  const today = dayKey(now);
  return logs.find((l) => l.userId === userId && l.date === today);
}
