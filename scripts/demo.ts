// ---------------------------------------------------------------------------
// Fill the database with a practice that looks like a working one.
//
//   npx dotenv -e .env.local -- npx tsx scripts/demo.ts
//
// This is for demonstrations and for the screenshots in the guide, not for
// handover: it writes ten client sheets, ten weeks of closed work and the
// audit trail behind all of it. Everything it writes is invented. Real seats
// (anybody whose email is not @pharmers.co.za) are left exactly where they
// are, so whoever is signed in stays signed in.
//
// The random numbers are seeded, so running it twice produces the same
// practice rather than a different one.
// ---------------------------------------------------------------------------

import { addDays, getISODay, subDays, subHours } from "date-fns";
import { dayKey } from "../src/lib/date";
import { makeSheet, type SheetInput } from "../src/lib/seed";
import { syncSheet } from "../src/lib/sheet";
import { serviceById } from "../src/lib/services";
import { getDb } from "../src/db";
import {
  assignments as assignmentsTable,
  audit as auditTable,
  authorityQueries,
  projectDocuments,
  projectPayments,
  projectSteps,
  projects as projectsTable,
  recurringTasks,
} from "../src/db/schema";
import {
  saveAssignments,
  saveAudit,
  saveProject,
  saveRecurring,
  saveUser,
} from "../src/db/queries";
import type {
  Assignment,
  AuditEvent,
  Project,
  RecurringTask,
  TaskCategory,
  User,
} from "../src/lib/types";

const now = new Date();
const iso = (d: Date) => d.toISOString();

/** Mulberry32. Seeded, so the same practice comes out every time. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260910);
const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];
const between = (lo: number, hi: number) =>
  lo + Math.floor(rand() * (hi - lo + 1));
const pad = (n: number) => String(n).padStart(2, "0");

/** The same moment, moved into the working day. */
const workish = (isoAt: string, hour = between(8, 17)) =>
  iso(atWork(new Date(isoAt), hour));

/** A date key plus a plausible hour inside the working day. */
const atWork = (d: Date, hour = between(8, 17)) =>
  new Date(`${dayKey(d)}T${pad(hour)}:${pad(between(0, 59))}:00`);

// --- the team --------------------------------------------------------------
// The five seats Patricia described: herself, the office, sales, the project
// consultant and the coordinator. Every step of a project sheet is written
// against one of these roles rather than against a person.

const TEAM: User[] = [
  {
    id: "u_patricia",
    name: "Patricia Ngassam",
    email: "patricia@pharmers.co.za",
    role: "admin",
    jobTitle: "Owner and responsible pharmacist",
    workRole: "owner",
    duties: [
      "QC check on every application before it is submitted",
      "Sign off pricing and scope on new projects",
      "Handle anything the team cannot resolve",
      "Read the weekly numbers and act on what is slipping",
    ],
    tint: "#4f46e5",
  },
  {
    id: "u_nadia",
    name: "Nadia Petersen",
    email: "nadia@pharmers.co.za",
    role: "employee",
    jobTitle: "Practice administrator",
    workRole: "admin",
    duties: [
      "Load every project the day the payment lands",
      "Send the document request and keep chasing until it is all in",
      "Invoice the balance the day an application is submitted",
      "Reconcile payments received against every open sheet",
    ],
    tint: "#7c3aed",
  },
  {
    id: "u_lerato",
    name: "Lerato Dlamini",
    email: "lerato@pharmers.co.za",
    role: "employee",
    jobTitle: "Sales consultant",
    workRole: "sales",
    duties: [
      "Answer every new enquiry the same working day",
      "Quote from the brochure and explain the phases",
      "Follow up every quote older than three days",
      "Hand a paid client over to the office with the scope in writing",
    ],
    tint: "#0d9488",
  },
  {
    id: "u_rushdi",
    name: "Rushdi Adams",
    email: "rushdi@pharmers.co.za",
    role: "employee",
    jobTitle: "Project consultant",
    workRole: "consultant",
    duties: [
      "Compile every application pack from the client's documents",
      "Hand the pack up for QC before the submission date",
      "Correct and resend anything QC sends back the same day",
      "Answer authority queries on the projects you carry",
    ],
    tint: "#c2410c",
  },
  {
    id: "u_sibongile",
    name: "Sibongile Nkosi",
    email: "sibongile@pharmers.co.za",
    role: "employee",
    jobTitle: "Project coordinator",
    workRole: "coordinator",
    duties: [
      "Submit approved packs and record how they went in",
      "Check the authority portals every morning",
      "Follow up everything in processing once a month",
      "Record the outcome the day it arrives",
    ],
    tint: "#be123c",
  },
];

