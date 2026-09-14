// ---------------------------------------------------------------------------
// The database, which is the same shape as src/lib/types.ts.
//
// The domain model came first and the rules in lib/ are pure functions of it,
// so this file is deliberately a transcription rather than a redesign: a
// project sheet, its steps, its documents, its payments and the queries the
// authority sent back, plus the team, the work handed out and the trail.
//
// What is not here yet: the daily checklist and escalations. Those pages are
// still parked out of the app, so putting them in the database would be
// storing something nobody can reach.
// ---------------------------------------------------------------------------

import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** Everyone in the practice. Ids match the Clerk user id once they sign in. */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  /** "employee" or "admin": what they may see. */
  role: text("role").notNull().default("employee"),
  jobTitle: text("job_title").notNull(),
  /** owner, admin, sales, consultant, coordinator: what work reaches them. */
  workRole: text("work_role").notNull(),
  /** Their job description, one duty per row. */
  duties: text("duties").array().notNull().default([]),
  tint: text("tint").notNull(),
  /** Set when they leave. Nothing of theirs is ever deleted. */
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  /** The Clerk account this person signs in with, once they have. */
  clerkId: text("clerk_id").unique(),
});

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    client: text("client").notNull(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone"),
    /** Which entry in the service catalogue this is. */
    serviceId: text("service_id").notNull(),
    /** The consultant carrying it. */
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("active"),

    /** The day the money landed. Every date below is counted from it. */
    paidAt: date("paid_at").notNull(),
    /** paidAt plus the service's window: the day we promised to submit. */
    dueDate: date("due_date").notNull(),
    fee: integer("fee").notNull(),
    phase: integer("phase").notNull().default(0),

    /** Step 5: when the client was acknowledged and sent the guidelines. */
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),

    docsRequestedAt: timestamp("docs_requested_at", { withTimezone: true }),
    docsRemindedAt: timestamp("docs_reminded_at", { withTimezone: true }),
    docChases: integer("doc_chases").notNull().default(0),

    qcRequestedAt: timestamp("qc_requested_at", { withTimezone: true }),
    qcApprovedAt: timestamp("qc_approved_at", { withTimezone: true }),
    qcApprovedBy: text("qc_approved_by"),
    qcReturnedAt: timestamp("qc_returned_at", { withTimezone: true }),
    qcReturnNote: text("qc_return_note"),
    qcReturns: integer("qc_returns").notNull().default(0),

    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    submittedVia: text("submitted_via"),
    invoicedAt: timestamp("invoiced_at", { withTimezone: true }),
    balanceRemindedAt: timestamp("balance_reminded_at", { withTimezone: true }),
    lastFollowUpAt: timestamp("last_follow_up_at", { withTimezone: true }),

    outcome: text("outcome"),
    outcomeAt: timestamp("outcome_at", { withTimezone: true }),
  },
  (t) => [
    index("projects_status_idx").on(t.status),
    index("projects_owner_idx").on(t.ownerId),
  ],
);

/** One step of the workflow chart, 5 to 10, built at intake. */
export const projectSteps = pgTable(
  "project_steps",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Its number on the practice's chart. */
    step: integer("step").notNull(),
    label: text("label").notNull(),
    /** Who it waits on, including "client" and "authority". */
    role: text("role").notNull(),
    detail: text("detail"),
    /** start, documents, compile, qc, submit, balance. */
    gate: text("gate"),
    dueDate: date("due_date").notNull(),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at", { withTimezone: true }),
    doneBy: text("done_by"),
  },
  (t) => [index("project_steps_project_idx").on(t.projectId)],
);

export const projectDocuments = pgTable(
  "project_documents",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    received: boolean("received").notNull().default(false),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    /** Asked for on this project only, on top of the standard list. */
    extra: boolean("extra").notNull().default(false),
    /** Keeps the request list in the order it was written. */
    position: integer("position").notNull().default(0),
  },
  (t) => [index("project_documents_project_idx").on(t.projectId)],
);

export const projectPayments = pgTable(
  "project_payments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).notNull(),
    /** Whole rands. */
    amount: integer("amount").notNull(),
    phase: integer("phase").notNull().default(0),
    note: text("note"),
  },
  (t) => [index("project_payments_project_idx").on(t.projectId)],
);

