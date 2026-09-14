// ---------------------------------------------------------------------------
// Taskey domain model
//
// Everything the app knows about is described here. The store (lib/store.ts)
// holds exactly this shape, so swapping the localStorage adapter for a real
// database later means implementing these types server-side and nothing else.
// ---------------------------------------------------------------------------

export type Role = "employee" | "admin";

/**
 * The job somebody does, as opposed to what they are allowed to see. Every
 * step of a project workflow is written against a role, never a person, so
 * Taskey can route a step to whoever holds that role without anybody
 * pointing it at a name by hand.
 */
export type WorkRole =
  | "owner"
  | "admin"
  | "sales"
  | "consultant"
  | "coordinator";

/** A step can also sit outside the team: with the client, or the authority. */
export type StepRole = WorkRole | "client" | "authority";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  jobTitle: string;
  /** What they do, which is what work gets routed to them. */
  workRole: WorkRole;
  /**
   * Their job description, one duty per line. Recurring work is generated
   * from the recurring task list rather than from this, so these are the
   * standing responsibilities the recurring list is written against.
   */
  duties: string[];
  /** Tailwind-ready accent used for avatars and chart series. */
  tint: string;
  /**
   * Set when someone leaves the team. They drop out of every live list but
   * their logs, tasks and audit entries stay exactly where they are, because
   * the trail is the record reviews are held against.
   */
  archivedAt?: string;
}

// --- 1. Calendar-synced daily checklist -----------------------------------

export type TaskCategory =
  | "emails"
  | "calls"
  | "quotes"
  | "projects"
  | "meetings"
  | "admin"
  | "other";

/**
 * A recurring block on the employee's calendar, e.g. 08:00-09:00 Emails.
 * These mirror the team calendar and are what the daily log is generated from.
 */
export interface TimeBlockTemplate {
  id: string;
  userId: string;
  label: string;
  /** "HH:mm", 24h. */
  start: string;
  end: string;
  /** ISO weekdays the block occurs on: 1 = Monday … 7 = Sunday. */
  weekdays: number[];
  category: TaskCategory;
  /** Source calendar the block was mirrored from. */
  calendar: string;
}

export type BlockStatus = "pending" | "done" | "partial" | "missed";

export type SkipReason =
  | "ran_out_of_time"
  | "reprioritised"
  | "blocked_externally"
  | "client_delay"
  | "meeting_overran"
  | "leave"
  | "other";

/** A template instantiated for one specific day, with its outcome. */
export interface DailyBlock {
  id: string;
  templateId: string;
  label: string;
  start: string;
  end: string;
  category: TaskCategory;
  status: BlockStatus;
  /** Required by submission validation whenever status is partial or missed. */
  skipReason?: SkipReason;
  note?: string;
}

/** Work that happened but wasn't on the calendar. */
export interface ExtraTask {
  id: string;
  label: string;
  minutes: number;
  category: TaskCategory;
}

export interface DailyLog {
  id: string;
  userId: string;
  /** "yyyy-MM-dd". */
  date: string;
  blocks: DailyBlock[];
  extraTasks: ExtraTask[];
  summaryNote?: string;
  submittedAt?: string;
  /** Set at submission. A locked log can never be edited again. */
  lockedAt?: string;
}

// --- 1b. Work the admin hands out -----------------------------------------

export type AssignmentPriority = "normal" | "urgent";
export type AssignmentStatus = "open" | "done";

/**
 * A task management assigns directly to somebody, as opposed to a calendar
 * block they already own. It lives outside the daily log on purpose: the log
 * is locked at submission, and an assignment can outlive the day it was
 * given on.
 */
export interface Assignment {
  id: string;
  title: string;
  detail?: string;
  /** One task can sit with several people. Never empty. */
  assigneeIds: string[];
  /** The admin who handed it out. Kept so the employee can see who asked. */
  assignedById: string;
  createdAt: string;
  /** "yyyy-MM-dd". */
  dueDate: string;
  /** "HH:mm", 24h. Absent means any time that day. */
  dueTime?: string;
  priority: AssignmentPriority;
  category: TaskCategory;
  status: AssignmentStatus;
  /** When management last nudged the assignees, so it is not sent blind. */
  remindedAt?: string;
  completedAt?: string;
  completionNote?: string;
  /** Set when the task was generated from a recurring duty. */
  recurringId?: string;
  /** Set when the task is one step of a project workflow. */
  projectId?: string;
  stepId?: string;
}

