// ---------------------------------------------------------------------------
// Rows in, domain objects out.
//
// The application talks in the shapes from src/lib/types.ts and knows nothing
// about tables, so all of the translation happens here and nowhere else.
// ---------------------------------------------------------------------------

import { asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "./index";
import {
  assignments as assignmentsTable,
  audit as auditTable,
  authorityQueries,
  emails as emailsTable,
  leadActivity,
  leads as leadsTable,
  projectDocuments,
  projectPayments,
  projectSteps,
  projects as projectsTable,
  recurringTasks,
  users as usersTable,
} from "./schema";
import type {
  ActivityKind,
  Assignment,
  AssignmentPriority,
  AuditEvent,
  AuditType,
  Lead,
  LeadChannel,
  LeadStage,
  Project,
  ProjectStatus,
  RecurringTask,
  Role,
  StepGate,
  StepRole,
  TaskCategory,
  User,
  WorkRole,
} from "@/lib/types";

/** Timestamps live as dates in the database and as ISO strings in the app. */
const iso = (d: Date | null) => (d ? d.toISOString() : undefined);
const at = (s?: string) => (s ? new Date(s) : null);

/** A letter that did not leave the building, and why. */
export interface FailedEmail {
  id: string;
  at: string;
  kind: string;
  to: string;
  subject: string;
  projectId?: string;
  error: string;
}

export interface Workspace {
  users: User[];
  /** Steps 1 to 4: what has come in and not yet been paid for. */
  leads: Lead[];
  projects: Project[];
  assignments: Assignment[];
  recurring: RecurringTask[];
  audit: AuditEvent[];
  /**
   * Sends that failed, newest first. Every send is logged either way, but a
   * reminder that silently never went out is worse than no reminder at all,
   * so the failures are carried into the app rather than left in a table
   * nobody opens.
   */
  emailFailures: FailedEmail[];
}

/**
 * The whole workspace in one go. A practice runs tens of projects, not
 * millions, so the app holds all of it and every rule stays a pure function
 * of the state rather than a query somebody has to remember to write.
 */
export async function loadWorkspace(): Promise<Workspace> {
  const db = getDb();

  const [
    userRows,
    projectRows,
    stepRows,
    documentRows,
    paymentRows,
    queryRows,
    assignmentRows,
    recurringRows,
    auditRows,
    leadRows,
    leadActivityRows,
    emailFailureRows,
  ] = await Promise.all([
    db.select().from(usersTable).orderBy(asc(usersTable.name)),
    db.select().from(projectsTable).orderBy(asc(projectsTable.dueDate)),
    db.select().from(projectSteps).orderBy(asc(projectSteps.step)),
    db.select().from(projectDocuments).orderBy(asc(projectDocuments.position)),
    db.select().from(projectPayments).orderBy(asc(projectPayments.at)),
    db.select().from(authorityQueries).orderBy(desc(authorityQueries.at)),
    db.select().from(assignmentsTable).orderBy(asc(assignmentsTable.dueDate)),
    db.select().from(recurringTasks).orderBy(desc(recurringTasks.createdAt)),
    // The trail is long-lived; the app shows the recent end of it.
    db.select().from(auditTable).orderBy(desc(auditTable.at)).limit(400),
    db.select().from(leadsTable).orderBy(desc(leadsTable.lastActivityAt)),
    db.select().from(leadActivity).orderBy(desc(leadActivity.at)),
    db
      .select()
      .from(emailsTable)
      .where(isNotNull(emailsTable.error))
      .orderBy(desc(emailsTable.at))
      .limit(25),
  ]);

  const byProject = <T extends { projectId: string }>(rows: T[], id: string) =>
    rows.filter((r) => r.projectId === id);

  return {
    users: userRows.map(toUser),
    leads: leadRows.map((l) => ({
      id: l.id,
      company: l.company,
      contactName: l.contactName,
      contactEmail: l.contactEmail ?? undefined,
      contactPhone: l.contactPhone ?? undefined,
      serviceId: l.serviceId ?? undefined,
      channel: l.channel as LeadChannel,
      ownerId: l.ownerId,
      stage: l.stage as LeadStage,
      value: l.value,
      createdAt: l.createdAt.toISOString(),
      firstResponseAt: iso(l.firstResponseAt),
      quoteSentAt: iso(l.quoteSentAt),
      lastActivityAt: l.lastActivityAt.toISOString(),
      closedAt: iso(l.closedAt),
      projectId: l.projectId ?? undefined,
      activity: leadActivityRows
        .filter((a) => a.leadId === l.id)
        .map((a) => ({
          id: a.id,
          at: a.at.toISOString(),
          kind: a.kind as ActivityKind,
          detail: a.detail,
          byUserId: a.byUserId,
        })),
    })),
    projects: projectRows.map((p) => ({
      id: p.id,
      name: p.name,
      client: p.client,
      clientContact: {
        name: p.contactName,
        email: p.contactEmail,
        phone: p.contactPhone ?? undefined,
      },
      serviceId: p.serviceId,
      ownerId: p.ownerId,
      status: p.status as ProjectStatus,
      dueDate: p.dueDate,
      paidAt: p.paidAt,
      fee: p.fee,
      phase: p.phase,
      milestones: byProject(stepRows, p.id).map((s) => ({
        id: s.id,
        step: s.step,
        label: s.label,
        role: s.role as StepRole,
        detail: s.detail ?? undefined,
        gate: (s.gate as StepGate) ?? undefined,
        dueDate: s.dueDate,
        done: s.done,
        doneAt: iso(s.doneAt),
        doneBy: s.doneBy ?? undefined,
      })),
      documents: byProject(documentRows, p.id).map((d) => ({
        id: d.id,
        label: d.label,
        received: d.received,
        receivedAt: iso(d.receivedAt),
        extra: d.extra || undefined,
      })),
      payments: byProject(paymentRows, p.id).map((y) => ({
        id: y.id,
        at: y.at.toISOString(),
        amount: y.amount,
        phase: y.phase,
        note: y.note ?? undefined,
      })),
      queries: byProject(queryRows, p.id).map((q) => ({
        id: q.id,
        at: q.at.toISOString(),
        detail: q.detail,
        clearedAt: iso(q.clearedAt),
      })),
      acknowledgedAt: iso(p.acknowledgedAt),
      docsRequestedAt: iso(p.docsRequestedAt),
      docsRemindedAt: iso(p.docsRemindedAt),
      docChases: p.docChases,
      qcRequestedAt: iso(p.qcRequestedAt),
      qcApprovedAt: iso(p.qcApprovedAt),
      qcApprovedBy: p.qcApprovedBy ?? undefined,
      qcReturnedAt: iso(p.qcReturnedAt),
      qcReturnNote: p.qcReturnNote ?? undefined,
      qcReturns: p.qcReturns,
      submittedAt: iso(p.submittedAt),
      submittedVia: p.submittedVia ?? undefined,
      invoicedAt: iso(p.invoicedAt),
      balanceRemindedAt: iso(p.balanceRemindedAt),
      lastFollowUpAt: iso(p.lastFollowUpAt),
      outcome: (p.outcome as Project["outcome"]) ?? undefined,
      outcomeAt: iso(p.outcomeAt),
    })),
    assignments: assignmentRows.map(toAssignment),
    recurring: recurringRows.map((r) => ({
      id: r.id,
      title: r.title,
      detail: r.detail ?? undefined,
      assigneeIds: r.assigneeIds,
      weekdays: r.weekdays,
      dueTime: r.dueTime ?? undefined,
      category: r.category as TaskCategory,
      active: r.active,
      createdAt: r.createdAt.toISOString(),
    })),
    emailFailures: emailFailureRows.map((e) => ({
      id: e.id,
      at: e.at.toISOString(),
      kind: e.kind,
      to: e.to,
      subject: e.subject,
      projectId: e.projectId ?? undefined,
      error: e.error ?? "Not sent",
    })),
    audit: auditRows.map((a) => ({
      id: a.id,
      at: a.at.toISOString(),
      actorId: a.actorId,
      type: a.type as AuditType,
      subject: a.subject,
      detail: a.detail,
    })),
  };
}

const toUser = (u: typeof usersTable.$inferSelect): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role as Role,
  jobTitle: u.jobTitle,
  workRole: u.workRole as WorkRole,
  duties: u.duties,
  tint: u.tint,
  archivedAt: iso(u.archivedAt),
});