const PATRICIA = "u_patricia";
const OFFICE = "u_nadia";
const SALES = "u_lerato";
const CONSULTANT = "u_rushdi";
const COORDINATOR = "u_sibongile";
const WORKERS = [OFFICE, SALES, CONSULTANT, COORDINATOR];

// --- standing duties ------------------------------------------------------
// Work nobody hands out. Taskey raises one task per person per matching day.

const DUTIES: RecurringTask[] = [
  {
    id: "rt_chase",
    title: "Chase outstanding client documents",
    detail: "Anything requested and not back yet, oldest first.",
    assigneeIds: [CONSULTANT],
    weekdays: [1, 2, 3, 4, 5],
    dueTime: "10:00",
    category: "calls",
    active: true,
    createdAt: iso(subDays(now, 120)),
  },
  {
    id: "rt_portals",
    title: "Check the authority portals for new correspondence",
    detail: "SAHPRA, the Pharmacy Council and Port Health.",
    assigneeIds: [COORDINATOR],
    weekdays: [1, 2, 3, 4, 5],
    dueTime: "08:30",
    category: "admin",
    active: true,
    createdAt: iso(subDays(now, 120)),
  },
  {
    id: "rt_payments",
    title: "Reconcile payments received and update balances",
    assigneeIds: [OFFICE],
    weekdays: [1, 2, 3, 4, 5],
    dueTime: "16:00",
    category: "admin",
    active: true,
    createdAt: iso(subDays(now, 120)),
  },
  {
    id: "rt_quotes",
    title: "Follow up every quote older than three days",
    assigneeIds: [SALES],
    weekdays: [1, 3, 5],
    dueTime: "11:00",
    category: "quotes",
    active: true,
    createdAt: iso(subDays(now, 120)),
  },
  {
    id: "rt_sweep",
    title: "Monthly follow-up sweep on everything in processing",
    detail: "Every submitted application with no outcome yet.",
    assigneeIds: [COORDINATOR],
    weekdays: [1],
    dueTime: "09:00",
    category: "calls",
    active: true,
    createdAt: iso(subDays(now, 120)),
  },
];

// --- the client sheets ----------------------------------------------------
// One per thing that can happen to a project, so every screen in the guide
// has something real to show.

