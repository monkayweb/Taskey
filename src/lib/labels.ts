import type {
  BlockStatus,
  FlagKind,
  EscalationSeverity,
  LeadChannel,
  LeadStage,
  SkipReason,
  TaskCategory,
} from "./types";
import type { Tone } from "@/components/ui";

export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  emails: "Email",
  calls: "Calls",
  quotes: "Quotes",
  projects: "Projects",
  meetings: "Meetings",
  admin: "Admin",
  other: "Other",
};

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
  inquiry_idle: "Unanswered",
  followup_overdue: "Follow-up overdue",
  followup_due_today: "Follow up today",
  milestone_overdue: "Milestone late",
  project_due_soon: "Delivering soon",
  log_missing: "No log submitted",
};

export const FLAG_TONE: Record<"critical" | "warning" | "info", Tone> = {
  critical: "danger",
  warning: "warn",
  info: "neutral",
};