/**
 * Work somebody does every week without being asked for it. Taskey
 * materialises one assignment per person per matching day, so a standing
 * duty is chased by exactly the same rules as anything handed out by name.
 */
export interface RecurringTask {
  id: string;
  title: string;
  detail?: string;
  assigneeIds: string[];
  /** ISO weekdays it runs on: 1 = Monday … 7 = Sunday. */
  weekdays: number[];
  /** "HH:mm", 24h. Absent means any time that day. */
  dueTime?: string;
  category: TaskCategory;
  /** Paused rather than deleted, so the history stays readable. */
  active: boolean;
  createdAt: string;
}

// --- 2. Lead and quote tracking -------------------------------------------

export type LeadChannel =
  | "whatsapp"
  | "email"
  | "phone"
  | "website"
  | "referral"
  | "walk_in";

export type LeadStage =
  | "inquiry"
  | "contacted"
  | "quoted"
  | "negotiating"
  | "won"
  | "lost";

export type ActivityKind =
  | "note"
  | "call"
  | "email"
  | "whatsapp"
  | "meeting"
  | "quote_sent"
  | "stage_change";

export interface LeadActivity {
  id: string;
  at: string;
  kind: ActivityKind;
  detail: string;
  byUserId: string;
}

export interface Lead {
  id: string;
  company: string;
  contactName: string;
  /** Where to reach them. Carried onto the project sheet when they buy. */
  contactEmail?: string;
  contactPhone?: string;
  /** Which service they are asking about, where it is known yet. */
  serviceId?: string;
  channel: LeadChannel;
  ownerId: string;
  stage: LeadStage;
  /** Quote value in ZAR. */
  value: number;
  /** When the inquiry landed. Drives the idle-inquiry safeguard. */
  createdAt: string;
  /** First outbound touch. Absent means nobody has replied yet. */
  firstResponseAt?: string;
  /** When the quote went out. Starts the 3-day follow-up clock. */
  quoteSentAt?: string;
  lastActivityAt: string;
  activity: LeadActivity[];
  closedAt?: string;
  /** The sheet this lead turned into, once the client paid. */
  projectId?: string;
}

// --- 3. Projects, milestones and escalation -------------------------------

export type ProjectStatus = "active" | "on_hold" | "complete";

/**
 * One step of a project's workflow. The whole list is built from the service
 * type the moment payment is recorded, which is why a step knows its number
 * and the role it sits with: nobody types a project plan out by hand.
 */
export interface Milestone {
  id: string;
  label: string;
  /** Target date, laid out across the service's own window at intake. */
  dueDate: string;
  done: boolean;
  doneAt?: string;
  doneBy?: string;
  /** 1-based position in the workflow. */
  step: number;
  /** Who the step waits on. */
  role: StepRole;
  detail?: string;
  /**
   * The gates that have an action of their own attached: requesting the
   * documents, getting them back, QC, submitting, and the outcome. A step
   * without a gate is just ticked off.
   */
  gate?: StepGate;
}

/**
 * The steps that carry an action of their own. Named after the practice's own
 * workflow chart, steps 5 to 10: the sheet opens at step 5, because steps 1
 * to 4 are the sales side and happen before there is a project.
 */
export type StepGate =
  | "start"
  | "documents"
  | "compile"
  | "qc"
  | "submit"
  | "balance";

/** One item on the document request list that goes out to the client. */
export interface ProjectDocument {
  id: string;
  label: string;
  received: boolean;
  receivedAt?: string;
  /** Asked for on this project only, on top of the standard list. */
  extra?: boolean;
}

export interface ProjectPayment {
  id: string;
  at: string;
  amount: number;
  /** The phase the money was against. */
  phase: number;
  note?: string;
}

/** Something the authority came back asking for after submission. */
export interface AuthorityQuery {
  id: string;
  at: string;
  detail: string;
  clearedAt?: string;
}

export interface ClientContact {
  name: string;
  email: string;
  phone?: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  clientContact: ClientContact;
  /** Which entry in the service catalogue this project is. */
  serviceId: string;
  /** The consultant carrying it. */
  ownerId: string;
  status: ProjectStatus;
  /**
   * The day the submission is due: the payment date plus the service's own
   * submission window. This is the promise the client was made.
   */
  dueDate: string;
  milestones: Milestone[];

