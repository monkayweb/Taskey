// ---------------------------------------------------------------------------
// Taskey domain model
//
// Everything the app knows about is described here. The store (lib/store.ts)
// holds exactly this shape, so swapping the localStorage adapter for a real
// database later means implementing these types server-side and nothing else.
// ---------------------------------------------------------------------------

export type Role = "employee" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  jobTitle: string;
  /** Tailwind-ready accent used for avatars and chart series. */
  tint: string;
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
}

// --- 3. Projects, milestones and escalation -------------------------------

export type ProjectStatus = "active" | "on_hold" | "complete";

export interface Milestone {
  id: string;
  label: string;
  dueDate: string;
  done: boolean;
  doneAt?: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  ownerId: string;
  status: ProjectStatus;
  dueDate: string;
  milestones: Milestone[];
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
  | "log.submitted"
  | "block.completed"
  | "block.missed"
  | "lead.quote_sent"
  | "lead.responded"
  | "lead.stage_changed"
  | "lead.activity"
  | "project.created"
  | "milestone.completed"
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
  | "followup_overdue"
  | "followup_due_today"
  | "inquiry_idle"
  | "milestone_overdue"
  | "project_due_soon"
  | "log_missing";

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
