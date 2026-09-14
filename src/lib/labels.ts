import type {
  AssignmentPriority,
  AuditType,
  ProjectStatus,
  StepRole,
  WorkRole,
  BlockStatus,
  FlagKind,
  EscalationSeverity,
  LeadChannel,
  LeadStage,
  SkipReason,
  TaskCategory,
} from "./types";
import type { Tone } from "@/components/ui";
import {
  Archive,
  FileText,
  Flame,
  FolderKanban,
  Mail,
  Minus,
  Phone,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  emails: "Email",
  calls: "Calls",
  quotes: "Quotes",
  projects: "Projects",
  meetings: "Meetings",
  admin: "Admin",
  other: "Other",
};

/** Re-exported so the UI has one place to import wording helpers from. */
export { capitalise, nameList } from "./text";

export const CATEGORY_ICON: Record<TaskCategory, LucideIcon> = {
  emails: Mail,
  calls: Phone,
  quotes: FileText,
  projects: FolderKanban,
  meetings: Users,
  admin: Archive,
  other: Sparkles,
};

/** The three fills the reference rotates through, tile by tile. */
export const TILE_FILL = [
  "bg-tile-indigo",
  "bg-tile-pink",
  "bg-tile-teal",
] as const;

/** The reference tints each row's subtitle with that row's colour. */
export const TILE_TEXT = [
  "text-tile-indigo/75",
  "text-tile-pink/85",
  "text-tile-teal/90",
] as const;

export const STATUS_LABEL: Record<BlockStatus, string> = {
  pending: "Not logged",
  done: "Done",
  partial: "Partly done",
  missed: "Missed",
};

export const STATUS_TONE: Record<BlockStatus, Tone> = {
  pending: "neutral",
  done: "ok",
  partial: "warn",
  missed: "danger",
};

export const SKIP_LABEL: Record<SkipReason, string> = {
  ran_out_of_time: "Ran out of time",
  reprioritised: "Reprioritised to something urgent",
  blocked_externally: "Blocked, waiting on someone else",
  client_delay: "Client delayed or cancelled",
  meeting_overran: "A meeting overran",
  leave: "On leave / sick",
  other: "Other",
};

export const PRIORITY_LABEL: Record<AssignmentPriority, string> = {
  normal: "Normal",
  urgent: "Urgent",
};

/** These carry no label beside them, so the two marks have to be readable
    on their own: something alarming for urgent, something deliberately
    unremarkable for the default. */
export const PRIORITY_ICON: Record<AssignmentPriority, LucideIcon> = {
  normal: Minus,
  urgent: Flame,
};

/** A score's standing, said in a word, for places a status colour cannot go
    (the brand-filled tile) or where the number needs naming. */
export const SCORE_BAND: Record<string, string> = {
  ok: "good",
  warn: "watch",
  danger: "behind",
};

export const PRIORITY_TONE: Record<AssignmentPriority, Tone> = {
  normal: "neutral",
  urgent: "danger",
};

export const STAGE_LABEL: Record<LeadStage, string> = {
  inquiry: "New inquiry",
  contacted: "Contacted",
  quoted: "Quoted",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
};

export const STAGE_TONE: Record<LeadStage, Tone> = {
  inquiry: "accent",
  contacted: "neutral",
  quoted: "warn",
  negotiating: "warn",
  won: "ok",
  lost: "neutral",
};

export const CHANNEL_LABEL: Record<LeadChannel, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  phone: "Phone",
  website: "Website",
  referral: "Referral",
  walk_in: "Walk-in",
};

export const SEVERITY_LABEL: Record<EscalationSeverity, string> = {
  stretched: "Stretched",
  overloaded: "Overloaded",
  blocked: "Blocked",
};

export const SEVERITY_TONE: Record<EscalationSeverity, Tone> = {
  stretched: "warn",
  overloaded: "danger",
  blocked: "danger",
};