const toAssignment = (a: typeof assignmentsTable.$inferSelect): Assignment => ({
  id: a.id,
  title: a.title,
  detail: a.detail ?? undefined,
  assigneeIds: a.assigneeIds,
  assignedById: a.assignedById,
  createdAt: a.createdAt.toISOString(),
  dueDate: a.dueDate,
  dueTime: a.dueTime ?? undefined,
  priority: a.priority as AssignmentPriority,
  category: a.category as TaskCategory,
  status: a.status as Assignment["status"],
  remindedAt: iso(a.remindedAt),
  completedAt: iso(a.completedAt),
  completionNote: a.completionNote ?? undefined,
  recurringId: a.recurringId ?? undefined,
  projectId: a.projectId ?? undefined,
  stepId: a.stepId ?? undefined,
});

// --- writing ---------------------------------------------------------------

/**
 * Write a project and everything hanging off it. The child rows are replaced
 * rather than diffed: a sheet has a couple of dozen of them, and replacing is
 * one thing that can go wrong instead of three.
 */
export async function saveProject(p: Project): Promise<void> {
  const db = getDb();
  const row = {
    id: p.id,
    name: p.name,
    client: p.client,
    contactName: p.clientContact.name,
    contactEmail: p.clientContact.email,
    contactPhone: p.clientContact.phone ?? null,
    serviceId: p.serviceId,
    ownerId: p.ownerId,
    status: p.status,
    paidAt: p.paidAt,
    dueDate: p.dueDate,
    fee: p.fee,
    phase: p.phase,
    acknowledgedAt: at(p.acknowledgedAt),
    docsRequestedAt: at(p.docsRequestedAt),
    docsRemindedAt: at(p.docsRemindedAt),
    docChases: p.docChases,
    qcRequestedAt: at(p.qcRequestedAt),
    qcApprovedAt: at(p.qcApprovedAt),
    qcApprovedBy: p.qcApprovedBy ?? null,
    qcReturnedAt: at(p.qcReturnedAt),
    qcReturnNote: p.qcReturnNote ?? null,
    qcReturns: p.qcReturns,
    submittedAt: at(p.submittedAt),
    submittedVia: p.submittedVia ?? null,
    invoicedAt: at(p.invoicedAt),
    balanceRemindedAt: at(p.balanceRemindedAt),
    lastFollowUpAt: at(p.lastFollowUpAt),
    outcome: p.outcome ?? null,
    outcomeAt: at(p.outcomeAt),
  };

  await db
    .insert(projectsTable)
    .values(row)
    .onConflictDoUpdate({ target: projectsTable.id, set: row });

  await Promise.all([
    db.delete(projectSteps).where(eq(projectSteps.projectId, p.id)),
    db.delete(projectDocuments).where(eq(projectDocuments.projectId, p.id)),
    db.delete(projectPayments).where(eq(projectPayments.projectId, p.id)),
    db.delete(authorityQueries).where(eq(authorityQueries.projectId, p.id)),
  ]);

  if (p.milestones.length > 0) {
    await db.insert(projectSteps).values(
      p.milestones.map((m) => ({
        id: m.id,
        projectId: p.id,
        step: m.step,
        label: m.label,
        role: m.role,
        detail: m.detail ?? null,
        gate: m.gate ?? null,
        dueDate: m.dueDate,
        done: m.done,
        doneAt: at(m.doneAt),
        doneBy: m.doneBy ?? null,
      })),
    );
  }

  if (p.documents.length > 0) {
    await db.insert(projectDocuments).values(
      p.documents.map((d, i) => ({
        id: d.id,
        projectId: p.id,
        label: d.label,
        received: d.received,
        receivedAt: at(d.receivedAt),
        extra: !!d.extra,
        position: i,
      })),
    );
  }

  if (p.payments.length > 0) {
    await db.insert(projectPayments).values(
      p.payments.map((y) => ({
        id: y.id,
        projectId: p.id,
        at: new Date(y.at),
        amount: y.amount,
        phase: y.phase,
        note: y.note ?? null,
      })),
    );
  }

  if (p.queries.length > 0) {
    await db.insert(authorityQueries).values(
      p.queries.map((q) => ({
        id: q.id,
        projectId: p.id,
        at: new Date(q.at),
        detail: q.detail,
        clearedAt: at(q.clearedAt),
      })),
    );
  }
}

