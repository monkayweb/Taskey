// ---------------------------------------------------------------------------
// Weekly KPI rollup.
//
// Derived entirely from the daily submissions and the lead/project record, so
// nobody on the team fills in a report: ticking the checklist *is* the report.
// ---------------------------------------------------------------------------

import type {
  DailyLog,
  Escalation,
  Lead,
  Project,
  TimeBlockTemplate,
  User,
} from "./types";
import { logExpected, FOLLOW_UP_DAYS } from "./rules";
import { daysSince, hoursSince } from "./date";

export interface KpiRow {
  user: User;
  logsExpected: number;
  logsSubmitted: number;
  submissionRate: number;
  blocksTotal: number;
  blocksDone: number;
  blocksPartial: number;
  blocksMissed: number;
  completionRate: number;
  extraMinutes: number;
  quotesSent: number;
  followUpsOnTime: number;
  followUpsBreached: number;
  avgFirstResponseHours: number | null;
  milestonesClosed: number;
  escalations: number;
  /** 0-100 composite: delivery, discipline and responsiveness, evenly weighted. */
  score: number;
}

const pct = (n: number, d: number) => (d === 0 ? 1 : n / d);

export function kpiForUser(
  user: User,
  week: string[],
  templates: TimeBlockTemplate[],
  logs: DailyLog[],
  leads: Lead[],
  projects: Project[],
  escalations: Escalation[],
  now: Date,
): KpiRow {
  const weekStart = week[0];
  const weekEnd = week[week.length - 1];
  const inWeek = (iso?: string) =>
    !!iso && iso.slice(0, 10) >= weekStart && iso.slice(0, 10) <= weekEnd;

  const myLogs = logs.filter(
    (l) => l.userId === user.id && week.includes(l.date),
  );
  const submitted = myLogs.filter((l) => l.submittedAt);
  const logsExpected = week.filter((d) => logExpected(templates, user.id, d)).length;

  const blocks = submitted.flatMap((l) => l.blocks);
  const blocksDone = blocks.filter((b) => b.status === "done").length;
  const blocksPartial = blocks.filter((b) => b.status === "partial").length;
  const blocksMissed = blocks.filter((b) => b.status === "missed").length;

  const myLeads = leads.filter((l) => l.ownerId === user.id);
  const quotesSent = myLeads.filter((l) => inWeek(l.quoteSentAt)).length;

  // A quote counts as followed up on time if it moved within the SLA window;
  // one still sitting silent past the window counts as breached.
  let followUpsOnTime = 0;
  let followUpsBreached = 0;
  for (const lead of myLeads) {
    if (!lead.quoteSentAt) continue;
    const gap = daysSince(lead.quoteSentAt, new Date(lead.lastActivityAt));
    const stale = daysSince(lead.lastActivityAt, now);
    if (gap > FOLLOW_UP_DAYS || stale > FOLLOW_UP_DAYS) followUpsBreached++;
    else followUpsOnTime++;
  }

  const responseTimes = myLeads
    .filter((l) => l.firstResponseAt)
    .map((l) => hoursSince(l.createdAt, new Date(l.firstResponseAt!)));
  const avgFirstResponseHours = responseTimes.length
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : null;

  const milestonesClosed = projects
    .filter((p) => p.ownerId === user.id)
    .flatMap((p) => p.milestones)
    .filter((m) => m.done && inWeek(m.doneAt)).length;

  const submissionRate = pct(submitted.length, logsExpected);
  // Partial credit for partial blocks, because a half-done block isn't a zero.
  const completionRate = pct(blocksDone + blocksPartial * 0.5, blocks.length);
  const responsiveness = pct(
    followUpsOnTime,
    followUpsOnTime + followUpsBreached,
  );

  return {
    user,
    logsExpected,
    logsSubmitted: submitted.length,
    submissionRate,
    blocksTotal: blocks.length,
    blocksDone,
    blocksPartial,
    blocksMissed,
    completionRate,
    extraMinutes: submitted
      .flatMap((l) => l.extraTasks)
      .reduce((a, t) => a + t.minutes, 0),
    quotesSent,
    followUpsOnTime,
    followUpsBreached,
    avgFirstResponseHours,
    milestonesClosed,
    escalations: escalations.filter(
      (e) => e.userId === user.id && inWeek(e.createdAt),
    ).length,
    score: Math.round(
      (completionRate * 0.4 + submissionRate * 0.3 + responsiveness * 0.3) * 100,
    ),
  };
}

export const scoreTone = (score: number) =>
  score >= 85 ? "ok" : score >= 65 ? "warn" : "danger";
