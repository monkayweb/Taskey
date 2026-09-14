// ---------------------------------------------------------------------------
// The rules that make Taskey nag instead of just record.
//
// All of these are pure functions of state + "now", so nothing needs a cron
// job to stay correct: a flag exists the moment the clock says it should.
// ---------------------------------------------------------------------------

import type {
  Assignment,
  Flag,
  Lead,
  Project,
  StepGate,
  StepRole,
  TimeBlockTemplate,
  DailyLog,
  User,
} from "./types";
import { daysSince, hoursSince, daysUntil, relativeDays, isoWeekday } from "./date";
import {
  allDocumentsIn,
  balanceIsDue,
  currentStep,
  holderOf,
  isFinalPhase,
  outstandingDocuments,
  phaseAmount,
  phaseBalance,
  phaseOf,
  serviceById,
} from "./services";

/** A quote with no movement for this many days gets flagged and re-prioritised. */
export const FOLLOW_UP_DAYS = 3;
/** An inquiry with no first response inside this many hours gets flagged. */
export const INQUIRY_IDLE_HOURS = 4;
/** Projects inside this window stay pinned to the daily dashboard. */
export const PROJECT_DUE_SOON_DAYS = 7;
/**
 * How long a client is left alone before the outstanding documents are chased
 * again. Most of our delay is here, waiting on an ID copy or a lease, so this
 * clock runs from the request and restarts every time we chase.
 */
export const DOC_CHASE_DAYS = 3;
/** How long a QC check may sit with management before it is holding up a submission. */
export const QC_TURNAROUND_DAYS = 2;
/** Submissions inside this window are already worth watching. */
export const SUBMISSION_WARN_DAYS = 3;
/** Follow-ups with the authority run monthly while we wait on an outcome. */
export const AUTHORITY_FOLLOW_UP_DAYS = 30;
/** How long an invoiced balance is left before the client is reminded again. */
export const BALANCE_CHASE_DAYS = 7;

const ZAR = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});
export const money = (n: number) => ZAR.format(n);

/**
 * Everywhere that lists the team, assigns work or scores people goes through
 * these two, so an archived employee cannot be handed a task or counted in a
 * KPI while still keeping all of their history.
 */
export const isActiveEmployee = (u: User) =>
  u.role === "employee" && !u.archivedAt;

export const activeEmployees = (users: User[]) => users.filter(isActiveEmployee);

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

/**
 * Work handed out by management. An urgent assignment outranks the follow-up
 * clock, because somebody is waiting on it by name.
 */
export function assignmentFlags(a: Assignment, now: Date): Flag[] {
  if (a.status === "done") return [];
  const left = daysUntil(a.dueDate, now);
  if (left > 0) return [];

  const urgent = a.priority === "urgent";

  // A task shared by three people is three things to chase, so it raises a
  // flag per person. The refId carries both so the keys stay unique.
  if (left < 0) {
    return a.assigneeIds.map((userId) => ({
      kind: "assignment_overdue" as const,
      severity: "critical" as const,
      title: `${a.title} is overdue`,
      detail: `Assigned task · due ${relativeDays(a.dueDate, now)}`,
      priority: (urgent ? 1100 : 850) + Math.abs(left) * 10,
      href: "/tasks",
      refId: `${a.id}:${userId}`,
      ownerId: userId,
    }));
  }

  return a.assigneeIds.map((userId) => ({
    kind: "assignment_due_today" as const,
    severity: (urgent ? "critical" : "warning") as Flag["severity"],
    title: `${a.title} is due today`,
    detail: urgent ? "Assigned task · marked urgent" : "Assigned task",
    priority: urgent ? 950 : 750,
    href: "/tasks",
    refId: `${a.id}:${userId}`,
    ownerId: userId,
  }));
}

/**
 * Everything a project can be quietly late on. This is the whole point of the
 * system: a project sheet is dated at intake, so from then on the sheet knows
 * who is holding it up without anybody being asked for a status update.
 *
 * Flags route to whoever the step sits with, not to the project's consultant
 * by default, because a QC check waiting on management is not the consultant's
 * to chase.
 */