export const FLAG_LABEL: Record<FlagKind, string> = {
  assignment_overdue: "Assigned task late",
  assignment_due_today: "Assigned, due today",
  inquiry_idle: "Unanswered",
  followup_overdue: "Follow-up overdue",
  followup_due_today: "Follow up today",
  milestone_overdue: "Workflow step late",
  project_due_soon: "Submitting soon",
  log_missing: "No log submitted",
  docs_outstanding: "Client documents outstanding",
  submission_due: "Submission date",
  qc_waiting: "Waiting on QC",
  balance_due: "Balance due",
  balance_overdue: "Balance unpaid",
  phase_ready: "Next phase not opened",
  authority_followup: "Authority follow-up due",
  query_open: "Authority came back",
};

/** What each role is called, and what it is for. */
export const ROLE_LABEL: Record<WorkRole, string> = {
  owner: "Owner",
  admin: "Administrator",
  sales: "Sales",
  consultant: "Project consultant",
  coordinator: "Coordinator",
};

/** For chips and tight rows, where "Project consultant" wraps. */
export const ROLE_SHORT: Record<WorkRole, string> = {
  owner: "Owner",
  admin: "Admin",
  sales: "Sales",
  consultant: "Consultant",
  coordinator: "Coordinator",
};

export const ROLE_BLURB: Record<WorkRole, string> = {
  owner: "Signs off QC and prices new work",
  admin: "Takes payments in and opens project sheets",
  sales: "Answers inquiries and quotes new work",
  consultant: "Requests documents and compiles applications",
  coordinator: "Submits, tracks and follows up",
};

/** A workflow step can also sit with somebody outside the practice. */
export const STEP_ROLE_LABEL: Record<StepRole, string> = {
  ...ROLE_LABEL,
  client: "The client",
  authority: "The authority",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  complete: "Complete",
};

export const PROJECT_STATUS_TONE: Record<ProjectStatus, Tone> = {
  active: "accent",
  on_hold: "warn",
  complete: "ok",
};

/** ISO weekday initials, for the recurring day picker. */
export const WEEKDAY_LABEL: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

export const FLAG_TONE: Record<"critical" | "warning" | "info", Tone> = {
  critical: "danger",
  warning: "warn",
  info: "neutral",
};

/**
 * Every audit type in plain words. The trail is the record reviews are
 * held against, so the same event is named the same way wherever it is
 * shown: the dashboard's activity list and the full trail read alike.
 */
export const AUDIT_LABEL: Record<AuditType, string> = {
  "user.added": "Employee added",
  "user.archived": "Employee removed",
  "user.deleted": "Employee deleted",
  "user.restored": "Employee restored",
  "log.submitted": "Day submitted",
  "task.assigned": "Task assigned",
  "task.reminded": "Task chased",
  "task.completed": "Assigned task done",
  "task.deleted": "Task deleted",
  "block.completed": "Daily task partly done",
  "block.missed": "Daily task missed",
  "lead.created": "Inquiry logged",
  "lead.converted": "Lead became a project",
  "lead.quote_sent": "Quote sent",
  "lead.responded": "First response",
  "lead.stage_changed": "Stage changed",
  "lead.activity": "Lead activity",
  "project.created": "Project created",
  "project.status": "Status changed",
  "client.acknowledged": "Client acknowledged",
  "milestone.completed": "Workflow step closed",
  "payment.received": "Payment received",
  "docs.requested": "Documents requested",
  "docs.reminded": "Client chased",
  "docs.received": "Document received",
  "qc.requested": "Handed up for QC",
  "qc.approved": "QC signed off",
  "qc.returned": "QC sent back",
  "balance.invoiced": "Balance invoiced",
  "project.submitted": "Submitted to authority",
  "authority.query": "Authority query",
  "authority.followup": "Authority follow-up",
  "project.outcome": "Outcome received",
  "project.deleted": "Project deleted",
  "phase.advanced": "Phase advanced",
  "recurring.added": "Standing duty added",
  "recurring.paused": "Standing duty paused",
  "escalation.raised": "Escalation raised",
  "escalation.acknowledged": "Escalation seen",
  "escalation.resolved": "Escalation resolved",
};