const SHEETS: SheetInput[] = [
  {
    id: "pj_kirstenhof",
    serviceId: "pl_new",
    client: "Kirstenhof Pharmacy",
    contact: {
      name: "Dr Lindiwe Mahlangu",
      email: "lindiwe@kirstenhofpharmacy.co.za",
      phone: "082 555 0114",
    },
    ownerId: CONSULTANT,
    paidDaysAgo: 6,
    stage: "docs_out",
    docsIn: 4,
    chases: 1,
  },
  {
    id: "pj_newlands",
    serviceId: "pl_new",
    client: "Newlands Village Pharmacy",
    contact: {
      name: "Riaan Botha",
      email: "riaan@newlandsvillage.co.za",
      phone: "083 555 0198",
    },
    ownerId: CONSULTANT,
    paidDaysAgo: 16,
    stage: "qc",
  },
  {
    id: "pj_zenith",
    serviceId: "detained",
    client: "Zenith Imports",
    contact: {
      name: "Ravi Chetty",
      email: "ravi@zenithimports.co.za",
      phone: "084 555 0177",
    },
    ownerId: CONSULTANT,
    paidDaysAgo: 2,
    stage: "docs_out",
    docsIn: 1,
    paidShare: 1,
  },
  {
    id: "pj_rondebosch",
    serviceId: "rp_change",
    client: "Rondebosch Dispensary",
    contact: {
      name: "Sarah Naidoo",
      email: "sarah@rondeboschdispensary.co.za",
      phone: "082 555 0143",
    },
    ownerId: CONSULTANT,
    paidDaysAgo: 12,
    stage: "submitted",
    submittedDaysAgo: 5,
    paidShare: 0.5,
    queries: [
      {
        detail:
          "Copy of the incoming pharmacist's registration certificate was illegible, resend a certified copy.",
        daysAgo: 2,
      },
    ],
  },
  {
    id: "pj_capemedical",
    serviceId: "wholesale",
    client: "Cape Medical Wholesalers",
    contact: {
      name: "Johan Meyer",
      email: "johan@capemedicalwholesale.co.za",
      phone: "021 555 0120",
    },
    ownerId: CONSULTANT,
    paidDaysAgo: 26,
    stage: "submitted",
    submittedDaysAgo: 8,
    followUpDaysAgo: 8,
    paidShare: 0.6,
  },
  {
    id: "pj_tablebay",
    serviceId: "manufacturing",
    client: "Table Bay Compounding",
    contact: {
      name: "Dr Anele Dube",
      email: "anele@tablebaycompounding.co.za",
      phone: "021 555 0166",
    },
    ownerId: CONSULTANT,
    paidDaysAgo: 22,
    stage: "compiling",
    paidShare: 0.34,
  },
  {
    id: "pj_paarl",
    serviceId: "pl_renewal",
    client: "Paarl Family Pharmacy",
    contact: {
      name: "Marius van Wyk",
      email: "marius@paarlfamily.co.za",
      phone: "082 555 0131",
    },
    ownerId: CONSULTANT,
    paidDaysAgo: 9,
    stage: "compiling",
    paidShare: 1,
  },
  {
    id: "pj_midrand",
    serviceId: "s22a_permit",
    client: "Midrand Oncology Centre",
    contact: {
      name: "Dr Kobus Steyn",
      email: "kobus@midrandoncology.co.za",
      phone: "011 555 0109",
    },
    ownerId: CONSULTANT,
    paidDaysAgo: 34,
    stage: "submitted",
    submittedDaysAgo: 14,
    followUpDaysAgo: 14,
    paidShare: 0.34,
  },
  {
    id: "pj_umhlanga",
    serviceId: "pl_new",
    client: "Umhlanga Ridge Pharmacy",
    contact: {
      name: "Preshan Govender",
      email: "preshan@umhlangaridgerx.co.za",
      phone: "031 555 0175",
    },
    ownerId: CONSULTANT,
    paidDaysAgo: 48,
    stage: "outcome",
    submittedDaysAgo: 36,
    outcomeDaysAgo: 3,
    followUpDaysAgo: 12,
    paidShare: 1,
  },
  {
    id: "pj_bellville",
    serviceId: "rp_change",
    client: "Bellville Chemist",
    contact: {
      name: "Yolanda Fourie",
      email: "yolanda@bellvillechemist.co.za",
      phone: "021 555 0188",
    },
    ownerId: CONSULTANT,
    paidDaysAgo: 61,
    stage: "outcome",
    submittedDaysAgo: 54,
    outcomeDaysAgo: 9,
    paidShare: 1,
  },
];

// --- work handed out ------------------------------------------------------
// Ten weeks of it, so the charts have something to say. The mix is
// deliberate: most work closes on its date and some of it does not.

const CLIENTS = SHEETS.map((s) => s.client);

