// ---------------------------------------------------------------------------
// What the dashboards and the KPI screen are made of.
//
// Every number here is derived from work that actually happened: tasks closed
// against the date they were due, sheets submitted against the date the client
// was promised, money received against the fee. Nothing asks anybody for a
// status update, which is the whole point of the system.
//
// It lives away from the components so the three screens cannot quietly
// disagree with each other: one definition of "on time", one of "late", one of
// "waiting on the client".
// ---------------------------------------------------------------------------

import { dayKey, daysSince, shortDate } from "./date";
import {
  allDocumentsIn,
  balanceIsDue,
  currentStep,
  outstandingDocuments,
  paidToDate,
  phaseBalance,
  serviceById,
  WORKFLOW_STEPS,
} from "./services";
import { isActiveEmployee, money } from "./rules";
import type { Assignment, Project, TaskCategory, User } from "./types";

const DAY = 86_400_000;

/** One bar of a two-series chart: the mass of the work, and the problem. */
export interface Bucket {
  /** The x label under the bar. */
  label: string;
  /** Long form, for the tooltip and the table. */
  title: string;
  good: number;
  bad: number;
}

/** Monday of the ISO week containing `d`, at midday so DST cannot shift it. */
export function monday(d: Date): Date {
  const out = new Date(d);
  const day = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - day);
  out.setHours(12, 0, 0, 0);
  return out;
}

// --- tasks -----------------------------------------------------------------

export interface TaskRecord {
  closed: number;
  onTime: number;
  late: number;
  /** Share of closed tasks that made their date, or null with nothing closed. */
  rate: number | null;
  open: number;
  overdue: number;
  dueToday: number;
  /** Average days past the due date, across the late ones only. */
  avgDaysLate: number | null;
}

/**
 * A set of tasks, judged against their own due dates. "On time" means closed
 * on or before the day it was due; the time of day is not held against
 * anybody, because a task due Tuesday closed Tuesday evening was done.
 */
export function taskRecord(tasks: Assignment[], today: string): TaskRecord {
  const closed = tasks.filter((t) => t.status === "done" && t.completedAt);
  const onTime = closed.filter((t) => t.completedAt!.slice(0, 10) <= t.dueDate);
  const late = closed.filter((t) => t.completedAt!.slice(0, 10) > t.dueDate);
  const open = tasks.filter((t) => t.status === "open");

  const daysLate = late.map(
    (t) =>
      (new Date(`${t.completedAt!.slice(0, 10)}T12:00:00`).getTime() -
        new Date(`${t.dueDate}T12:00:00`).getTime()) /
      DAY,
  );

  return {
    closed: closed.length,
    onTime: onTime.length,
    late: late.length,
    rate: closed.length === 0 ? null : onTime.length / closed.length,
    open: open.length,
    overdue: open.filter((t) => t.dueDate < today).length,
    dueToday: open.filter((t) => t.dueDate === today).length,
    avgDaysLate:
      daysLate.length === 0
        ? null
        : daysLate.reduce((a, b) => a + b, 0) / daysLate.length,
  };
}

/** Tasks closed per week, split by whether they made their date. */
export function weeklyClosures(
  tasks: Assignment[],
  now: Date,
  weeks = 8,
): Bucket[] {
  const closed = tasks.filter((t) => t.status === "done" && t.completedAt);
  const out: Bucket[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const start = monday(new Date(now.getTime() - i * 7 * DAY));
    const end = new Date(start.getTime() + 7 * DAY);
    const within = closed.filter((t) => {
      const at = new Date(t.completedAt!);
      return at >= start && at < end;
    });

    out.push({
      label: shortDate(dayKey(start)).split(" ")[0],
      title: `Week of ${shortDate(dayKey(start))}`,
      good: within.filter((t) => t.completedAt!.slice(0, 10) <= t.dueDate)
        .length,
      bad: within.filter((t) => t.completedAt!.slice(0, 10) > t.dueDate).length,
    });
  }
  return out;
}