export function projectFlags(
  project: Project,
  now: Date,
  users: User[],
): Flag[] {
  if (project.status === "complete") return [];

  const service = serviceById(project.serviceId);
  const href = `/projects/${project.id}`;
  const flags: Flag[] = [];

  /** The step's own role holder, falling back to the consultant carrying it. */
  const holder = (role: StepRole | undefined) =>
    (role ? holderOf(users, role) : undefined) ?? project.ownerId;

  const step = currentStep(project);

  // --- the promise: submitted inside the service's own window --------------
  if (!project.submittedAt) {
    const left = daysUntil(project.dueDate, now);
    if (left < 0) {
      flags.push({
        kind: "submission_due",
        severity: "critical",
        title: `${project.client} is past its submission date`,
        detail: `${service.short} · was due ${relativeDays(project.dueDate, now)}, still not submitted`,
        // Breaking the client's promise outranks anything internal.
        priority: 1050 + Math.abs(left) * 10,
        href,
        refId: project.id,
        ownerId: holder(step?.role),
      });
    } else if (left <= SUBMISSION_WARN_DAYS) {
      flags.push({
        kind: "submission_due",
        severity: left <= 1 ? "critical" : "warning",
        title: `${project.client} submits ${relativeDays(project.dueDate, now)}`,
        detail: `${service.short} to ${service.authority} · ${step ? `on step ${step.step}: ${step.label}` : "ready"}`,
        priority: 930 - left,
        href,
        refId: project.id,
        ownerId: holder(step?.role),
      });
    }
  }

  // --- the client's documents ---------------------------------------------
  if (project.docsRequestedAt && !allDocumentsIn(project)) {
    const since = project.docsRemindedAt ?? project.docsRequestedAt;
    const waited = daysSince(since, now);
    if (waited >= DOC_CHASE_DAYS) {
      const missing = outstandingDocuments(project).length;
      flags.push({
        kind: "docs_outstanding",
        severity: project.docChases >= 2 || waited >= DOC_CHASE_DAYS * 3
          ? "critical"
          : "warning",
        title: `Chase ${project.client} for ${missing} document${missing === 1 ? "" : "s"}`,
        detail: project.docsRemindedAt
          ? `Chased ${project.docChases} time${project.docChases === 1 ? "" : "s"}, silent ${waited} days`
          : `Requested ${waited} days ago, nothing back yet`,
        priority: 880 + waited,
        href,
        refId: `${project.id}:docs`,
        ownerId: project.ownerId,
      });
    }
  }

  // --- the QC gate ---------------------------------------------------------
  if (project.qcRequestedAt && !project.qcApprovedAt) {
    const waiting = daysSince(project.qcRequestedAt, now);
    flags.push({
      kind: "qc_waiting",
      severity: waiting > QC_TURNAROUND_DAYS ? "critical" : "warning",
      title: `QC check waiting on ${project.client}`,
      detail: `${service.short} · handed up ${relativeDays(project.qcRequestedAt.slice(0, 10), now)}, nothing submits until it is signed off`,
      priority: 920 + waiting * 5,
      href,
      refId: `${project.id}:qc`,
      ownerId: holderOf(users, "owner") ?? project.ownerId,
    });
  }

  // --- the money -----------------------------------------------------------
  if (balanceIsDue(project)) {
    flags.push({
      kind: "balance_due",
      severity: "warning",
      title: `${money(phaseBalance(project))} outstanding on ${project.client}`,
      detail: `Balance fell due on submission, ${relativeDays(project.submittedAt!.slice(0, 10), now)}`,
      priority: 860,
      href,
      refId: `${project.id}:balance`,
      ownerId: holderOf(users, "admin") ?? project.ownerId,
    });
  }

  // --- the invoiced balance nobody has paid --------------------------------
  if (project.invoicedAt && phaseBalance(project) > 0) {
    const since = project.balanceRemindedAt ?? project.invoicedAt;
    const waited = daysSince(since, now);
    if (waited >= BALANCE_CHASE_DAYS) {
      flags.push({
        kind: "balance_overdue",
        severity: "critical",
        title: `${money(phaseBalance(project))} unpaid by ${project.client}`,
        detail: `Invoiced ${relativeDays(project.invoicedAt.slice(0, 10), now)}, ${money(phaseAmount(project))} due on the phase, nothing since`,
        priority: 870 + waited,
        href,
        refId: `${project.id}:unpaid`,
        ownerId: holderOf(users, "admin") ?? project.ownerId,
      });
    }
  }

  // --- while the authority has it ------------------------------------------
  if (project.submittedAt && !project.outcomeAt) {
    for (const q of project.queries.filter((x) => !x.clearedAt)) {
      flags.push({
        kind: "query_open",
        severity: "critical",
        title: `${service.authority} came back on ${project.client}`,
        detail: q.detail,
        priority: 1000 + daysSince(q.at, now),
        href,
        refId: q.id,
        ownerId: project.ownerId,
      });
    }

    const since = project.lastFollowUpAt ?? project.submittedAt;
    const waited = daysSince(since, now);
    if (waited >= AUTHORITY_FOLLOW_UP_DAYS) {
      flags.push({
        kind: "authority_followup",
        severity: "warning",
        title: `Follow up ${service.authority} on ${project.client}`,
        detail: `No contact for ${waited} days · submitted ${relativeDays(project.submittedAt.slice(0, 10), now)}`,
        priority: 700 + waited,
        href,
        refId: `${project.id}:followup`,
        ownerId: holderOf(users, "coordinator") ?? project.ownerId,
      });
    }
  }

  // --- a phase that came back and was never moved on -----------------------
  // Every step is closed, the authority has answered, and the next phase has
  // not been opened: the sheet is finished with nothing left to raise a task.
  // Without this the project simply goes quiet, which is the one thing a
  // system like this exists to prevent.
  if (
    project.outcome === "approved" &&
    project.outcomeAt &&
    !isFinalPhase(project)
  ) {
    const waited = daysSince(project.outcomeAt, now);
    flags.push({
      kind: "phase_ready",
      severity: waited >= 3 ? "critical" : "warning",
      title: `Start the next phase on ${project.client}`,
      detail: `${phaseOf(project).label} was approved ${relativeDays(project.outcomeAt.slice(0, 10), now)}. Nothing is running on this project until the next phase is opened.`,
      priority: 890 + waited,
      href,
      refId: `${project.id}:phase`,
      ownerId: holderOf(users, "admin") ?? project.ownerId,
    });
  }

  // --- the step it is actually stuck on ------------------------------------
  // Only the current step, and only where nothing more specific already
  // covers it: a late QC check is reported as a QC check, and a client sitting
  // on their documents as a chase, not twice as a numbered step.
  const covered: StepGate[] = ["documents", "qc", "submit", "balance"];
  if (
    step &&
    step.role !== "client" &&
    step.role !== "authority" &&
    !(step.gate && covered.includes(step.gate))
  ) {
    const left = daysUntil(step.dueDate, now);
    if (left < 0) {
      flags.push({
        kind: "milestone_overdue",
        severity: "critical",
        title: `Step ${step.step} on ${project.client} is late`,
        detail: `${step.label} · was due ${relativeDays(step.dueDate, now)}`,
        priority: 800 + Math.abs(left) * 5,
        href,
        refId: step.id,
        ownerId: holder(step.role),
      });
    }
  }

  const left = daysUntil(project.dueDate, now);
  if (!project.submittedAt && left > SUBMISSION_WARN_DAYS && left <= PROJECT_DUE_SOON_DAYS) {
    flags.push({
      kind: "project_due_soon",
      severity: "info",
      title: `${project.client} submits ${relativeDays(project.dueDate, now)}`,
      detail: `${service.short} · ${project.milestones.filter((m) => !m.done).length} steps still open`,
      priority: 400 - left,
      href,
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