const WORK: Record<TaskCategory, string[]> = {
  emails: [
    "Reply to the {client} query from the authority",
    "Send {client} the signed scope letter",
    "Email {client} the certified copies we still need",
    "Forward the {client} submission receipt to the client",
  ],
  calls: [
    "Call {client} about the outstanding lease agreement",
    "Phone {client} to confirm the pharmacist's registration number",
    "Call {client} back about the inspection date",
    "Ring {client} about the deposit",
  ],
  quotes: [
    "Quote {client} for a premises licence renewal",
    "Re-quote {client} on the phased structure",
    "Send {client} the brochure and the timelines",
    "Price the {client} scheduled substances permit",
  ],
  projects: [
    "Compile the {client} application pack",
    "Check the {client} floor plan against the regulations",
    "Draft the {client} covering letter",
    "Update the {client} site master file",
    "Index the {client} SOPs for submission",
  ],
  meetings: [
    "Site visit at {client}",
    "Pre-inspection walkthrough with {client}",
    "Handover meeting on {client}",
  ],
  admin: [
    "File the {client} proof of payment",
    "Load the {client} details on the authority portal",
    "Reconcile the {client} balance",
    "Archive the {client} correspondence",
  ],
  other: ["Order certified copy stationery", "Renew the portal certificates"],
};

const CATEGORIES = Object.keys(WORK) as TaskCategory[];

/** Push a date onto a working day, since nothing here is due on a Sunday. */
function workingDay(d: Date): Date {
  const day = getISODay(d);
  if (day === 6) return subDays(d, 1);
  if (day === 7) return addDays(d, 1);
  return d;
}

function buildWork(): { tasks: Assignment[]; audit: AuditEvent[] } {
  const tasks: Assignment[] = [];
  const audit: AuditEvent[] = [];
  let n = 0;

  // --- ten weeks of closed work -------------------------------------------
  for (let week = 10; week >= 1; week--) {
    // A quiet week and a busy week look different, which is the point of
    // the chart.
    const count = between(8, 14);
    for (let i = 0; i < count; i++) {
      const category = pick(CATEGORIES);
      const title = pick(WORK[category]).replace("{client}", pick(CLIENTS));
      const who = pick(WORKERS);
      const due = workingDay(subDays(now, week * 7 - between(0, 4)));
      const created = subDays(due, between(1, 4));

      // Four in five close on their date. The rest run over, by a day or
      // two mostly, and this is what the on-time figures are measuring.
      const late = rand() > 0.79;
      const closedDay = late
        ? workingDay(addDays(due, between(1, 4)))
        : subDays(due, between(0, 1));
      // Nothing is closed in the future, however late it ran.
      const closed = atWork(closedDay < now ? closedDay : subDays(now, 1));

      const id = `as_h${++n}`;
      tasks.push({
        id,
        title,
        assigneeIds: [who],
        assignedById: rand() > 0.25 ? PATRICIA : OFFICE,
        createdAt: iso(created),
        dueDate: dayKey(due),
        dueTime: rand() > 0.6 ? pick(["09:00", "11:00", "14:00", "16:00"]) : undefined,
        priority: rand() > 0.85 ? "urgent" : "normal",
        category,
        status: "done",
        completedAt: iso(closed),
        completionNote: late ? pick([
          "Client only came back to me this morning.",
          "Took longer than it should have, done now.",
          "Waited on the authority to answer.",
        ]) : undefined,
      });

      // Only the recent trail: the audit list is read newest first, and
      // three months of task noise buries the project events.
      if (week <= 3) {
        audit.push({
          id: `ae_${id}_a`,
          at: iso(atWork(created, between(8, 10))),
          actorId: PATRICIA,
          type: "task.assigned",
          subject: title,
          detail: `Assigned to ${TEAM.find((u) => u.id === who)!.name}, due ${dayKey(due)}`,
        });
        audit.push({
          id: `ae_${id}_c`,
          at: iso(closed),
          actorId: who,
          type: "task.completed",
          subject: title,
          detail: late ? "Closed after its due date" : "Closed on time",
        });
      }
    }
  }

  // --- and what is open right now -----------------------------------------
  const open: {
    title: string;
    who: string;
    dueDays: number;
    category: TaskCategory;
    priority?: "urgent";
    time?: string;
    detail?: string;
  }[] = [
    {
      title: "Re-quote Gqeberha Compounding at the revised phase split",
      detail: "They pushed back on phase 0. Use the three-phase structure.",
      who: SALES,
      dueDays: 0,
      category: "quotes",
      priority: "urgent",
      time: "15:00",
    },
    {
      title: "Get the Cape Medical site master file updated",
      detail: "SAHPRA will ask for it at the inspection.",
      who: CONSULTANT,
      dueDays: -2,
      category: "projects",
    },
    {
      title: "Invoice the Rondebosch balance",
      detail: "It fell due the day we submitted.",
      who: OFFICE,
      dueDays: 0,
      category: "admin",
    },
    {
      title: "Confirm the Table Bay pre-inspection date",
      detail: "They need two weeks notice before an inspection.",
      who: COORDINATOR,
      dueDays: 0,
      category: "calls",
      time: "09:30",
    },
    {
      title: "Send the Stellenbosch group the scope letter",
      who: SALES,
      dueDays: 1,
      category: "emails",
    },
    {
      title: "Certified copies for the Umhlanga file",
      who: OFFICE,
      dueDays: -1,
      category: "admin",
    },
    {
      title: "Draft the Midrand response to the SAHPRA query",
      who: CONSULTANT,
      dueDays: 2,
      category: "projects",
      priority: "urgent",
    },
    {
      title: "Site visit at Paarl Family Pharmacy",
      who: COORDINATOR,
      dueDays: 3,
      category: "meetings",
      time: "11:00",
    },
  ];

  for (const o of open) {
    const id = `as_o${++n}`;
    const due = workingDay(addDays(now, o.dueDays));
    tasks.push({
      id,
      title: o.title,
      detail: o.detail,
      assigneeIds: [o.who],
      assignedById: PATRICIA,
      createdAt: iso(subHours(now, between(6, 72))),
      dueDate: dayKey(due),
      dueTime: o.time,
      priority: o.priority ?? "normal",
      category: o.category,
      status: "open",
    });
    audit.push({
      id: `ae_${id}_a`,
      at: iso(subHours(now, between(6, 72))),
      actorId: PATRICIA,
      type: "task.assigned",
      subject: o.title,
      detail: `Assigned to ${TEAM.find((u) => u.id === o.who)!.name}, due ${dayKey(due)}`,
    });
  }

  return { tasks, audit };
}

