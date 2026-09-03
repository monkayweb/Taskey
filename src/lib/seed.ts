// ---------------------------------------------------------------------------
// Demo seed.
//
// Built relative to "now" so the follow-up clocks, idle inquiries and overdue
// milestones are genuinely live rather than hardcoded to a past date.
// Replace this module when a real backend lands; nothing else depends on it.
// ---------------------------------------------------------------------------

import { subDays, subHours, subMinutes, addDays, addHours, getISODay } from "date-fns";
import { dayKey } from "./date";
import type {
  AuditEvent,
  BlockStatus,
  DailyBlock,
  DailyLog,
  Escalation,
  Lead,
  Project,
  SkipReason,
  TimeBlockTemplate,
  User,
} from "./types";

export const USERS: User[] = [
  {
    id: "u_admin",
    name: "Tristan Storm",
    email: "tristan@cirrusbridge.com",
    role: "admin",
    jobTitle: "Owner",
    tint: "#4f46e5",
  },
  {
    id: "u_thandi",
    name: "Thandi Mokoena",
    email: "thandi@cirrusbridge.com",
    role: "employee",
    jobTitle: "Sales Lead",
    tint: "#0d9488",
  },
  {
    id: "u_devon",
    name: "Devon Pillay",
    email: "devon@cirrusbridge.com",
    role: "employee",
    jobTitle: "Project Manager",
    tint: "#c2410c",
  },
  {
    id: "u_ayesha",
    name: "Ayesha Kader",
    email: "ayesha@cirrusbridge.com",
    role: "employee",
    jobTitle: "Office & Inbound",
    tint: "#7c3aed",
  },
];

const WEEKDAYS = [1, 2, 3, 4, 5];

/** Mirrors what each person's Google Calendar looks like on a working day. */
export const TEMPLATES: TimeBlockTemplate[] = [
  // Thandi, sales
  ["u_thandi", "Emails & WhatsApp triage", "08:00", "09:00", "emails"],
  ["u_thandi", "Outbound sales calls", "09:00", "10:30", "calls"],
  ["u_thandi", "Quote follow-ups", "10:30", "11:00", "quotes"],
  ["u_thandi", "New quotes & pricing", "11:00", "12:30", "quotes"],
  ["u_thandi", "Client meetings", "13:30", "15:00", "meetings"],
  ["u_thandi", "Pipeline & CRM update", "15:00", "16:00", "admin"],
  ["u_thandi", "End-of-day wrap", "16:00", "17:00", "admin"],
  // Devon, delivery
  ["u_devon", "Site check-ins", "08:00", "08:30", "projects"],
  ["u_devon", "Project delivery block", "08:30", "10:00", "projects"],
  ["u_devon", "Supplier emails", "10:00", "11:00", "emails"],
  ["u_devon", "Installation coordination", "11:00", "13:00", "projects"],
  ["u_devon", "Project delivery block", "14:00", "15:30", "projects"],
  ["u_devon", "Snag list & QA", "15:30", "16:30", "projects"],
  ["u_devon", "Daily report", "16:30", "17:00", "admin"],
  // Ayesha, inbound
  ["u_ayesha", "Inbox & WhatsApp inbound", "08:00", "09:30", "emails"],
  ["u_ayesha", "Invoicing", "09:30", "10:30", "admin"],
  ["u_ayesha", "Inquiry routing calls", "10:30", "12:00", "calls"],
  ["u_ayesha", "Supplier orders", "13:00", "14:00", "admin"],
  ["u_ayesha", "Quote typing & sending", "14:00", "15:30", "quotes"],
  ["u_ayesha", "Filing & compliance", "15:30", "17:00", "admin"],
].map(([userId, label, start, end, category], i) => ({
  id: `tb_${i}`,
  userId: userId as string,
  label: label as string,
  start: start as string,
  end: end as string,
  weekdays: WEEKDAYS,
  category: category as TimeBlockTemplate["category"],
  calendar: "Google Calendar · Team",
}));

/** Instantiate one day's checklist for a user from their calendar blocks. */
export function blocksForDay(userId: string, date: string): DailyBlock[] {
  const weekday = getISODay(new Date(`${date}T12:00:00`));
  return TEMPLATES.filter(
    (t) => t.userId === userId && t.weekdays.includes(weekday),
  )
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((t) => ({
      id: `db_${date}_${t.id}`,
      templateId: t.id,
      label: t.label,
      start: t.start,
      end: t.end,
      category: t.category,
      status: "pending" as BlockStatus,
    }));
}

// --- deterministic pseudo-randomness so the demo history is stable ---------

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const SKIP_REASONS: SkipReason[] = [
  "ran_out_of_time",
  "reprioritised",
  "blocked_externally",
  "client_delay",
  "meeting_overran",
];

