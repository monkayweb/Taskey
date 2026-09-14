// ---------------------------------------------------------------------------
// Demo data for a regulatory licensing practice.
//
// Everything here is generated relative to "now" so the flags, follow-up
// clocks and project sheets are genuinely live rather than hardcoded to a
// date in the past. Each record exists to exercise one rule: a client sitting
// on their documents, a QC check holding up a submission, a balance that fell
// due the day we submitted, an authority that has gone quiet.
// ---------------------------------------------------------------------------

import {
  addDays,
  addHours,
  getISODay,
  subDays,
  subHours,
  subMinutes,
} from "date-fns";
import { dayKey } from "./date";
import {
  buildDocuments,
  buildSteps,
  holdersOf,
  phaseAmount,
  serviceById,
  WORKFLOW_STEPS,
} from "./services";
import type {
  Assignment,
  AuditEvent,
  BlockStatus,
  ClientContact,
  DailyBlock,
  DailyLog,
  Escalation,
  Lead,
  Project,
  RecurringTask,
  SkipReason,
  TimeBlockTemplate,
  User,
} from "./types";
import { nameList } from "./text";

/**
 * The practice: an owner who signs everything off, an administrator who takes
 * the payments in, a sales consultant on the inquiries, a project consultant
 * who does the technical work and a coordinator who submits and chases.
 *
 * Work is routed by `workRole`, so these five roles are what every project
 * step is written against.
 */
export const USERS: User[] = [
  {
    id: "u_admin",
    name: "Patricia Ngassam",
    email: "patricia@pharmers.co.za",
    role: "admin",
    jobTitle: "Owner",
    workRole: "owner",
    duties: [
      "QC check on every application before it is submitted",
      "Sign off pricing and scope on new projects",
      "Handle escalations the team cannot resolve",
      "Review the weekly team scorecard",
    ],
    tint: "#4f46e5",
  },
  {
    id: "u_ayesha",
    name: "Ayesha Kader",
    email: "ayesha@pharmers.co.za",
    role: "employee",
    jobTitle: "Office Administrator",
    workRole: "admin",
    duties: [
      "Load a project sheet the day a client's payment lands",
      "Reconcile payments and keep the balances current",
      "Invoice balances that fall due on submission",
      "Keep the client file and correspondence in order",
    ],
    tint: "#7c3aed",
  },
  {
    id: "u_thandi",
    name: "Thandi Mokoena",
    email: "thandi@pharmers.co.za",
    role: "employee",
    jobTitle: "Sales Consultant",
    workRole: "sales",
    duties: [
      "Answer every inbound inquiry the same day",
      "Quote new work and follow up inside three days",
      "Explain scope and timelines to new clients",
      "Keep the pipeline current",
    ],
    tint: "#0d9488",
  },
  {
    id: "u_devon",
    name: "Devon Pillay",
    email: "devon@pharmers.co.za",
    role: "employee",
    jobTitle: "Project Consultant",
    workRole: "consultant",
    duties: [
      "Send the document request the day a project sheet opens",
      "Chase clients until every requested document is in",
      "Compile letters, application forms and the technical pack",
      "Answer anything the authority comes back asking for",
    ],
    tint: "#c2410c",
  },
  {
    id: "u_naledi",
    name: "Naledi Sithole",
    email: "naledi@pharmers.co.za",
    role: "employee",
    jobTitle: "Project Coordinator",
    workRole: "coordinator",
    duties: [
      "Submit cleared applications to the authority",
      "Check the authority portals every morning",
      "Follow up monthly on everything still in processing",
      "Keep the tracking sheet and outcome dates current",
    ],
    tint: "#be123c",
  },
];

const WEEKDAYS = [1, 2, 3, 4, 5];