/** The trail every sheet leaves behind, in the order the work happened. */
function sheetAudit(p: Project): AuditEvent[] {
  const service = serviceById(p.serviceId);
  const out: AuditEvent[] = [];
  const subject = `${p.client} · ${service.short}`;

  out.push({
    id: `ae_${p.id}_new`,
    at: `${p.paidAt}T09:05:00.000Z`,
    actorId: OFFICE,
    type: "project.created",
    subject,
    detail: `Sheet opened from the ${p.paidAt} payment. Submission due ${p.dueDate}.`,
  });

  for (const pay of p.payments)
    out.push({
      id: `ae_${p.id}_pay_${pay.id}`,
      at: workish(pay.at, 8),
      actorId: OFFICE,
      type: "payment.received",
      subject,
      detail: `${pay.amount.toLocaleString("en-ZA")} ZAR received · ${pay.note ?? "payment"}`,
    });

  if (p.docsRequestedAt)
    out.push({
      id: `ae_${p.id}_docs`,
      at: workish(p.docsRequestedAt, 9),
      actorId: OFFICE,
      type: "docs.requested",
      subject,
      detail: `Request list of ${p.documents.length} items sent to ${p.clientContact.name}`,
    });

  if (p.docsRemindedAt)
    out.push({
      id: `ae_${p.id}_chase`,
      at: workish(p.docsRemindedAt, 10),
      actorId: CONSULTANT,
      type: "docs.reminded",
      subject,
      detail: `Chased for ${p.documents.filter((d) => !d.received).length} outstanding documents`,
    });

  for (const m of p.milestones.filter((x) => x.done && x.doneAt))
    out.push({
      id: `ae_${p.id}_ms${m.step}`,
      at: workish(m.doneAt!),
      actorId: m.doneBy ?? CONSULTANT,
      type: "milestone.completed",
      subject: `${p.client} · step ${m.step}`,
      detail: m.label,
    });

  if (p.qcRequestedAt)
    out.push({
      id: `ae_${p.id}_qcreq`,
      at: workish(p.qcRequestedAt, 14),
      actorId: CONSULTANT,
      type: "qc.requested",
      subject,
      detail: "Application pack handed up for the QC check before submission",
    });

  if (p.qcApprovedAt)
    out.push({
      id: `ae_${p.id}_qcok`,
      at: workish(p.qcApprovedAt, 16),
      actorId: PATRICIA,
      type: "qc.approved",
      subject,
      detail: "QC signed off, cleared to submit",
    });

  if (p.submittedAt) {
    out.push({
      id: `ae_${p.id}_sub`,
      at: workish(p.submittedAt, 11),
      actorId: COORDINATOR,
      type: "project.submitted",
      subject,
      detail: `Submitted to ${service.authority} via ${p.submittedVia}`,
    });
    out.push({
      id: `ae_${p.id}_inv`,
      at: workish(p.submittedAt, 12),
      actorId: OFFICE,
      type: "balance.invoiced",
      subject,
      detail: "Balance email and invoice sent, due on submission",
    });
  }

  for (const q of p.queries)
    out.push({
      id: `ae_${p.id}_q_${q.id}`,
      at: workish(q.at, 13),
      actorId: COORDINATOR,
      type: "authority.query",
      subject,
      detail: q.detail,
    });

  if (p.lastFollowUpAt)
    out.push({
      id: `ae_${p.id}_fu`,
      at: workish(p.lastFollowUpAt, 9),
      actorId: COORDINATOR,
      type: "authority.followup",
      subject,
      detail: `Followed up ${service.authority} on progress`,
    });

  if (p.outcomeAt)
    out.push({
      id: `ae_${p.id}_out`,
      at: workish(p.outcomeAt, 15),
      actorId: COORDINATOR,
      type: "project.outcome",
      subject,
      detail: `${service.authority} approved the application`,
    });

  return out;
}