const SKIP_NOTES: Record<string, string> = {
  ran_out_of_time: "Ran over on the earlier block, pushed to tomorrow.",
  reprioritised: "Dropped this to take an urgent client call.",
  blocked_externally: "Waiting on supplier pricing before I can finish.",
  client_delay: "Client rescheduled at short notice.",
  meeting_overran: "Site meeting ran an hour long.",
};

/** Working days from `daysBack` ago up to and including today. */
function workingDays(now: Date, daysBack: number): string[] {
  const out: string[] = [];
  for (let i = daysBack; i >= 0; i--) {
    const d = subDays(now, i);
    if (getISODay(d) <= 5) out.push(dayKey(d));
  }
  return out;
}

export interface Seed {
  users: User[];
  templates: TimeBlockTemplate[];
  logs: DailyLog[];
  leads: Lead[];
  projects: Project[];
  escalations: Escalation[];
  audit: AuditEvent[];
}

export function buildSeed(now: Date): Seed {
  const iso = (d: Date) => d.toISOString();
  const today = dayKey(now);
  const days = workingDays(now, 72);
  const employees = USERS.filter((u) => u.role === "employee");

  const logs: DailyLog[] = [];
  const audit: AuditEvent[] = [];
  const rand = rng(20260903);

  for (const date of days) {
    for (const user of employees) {
      const blocks = blocksForDay(user.id, date);
      if (blocks.length === 0) continue;

      const isToday = date === today;
      // One deliberate gap: Ayesha never submitted the most recent day, which
      // is what surfaces the "did not submit" flag on the admin dashboard.
      const skipSubmission = !isToday && user.id === "u_ayesha" && date === days[days.length - 2];

      if (isToday || skipSubmission) {
        logs.push({
          id: `log_${user.id}_${date}`,
          userId: user.id,
          date,
          blocks,
          extraTasks: [],
        });
        continue;
      }

      const filled = blocks.map((b) => {
        const roll = rand();
        let status: BlockStatus = "done";
        if (roll > 0.88) status = "missed";
        else if (roll > 0.76) status = "partial";
        const reason =
          status === "done"
            ? undefined
            : SKIP_REASONS[Math.floor(rand() * SKIP_REASONS.length)];
        return {
          ...b,
          status,
          skipReason: reason,
          note: reason ? SKIP_NOTES[reason] : undefined,
        };
      });

      const submittedAt = iso(
        new Date(`${date}T${17 + Math.floor(rand() * 2)}:${10 + Math.floor(rand() * 40)}:00`),
      );

      logs.push({
        id: `log_${user.id}_${date}`,
        userId: user.id,
        date,
        blocks: filled,
        extraTasks:
          rand() > 0.6
            ? [
                {
                  id: `xt_${user.id}_${date}`,
                  label: "Unplanned walk-in client",
                  minutes: 30 + Math.floor(rand() * 60),
                  category: "other",
                },
              ]
            : [],
        summaryNote: filled.some((b) => b.status === "missed")
          ? "Busy day, flagged what slipped."
          : undefined,
        submittedAt,
        lockedAt: submittedAt,
      });

      audit.push({
        id: `ae_log_${user.id}_${date}`,
        at: submittedAt,
        actorId: user.id,
        type: "log.submitted",
        subject: `Daily log · ${date}`,
        detail: `${filled.filter((b) => b.status === "done").length}/${filled.length} blocks completed`,
      });
    }
  }

  // --- leads: each one exists to exercise a specific rule -------------------

  const leads: Lead[] = [
    {
      id: "ld_1",
      company: "Kloof Industrial",
      contactName: "Marius van Wyk",
      channel: "whatsapp",
      ownerId: "u_ayesha",
      stage: "inquiry",
      value: 48000,
      createdAt: iso(subHours(now, 7)),
      lastActivityAt: iso(subHours(now, 7)),
      activity: [
        {
          id: "la_1",
          at: iso(subHours(now, 7)),
          kind: "whatsapp",
          detail: "Inbound WhatsApp: needs pricing on 12 units, urgent.",
          byUserId: "u_ayesha",
        },
      ],
    },
    {
      id: "ld_2",
      company: "Bright Path Schools",
      contactName: "Nomsa Dube",
      channel: "website",
      ownerId: "u_thandi",
      stage: "inquiry",
      value: 132000,
      createdAt: iso(subHours(now, 19)),
      lastActivityAt: iso(subHours(now, 19)),
      activity: [
        {
          id: "la_2",
          at: iso(subHours(now, 19)),
          kind: "note",
          detail: "Website form: 3 campus rollout, asked for a site visit.",
          byUserId: "u_thandi",
        },
      ],
    },
    {
      id: "ld_3",
      company: "Umhlanga Retail Group",
      contactName: "Priya Naidoo",
      channel: "referral",
      ownerId: "u_thandi",
      stage: "quoted",
      value: 265000,
      createdAt: iso(subDays(now, 14)),
      firstResponseAt: iso(addHours(subDays(now, 14), 2)),
      quoteSentAt: iso(subDays(now, 9)),
      lastActivityAt: iso(subDays(now, 9)),
      activity: [
        {
          id: "la_3",
          at: iso(subDays(now, 9)),
          kind: "quote_sent",
          detail: "Quote Q-1094 sent for the full fit-out.",
          byUserId: "u_thandi",
        },
      ],
    },
    {
      id: "ld_4",
      company: "Coastal Logistics",
      contactName: "Sipho Zulu",
      channel: "email",
      ownerId: "u_thandi",
      stage: "negotiating",
      value: 89500,
      createdAt: iso(subDays(now, 11)),
      firstResponseAt: iso(addHours(subDays(now, 11), 5)),
      quoteSentAt: iso(subDays(now, 8)),
      lastActivityAt: iso(subDays(now, 5)),
      activity: [
        {
          id: "la_4a",
          at: iso(subDays(now, 8)),
          kind: "quote_sent",
          detail: "Quote Q-1088 sent.",
          byUserId: "u_thandi",
        },
        {
          id: "la_4b",
          at: iso(subDays(now, 5)),
          kind: "call",
          detail: "Asked for 10% off, said he'd come back to me.",
          byUserId: "u_thandi",
        },
      ],
    },
    {
      id: "ld_5",
      company: "Ridgeview Estates",
      contactName: "Hanlie Botha",
      channel: "phone",
      ownerId: "u_ayesha",
      stage: "quoted",
      value: 41200,
      createdAt: iso(subDays(now, 8)),
      firstResponseAt: iso(addHours(subDays(now, 8), 1)),
      quoteSentAt: iso(subDays(now, 6)),
      lastActivityAt: iso(subDays(now, 6)),
      activity: [
        {
          id: "la_5",
          at: iso(subDays(now, 6)),
          kind: "quote_sent",
          detail: "Quote Q-1091 emailed through.",
          byUserId: "u_ayesha",
        },
      ],
    },
    {
      id: "ld_6",
      company: "Sandton Dental Rooms",
      contactName: "Dr. Reza Ismail",
      channel: "referral",
      ownerId: "u_thandi",
      stage: "quoted",
      value: 76800,
      createdAt: iso(subDays(now, 7)),
      firstResponseAt: iso(addHours(subDays(now, 7), 3)),
      quoteSentAt: iso(subDays(now, 3)),
      lastActivityAt: iso(subDays(now, 3)),
      activity: [
        {
          id: "la_6",
          at: iso(subDays(now, 3)),
          kind: "quote_sent",
          detail: "Quote Q-1096 sent with the finance option.",
          byUserId: "u_thandi",
        },
      ],
    },
    {
      id: "ld_7",
      company: "Ballito Beach Lodge",
      contactName: "Erin Fourie",
      channel: "email",
      ownerId: "u_ayesha",
      stage: "contacted",
      value: 23400,
      createdAt: iso(subDays(now, 2)),
      firstResponseAt: iso(addHours(subDays(now, 2), 6)),
      lastActivityAt: iso(subHours(now, 26)),
      activity: [
        {
          id: "la_7",
          at: iso(subHours(now, 26)),
          kind: "email",
          detail: "Sent the brochure, waiting on their spec.",
          byUserId: "u_ayesha",
        },
      ],
    },
    {
      id: "ld_8",
      company: "Pinetown Manufacturing",
      contactName: "Johan Steyn",
      channel: "walk_in",
      ownerId: "u_devon",
      stage: "won",
      value: 154000,
      createdAt: iso(subDays(now, 21)),
      firstResponseAt: iso(addHours(subDays(now, 21), 1)),
      quoteSentAt: iso(subDays(now, 18)),
      lastActivityAt: iso(subDays(now, 4)),
      closedAt: iso(subDays(now, 4)),
      activity: [
        {
          id: "la_8",
          at: iso(subDays(now, 4)),
          kind: "stage_change",
          detail: "PO received, moved to won.",
          byUserId: "u_devon",
        },
      ],
    },
    {
      id: "ld_9",
      company: "Glenwood Bakery",
      contactName: "Lerato Khumalo",
      channel: "whatsapp",
      ownerId: "u_ayesha",
      stage: "lost",
      value: 18900,
      createdAt: iso(subDays(now, 24)),
      firstResponseAt: iso(subDays(now, 23)),
      quoteSentAt: iso(subDays(now, 22)),
      lastActivityAt: iso(subDays(now, 12)),
      closedAt: iso(subDays(now, 12)),
      activity: [
        {
          id: "la_9",
          at: iso(subDays(now, 12)),
          kind: "stage_change",
          detail: "Went with a cheaper local supplier.",
          byUserId: "u_ayesha",
        },
      ],
    },
  ];

  for (const lead of leads) {
    if (lead.quoteSentAt) {
      audit.push({
        id: `ae_q_${lead.id}`,
        at: lead.quoteSentAt,
        actorId: lead.ownerId,
        type: "lead.quote_sent",
        subject: lead.company,
        detail: `Quote sent for ${lead.value.toLocaleString("en-ZA")} ZAR`,
      });
    }
  }

  // --- projects ------------------------------------------------------------

  const projects: Project[] = [
    {
      id: "pj_1",
      name: "Umhlanga HQ fit-out",
      client: "Umhlanga Retail Group",
      ownerId: "u_devon",
      status: "active",
      dueDate: dayKey(addDays(now, 5)),
      milestones: [
        { id: "ms_1a", label: "Site survey signed off", dueDate: dayKey(subDays(now, 9)), done: true, doneAt: iso(subDays(now, 9)) },
        { id: "ms_1b", label: "Materials delivered to site", dueDate: dayKey(subDays(now, 2)), done: false },
        { id: "ms_1c", label: "First-fix installation", dueDate: dayKey(addDays(now, 2)), done: false },
        { id: "ms_1d", label: "Client walkthrough", dueDate: dayKey(addDays(now, 5)), done: false },
      ],
    },
    {
      id: "pj_2",
      name: "Pinetown line upgrade",
      client: "Pinetown Manufacturing",
      ownerId: "u_devon",
      status: "active",
      dueDate: dayKey(addDays(now, 18)),
      milestones: [
        { id: "ms_2a", label: "Scope locked with plant manager", dueDate: dayKey(subDays(now, 3)), done: true, doneAt: iso(subDays(now, 3)) },
        { id: "ms_2b", label: "Long-lead parts ordered", dueDate: dayKey(addDays(now, 1)), done: false },
        { id: "ms_2c", label: "Shutdown window booked", dueDate: dayKey(addDays(now, 9)), done: false },
      ],
    },
    {
      id: "pj_3",
      name: "Bright Path campus pilot",
      client: "Bright Path Schools",
      ownerId: "u_thandi",
      status: "active",
      dueDate: dayKey(addDays(now, 11)),
      milestones: [
        { id: "ms_3a", label: "Pilot proposal to board", dueDate: dayKey(subDays(now, 1)), done: false },
        { id: "ms_3b", label: "Budget approval", dueDate: dayKey(addDays(now, 6)), done: false },
      ],
    },
    {
      id: "pj_4",
      name: "Glenwood store refresh",
      client: "Glenwood Bakery",
      ownerId: "u_ayesha",
      status: "on_hold",
      dueDate: dayKey(addDays(now, 30)),
      milestones: [
        { id: "ms_4a", label: "Revised budget from client", dueDate: dayKey(addDays(now, 14)), done: false },
      ],
    },
  ];

  // --- escalations ---------------------------------------------------------

  const escalations: Escalation[] = [
    {
      id: "es_1",
      userId: "u_ayesha",
      createdAt: iso(subMinutes(now, 95)),
      severity: "overloaded",
      items: [
        { kind: "block", refId: "tb_18", label: "Quote typing & sending" },
        { kind: "lead", refId: "ld_1", label: "Kloof Industrial · WhatsApp inquiry" },
      ],
      note: "Three quotes to type and the inbound WhatsApp queue is backing up. I can do one or the other today.",
      status: "open",
    },
    {
      id: "es_2",
      userId: "u_devon",
      createdAt: iso(subDays(now, 6)),
      severity: "blocked",
      items: [
        { kind: "milestone", refId: "ms_1b", label: "Materials delivered to site" },
      ],
      note: "Supplier missed the delivery date, whole first-fix is stalled.",
      status: "resolved",
      acknowledgedAt: iso(subDays(now, 6)),
      acknowledgedBy: "u_admin",
      resolvedAt: iso(subDays(now, 4)),
      adminNote: "Switched to the Durban supplier, delivery re-booked.",
    },
  ];

  for (const e of escalations) {
    audit.push({
      id: `ae_es_${e.id}`,
      at: e.createdAt,
      actorId: e.userId,
      type: "escalation.raised",
      subject: `Escalation · ${e.severity}`,
      detail: e.note ?? `${e.items.length} items flagged as falling behind`,
    });
  }

  audit.sort((a, b) => b.at.localeCompare(a.at));

  return { users: USERS, templates: TEMPLATES, logs, leads, projects, escalations, audit };
}