/**
 * A lead and its activity. Like a project sheet, the child rows are replaced
 * rather than diffed: there are a handful of them and replacing is one thing
 * that can go wrong instead of three.
 */
export async function saveLead(l: Lead): Promise<void> {
  const db = getDb();
  const row = {
    id: l.id,
    company: l.company,
    contactName: l.contactName,
    contactEmail: l.contactEmail ?? null,
    contactPhone: l.contactPhone ?? null,
    channel: l.channel,
    serviceId: l.serviceId ?? null,
    ownerId: l.ownerId,
    stage: l.stage,
    value: l.value,
    createdAt: new Date(l.createdAt),
    firstResponseAt: at(l.firstResponseAt),
    quoteSentAt: at(l.quoteSentAt),
    lastActivityAt: new Date(l.lastActivityAt),
    closedAt: at(l.closedAt),
    projectId: l.projectId ?? null,
  };

  await db
    .insert(leadsTable)
    .values(row)
    .onConflictDoUpdate({ target: leadsTable.id, set: row });

  await db.delete(leadActivity).where(eq(leadActivity.leadId, l.id));
  if (l.activity.length > 0) {
    await db.insert(leadActivity).values(
      l.activity.map((a) => ({
        id: a.id,
        leadId: l.id,
        at: new Date(a.at),
        kind: a.kind,
        detail: a.detail,
        byUserId: a.byUserId,
      })),
    );
  }
}