async function main() {
  const db = getDb();

  // Start from nothing, so a second run does not leave two of everything.
  // Users are written by id and real seats are never touched.
  await db.delete(authorityQueries);
  await db.delete(projectDocuments);
  await db.delete(projectPayments);
  await db.delete(projectSteps);
  await db.delete(projectsTable);
  await db.delete(assignmentsTable);
  await db.delete(recurringTasks);
  await db.delete(auditTable);
  console.log("cleared  projects, tasks, duties and the trail");

  for (const u of TEAM) {
    await saveUser(u);
    console.log(`seat     ${u.name.padEnd(18)} ${u.workRole}`);
  }

  for (const d of DUTIES) await saveRecurring(d);
  console.log(`duties   ${DUTIES.length} standing duties`);

  // Each sheet is then reconciled with itself exactly as it would be in the
  // app, which is what raises the task for the step it is sitting on and
  // hands it to whoever holds that role.
  let stepTasks: Assignment[] = [];
  const stepAudit: AuditEvent[] = [];
  let k = 0;
  const projects: Project[] = [];

  for (const input of SHEETS) {
    const synced = syncSheet(
      makeSheet(now, input),
      TEAM,
      stepTasks,
      [],
      OFFICE,
      (prefix) => `${prefix}_demo${++k}`,
    );
    projects.push(synced.project);
    stepTasks = synced.assignments;
    stepAudit.push(...synced.audit);
  }

  for (const p of projects) {
    await saveProject(p);
    console.log(
      `sheet    ${p.client.padEnd(26)} ${serviceById(p.serviceId).short}`,
    );
  }

  const { tasks, audit } = buildWork();
  await saveAssignments([...tasks, ...stepTasks]);
  console.log(
    `tasks    ${tasks.length} handed out, ${stepTasks.length} raised by the sheets`,
  );

  const trail = [
    ...audit,
    ...stepAudit,
    ...projects.flatMap(sheetAudit),
  ].sort((a, b) => a.at.localeCompare(b.at));
  await saveAudit(trail);
  console.log(`trail    ${trail.length} entries`);

  console.log("\nThe practice is loaded. Everything in it is invented.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