/** Which kind of work is being closed, most of it first. */
export function closedByCategory(
  tasks: Assignment[],
): { category: TaskCategory; count: number }[] {
  const tally = new Map<TaskCategory, number>();
  for (const t of tasks.filter((x) => x.status === "done"))
    tally.set(t.category, (tally.get(t.category) ?? 0) + 1);
  return [...tally.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

// --- projects --------------------------------------------------------------

/** Everything live, counted once, so the tiles and the lists agree. */
export interface PracticeNumbers {
  live: Project[];
  /** Not submitted and past the date the client was promised. */
  lateSheets: Project[];
  /** Documents requested, not all of them back. */
  waitingOnClients: Project[];
  /** Handed up for QC and not signed off. Nothing submits until it is. */
  qcWaiting: Project[];
  /** Due to submit inside the next week, and not submitted. */
  submitSoon: Project[];
  /** Submitted, no outcome yet. */
  atAuthority: Project[];
  /** The authority came back and it has not been cleared. */
  queriesOpen: Project[];
  /** Submitted with money still owed on the phase. */
  balancesDue: Project[];
  /** Rand still owed across those. */
  owed: number;
  /** Rand received against live sheets. */
  received: number;
  /** Fee value of everything live. */
  fees: number;
}

export function practiceNumbers(
  projects: Project[],
  now: Date,
): PracticeNumbers {
  const today = dayKey(now);
  const weekOut = dayKey(new Date(now.getTime() + 6 * DAY));
  const live = projects.filter((p) => p.status !== "complete");

  return {
    live,
    lateSheets: live.filter((p) => !p.submittedAt && p.dueDate < today),
    waitingOnClients: live.filter(
      (p) => !!p.docsRequestedAt && !allDocumentsIn(p),
    ),
    qcWaiting: live.filter((p) => p.qcRequestedAt && !p.qcApprovedAt),
    submitSoon: live.filter(
      (p) => !p.submittedAt && p.dueDate >= today && p.dueDate <= weekOut,
    ),
    atAuthority: live.filter((p) => !!p.submittedAt && !p.outcomeAt),
    queriesOpen: live.filter((p) => p.queries.some((q) => !q.clearedAt)),
    balancesDue: live.filter((p) => balanceIsDue(p)),
    owed: live.reduce((a, p) => a + (p.submittedAt ? phaseBalance(p) : 0), 0),
    received: live.reduce((a, p) => a + paidToDate(p), 0),
    fees: live.reduce((a, p) => a + p.fee, 0),
  };
}

/** One line saying what a sheet is actually waiting on, in plain words. */
export function waitingOn(p: Project, now: Date): string {
  if (p.status === "complete")
    return `Closed · ${serviceById(p.serviceId).authority} ${p.outcome === "declined" ? "declined" : "approved"}`;

  const open = p.queries.filter((q) => !q.clearedAt);
  if (open.length > 0)
    return `${serviceById(p.serviceId).authority} came back with a query`;
  if (p.submittedAt && !p.outcomeAt)
    return `With ${serviceById(p.serviceId).authority} since ${shortDate(p.submittedAt)}`;
  if (p.qcRequestedAt && !p.qcApprovedAt)
    return `QC, handed up ${daysSince(p.qcRequestedAt, now)} days ago`;
  if (p.docsRequestedAt && !allDocumentsIn(p))
    return `The client: ${outstandingDocuments(p).length} document${outstandingDocuments(p).length === 1 ? "" : "s"} still out`;

  const step = currentStep(p);
  return step ? `On step ${step.step}: ${step.label}` : "Every step closed";
}

/** Submissions per month, against the date each client was promised. */
export function monthlySubmissions(
  projects: Project[],
  now: Date,
  months = 6,
): Bucket[] {
  const out: Bucket[] = [];
  const submitted = projects.filter((p) => p.submittedAt);

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1, 12);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1, 12);
    const within = submitted.filter((p) => {
      const at = new Date(p.submittedAt!);
      return at >= start && at < end;
    });

    out.push({
      label: start.toLocaleDateString("en-ZA", { month: "short" }),
      title: start.toLocaleDateString("en-ZA", {
        month: "long",
        year: "numeric",
      }),
      good: within.filter((p) => p.submittedAt!.slice(0, 10) <= p.dueDate)
        .length,
      bad: within.filter((p) => p.submittedAt!.slice(0, 10) > p.dueDate).length,
    });
  }
  return out;
}