/** Mirrors what each person's calendar looks like on a working day. */
export const TEMPLATES: TimeBlockTemplate[] = [
  // Thandi, sales
  ["u_thandi", "Inbox & WhatsApp triage", "08:00", "09:00", "emails"],
  ["u_thandi", "Inquiry calls", "09:00", "10:30", "calls"],
  ["u_thandi", "Quotes & pricing", "10:30", "12:00", "quotes"],
  ["u_thandi", "Client consultations", "13:00", "15:00", "meetings"],
  ["u_thandi", "Quote follow-ups", "15:00", "16:00", "quotes"],
  ["u_thandi", "Pipeline update", "16:00", "17:00", "admin"],
  // Devon, project consultant
  ["u_devon", "Document chase round", "08:00", "09:00", "calls"],
  ["u_devon", "Application drafting", "09:00", "11:00", "projects"],
  ["u_devon", "Client emails", "11:00", "12:00", "emails"],
  ["u_devon", "Technical pack compiling", "13:00", "15:00", "projects"],
  ["u_devon", "Authority queries", "15:00", "16:00", "projects"],
  ["u_devon", "Daily report", "16:30", "17:00", "admin"],
  // Naledi, coordinator
  ["u_naledi", "Authority portal checks", "08:00", "08:30", "admin"],
  ["u_naledi", "Submission preparation", "08:30", "10:30", "projects"],
  ["u_naledi", "Follow-up calls", "10:30", "12:00", "calls"],
  ["u_naledi", "Tracking sheet update", "13:00", "14:00", "admin"],
  ["u_naledi", "Submissions & couriers", "14:00", "16:00", "projects"],
  ["u_naledi", "End-of-day wrap", "16:00", "17:00", "admin"],
  // Ayesha, office
  ["u_ayesha", "Payments & project intake", "08:00", "09:30", "admin"],
  ["u_ayesha", "Invoicing & balances", "09:30", "10:30", "admin"],
  ["u_ayesha", "Client onboarding calls", "10:30", "12:00", "calls"],
  ["u_ayesha", "Correspondence & filing", "13:00", "14:30", "emails"],
  ["u_ayesha", "Compliance filing", "14:30", "16:00", "admin"],
  ["u_ayesha", "Statements", "16:00", "17:00", "admin"],
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

/**
 * The standing duties. These are materialised into one task per person per
 * matching day, so nobody is reminded of them by hand.
 */
export const RECURRING: RecurringTask[] = [
  {
    id: "rt_docs",
    title: "Chase outstanding client documents",
    detail:
      "Work the outstanding list on every open sheet. Most of our delay sits here.",
    assigneeIds: ["u_devon"],
    weekdays: WEEKDAYS,
    dueTime: "10:00",
    category: "calls",
    active: true,
    createdAt: "2026-01-12T08:00:00.000Z",
  },
  {
    id: "rt_portals",
    title: "Check the authority portals for new correspondence",
    assigneeIds: ["u_naledi"],
    weekdays: WEEKDAYS,
    dueTime: "08:30",
    category: "admin",
    active: true,
    createdAt: "2026-01-12T08:00:00.000Z",
  },
  {
    id: "rt_payments",
    title: "Reconcile payments received and update balances",
    detail: "Any new payment means a project sheet has to be opened same day.",
    assigneeIds: ["u_ayesha"],
    weekdays: WEEKDAYS,
    dueTime: "09:00",
    category: "admin",
    active: true,
    createdAt: "2026-01-12T08:00:00.000Z",
  },
  {
    id: "rt_quotes",
    title: "Follow up every quote older than three days",
    assigneeIds: ["u_thandi"],
    weekdays: [1, 3, 5],
    dueTime: "11:00",
    category: "quotes",
    active: true,
    createdAt: "2026-01-12T08:00:00.000Z",
  },
  {
    id: "rt_followups",
    title: "Monthly follow-up sweep on everything in processing",
    detail: "One call or email per open submission, logged on the sheet.",
    assigneeIds: ["u_naledi"],
    weekdays: [1],
    dueTime: "14:00",
    category: "calls",
    active: true,
    createdAt: "2026-01-12T08:00:00.000Z",
  },
];

/** Instantiate one day's checklist for a user from their calendar tasks. */
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
  ran_out_of_time: "Ran over on the earlier task, pushed to tomorrow.",
  reprioritised: "Dropped this to take an urgent client call.",
  blocked_externally: "Waiting on the client's documents before I can finish.",
  client_delay: "Client rescheduled at short notice.",
  meeting_overran: "Consultation ran an hour long.",
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
  assignments: Assignment[];
  leads: Lead[];
  projects: Project[];
  recurring: RecurringTask[];
  escalations: Escalation[];
  audit: AuditEvent[];
}