/** Something the authority came back asking for after submission. */
export const authorityQueries = pgTable(
  "authority_queries",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).notNull(),
    detail: text("detail").notNull(),
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
  },
  (t) => [index("authority_queries_project_idx").on(t.projectId)],
);

/**
 * Steps 1 to 4 of the chart: the inquiry, the questionnaire, the consultation
 * and the quote. All of it happens before there is a project, which is why a
 * lead is its own row rather than an empty project sheet.
 */
export const leads = pgTable(
  "leads",
  {
    id: text("id").primaryKey(),
    company: text("company").notNull(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    /** Step 1: where they came from. */
    channel: text("channel").notNull(),
    /** Which entry in the catalogue they are asking about, once it is known. */
    serviceId: text("service_id"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    stage: text("stage").notNull().default("inquiry"),
    /** Quote value in whole rands. */
    value: integer("value").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    /** The first outbound touch. Absent means nobody has replied yet. */
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
    /** Step 4. Starts the follow-up clock. */
    quoteSentAt: timestamp("quote_sent_at", { withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", {
      withTimezone: true,
    }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    /** The sheet this lead turned into, once the client paid. */
    projectId: text("project_id"),
  },
  (t) => [
    index("leads_stage_idx").on(t.stage),
    index("leads_owner_idx").on(t.ownerId),
  ],
);

/** Every touch on a lead, which is what the follow-up clock reads. */
export const leadActivity = pgTable(
  "lead_activity",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).notNull(),
    kind: text("kind").notNull(),
    detail: text("detail").notNull(),
    byUserId: text("by_user_id").notNull(),
  },
  (t) => [index("lead_activity_lead_idx").on(t.leadId)],
);

/** Work with somebody's name on it, whether a person or the sheet raised it. */
export const assignments = pgTable(
  "assignments",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    detail: text("detail"),
    assigneeIds: text("assignee_ids").array().notNull(),
    assignedById: text("assigned_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    dueDate: date("due_date").notNull(),
    /** "HH:mm". Absent means any time that day. */
    dueTime: text("due_time"),
    priority: text("priority").notNull().default("normal"),
    category: text("category").notNull().default("other"),
    status: text("status").notNull().default("open"),
    remindedAt: timestamp("reminded_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completionNote: text("completion_note"),
    /** Set when the task came from a standing duty. */
    recurringId: text("recurring_id"),
    /** Set when the task is one step of a project sheet. */
    projectId: text("project_id"),
    stepId: text("step_id"),
  },
  (t) => [
    index("assignments_status_idx").on(t.status),
    index("assignments_project_idx").on(t.projectId),
  ],
);

/** A duty somebody does every week, materialised into tasks day by day. */
export const recurringTasks = pgTable("recurring_tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  detail: text("detail"),
  assigneeIds: text("assignee_ids").array().notNull(),
  /** ISO weekdays: 1 = Monday to 7 = Sunday. */
  weekdays: integer("weekdays").array().notNull(),
  dueTime: text("due_time"),
  category: text("category").notNull().default("admin"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

/**
 * Append-only. Nothing in the application updates or deletes a row here,
 * because this is the record performance reviews are held against.
 */
export const audit = pgTable(
  "audit",
  {
    id: text("id").primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull(),
    actorId: text("actor_id").notNull(),
    type: text("type").notNull(),
    subject: text("subject").notNull(),
    detail: text("detail").notNull(),
  },
  (t) => [index("audit_at_idx").on(t.at), index("audit_actor_idx").on(t.actorId)],
);

/**
 * Every email the system sends, so a client cannot say they were never asked
 * and nobody has to wonder whether a reminder actually went out.
 */
export const emails = pgTable(
  "emails",
  {
    id: text("id").primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull(),
    /** docs_request, docs_chase, qc_waiting, balance_invoice, task_digest. */
    kind: text("kind").notNull(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    projectId: text("project_id"),
    /** Resend's id for the message, for looking it up on their side. */
    providerId: text("provider_id"),
    error: text("error"),
  },
  (t) => [index("emails_project_idx").on(t.projectId)],
);
