// ---------------------------------------------------------------------------
// The rules that make Taskey nag instead of just record.
//
// All of these are pure functions of state + "now", so nothing needs a cron
// job to stay correct: a flag exists the moment the clock says it should.
// ---------------------------------------------------------------------------

import type { Flag, Lead, Project, TimeBlockTemplate, DailyLog } from "./types";
import { daysSince, hoursSince, daysUntil, relativeDays, isoWeekday } from "./date";

/** A quote with no movement for this many days gets flagged and re-prioritised. */
export const FOLLOW_UP_DAYS = 3;
/** An inquiry with no first response inside this many hours gets flagged. */
export const INQUIRY_IDLE_HOURS = 4;
/** Projects inside this window stay pinned to the daily dashboard. */
export const PROJECT_DUE_SOON_DAYS = 7;

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});
export const money = (n: number) => ZAR.format(n);

export const isOpen = (lead: Lead) =>
  lead.stage !== "won" && lead.stage !== "lost";

/** Quote is out and awaiting a decision, so the 3-day clock is running. */
export const isAwaitingFollowUp = (lead: Lead) =>
  !!lead.quoteSentAt && (lead.stage === "quoted" || lead.stage === "negotiating");

/** Days left before this quote breaches the follow-up SLA. Negative = overdue. */
export function followUpSlack(lead: Lead, now: Date): number | null {
  if (!isAwaitingFollowUp(lead)) return null;
  return FOLLOW_UP_DAYS - daysSince(lead.lastActivityAt, now);
}

export function leadFlags(lead: Lead, now: Date): Flag[] {
  const flags: Flag[] = [];

  if (isOpen(lead) && !lead.firstResponseAt) {
    const idle = hoursSince(lead.createdAt, now);
    if (idle >= INQUIRY_IDLE_HOURS) {
      flags.push({
        kind: "inquiry_idle",
        severity: idle >= INQUIRY_IDLE_HOURS * 3 ? "critical" : "warning",
        title: `${lead.company} has had no reply`,
        detail: `${lead.channel.replace("_", " ")} inquiry, waiting ${idle}h`,
        // Unanswered inquiries outrank everything: this is the leak.
        priority: 1000 + idle,
        href: "/leads",
        refId: lead.id,
        ownerId: lead.ownerId,
      });
    }
  }

  const slack = followUpSlack(lead, now);
  if (slack !== null) {
    if (slack < 0) {
      flags.push({
        kind: "followup_overdue",
        severity: "critical",
        title: `Follow up ${lead.company}`,
        detail: `Quote ${money(lead.value)} · silent ${daysSince(lead.lastActivityAt, now)} days`,
        priority: 900 + Math.abs(slack) * 10,
        href: "/leads",
        refId: lead.id,
        ownerId: lead.ownerId,
      });
    } else if (slack === 0) {
      flags.push({
        kind: "followup_due_today",
        severity: "warning",
        title: `Follow up ${lead.company} today`,
        detail: `Quote ${money(lead.value)} · day ${FOLLOW_UP_DAYS} of the follow-up window`,
        priority: 700,
        href: "/leads",
        refId: lead.id,
        ownerId: lead.ownerId,
      });
    }
  }

  return flags;
}

export function projectFlags(project: Project, now: Date): Flag[] {
  if (project.status === "complete") return [];
  const flags: Flag[] = [];

  for (const m of project.milestones) {
    if (m.done) continue;
    const left = daysUntil(m.dueDate, now);
    if (left < 0) {
      flags.push({
        kind: "milestone_overdue",
        severity: "critical",
        title: `${m.label} is overdue`,
        detail: `${project.name} · due ${relativeDays(m.dueDate, now)}`,
        priority: 800 + Math.abs(left) * 5,
        href: "/projects",
        refId: m.id,
        ownerId: project.ownerId,
      });
    }
  }

  const left = daysUntil(project.dueDate, now);
  if (left >= 0 && left <= PROJECT_DUE_SOON_DAYS) {
    flags.push({
      kind: "project_due_soon",
      severity: left <= 2 ? "warning" : "info",
      title: `${project.name} delivers ${relativeDays(project.dueDate, now)}`,
      detail: `${project.client} · ${project.milestones.filter((m) => !m.done).length} milestones open`,
      priority: 400 - left,
      href: "/projects",
      refId: project.id,
      ownerId: project.ownerId,
    });
  }

  return flags;
}

/** Was a log expected from this user on this day? (Only if they had blocks.) */
export function logExpected(
  templates: TimeBlockTemplate[],
  userId: string,
  date: string,
): boolean {
  const weekday = isoWeekday(new Date(`${date}T12:00:00`));
  return templates.some(
    (t) => t.userId === userId && t.weekdays.includes(weekday),
  );
}

/** Working days in the range where a log was expected but never submitted. */
export function missingLogFlags(
  userId: string,
  userName: string,
  days: string[],
  templates: TimeBlockTemplate[],
  logs: DailyLog[],
  today: string,
): Flag[] {
  return days
    .filter((d) => d < today && logExpected(templates, userId, d))
    .filter(
      (d) =>
        !logs.some((l) => l.userId === userId && l.date === d && l.submittedAt),
    )
    .map((d) => ({
      kind: "log_missing" as const,
      severity: "warning" as const,
      title: `${userName} did not submit`,
      detail: `No end-of-day log for ${d}`,
      priority: 600,
      href: "/admin",
      refId: `${userId}:${d}`,
      ownerId: userId,
    }));
}

export const byPriority = (a: Flag, b: Flag) => b.priority - a.priority;