/**
 * How far along a sheet is, by the last step of the chart that is closed. The
 * rest of a project's state follows from it, the same way it does in the
 * running app: a step is closed because the work behind it happened.
 */
export type Stage = "docs_out" | "compiling" | "qc" | "submitted" | "outcome";

const STAGE_STEPS: Record<Stage, number> = {
  docs_out: 5, // sheet open, request out, waiting on the client
  compiling: 6, // documents in, being compiled
  qc: 7, // handed up, sitting with the owner
  submitted: 9, // lodged, balance being collected
  outcome: 99, // closed out
};

export interface SheetInput {
  id: string;
  serviceId: string;
  client: string;
  contact: ClientContact;
  ownerId: string;
  paidDaysAgo: number;
  stage: Stage;
  /** How many requested documents are back, while we are still waiting. */
  docsIn?: number;
  chases?: number;
  submittedDaysAgo?: number;
  followUpDaysAgo?: number;
  outcomeDaysAgo?: number;
  /** Share of the running phase's fee the client has actually paid. */
  paidShare?: number;
  phase?: number;
  fee?: number;
  queries?: { detail: string; daysAgo: number; cleared?: boolean }[];
}

/** Build one project sheet exactly as intake would have built it. */
export function makeSheet(now: Date, o: SheetInput): Project {
  const iso = (d: Date) => d.toISOString();
  const service = serviceById(o.serviceId);
  const phase = o.phase ?? 0;
  const paidAt = dayKey(subDays(now, o.paidDaysAgo));
  const prefix = `${o.id}_p${phase}`;
  const submittedAt =
    o.submittedDaysAgo !== undefined
      ? iso(subDays(now, o.submittedDaysAgo))
      : undefined;

  const steps = buildSteps(service, paidAt, prefix);
  const through = STAGE_STEPS[o.stage];
  const docsAllIn = through >= STAGE_STEPS.compiling;

  const documents = buildDocuments(service, prefix).map((d, i) => {
    const received = docsAllIn || i < (o.docsIn ?? 0);
    return {
      ...d,
      received,
      receivedAt: received
        ? iso(subDays(now, Math.max(o.paidDaysAgo - 3 - i, 0)))
        : undefined,
    };
  });

  const fee = o.fee ?? service.fee;
  const draft: Project = {
    id: o.id,
    name: service.name,
    client: o.client,
    clientContact: o.contact,
    serviceId: service.id,
    ownerId: o.ownerId,
    status:
      o.stage === "outcome" && phase === service.phases.length - 1
        ? "complete"
        : "active",
    dueDate: steps.find((m) => m.gate === "submit")!.dueDate,
    milestones: steps.map((m) => ({
      ...m,
      done: m.step <= through,
      doneAt:
        m.step <= through
          ? iso(subDays(now, Math.max(o.paidDaysAgo - m.step, 0)))
          : undefined,
      doneBy: m.step <= through ? o.ownerId : undefined,
    })),
    paidAt,
    fee,
    payments: [],
    phase,
    documents,
    // Step 5, the day after the money landed. Every sample sheet is past it,
    // which is why they all sit on step 6 or later.
    acknowledgedAt: iso(subDays(now, Math.max(o.paidDaysAgo - 1, 0))),
    docsRequestedAt: iso(subDays(now, Math.max(o.paidDaysAgo - 1, 0))),
    docsRemindedAt:
      o.chases && o.chases > 0
        ? iso(subDays(now, Math.max(o.paidDaysAgo - 4, 0)))
        : undefined,
    docChases: o.chases ?? 0,
    qcRequestedAt:
      through >= STAGE_STEPS.qc
        ? iso(subDays(now, Math.max(o.paidDaysAgo - 8, 1)))
        : undefined,
    qcApprovedAt:
      through >= STAGE_STEPS.submitted
        ? iso(subDays(now, (o.submittedDaysAgo ?? 0) + 1))
        : undefined,
    qcApprovedBy: through >= STAGE_STEPS.submitted ? "u_admin" : undefined,
    qcReturns: 0,
    submittedAt,
    submittedVia: submittedAt ? "authority portal" : undefined,
    // The admin sends the balance email the day it is lodged.
    invoicedAt: submittedAt,
    lastFollowUpAt:
      o.followUpDaysAgo !== undefined
        ? iso(subDays(now, o.followUpDaysAgo))
        : undefined,
    queries: (o.queries ?? []).map((q, i) => ({
      id: `${o.id}_q${i + 1}`,
      at: iso(subDays(now, q.daysAgo)),
      detail: q.detail,
      clearedAt: q.cleared ? iso(subDays(now, Math.max(q.daysAgo - 2, 0))) : undefined,
    })),
    outcome: o.stage === "outcome" ? "approved" : undefined,
    outcomeAt:
      o.stage === "outcome" && o.outcomeDaysAgo !== undefined
        ? iso(subDays(now, o.outcomeDaysAgo))
        : undefined,
  };

  // The deposit, and whatever else has come in against this phase.
  const share = o.paidShare ?? 0.5;
  const paid = Math.round(phaseAmount(draft, phase) * share);
  return {
    ...draft,
    payments: paid
      ? [
          {
            id: `${o.id}_pay1`,
            at: iso(subDays(now, o.paidDaysAgo)),
            amount: paid,
            phase,
            note: share >= 1 ? "Paid in full up front" : "Deposit on intake",
          },
        ]
      : [],
  };
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
      const skipSubmission =
        !isToday && user.id === "u_ayesha" && date === days[days.length - 2];

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
        new Date(
          `${date}T${17 + Math.floor(rand() * 2)}:${10 + Math.floor(rand() * 40)}:00`,
        ),
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
                  label: "Unplanned client walk-in",
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
        detail: `${filled.filter((b) => b.status === "done").length}/${filled.length} tasks completed`,
      });
    }
  }

  // --- leads: each one exists to exercise a specific rule -------------------

  const leads: Lead[] = [
    {
      id: "ld_1",
      company: "Bellville Chemist",
      contactName: "Marius van Wyk",
      channel: "whatsapp",
      ownerId: "u_thandi",
      stage: "inquiry",
      value: 24500,
      createdAt: iso(subHours(now, 7)),
      lastActivityAt: iso(subHours(now, 7)),
      activity: [
        {
          id: "la_1",
          at: iso(subHours(now, 7)),
          kind: "whatsapp",
          detail: "Opening a second branch, wants to know what a new PL costs.",
          byUserId: "u_thandi",
        },
      ],
    },
    {
      id: "ld_2",
      company: "Klerksdorp Medical Supplies",
      contactName: "Nomsa Dube",
      channel: "website",
      ownerId: "u_thandi",
      stage: "inquiry",
      value: 62000,
      createdAt: iso(subHours(now, 19)),
      lastActivityAt: iso(subHours(now, 19)),
      activity: [
        {
          id: "la_2",
          at: iso(subHours(now, 19)),
          kind: "note",
          detail: "Website form: wholesale licence, asked how long SAHPRA takes.",
          byUserId: "u_thandi",
        },
      ],
    },
    {
      id: "ld_3",
      company: "Gqeberha Compounding Lab",
      contactName: "Priya Naidoo",
      channel: "referral",
      ownerId: "u_thandi",
      stage: "quoted",
      value: 96000,
      createdAt: iso(subDays(now, 14)),
      firstResponseAt: iso(addHours(subDays(now, 14), 2)),
      quoteSentAt: iso(subDays(now, 9)),
      lastActivityAt: iso(subDays(now, 9)),
      activity: [
        {
          id: "la_3",
          at: iso(subDays(now, 9)),
          kind: "quote_sent",
          detail: "Quote Q-1094 sent for the manufacturing licence, all phases.",
          byUserId: "u_thandi",
        },
      ],
    },
    {
      id: "ld_4",
      company: "Stellenbosch Pharmacy Group",
      contactName: "Sipho Zulu",
      channel: "email",
      ownerId: "u_thandi",
      stage: "negotiating",
      value: 24500,
      createdAt: iso(subDays(now, 11)),
      firstResponseAt: iso(addHours(subDays(now, 11), 5)),
      quoteSentAt: iso(subDays(now, 8)),
      lastActivityAt: iso(subDays(now, 5)),
      activity: [
        {
          id: "la_4a",
          at: iso(subDays(now, 8)),
          kind: "quote_sent",
          detail: "Quote Q-1088 sent for two new premises licences.",
          byUserId: "u_thandi",
        },
        {
          id: "la_4b",
          at: iso(subDays(now, 5)),
          kind: "call",
          detail: "Asked for a discount on the second branch, will come back to me.",
          byUserId: "u_thandi",
        },
      ],
    },
    {
      id: "ld_5",
      company: "Paarl Dispensary",
      contactName: "Hanlie Botha",
      channel: "phone",
      ownerId: "u_ayesha",
      stage: "quoted",
      value: 9500,
      createdAt: iso(subDays(now, 8)),
      firstResponseAt: iso(addHours(subDays(now, 8), 1)),
      quoteSentAt: iso(subDays(now, 6)),
      lastActivityAt: iso(subDays(now, 6)),
      activity: [
        {
          id: "la_5",
          at: iso(subDays(now, 6)),
          kind: "quote_sent",
          detail: "Renewal quote Q-1091 emailed through.",
          byUserId: "u_ayesha",
        },
      ],
    },
    {
      id: "ld_6",
      company: "Somerset West Pharmacy",
      contactName: "Dr Reza Ismail",
      channel: "referral",
      ownerId: "u_thandi",
      stage: "quoted",
      value: 18400,
      createdAt: iso(subDays(now, 7)),
      firstResponseAt: iso(addHours(subDays(now, 7), 3)),
      quoteSentAt: iso(subDays(now, 3)),
      lastActivityAt: iso(subDays(now, 3)),
      activity: [
        {
          id: "la_6",
          at: iso(subDays(now, 3)),
          kind: "quote_sent",
          detail: "Quote Q-1096 sent for the 22A permit.",
          byUserId: "u_thandi",
        },
      ],
    },
    {
      id: "ld_7",
      company: "Atlantic Seaboard Aesthetics",
      contactName: "Erin Fourie",
      channel: "email",
      ownerId: "u_ayesha",
      stage: "contacted",
      value: 7200,
      createdAt: iso(subDays(now, 2)),
      firstResponseAt: iso(addHours(subDays(now, 2), 6)),
      lastActivityAt: iso(subHours(now, 26)),
      activity: [
        {
          id: "la_7",
          at: iso(subHours(now, 26)),
          kind: "email",
          detail: "Sent the RP change checklist, waiting on their pharmacist's details.",
          byUserId: "u_ayesha",
        },
      ],
    },
    {
      id: "ld_8",
      company: "Table Bay Compounding",
      contactName: "Johan Steyn",
      channel: "walk_in",
      ownerId: "u_thandi",
      stage: "won",
      value: 96000,
      createdAt: iso(subDays(now, 32)),
      firstResponseAt: iso(addHours(subDays(now, 32), 1)),
      quoteSentAt: iso(subDays(now, 29)),
      lastActivityAt: iso(subDays(now, 26)),
      closedAt: iso(subDays(now, 26)),
      activity: [
        {
          id: "la_8",
          at: iso(subDays(now, 26)),
          kind: "stage_change",
          detail: "Phase 0 paid, project sheet opened same day.",
          byUserId: "u_thandi",
        },
      ],
    },
    {
      id: "ld_9",
      company: "Hermanus Chemist",
      contactName: "Lerato Khumalo",
      channel: "whatsapp",
      ownerId: "u_ayesha",
      stage: "lost",
      value: 9500,
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
          detail: "Did the renewal themselves.",
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

  // --- project sheets, one per thing that can go wrong ----------------------

  const projects: Project[] = [
    // The client is sitting on their documents. This is where most of the
    // delay in the business actually is.
    makeSheet(now, {
      id: "pj_kirstenhof",
      serviceId: "pl_new",
      client: "Kirstenhof Pharmacy",
      contact: {
        name: "Dr Lindiwe Mahlangu",
        email: "lindiwe@kirstenhofpharmacy.co.za",
        phone: "082 555 0114",
      },
      ownerId: "u_devon",
      paidDaysAgo: 8,
      stage: "docs_out",
      docsIn: 4,
      chases: 1,
    }),
    // Compiled, handed up, and waiting on the QC signature while the
    // submission date goes past.
    makeSheet(now, {
      id: "pj_newlands",
      serviceId: "pl_new",
      client: "Newlands Village Pharmacy",
      contact: {
        name: "Yusuf Adams",
        email: "yusuf@newlandsvillagerx.co.za",
        phone: "021 555 0187",
      },
      ownerId: "u_devon",
      paidDaysAgo: 17,
      stage: "qc",
    }),
    // With SAHPRA, nothing heard for over a month, and the balance that fell
    // due on submission is still outstanding.
    makeSheet(now, {
      id: "pj_capewholesale",
      serviceId: "wholesale",
      client: "Cape Medical Wholesalers",
      contact: {
        name: "Farhana Petersen",
        email: "farhana@capemedwholesale.co.za",
        phone: "021 555 0433",
      },
      ownerId: "u_devon",
      phase: 1,
      paidDaysAgo: 40,
      stage: "submitted",
      submittedDaysAgo: 34,
    }),
    // Two days to submit, three of six documents in. The short one.
    makeSheet(now, {
      id: "pj_zenith",
      serviceId: "detained",
      client: "Zenith Imports",
      contact: {
        name: "Ravi Chetty",
        email: "ravi@zenithimports.co.za",
        phone: "083 555 0921",
      },
      ownerId: "u_devon",
      paidDaysAgo: 1,
      stage: "docs_out",
      docsIn: 3,
      paidShare: 1,
    }),
    // Running to time, mid-phase, nothing wrong with it.
    makeSheet(now, {
      id: "pj_tablebay",
      serviceId: "manufacturing",
      client: "Table Bay Compounding",
      contact: {
        name: "Johan Steyn",
        email: "johan@tablebaycompounding.co.za",
        phone: "021 555 0290",
      },
      ownerId: "u_devon",
      phase: 1,
      paidDaysAgo: 26,
      stage: "compiling",
    }),
    // Closed out, licence issued, paid in full.
    makeSheet(now, {
      id: "pj_milnerton",
      serviceId: "pl_renewal",
      client: "Milnerton Family Pharmacy",
      contact: {
        name: "Anele Mbeki",
        email: "anele@milnertonfamilyrx.co.za",
      },
      ownerId: "u_devon",
      paidDaysAgo: 78,
      stage: "outcome",
      submittedDaysAgo: 66,
      followUpDaysAgo: 20,
      outcomeDaysAgo: 6,
      paidShare: 1,
    }),
    // Submitted two days ago: the authority has already come back, and the
    // balance is due.
    makeSheet(now, {
      id: "pj_rondebosch",
      serviceId: "rp_change",
      client: "Rondebosch Dispensary",
      contact: {
        name: "Kate Willemse",
        email: "kate@rondeboschdispensary.co.za",
        phone: "021 555 0776",
      },
      ownerId: "u_devon",
      paidDaysAgo: 9,
      stage: "submitted",
      submittedDaysAgo: 2,
      queries: [
        {
          detail:
            "Copy of the incoming pharmacist's registration certificate was illegible, resend a certified copy.",
          daysAgo: 1,
        },
      ],
    }),
  ];

  for (const p of projects) {
    const service = serviceById(p.serviceId);
    audit.push({
      id: `ae_pay_${p.id}`,
      at: p.payments[0]?.at ?? iso(subDays(now, 1)),
      actorId: "u_ayesha",
      type: "payment.received",
      subject: p.client,
      detail: `${(p.payments[0]?.amount ?? 0).toLocaleString("en-ZA")} ZAR received against a fee of ${p.fee.toLocaleString("en-ZA")} ZAR`,
    });
    audit.push({
      id: `ae_pj_${p.id}`,
      at: p.payments[0]?.at ?? iso(subDays(now, 1)),
      actorId: "u_ayesha",
      type: "project.created",
      subject: `${service.short} · ${p.client}`,
      detail: `Sheet opened from the ${p.paidAt} payment. ${service.name} to ${service.authority}, submission due ${p.dueDate}`,
    });
    if (p.docsRequestedAt) {
      audit.push({
        id: `ae_dr_${p.id}`,
        at: p.docsRequestedAt,
        actorId: p.ownerId,
        type: "docs.requested",
        subject: p.client,
        detail: `Request list of ${p.documents.length} items sent to ${p.clientContact.name}`,
      });
    }
    if (p.docsRemindedAt) {
      audit.push({
        id: `ae_dm_${p.id}`,
        at: p.docsRemindedAt,
        actorId: p.ownerId,
        type: "docs.reminded",
        subject: p.client,
        detail: `Chase ${p.docChases} sent for ${p.documents.filter((d) => !d.received).length} outstanding items`,
      });
    }
    if (p.qcRequestedAt) {
      audit.push({
        id: `ae_qcr_${p.id}`,
        at: p.qcRequestedAt,
        actorId: p.ownerId,
        type: "qc.requested",
        subject: `${p.client} · QC`,
        detail: "Application pack handed up for the QC check before submission",
      });
    }
    if (p.qcApprovedAt) {
      audit.push({
        id: `ae_qca_${p.id}`,
        at: p.qcApprovedAt,
        actorId: "u_admin",
        type: "qc.approved",
        subject: `${p.client} · QC`,
        detail: "Checked and cleared for submission",
      });
    }
    if (p.submittedAt) {
      audit.push({
        id: `ae_sub_${p.id}`,
        at: p.submittedAt,
        actorId: "u_naledi",
        type: "project.submitted",
        subject: `${p.client} · ${service.short}`,
        detail: `Submitted to ${service.authority}. Balance of ${phaseAmount(p, p.phase) - p.payments.reduce((a, x) => a + x.amount, 0)} ZAR now due.`,
      });
    }
    for (const q of p.queries) {
      audit.push({
        id: `ae_qy_${q.id}`,
        at: q.at,
        actorId: "u_naledi",
        type: "authority.query",
        subject: `${p.client} · ${service.authority}`,
        detail: q.detail,
      });
    }
    if (p.outcomeAt) {
      audit.push({
        id: `ae_out_${p.id}`,
        at: p.outcomeAt,
        actorId: "u_naledi",
        type: "project.outcome",
        subject: `${p.client} · ${service.short}`,
        detail: `${service.authority} approved the application`,
      });
    }
  }

  // --- work Patricia has handed out ----------------------------------------

  const assignments: Assignment[] = [
    {
      id: "as_1",
      title: "Re-quote Gqeberha Compounding at the revised phase split",
      detail: "They pushed back on phase 0. Use the four-phase structure.",
      assigneeIds: ["u_thandi"],
      assignedById: "u_admin",
      createdAt: iso(subDays(now, 1)),
      dueDate: dayKey(now),
      dueTime: "15:00",
      priority: "urgent",
      category: "quotes",
      status: "open",
    },
    {
      id: "as_2",
      title: "Get the Cape Medical site master file updated",
      detail: "SAHPRA will ask for it at the inspection.",
      assigneeIds: ["u_devon"],
      assignedById: "u_admin",
      createdAt: iso(subDays(now, 3)),
      dueDate: dayKey(subDays(now, 1)),
      priority: "normal",
      category: "projects",
      status: "open",
    },
    {
      id: "as_3",
      title: "Invoice the Rondebosch balance",
      detail: "It fell due the day we submitted.",
      assigneeIds: ["u_ayesha"],
      assignedById: "u_admin",
      createdAt: iso(subDays(now, 2)),
      dueDate: dayKey(now),
      priority: "normal",
      category: "admin",
      status: "open",
    },
    {
      id: "as_5",
      title: "Confirm the Table Bay pre-inspection date",
      detail: "They need two weeks notice before an inspection.",
      assigneeIds: ["u_naledi"],
      assignedById: "u_admin",
      createdAt: iso(subHours(now, 20)),
      dueDate: dayKey(now),
      dueTime: "09:30",
      priority: "normal",
      category: "calls",
      status: "open",
    },
    {
      id: "as_6",
      title: "Put the Zenith consignment paperwork together",
      assigneeIds: ["u_devon", "u_naledi"],
      assignedById: "u_admin",
      createdAt: iso(subHours(now, 6)),
      dueDate: dayKey(addDays(now, 1)),
      priority: "urgent",
      category: "projects",
      status: "open",
    },
    {
      id: "as_7",
      title: "Call the Bellville walk-in back",
      assigneeIds: ["u_thandi"],
      assignedById: "u_admin",
      createdAt: iso(subDays(now, 3)),
      dueDate: dayKey(subDays(now, 2)),
      priority: "urgent",
      category: "calls",
      status: "done",
      completedAt: iso(subDays(now, 2)),
      completionNote: "Reached them, they want a consultation next week.",
    },
    {
      id: "as_4",
      title: "Send the Stellenbosch group the scope letter",
      assigneeIds: ["u_thandi"],
      assignedById: "u_admin",
      createdAt: iso(subDays(now, 5)),
      dueDate: dayKey(subDays(now, 4)),
      priority: "normal",
      category: "meetings",
      status: "done",
      completedAt: iso(subDays(now, 4)),
      completionNote: "Sent Thursday morning, they acknowledged same day.",
    },
  ];

  // Every open sheet hands its current step to whoever holds that role, which
  // is the whole point: the task list fills itself.
  for (const p of projects) {
    if (p.status !== "active") continue;
    const step = p.milestones.find((m) => !m.done);
    if (!step) continue;
    const holders = holdersOf(USERS, step.role);
    if (holders.length === 0) continue;
    const service = serviceById(p.serviceId);
    assignments.push({
      id: `as_step_${step.id}`,
      title: step.label,
      detail: `${service.short} for ${p.client} · step ${step.step} of ${WORKFLOW_STEPS}`,
      assigneeIds: holders,
      assignedById: "u_admin",
      createdAt: p.payments[0]?.at ?? iso(subDays(now, 1)),
      dueDate: step.dueDate,
      priority: "normal",
      category: "projects",
      status: "open",
      projectId: p.id,
      stepId: step.id,
    });
  }

  for (const a of assignments) {
    audit.push({
      id: `ae_as_${a.id}`,
      at: a.createdAt,
      actorId: a.assignedById,
      type: "task.assigned",
      subject: a.title,
      detail: a.stepId
        ? `Raised automatically from the project sheet, due ${a.dueDate}`
        : `Assigned to ${nameList(
            a.assigneeIds.map((id) => USERS.find((u) => u.id === id)?.name ?? id),
          )}, due ${a.dueDate}${a.priority === "urgent" ? ", marked urgent" : ""}`,
    });
    if (a.completedAt) {
      audit.push({
        id: `ae_asc_${a.id}`,
        at: a.completedAt,
        actorId: a.assigneeIds[0],
        type: "task.completed",
        subject: a.title,
        detail: a.completionNote ?? `Marked done (due ${a.dueDate})`,
      });
    }
  }

  // --- escalations ---------------------------------------------------------

  const escalations: Escalation[] = [
    {
      id: "es_1",
      userId: "u_devon",
      createdAt: iso(subMinutes(now, 95)),
      severity: "overloaded",
      items: [
        {
          kind: "project",
          refId: "pj_kirstenhof",
          label: "Kirstenhof Pharmacy · six documents still outstanding",
        },
        {
          kind: "project",
          refId: "pj_newlands",
          label: "Newlands Village Pharmacy · past its submission date",
        },
      ],
      note: "Newlands has been sitting in QC for over a week and Kirstenhof still owes me six documents. I cannot pull the submission date back on my own.",
      status: "open",
    },
    {
      id: "es_2",
      userId: "u_naledi",
      createdAt: iso(subDays(now, 6)),
      severity: "blocked",
      items: [
        {
          kind: "project",
          refId: "pj_capewholesale",
          label: "Cape Medical Wholesalers · awaiting SAHPRA",
        },
      ],
      note: "The SAHPRA portal was down for three days, I could not log the follow-ups.",
      status: "resolved",
      acknowledgedAt: iso(subDays(now, 6)),
      acknowledgedBy: "u_admin",
      resolvedAt: iso(subDays(now, 4)),
      adminNote: "Logged them by email instead and kept the acknowledgements.",
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

  return {
    users: USERS,
    templates: TEMPLATES,
    logs,
    assignments,
    leads,
    projects,
    recurring: RECURRING,
    escalations,
    audit,
  };
}
