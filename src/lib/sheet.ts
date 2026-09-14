// ---------------------------------------------------------------------------
// What a project sheet does to itself.
//
// Pure functions of a project, the team and the work outstanding. They were
// written against the client-side store and are now the same code the server
// runs, which is the point of keeping them free of both: the rules that decide
// whether step 8 is closed cannot be allowed to differ between the two.
// ---------------------------------------------------------------------------

import { allDocumentsIn, holdersOf, phaseBalance, serviceById, WORKFLOW_STEPS } from "./services";
import type {
  Assignment,
  AuditEvent,
  AuditType,
  Milestone,
  Project,
  User,
} from "./types";

export interface SheetSync {
  project: Project;
  /** Tasks to create, close, or leave alone: the caller persists these. */
  assignments: Assignment[];
  audit: AuditEvent[];
}

/** Which gated steps the work behind them says are finished. */
export function gatesReached(project: Project): Record<string, boolean> {
  return {
    // Step 5 is the acknowledgement itself, not the fact that a sheet exists.
    start: !!project.acknowledgedAt,
    documents: allDocumentsIn(project),
    // Handing a pack up for QC is what "compiled" means.
    compile: !!project.qcRequestedAt,
    qc: !!project.qcApprovedAt,
    submit: !!project.submittedAt,
    balance: !!project.submittedAt && phaseBalance(project) === 0,
  };
}

/**
 * What has to happen for a gated step to close, said the way it would be said
 * out loud. A step is closed by the work behind it and never by ticking it, so
 * this is the sentence that goes back to anybody who tries.
 */
export function gateBlockedReason(
  step: Milestone,
  project: Project,
): string | null {
  if (!step.gate || gatesReached(project)[step.gate]) return null;

  const where = `Open the ${project.client} sheet`;
  switch (step.gate) {
    case "start":
      return `Step ${step.step} closes when the client has been acknowledged. ${where} and send the acknowledgement.`;
    case "documents": {
      const left = project.documents.filter((d) => !d.received).length;
      return `Step ${step.step} closes when every document is in: ${left} still outstanding. ${where} and tick them off as they arrive.`;
    }
    case "compile":
      return `Step ${step.step} closes when the pack is handed up for QC. ${where} and hand it up.`;
    case "qc":
      return `Step ${step.step} closes when the QC check is signed off, which is the owner's to do. ${where} to see where it stands.`;
    case "submit":
      return `Step ${step.step} closes when the submission is recorded. ${where} and record it.`;
    case "balance":
      return `Step ${step.step} closes when the balance is settled. ${where} and record the payment.`;
    default:
      return `Step ${step.step} closes off the sheet rather than off the task list.`;
  }
}

/**
 * Reconcile a sheet with itself: close the steps whose work is done, reopen
 * one whose work has been undone (a QC sent back), close the task behind a
 * step that is no longer current, and hand the open step to whoever holds
 * that role.
 *
 * Everything here is derived rather than set by hand, which is what keeps a
 * project moving without anybody driving it.
 */
export function syncSheet(
  project: Project,
  users: User[],
  assignments: Assignment[],
  audit: AuditEvent[],
  actorId: string,
  newId: (prefix: string) => string,
): SheetSync {
  const at = new Date().toISOString();
  const service = serviceById(project.serviceId);
  const reached = gatesReached(project);

  // Both directions, so a sheet that goes backwards says so.
  const milestones: Milestone[] = project.milestones.map((m) => {
    if (!m.gate) return m;
    const hit = reached[m.gate];
    if (hit && !m.done) return { ...m, done: true, doneAt: at, doneBy: actorId };
    if (!hit && m.done)
      return { ...m, done: false, doneAt: undefined, doneBy: undefined };
    return m;
  });
  const synced: Project = { ...project, milestones };

  // A task stands for the step the sheet is on. It closes when that step
  // closes, when the sheet drops back to an earlier step, and when the step
  // itself is gone because a phase advanced.
  const onNow = milestones.find((m) => !m.done);
  let nextAssignments = assignments.map((a) => {
    if (a.status !== "open" || !a.stepId) return a;
    const step = milestones.find((m) => m.id === a.stepId);
    const mine = a.projectId === synced.id;
    if (!mine) return a;

    const closed = !!step?.done;
    const orphaned = !step;
    const wentBack = !!step && !closed && step.id !== onNow?.id;
    if (!closed && !orphaned && !wentBack) return a;

    return {
      ...a,
      status: "done" as const,
      completedAt: at,
      completionNote:
        a.completionNote ??
        (orphaned
          ? "Closed with the phase it belonged to."
          : wentBack
            ? "Closed: the project went back to an earlier step."
            : "Closed off the project sheet."),
    };
  });

  // A step waiting on the client or the authority raises no task: chasing
  // those is a flag, because there is nothing for anybody here to tick.
  let nextAudit = audit;
  if (onNow && synced.status === "active") {
    const holders = holdersOf(users, onNow.role);
    const openAlready = nextAssignments.some(
      (a) => a.stepId === onNow.id && a.status === "open",
    );
    if (holders.length > 0 && !openAlready) {
      // Second time round a step, the first task's id is taken.
      const baseId = `as_step_${onNow.id}`;
      const id = nextAssignments.some((a) => a.id === baseId)
        ? newId("as")
        : baseId;

      nextAssignments = [
        {
          id,
          title: onNow.label,
          detail: `${service.short} for ${synced.client} · step ${onNow.step} of ${WORKFLOW_STEPS}`,
          assigneeIds: holders,
          assignedById: actorId,
          createdAt: at,
          dueDate: onNow.dueDate,
          priority: "normal",
          category: "projects",
          status: "open",
          projectId: synced.id,
          stepId: onNow.id,
        },
        ...nextAssignments,
      ];
      nextAudit = [
        entry(newId("ae"), actorId, "task.assigned", onNow.label,
          `Raised automatically from the ${synced.client} sheet, due ${onNow.dueDate}`),
        ...nextAudit,
      ];
    }
  }

  return { project: synced, assignments: nextAssignments, audit: nextAudit };
}

export const entry = (
  id: string,
  actorId: string,
  type: AuditType,
  subject: string,
  detail: string,
): AuditEvent => ({
  id,
  at: new Date().toISOString(),
  actorId,
  type,
  subject,
  detail,
});