export async function saveAssignments(list: Assignment[]): Promise<void> {
  if (list.length === 0) return;
  const db = getDb();
  for (const a of list) {
    const row = {
      id: a.id,
      title: a.title,
      detail: a.detail ?? null,
      assigneeIds: a.assigneeIds,
      assignedById: a.assignedById,
      createdAt: new Date(a.createdAt),
      dueDate: a.dueDate,
      dueTime: a.dueTime ?? null,
      priority: a.priority,
      category: a.category,
      status: a.status,
      remindedAt: at(a.remindedAt),
      completedAt: at(a.completedAt),
      completionNote: a.completionNote ?? null,
      recurringId: a.recurringId ?? null,
      projectId: a.projectId ?? null,
      stepId: a.stepId ?? null,
    };
    await db
      .insert(assignmentsTable)
      .values(row)
      .onConflictDoUpdate({ target: assignmentsTable.id, set: row });
  }
}

/** Append-only, and the only way anything reaches the trail. */
export async function saveAudit(list: AuditEvent[]): Promise<void> {
  if (list.length === 0) return;
  await getDb()
    .insert(auditTable)
    .values(
      list.map((e) => ({
        id: e.id,
        at: new Date(e.at),
        actorId: e.actorId,
        type: e.type,
        subject: e.subject,
        detail: e.detail,
      })),
    )
    .onConflictDoNothing();
}

export async function saveUser(u: User): Promise<void> {
  const db = getDb();
  const row = {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    jobTitle: u.jobTitle,
    workRole: u.workRole,
    duties: u.duties,
    tint: u.tint,
    archivedAt: at(u.archivedAt),
  };
  await db
    .insert(usersTable)
    .values(row)
    .onConflictDoUpdate({ target: usersTable.id, set: row });
}

export async function saveRecurring(r: RecurringTask): Promise<void> {
  const db = getDb();
  const row = {
    id: r.id,
    title: r.title,
    detail: r.detail ?? null,
    assigneeIds: r.assigneeIds,
    weekdays: r.weekdays,
    dueTime: r.dueTime ?? null,
    category: r.category,
    active: r.active,
    createdAt: new Date(r.createdAt),
  };
  await db
    .insert(recurringTasks)
    .values(row)
    .onConflictDoUpdate({ target: recurringTasks.id, set: row });
}

export async function deleteRecurring(id: string): Promise<void> {
  await getDb().delete(recurringTasks).where(eq(recurringTasks.id, id));
}

export async function findProject(id: string): Promise<Project | undefined> {
  const { projects } = await loadWorkspace();
  return projects.find((p) => p.id === id);
}

export async function usersByIds(ids: string[]): Promise<User[]> {
  if (ids.length === 0) return [];
  const rows = await getDb()
    .select()
    .from(usersTable)
    .where(inArray(usersTable.id, ids));
  return rows.map(toUser);
}