/** How the practice is doing on the promises it makes, across all time. */
export interface Promises {
  submitted: number;
  submittedOnTime: number;
  /** Average calendar days from the payment landing to the submission. */
  avgDaysToSubmit: number | null;
  /** Average days the service allows, so the average above has a yardstick. */
  avgWindow: number | null;
  /** QC packs signed off without ever being sent back. */
  qcFirstTime: number;
  qcSignedOff: number;
  /** Times a pack was sent back to be corrected. */
  qcReturns: number;
  /** Times a client had to be chased for documents. */
  chases: number;
}

export function promises(projects: Project[]): Promises {
  const submitted = projects.filter((p) => p.submittedAt);
  const signedOff = projects.filter((p) => p.qcApprovedAt);

  const spans = submitted.map(
    (p) =>
      (new Date(`${p.submittedAt!.slice(0, 10)}T12:00:00`).getTime() -
        new Date(`${p.paidAt}T12:00:00`).getTime()) /
      DAY,
  );
  const windows = submitted.map(
    (p) => serviceById(p.serviceId).submissionDays,
  );
  const mean = (ns: number[]) =>
    ns.length === 0 ? null : ns.reduce((a, b) => a + b, 0) / ns.length;

  return {
    submitted: submitted.length,
    submittedOnTime: submitted.filter(
      (p) => p.submittedAt!.slice(0, 10) <= p.dueDate,
    ).length,
    avgDaysToSubmit: mean(spans),
    avgWindow: mean(windows),
    qcFirstTime: signedOff.filter((p) => p.qcReturns === 0).length,
    qcSignedOff: signedOff.length,
    qcReturns: projects.reduce((a, p) => a + p.qcReturns, 0),
    chases: projects.reduce((a, p) => a + p.docChases, 0),
  };
}

// --- people ----------------------------------------------------------------

/** One person's standing, for the team list and the per-person charts. */
export interface PersonRow {
  user: User;
  record: TaskRecord;
  /** Live sheets they carry as the consultant. */
  carrying: number;
}

export function teamRows(
  users: User[],
  assignments: Assignment[],
  projects: Project[],
  today: string,
): PersonRow[] {
  return users
    .filter(isActiveEmployee)
    .map((user) => ({
      user,
      record: taskRecord(
        assignments.filter((a) => a.assigneeIds.includes(user.id)),
        today,
      ),
      carrying: projects.filter(
        (p) => p.ownerId === user.id && p.status !== "complete",
      ).length,
    }))
    // Whoever is furthest behind comes first: this list exists to be acted on.
    .sort(
      (a, b) =>
        b.record.overdue - a.record.overdue ||
        b.record.open - a.record.open ||
        a.user.name.localeCompare(b.user.name),
    );
}

/**
 * Where the live sheets are sitting, in workflow order rather than by size:
 * this is read as a pipeline, so step 6 belongs above step 10 even when more
 * sheets are sitting on step 10.
 */
export function sheetsByStep(
  projects: Project[],
): { label: string; value: number }[] {
  const tally = new Map<number, { label: string; value: number }>();
  for (const p of projects.filter((x) => x.status !== "complete")) {
    const step = currentStep(p);
    const at = step?.step ?? WORKFLOW_STEPS + 1;
    const row = tally.get(at) ?? {
      label: step ? `${step.step}. ${step.label}` : "Every step closed",
      value: 0,
    };
    tally.set(at, { ...row, value: row.value + 1 });
  }
  return [...tally.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row);
}

/** Sheets by service, which is what the practice actually sells. */
export function sheetsByService(
  projects: Project[],
): { label: string; value: number; hint: string }[] {
  const tally = new Map<string, { count: number; fee: number }>();
  for (const p of projects) {
    const key = serviceById(p.serviceId).short;
    const row = tally.get(key) ?? { count: 0, fee: 0 };
    tally.set(key, { count: row.count + 1, fee: row.fee + p.fee });
  }
  return [...tally.entries()]
    .map(([label, row]) => ({
      label,
      value: row.count,
      hint: `${money(row.fee)} of work`,
    }))
    .sort((a, b) => b.value - a.value);
}