  /**
   * Step 5. When the client was acknowledged and sent the guidelines that
   * apply to their application. The step stays open until it happens, because
   * a sheet that opens itself and tells nobody is how a client spends the
   * first week of their window wondering whether we started.
   */
  acknowledgedAt?: string;

  /**
   * "yyyy-MM-dd". The day payment landed. Every date on the sheet is counted
   * from here, so the clock starts when the client pays rather than whenever
   * somebody got round to opening the file.
   */
  paidAt: string;
  /** Total fee for the project in ZAR, across all phases. */
  fee: number;
  payments: ProjectPayment[];
  /** Which phase of the service is running. Single-phase services stay at 0. */
  phase: number;

  documents: ProjectDocument[];
  /** When the request list went to the client. Starts the chase clock. */
  docsRequestedAt?: string;
  docsRemindedAt?: string;
  /** How many times the client has been chased for the outstanding items. */
  docChases: number;

  /**
   * Step 8. The consultant hands the pack up, and the owner either signs it
   * off or sends it back to be corrected and resent. Sending back is normal
   * rather than exceptional, so it is counted.
   */
  qcRequestedAt?: string;
  qcApprovedAt?: string;
  qcApprovedBy?: string;
  qcReturnedAt?: string;
  qcReturnNote?: string;
  qcReturns: number;

  /** Step 9. Submission to the authority. Makes the phase balance due. */
  submittedAt?: string;
  /** How it went in: the portal, or email. */
  submittedVia?: string;
  /** Step 10. When the balance email and invoice went to the client. */
  invoicedAt?: string;
  /** When the client was last reminded about an invoiced balance. */
  balanceRemindedAt?: string;
  /** Monthly follow-ups while the authority processes it. */
  lastFollowUpAt?: string;
  queries: AuthorityQuery[];
  outcome?: "approved" | "declined";
  outcomeAt?: string;
}

export type EscalationSeverity = "stretched" | "overloaded" | "blocked";
export type EscalationStatus = "open" | "acknowledged" | "resolved";

/** A specific thing the employee says is falling behind. */
export interface EscalationItem {
  kind: "block" | "lead" | "project" | "milestone";
  refId: string;
  label: string;
}

export interface Escalation {
  id: string;
  userId: string;
  createdAt: string;
  severity: EscalationSeverity;
  items: EscalationItem[];
  note?: string;
  status: EscalationStatus;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  adminNote?: string;
}

// --- 4. Audit trail --------------------------------------------------------

export type AuditType =
  | "user.added"
  | "user.archived"
  | "user.deleted"
  | "user.restored"
  | "log.submitted"
  | "task.assigned"
  | "task.reminded"
  | "task.completed"
  | "task.deleted"
  | "block.completed"
  | "block.missed"
  | "lead.created"
  | "lead.converted"
  | "lead.quote_sent"
  | "lead.responded"
  | "lead.stage_changed"
  | "lead.activity"
  | "project.created"
  | "project.status"
  | "client.acknowledged"
  | "milestone.completed"
  | "payment.received"
  | "docs.requested"
  | "docs.reminded"
  | "docs.received"
  | "qc.requested"
  | "qc.approved"
  | "qc.returned"
  | "balance.invoiced"
  | "project.submitted"
  | "authority.query"
  | "authority.followup"
  | "project.outcome"
  | "project.deleted"
  | "phase.advanced"
  | "recurring.added"
  | "recurring.paused"
  | "escalation.raised"
  | "escalation.acknowledged"
  | "escalation.resolved";

/**
 * Append-only. The store exposes no action that edits or removes an entry.
 * This is the record performance reviews are held against.
 */
export interface AuditEvent {
  id: string;
  at: string;
  actorId: string;
  type: AuditType;
  subject: string;
  detail: string;
}

// --- Derived (never persisted) --------------------------------------------

export type FlagKind =
  | "assignment_overdue"
  | "assignment_due_today"
  | "followup_overdue"
  | "followup_due_today"
  | "inquiry_idle"
  | "milestone_overdue"
  | "project_due_soon"
  | "log_missing"
  | "docs_outstanding"
  | "submission_due"
  | "qc_waiting"
  | "balance_due"
  | "authority_followup"
  | "query_open"
  | "phase_ready"
  | "balance_overdue";

export interface Flag {
  kind: FlagKind;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  /** Sort key. Higher floats to the top of the priority list. */
  priority: number;
  href: string;
  refId: string;
  ownerId: string;
}