/** Every email we send is logged, sent or failed. */
export async function logEmail(e: {
  id: string;
  kind: string;
  to: string;
  subject: string;
  projectId?: string;
  providerId?: string;
  error?: string;
}): Promise<void> {
  await getDb()
    .insert(emailsTable)
    .values({
      id: e.id,
      at: new Date(),
      kind: e.kind,
      to: e.to,
      subject: e.subject,
      projectId: e.projectId ?? null,
      providerId: e.providerId ?? null,
      error: e.error ?? null,
    })
    .onConflictDoNothing();
}

/**
 * Wipe a person: not an archive, a delete.
 *
 * Their seat, their standing duties and their tasks go. Tasks they shared
 * with somebody else stay, with their name taken off. What deliberately
 * survives is the audit trail, which is the record the practice is held to,
 * and which no action in this file has ever been allowed to edit.
 *
 * The caller must have moved their projects to somebody else first: the
 * database will not let a project exist without an owner, and quietly
 * deleting somebody's projects would be the wrong way to solve that.
 */
export async function wipeUser(id: string): Promise<{
  tasksDeleted: number;
  tasksReassigned: number;
  dutiesDeleted: number;
  dutiesReassigned: number;
}> {
  const db = getDb();

  const [tasks, duties] = await Promise.all([
    db.select().from(assignmentsTable),
    db.select().from(recurringTasks),
  ]);

  const mineOnly = tasks.filter(
    (a) => a.assigneeIds.length === 1 && a.assigneeIds[0] === id,
  );
  const shared = tasks.filter(
    (a) => a.assigneeIds.length > 1 && a.assigneeIds.includes(id),
  );
  const dutiesOnly = duties.filter(
    (r) => r.assigneeIds.length === 1 && r.assigneeIds[0] === id,
  );
  const dutiesShared = duties.filter(
    (r) => r.assigneeIds.length > 1 && r.assigneeIds.includes(id),
  );

  for (const a of mineOnly)
    await db.delete(assignmentsTable).where(eq(assignmentsTable.id, a.id));
  for (const a of shared)
    await db
      .update(assignmentsTable)
      .set({ assigneeIds: a.assigneeIds.filter((x) => x !== id) })
      .where(eq(assignmentsTable.id, a.id));

  for (const r of dutiesOnly)
    await db.delete(recurringTasks).where(eq(recurringTasks.id, r.id));
  for (const r of dutiesShared)
    await db
      .update(recurringTasks)
      .set({ assigneeIds: r.assigneeIds.filter((x) => x !== id) })
      .where(eq(recurringTasks.id, r.id));

  await db.delete(usersTable).where(eq(usersTable.id, id));

  return {
    tasksDeleted: mineOnly.length,
    tasksReassigned: shared.length,
    dutiesDeleted: dutiesOnly.length,
    dutiesReassigned: dutiesShared.length,
  };
}

/**
 * Hand somebody's work to another person, so they can be deleted. Their leads
 * move with their projects: a lead without an owner is an inquiry nobody is
 * answering, which is the exact thing this system exists to prevent.
 */
export async function reassignProjectsTo(
  fromId: string,
  toId: string,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .update(projectsTable)
    .set({ ownerId: toId })
    .where(eq(projectsTable.ownerId, fromId))
    .returning({ id: projectsTable.id });
  await db
    .update(leadsTable)
    .set({ ownerId: toId })
    .where(eq(leadsTable.ownerId, fromId));
  return rows.length;
}

/** Remove one task outright. Used only where the caller has checked it may. */
export async function deleteAssignment(id: string): Promise<void> {
  await getDb().delete(assignmentsTable).where(eq(assignmentsTable.id, id));
}

/**
 * Delete a project and everything hanging off it.
 *
 * The steps, documents, payments and queries go with it by cascade. The tasks
 * it raised do not: nothing in the database ties them to it, so they are
 * removed here by hand and counted, because a task pointing at a project that
 * no longer exists would sit on somebody's list forever.
 */
export async function deleteProject(
  id: string,
): Promise<{ tasksDeleted: number }> {
  const db = getDb();
  const tasks = await db
    .delete(assignmentsTable)
    .where(eq(assignmentsTable.projectId, id))
    .returning({ id: assignmentsTable.id });
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  return { tasksDeleted: tasks.length };
}
