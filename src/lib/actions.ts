"use server";

// ---------------------------------------------------------------------------
// Every change to the practice's data happens here.
//
// The rules themselves live in lib/services.ts and lib/sheet.ts as pure
// functions, exactly as they did when this was a browser-only prototype. An
// action's job is to say who is acting, load what the rule needs, apply it,
// write the result, and hand the caller the workspace back so the screen it
// came from can move on.
//
// Each one returns the whole workspace rather than a patch: a practice runs
// tens of projects, so one read is cheaper than the bugs that come from two
// copies of the truth drifting apart.
// ---------------------------------------------------------------------------

import { isoWeekday, dayKey } from "./date";
import {
  loadWorkspace,
  deleteRecurring,
  saveAssignments,
  saveAudit,
  saveLead,
  saveProject,
  saveRecurring,
  saveUser,
  deleteAssignment,
  deleteProject,
  reassignProjectsTo,
  wipeUser,
  type Workspace,
} from "@/db/queries";
import { clerkClient } from "@clerk/nextjs/server";
import { canOpenProjects, canSignOffQc, requireActor } from "./auth";
import { entry, gateBlockedReason, syncSheet } from "./sheet";
import {
  allDocumentsIn,
  buildDocuments,
  buildSteps,
  isFinalPhase,
  paidToDate,
  phaseBalance,
  phaseOf,
  serviceById,
  submissionDue,
} from "./services";
import { nameList } from "./text";
import { invite, type InviteResult } from "./invite";
import {
  sendBalanceEmail,
  sendChaseEmail,
  sendDocumentRequestEmail,
  sendOutcomeEmail,
  sendQcWaitingEmail,
  sendQcReturnedEmail,
  sendReceiptEmail,
  sendSubmittedEmail,
  sendTaskAssignedEmail,
  sendTaskReminderEmail,
  sendWelcomeEmail,
} from "./email";
import type {
  ActivityKind,
  Assignment,
  AssignmentPriority,
  AuditType,
  ClientContact,
  Lead,
  LeadChannel,
  LeadStage,
  Project,
  ProjectStatus,
  TaskCategory,
  User,
  WorkRole,
} from "./types";

const uid = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

/** Avatar and chart colours, handed out in order so nobody clashes. */
const TINTS = [
  "#4f46e5",
  "#0d9488",
  "#c2410c",
  "#7c3aed",
  "#be123c",
  "#0369a1",
  "#a16207",
  "#15803d",
] as const;

export async function getWorkspace(): Promise<Workspace> {
  await requireActor();
  return loadWorkspace();
}

/** Client mail replies to the consultant carrying the project. */
function replyToOwner(ws: Workspace, project: Project): string | undefined {
  return ws.users.find((u) => u.id === project.ownerId && !u.archivedAt)?.email;
}

type Change = (
  p: Project,
  me: User,
) => { project: Project; entries?: [AuditType, string, string][] } | null;

/**
 * Change one project, write the trail, then let the sheet reconcile itself.
 * A guard that returns null leaves the database exactly as it was.
 */
async function onProject(projectId: string, change: Change): Promise<Workspace> {
  const me = await requireActor();
  const ws = await loadWorkspace();
  const project = ws.projects.find((p) => p.id === projectId);
  if (!project) return ws;

  const result = change(project, me);
  if (!result) return ws;

  const fresh = (result.entries ?? []).map(([type, subject, detail]) =>
    entry(uid("ae"), me.id, type, subject, detail),
  );

  const synced = syncSheet(
    result.project,
    ws.users,
    ws.assignments.filter((a) => a.projectId === projectId),
    fresh,
    me.id,
    uid,
  );

  await saveProject(synced.project);
  await saveAssignments(synced.assignments);
  await saveAudit(synced.audit);

  // A step handed on is work arriving on somebody's list, so they are told
  // the same way they would be for anything handed out by name.
  await tellNewAssignees(ws.assignments, synced.assignments, ws.users, me, synced.project);

  return loadWorkspace();
}

/** Email whoever just picked up a task that did not exist a moment ago. */
async function tellNewAssignees(
  before: Assignment[],
  after: Assignment[],
  users: User[],
  assigner: User,
  project?: Project,
) {
  const known = new Set(before.map((a) => a.id));
  const fresh = after.filter((a) => !known.has(a.id) && a.status === "open");

  for (const task of fresh) {
    for (const person of users.filter(
      (u) => task.assigneeIds.includes(u.id) && !u.archivedAt,
    )) {
      await sendTaskAssignedEmail(person, task, assigner, project);
    }
  }
}

// --- opening a project -----------------------------------------------------

export async function intakeProject(input: {
  serviceId: string;
  client: string;
  clientContact: ClientContact;
  ownerId: string;
  fee: number;
  amountPaid: number;
  /** "yyyy-MM-dd". The day the money came in, not the day this was typed. */
  paidAt: string;
  name?: string;
  /** The inquiry this came from, where it came through the pipeline. */
  leadId?: string;
}): Promise<Workspace> {
  const me = await requireActor();
  if (!canOpenProjects(me)) return loadWorkspace();
  if (!input.client.trim() || !input.paidAt) return loadWorkspace();

  const ws = await loadWorkspace();
  const service = serviceById(input.serviceId);
  const id = uid("pj");

  const project: Project = {
    id,
    name: input.name?.trim() || service.name,
    client: input.client.trim(),
    clientContact: input.clientContact,
    serviceId: service.id,
    ownerId: input.ownerId,
    status: "active",
    dueDate: submissionDue(service, input.paidAt),
    milestones: buildSteps(service, input.paidAt, `${id}_p0`),
    paidAt: input.paidAt,
    fee: input.fee,
    payments:
      input.amountPaid > 0
        ? [
            {
              id: uid("pay"),
              at: new Date(`${input.paidAt}T12:00:00`).toISOString(),
              amount: input.amountPaid,
              phase: 0,
              note: "Payment on intake",
            },
          ]
        : [],
    phase: 0,
    documents: buildDocuments(service, `${id}_p0`),
    docChases: 0,
    qcReturns: 0,
    queries: [],
  };

  const balance = phaseBalance(project);
  const fresh = [
    entry(
      uid("ae"),
      me.id,
      "payment.received",
      project.client,
      `${input.amountPaid.toLocaleString("en-ZA")} ZAR received on ${input.paidAt} against a fee of ${input.fee.toLocaleString("en-ZA")} ZAR`,
    ),
    entry(
      uid("ae"),
      me.id,
      "project.created",
      `${service.short} · ${project.client}`,
      `Sheet opened from the ${input.paidAt} payment. ${service.name} to ${service.authority}, submission due ${project.dueDate}${balance > 0 ? `, ${balance.toLocaleString("en-ZA")} ZAR outstanding` : ""}`,
    ),
  ];

  const synced = syncSheet(project, ws.users, [], fresh, me.id, uid);
  await saveProject(synced.project);
  await saveAssignments(synced.assignments);
  await saveAudit(synced.audit);
  await tellNewAssignees([], synced.assignments, ws.users, me, synced.project);

  // Where it came through the pipeline, the lead closes as won and points at
  // the sheet, so steps 1 to 4 and steps 5 to 10 are one record rather than
  // two lists that have to be reconciled by hand.
  const lead = input.leadId
    ? ws.leads.find((l) => l.id === input.leadId)
    : undefined;
  if (lead) {
    const closedAt = new Date().toISOString();
    await saveLead({
      ...lead,
      stage: "won",
      closedAt: lead.closedAt ?? closedAt,
      projectId: id,
      lastActivityAt: closedAt,
      activity: [
        {
          id: uid("la"),
          at: closedAt,
          kind: "stage_change",
          detail: `Paid. Project sheet opened, submission due ${project.dueDate}.`,
          byUserId: me.id,
        },
        ...lead.activity,
      ],
    });
    await saveAudit([
      entry(
        uid("ae"),
        me.id,
        "lead.converted",
        lead.company,
        `Won after ${Math.max(Math.round((Date.parse(closedAt) - Date.parse(lead.createdAt)) / 86400000), 0)} days. ${service.short} sheet opened for ${project.client}.`,
      ),
    ]);
  }
  return loadWorkspace();
}

// --- steps 1 to 4, before there is a project ------------------------------
//
// The sales side of the chart: where they came from, the questionnaire and
// the consultation, and the quote. None of it has a project sheet yet, so it
// lives on the lead, and the clocks on it are the ones in lib/rules.ts: four
// hours to answer an inquiry, three days to chase a quote.

/** Step 1. Something came in, and from this moment it is being counted. */
export async function addLead(input: {
  company: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  channel: LeadChannel;
  serviceId?: string;
  ownerId: string;
  value: number;
  /** What they asked for, in their words, kept as the first activity. */
  detail?: string;
}): Promise<Workspace> {
  const me = await requireActor();
  if (!input.company.trim()) return loadWorkspace();

  const ws = await loadWorkspace();
  const owner = ws.users.find((u) => u.id === input.ownerId && !u.archivedAt);
  const at = new Date().toISOString();
  const id = uid("ld");
  const detail = input.detail?.trim();

  const lead: Lead = {
    id,
    company: input.company.trim(),
    contactName: input.contactName.trim() || "Unknown contact",
    contactEmail: input.contactEmail?.trim().toLowerCase() || undefined,
    contactPhone: input.contactPhone?.trim() || undefined,
    channel: input.channel,
    serviceId: input.serviceId,
    ownerId: owner?.id ?? me.id,
    stage: "inquiry",
    value: Math.max(Math.round(input.value), 0),
    createdAt: at,
    lastActivityAt: at,
    activity: detail
      ? [{ id: uid("la"), at, kind: "note", detail, byUserId: me.id }]
      : [],
  };

  await saveLead(lead);
  await saveAudit([
    entry(
      uid("ae"),
      me.id,
      "lead.created",
      lead.company,
      `${lead.channel.replace("_", " ")} inquiry logged for ${owner?.name ?? me.name}${lead.value > 0 ? `, worth about ${lead.value.toLocaleString("en-ZA")} ZAR` : ""}`,
    ),
  ]);
  return loadWorkspace();
}

/** Any touch at all. The first one is what stops the four-hour clock. */
export async function logLeadActivity(
  leadId: string,
  kind: ActivityKind,
  detail: string,
): Promise<Workspace> {
  const me = await requireActor();
  const clean = detail.trim();
  const ws = await loadWorkspace();
  const lead = ws.leads.find((l) => l.id === leadId);
  if (!lead || !clean) return ws;

  const at = new Date().toISOString();
  const first = !lead.firstResponseAt;

  await saveLead({
    ...lead,
    lastActivityAt: at,
    firstResponseAt: lead.firstResponseAt ?? at,
    activity: [
      { id: uid("la"), at, kind, detail: clean, byUserId: me.id },
      ...lead.activity,
    ],
  });
  await saveAudit([
    entry(
      uid("ae"),
      me.id,
      first ? "lead.responded" : "lead.activity",
      lead.company,
      first
        ? `First reply, ${Math.max(Math.round((Date.parse(at) - Date.parse(lead.createdAt)) / 3600000), 0)}h after the inquiry landed: ${clean}`
        : `${kind.replace("_", " ")}: ${clean}`,
    ),
  ]);
  return loadWorkspace();
}

/** Step 4. The quote goes out and the three-day follow-up clock starts. */
export async function sendQuote(
  leadId: string,
  value: number,
  detail: string,
): Promise<Workspace> {
  const me = await requireActor();
  const ws = await loadWorkspace();
  const lead = ws.leads.find((l) => l.id === leadId);
  if (!lead) return ws;

  const at = new Date().toISOString();
  const amount = Math.max(Math.round(value), 0);
  const clean = detail.trim() || "Quote sent.";

  await saveLead({
    ...lead,
    stage: "quoted",
    value: amount,
    quoteSentAt: at,
    lastActivityAt: at,
    firstResponseAt: lead.firstResponseAt ?? at,
    activity: [
      { id: uid("la"), at, kind: "quote_sent", detail: clean, byUserId: me.id },
      ...lead.activity,
    ],
  });
  await saveAudit([
    entry(
      uid("ae"),
      me.id,
      "lead.quote_sent",
      lead.company,
      `${amount.toLocaleString("en-ZA")} ZAR quoted. ${clean}`,
    ),
  ]);
  return loadWorkspace();
}

/** Won, lost, or somewhere in between. Closing one stops every clock on it. */
export async function setLeadStage(
  leadId: string,
  stage: LeadStage,
): Promise<Workspace> {
  const me = await requireActor();
  const ws = await loadWorkspace();
  const lead = ws.leads.find((l) => l.id === leadId);
  if (!lead || lead.stage === stage) return ws;

  const at = new Date().toISOString();
  const closing = stage === "won" || stage === "lost";

  await saveLead({
    ...lead,
    stage,
    lastActivityAt: at,
    closedAt: closing ? (lead.closedAt ?? at) : undefined,
    activity: [
      {
        id: uid("la"),
        at,
        kind: "stage_change",
        detail: `Moved from ${lead.stage} to ${stage}.`,
        byUserId: me.id,
      },
      ...lead.activity,
    ],
  });
  await saveAudit([
    entry(
      uid("ae"),
      me.id,
      "lead.stage_changed",
      lead.company,
      `${lead.stage} to ${stage}${stage === "won" ? ". Open the sheet when the payment lands." : ""}`,
    ),
  ]);
  return loadWorkspace();
}

// --- step 5, telling the client we have started ---------------------------

/**
 * Step 5 of the chart. Acknowledging the client is the step: it sets the date
 * it happened, which is what closes the step, and the letter goes with it so
 * the two cannot come apart.
 */
export async function acknowledgeClient(projectId: string): Promise<Workspace> {
  const ws = await onProject(projectId, (p) => {
    if (p.acknowledgedAt) return null;
    return {
      project: { ...p, acknowledgedAt: new Date().toISOString() },
      entries: [
        [
          "client.acknowledged",
          `${p.client} · step 5`,
          `Acknowledgement and guidelines sent to ${p.clientContact.name} (${p.clientContact.email}), submission date ${p.dueDate}`,
        ],
      ],
    };
  });

  const project = ws.projects.find((x) => x.id === projectId);
  if (project?.acknowledgedAt) {
    const consultant = ws.users.find(
      (u) => u.id === project.ownerId && !u.archivedAt,
    );
    await sendWelcomeEmail(project, consultant);
  }
  return ws;
}

// --- step 6, the client's documents ---------------------------------------

export async function requestDocuments(projectId: string): Promise<Workspace> {
  const ws = await onProject(projectId, (p) => {
    if (p.docsRequestedAt) return null;
    return {
      project: { ...p, docsRequestedAt: new Date().toISOString() },
      entries: [
        [
          "docs.requested",
          p.client,
          `Request list of ${p.documents.length} items sent to ${p.clientContact.name} (${p.clientContact.email})`,
        ],
      ],
    };
  });

  const project = ws.projects.find((p) => p.id === projectId);
  if (project?.docsRequestedAt) {
    await sendDocumentRequestEmail(project, replyToOwner(ws, project));
  }
  return ws;
}

/** Chasing the client. Recorded, because "we did ask" has to be provable. */
export async function remindClient(projectId: string): Promise<Workspace> {
  const before = await loadWorkspace();
  const target = before.projects.find((p) => p.id === projectId);
  const shouldSend =
    !!target?.docsRequestedAt && !allDocumentsIn(target);

  const ws = await onProject(projectId, (p) => {
    if (!p.docsRequestedAt || allDocumentsIn(p)) return null;
    const missing = p.documents.filter((d) => !d.received);
    return {
      project: {
        ...p,
        docsRemindedAt: new Date().toISOString(),
        docChases: p.docChases + 1,
      },
      entries: [
        [
          "docs.reminded",
          p.client,
          `Chase ${p.docChases + 1} sent to ${p.clientContact.name} for ${missing.length} outstanding item${missing.length === 1 ? "" : "s"}`,
        ],
      ],
    };
  });

  const after = ws.projects.find((p) => p.id === projectId);
  if (shouldSend && after) await sendChaseEmail(after, replyToOwner(ws, after));
  return ws;
}

export async function toggleDocument(
  projectId: string,
  documentId: string,
): Promise<Workspace> {
  return onProject(projectId, (p) => {
    const doc = p.documents.find((d) => d.id === documentId);
    if (!doc) return null;
    const at = new Date().toISOString();
    const received = !doc.received;
    const documents = p.documents.map((d) =>
      d.id !== documentId
        ? d
        : { ...d, received, receivedAt: received ? at : undefined },
    );
    const complete = documents.every((d) => d.received);
    return {
      project: { ...p, documents },
      entries: received
        ? [
            [
              "docs.received",
              p.client,
              complete
                ? `${doc.label} received. Every requested document is now in.`
                : `${doc.label} received. ${documents.filter((d) => !d.received).length} still outstanding.`,
            ],
          ]
        : [],
    };
  });
}

export async function addDocumentRequest(
  projectId: string,
  label: string,
): Promise<Workspace> {
  return onProject(projectId, (p) => {
    const clean = label.trim();
    if (!clean) return null;
    return {
      project: {
        ...p,
        documents: [
          ...p.documents,
          { id: uid("doc"), label: clean, received: false, extra: true },
        ],
      },
      entries: [
        [
          "docs.requested",
          p.client,
          `Added to the request list for this project only: ${clean}`,
        ],
      ],
    };
  });
}

export async function removeDocumentRequest(
  projectId: string,
  documentId: string,
): Promise<Workspace> {
  return onProject(projectId, (p) => ({
    project: {
      ...p,
      documents: p.documents.filter((d) => d.id !== documentId),
    },
  }));
}

// --- steps 7 and 8, compiling and QC --------------------------------------

export async function requestQc(projectId: string): Promise<Workspace> {
  const ws = await onProject(projectId, (p) => {
    if (p.qcRequestedAt) return null;
    return {
      project: { ...p, qcRequestedAt: new Date().toISOString() },
      entries: [
        [
          "qc.requested",
          `${p.client} · step 8 QC`,
          p.qcReturns > 0
            ? `Corrected and resent for QC, attempt ${p.qcReturns + 1}`
            : "Application pack handed up for the QC check before submission",
        ],
      ],
    };
  });

  const project = ws.projects.find((p) => p.id === projectId);
  // "It could tell me by email, hey, you have a QC to check."
  if (project?.qcRequestedAt) {
    const owner = ws.users.find((u) => u.workRole === "owner" && !u.archivedAt);
    if (owner) await sendQcWaitingEmail(project, owner);
  }
  return ws;
}

export async function approveQc(
  projectId: string,
  note?: string,
): Promise<Workspace> {
  return onProject(projectId, (p, me) => {
    if (!canSignOffQc(me)) return null;
    if (!p.qcRequestedAt || p.qcApprovedAt) return null;
    return {
      project: {
        ...p,
        qcApprovedAt: new Date().toISOString(),
        qcApprovedBy: me.id,
      },
      entries: [
        [
          "qc.approved",
          `${p.client} · step 8 QC`,
          note?.trim() || "Checked and cleared for submission",
        ],
      ],
    };
  });
}

/** Step 8's other outcome: back to the consultant to correct and resend. */
export async function returnQc(
  projectId: string,
  note: string,
): Promise<Workspace> {
  const ws = await returnQcInner(projectId, note);

  // The note is the whole point, so it travels by email as well as sitting
  // on the sheet.
  const project = ws.projects.find((p) => p.id === projectId);
  if (project?.qcReturnedAt) {
    const consultant = ws.users.find((u) => u.id === project.ownerId);
    const owner = ws.users.find((u) => u.workRole === "owner" && !u.archivedAt);
    if (consultant) {
      await sendQcReturnedEmail(
        consultant,
        project,
        project.qcReturnNote ?? note,
        owner,
      );
    }
  }
  return ws;
}

function returnQcInner(projectId: string, note: string): Promise<Workspace> {
  return onProject(projectId, (p, me) => {
    if (!canSignOffQc(me)) return null;
    if (!p.qcRequestedAt || p.qcApprovedAt) return null;
    const clean = note.trim();
    if (!clean) return null;
    return {
      project: {
        ...p,
        qcRequestedAt: undefined,
        qcReturnedAt: new Date().toISOString(),
        qcReturnNote: clean,
        qcReturns: p.qcReturns + 1,
      },
      entries: [
        [
          "qc.returned",
          `${p.client} · step 8 QC`,
          `Sent back to be corrected and resent: ${clean}`,
        ],
      ],
    };
  });
}

// --- steps 9 and 10, submission and the balance ---------------------------

export async function submitToAuthority(
  projectId: string,
  via?: string,
): Promise<Workspace> {
  const ws = await onProject(projectId, (p) => {
    // Nothing goes out unchecked, and nothing goes out twice.
    if (!p.qcApprovedAt || p.submittedAt) return null;
    const at = new Date().toISOString();
    const service = serviceById(p.serviceId);
    const balance = phaseBalance(p);
    const late = dayKey(at) > p.dueDate;
    return {
      project: { ...p, submittedAt: at, submittedVia: via?.trim() || undefined },
      entries: [
        [
          "project.submitted",
          `${p.client} · step 9`,
          `Submitted to ${service.authority}${via?.trim() ? ` via ${via.trim()}` : ""}. Due ${p.dueDate}, submitted ${dayKey(at)}${late ? " (late)" : " (on time)"}.${balance > 0 ? ` ${balance.toLocaleString("en-ZA")} ZAR balance now due.` : ""}`,
        ],
      ],
    };
  });

  // Where a balance is owed, step 10's invoice carries the news that we
  // submitted. Where there is none, step 10 closes itself and this is the
  // only thing that will ever tell the client their application went in.
  const project = ws.projects.find((p) => p.id === projectId);
  if (project?.submittedAt && phaseBalance(project) === 0) {
    await sendSubmittedEmail(project, replyToOwner(ws, project));
  }
  return ws;
}

export async function sendBalanceInvoice(
  projectId: string,
): Promise<Workspace> {
  const ws = await onProject(projectId, (p) => {
    if (!p.submittedAt || p.invoicedAt) return null;
    return {
      project: { ...p, invoicedAt: new Date().toISOString() },
      entries: [
        [
          "balance.invoiced",
          `${p.client} · step 10`,
          `Balance email sent to ${p.clientContact.name} for ${phaseBalance(p).toLocaleString("en-ZA")} ZAR`,
        ],
      ],
    };
  });

  const project = ws.projects.find((p) => p.id === projectId);
  if (project?.invoicedAt) {
    const admin = ws.users.find(
      (u) => u.workRole === "admin" && !u.archivedAt,
    );
    await sendBalanceEmail(project, admin?.email);
  }
  return ws;
}

export async function recordPayment(
  projectId: string,
  amount: number,
  note?: string,
): Promise<Workspace> {
  const paymentId = uid("pay");
  const ws = await onProject(projectId, (p) => {
    if (!(amount > 0)) return null;
    const payments = [
      ...p.payments,
      {
        id: paymentId,
        at: new Date().toISOString(),
        amount: Math.round(amount),
        phase: p.phase,
        note: note?.trim() || undefined,
      },
    ];
    const left = phaseBalance({ ...p, payments });
    return {
      project: { ...p, payments },
      entries: [
        [
          "payment.received",
          p.client,
          `${Math.round(amount).toLocaleString("en-ZA")} ZAR received against ${phaseOf(p).label}. ${left > 0 ? `${left.toLocaleString("en-ZA")} ZAR still outstanding.` : "Phase settled."}`,
        ],
      ],
    };
  });

  // Receipted the moment it is recorded. A client who has just paid a balance
  // should not have to ask whether it arrived.
  const project = ws.projects.find((x) => x.id === projectId);
  if (project?.payments.some((y) => y.id === paymentId)) {
    await sendReceiptEmail(
      project,
      { id: paymentId, amount: Math.round(amount) },
      replyToOwner(ws, project),
    );
  }
  return ws;
}

// --- while the authority has it -------------------------------------------

export async function addAuthorityQuery(
  projectId: string,
  detail: string,
): Promise<Workspace> {
  return onProject(projectId, (p) => {
    const clean = detail.trim();
    if (!clean) return null;
    return {
      project: {
        ...p,
        queries: [
          { id: uid("q"), at: new Date().toISOString(), detail: clean },
          ...p.queries,
        ],
      },
      entries: [
        [
          "authority.query",
          `${p.client} · ${serviceById(p.serviceId).authority}`,
          clean,
        ],
      ],
    };
  });
}

export async function clearAuthorityQuery(
  projectId: string,
  queryId: string,
): Promise<Workspace> {
  return onProject(projectId, (p) => {
    const q = p.queries.find((x) => x.id === queryId);
    if (!q || q.clearedAt) return null;
    return {
      project: {
        ...p,
        queries: p.queries.map((x) =>
          x.id !== queryId ? x : { ...x, clearedAt: new Date().toISOString() },
        ),
      },
      entries: [["authority.query", `${p.client} · query cleared`, q.detail]],
    };
  });
}

export async function logAuthorityFollowUp(
  projectId: string,
  detail: string,
): Promise<Workspace> {
  return onProject(projectId, (p) => {
    if (!p.submittedAt) return null;
    return {
      project: { ...p, lastFollowUpAt: new Date().toISOString() },
      entries: [
        [
          "authority.followup",
          `${p.client} · ${serviceById(p.serviceId).authority}`,
          detail.trim() || "Followed up, nothing new to report",
        ],
      ],
    };
  });
}

export async function recordOutcome(
  projectId: string,
  outcome: "approved" | "declined",
): Promise<Workspace> {
  const ws = await onProject(projectId, (p) => {
    if (!p.submittedAt || p.outcomeAt) return null;
    const service = serviceById(p.serviceId);
    const finished = isFinalPhase(p) || outcome === "declined";
    return {
      project: {
        ...p,
        outcome,
        outcomeAt: new Date().toISOString(),
        status: finished ? "complete" : p.status,
      },
      entries: [
        [
          "project.outcome",
          `${p.client} · ${service.short}`,
          `${service.authority} ${outcome === "approved" ? "approved" : "declined"} the application`,
        ],
      ],
    };
  });

  const project = ws.projects.find((x) => x.id === projectId);
  if (project?.outcomeAt && project.outcome === outcome) {
    await sendOutcomeEmail(project, outcome, replyToOwner(ws, project));
  }
  return ws;
}

/**
 * Bigger applications run in phases, quoted in equal amounts. Moving on
 * starts a fresh sheet for the next phase and leaves the closed one behind it
 * in the trail.
 */
export async function advancePhase(projectId: string): Promise<Workspace> {
  return onProject(projectId, (p) => {
    if (isFinalPhase(p) || !p.submittedAt) return null;
    const service = serviceById(p.serviceId);
    const phase = p.phase + 1;
    const paidAt = dayKey(new Date());
    return {
      project: {
        ...p,
        phase,
        paidAt,
        dueDate: submissionDue(service, paidAt),
        milestones: buildSteps(service, paidAt, `${p.id}_p${phase}`),
        docsRequestedAt: undefined,
        docsRemindedAt: undefined,
        docChases: 0,
        qcRequestedAt: undefined,
        qcApprovedAt: undefined,
        qcApprovedBy: undefined,
        qcReturnedAt: undefined,
        qcReturnNote: undefined,
        qcReturns: 0,
        submittedAt: undefined,
        submittedVia: undefined,
        invoicedAt: undefined,
        lastFollowUpAt: undefined,
        outcome: undefined,
        outcomeAt: undefined,
        status: "active",
      },
      entries: [
        [
          "phase.advanced",
          `${p.client} · ${service.short}`,
          `Moved to ${phaseOf(p, phase).label}. Submission due ${submissionDue(service, paidAt)}.`,
        ],
      ],
    };
  });
}

export async function setProjectStatus(
  projectId: string,
  status: ProjectStatus,
): Promise<Workspace> {
  return onProject(projectId, (p) =>
    p.status === status
      ? null
      : {
          project: { ...p, status },
          entries: [
            [
              "project.status",
              `${p.client} · ${serviceById(p.serviceId).short}`,
              `Status changed from ${p.status.replace("_", " ")} to ${status.replace("_", " ")}`,
            ],
          ],
        },
  );
}

/**
 * Delete a project sheet, which is management's to do.
 *
 * Everything on the sheet goes: its steps, the document request list, the
 * payments recorded against it, the authority's queries and the tasks it
 * raised. What survives is the audit trail and the record of every email it
 * sent, because those are the proof that the work happened and are not a
 * project's to take with it.
 *
 * There is no undo. A project that is finished should be left complete rather
 * than deleted; this is for the ones opened by mistake.
 */
export async function deleteProjectSheet(
  projectId: string,
): Promise<{ workspace: Workspace; message: string }> {
  const me = await requireActor();
  const ws = await loadWorkspace();
  const project = ws.projects.find((p) => p.id === projectId);

  if (me.role !== "admin")
    return { workspace: ws, message: "Only management can delete a project." };
  if (!project)
    return { workspace: ws, message: "That project is already gone." };

  const service = serviceById(project.serviceId);
  const paid = paidToDate(project);

  const { tasksDeleted } = await deleteProject(projectId);

  await saveAudit([
    entry(
      uid("ae"),
      me.id,
      "project.deleted",
      `${project.client} · ${service.short}`,
      `Deleted by ${me.name}. Opened from the ${project.paidAt} payment, ${
        project.submittedAt
          ? `submitted ${project.submittedAt.slice(0, 10)}`
          : "never submitted"
      }, ${paid.toLocaleString("en-ZA")} ZAR received, ${project.documents.filter((d) => d.received).length} of ${project.documents.length} documents in. ${tasksDeleted} task${tasksDeleted === 1 ? "" : "s"} removed with it.`,
    ),
  ]);

  return {
    workspace: await loadWorkspace(),
    message: `${project.client} is deleted, along with ${tasksDeleted} task${tasksDeleted === 1 ? "" : "s"} it had raised. The audit trail and the record of emails sent are kept.`,
  };
}

/** A step with no action of its own: whoever holds it says it is done. */
export async function completeStep(
  projectId: string,
  stepId: string,
): Promise<Workspace> {
  return onProject(projectId, (p, me) => {
    const step = p.milestones.find((m) => m.id === stepId);
    if (!step || step.done) return null;
    const at = new Date().toISOString();
    return {
      project: {
        ...p,
        milestones: p.milestones.map((m) =>
          m.id !== stepId ? m : { ...m, done: true, doneAt: at, doneBy: me.id },
        ),
      },
      entries: [
        [
          "milestone.completed",
          `${p.client} · step ${step.step}`,
          `${step.label} (due ${step.dueDate})`,
        ],
      ],
    };
  });
}

// --- work handed out by name ----------------------------------------------

export async function assignTask(input: {
  title: string;
  detail?: string;
  assigneeIds: string[];
  dueDate: string;
  dueTime?: string;
  priority: AssignmentPriority;
  category: TaskCategory;
}): Promise<{ workspace: Workspace; failed: string[] }> {
  const me = await requireActor();
  // Handing work out is a management action.
  if (me.role !== "admin")
    return { workspace: await loadWorkspace(), failed: [] };

  const ws = await loadWorkspace();
  const assignees = ws.users.filter(
    (u) => input.assigneeIds.includes(u.id) && !u.archivedAt,
  );
  if (!input.title.trim() || assignees.length === 0)
    return { workspace: ws, failed: [] };

  const task: Assignment = {
    id: uid("as"),
    title: input.title.trim(),
    detail: input.detail?.trim() || undefined,
    assigneeIds: assignees.map((u) => u.id),
    assignedById: me.id,
    createdAt: new Date().toISOString(),
    dueDate: input.dueDate,
    dueTime: input.dueTime,
    priority: input.priority,
    category: input.category,
    status: "open",
  };

  await saveAssignments([task]);
  await saveAudit([
    entry(
      uid("ae"),
      me.id,
      "task.assigned",
      task.title,
      `Assigned to ${nameList(assignees.map((u) => u.name))}, due ${task.dueDate}${task.dueTime ? ` at ${task.dueTime}` : ""}${task.priority === "urgent" ? ", marked urgent" : ""}`,
    ),
  ]);

  // Told, not just recorded, and the caller finds out which of those
  // happened: a task nobody was emailed about is worth knowing at the moment
  // it is created, not a day later.
  const failed: string[] = [];
  for (const person of assignees) {
    const { sent, error } = await sendTaskAssignedEmail(person, task, me);
    if (!sent) failed.push(`${person.name.split(" ")[0]} (${error ?? "unknown error"})`);
  }

  return { workspace: await loadWorkspace(), failed };
}

export async function completeAssignment(
  id: string,
  note?: string,
): Promise<Workspace> {
  const me = await requireActor();
  const ws = await loadWorkspace();
  const task = ws.assignments.find((a) => a.id === id);
  if (!task || task.status === "done") return ws;

  // A task standing for a project step is closed by the work behind it, never
  // by ticking it here. Closing it by hand used to close the task, reopen the
  // step underneath and raise a duplicate, so it is refused with the sentence
  // that says what would actually close it.
  if (task.stepId && task.projectId) {
    const project = ws.projects.find((x) => x.id === task.projectId);
    const step = project?.milestones.find((m) => m.id === task.stepId);
    if (project && step) {
      const blocked = gateBlockedReason(step, project);
      if (blocked) throw new Error(blocked);
    }
  }

  const at = new Date().toISOString();
  await saveAssignments([
    {
      ...task,
      status: "done",
      completedAt: at,
      completionNote: note?.trim() || undefined,
    },
  ]);
  await saveAudit([
    entry(
      uid("ae"),
      me.id,
      "task.completed",
      task.title,
      note?.trim() || `Marked done (due ${task.dueDate})`,
    ),
  ]);

  // Closing the task behind a project step is the same as closing the step.
  if (task.stepId && task.projectId) {
    return completeStep(task.projectId, task.stepId);
  }
  return loadWorkspace();
}

export async function reopenAssignment(id: string): Promise<Workspace> {
  await requireActor();
  const ws = await loadWorkspace();
  const task = ws.assignments.find((a) => a.id === id);
  if (!task) return ws;
  await saveAssignments([
    {
      ...task,
      status: "open",
      completedAt: undefined,
      completionNote: undefined,
    },
  ]);
  return loadWorkspace();
}

/**
 * Management chasing an open task. It sends the nudge and records that it
 * did: recording it without sending it is how somebody ends up being chased
 * in the trail and never told in real life.
 */
export async function remindAssignment(
  id: string,
): Promise<{ workspace: Workspace; failed: string[] }> {
  const me = await requireActor();
  const ws = await loadWorkspace();
  const task = ws.assignments.find((a) => a.id === id);
  if (!task || task.status === "done")
    return { workspace: ws, failed: [] };

  const people = ws.users.filter(
    (u) => task.assigneeIds.includes(u.id) && !u.archivedAt,
  );
  // Nobody left to remind is not a success. It happens when the person the
  // task was given to has since been removed from the team.
  if (people.length === 0)
    return {
      workspace: ws,
      failed: ["nobody: whoever this was given to is no longer on the team"],
    };

  const project = task.projectId
    ? ws.projects.find((p) => p.id === task.projectId)
    : undefined;

  const failed: string[] = [];
  const reached: string[] = [];
  for (const person of people) {
    const { sent, error } = await sendTaskReminderEmail(
      person,
      task,
      me,
      project,
    );
    if (sent) reached.push(person.name);
    else failed.push(`${person.name.split(" ")[0]} (${error ?? "unknown error"})`);
  }

  await saveAssignments([{ ...task, remindedAt: new Date().toISOString() }]);
  await saveAudit([
    entry(
      uid("ae"),
      me.id,
      "task.reminded",
      task.title,
      reached.length > 0
        ? `Emailed ${nameList(reached)} (due ${task.dueDate})`
        : `Tried to remind ${nameList(people.map((u) => u.name))}, but no email could be sent`,
    ),
  ]);
  return { workspace: await loadWorkspace(), failed };
}

/**
 * Delete a task outright, which is management's to do and nobody else's.
 *
 * Two kinds refuse, and say why rather than letting somebody watch a task
 * they deleted come straight back:
 *
 *   a project step  the sheet owns it. It closes when the step closes, and
 *                   deleting it would only make the sheet raise it again.
 *   a standing duty  today's copy can go, but tomorrow's will arrive unless
 *                    the duty itself is paused, so the message says so.
 */
export async function deleteTask(
  id: string,
): Promise<{ workspace: Workspace; message: string }> {
  const me = await requireActor();
  const ws = await loadWorkspace();
  const task = ws.assignments.find((a) => a.id === id);

  if (me.role !== "admin")
    return { workspace: ws, message: "Only management can delete a task." };
  if (!task) return { workspace: ws, message: "That task is already gone." };

  if (task.stepId) {
    const project = ws.projects.find((p) => p.id === task.projectId);
    return {
      workspace: ws,
      message: `This is step ${task.title.toLowerCase()} on ${project?.client ?? "a project sheet"}. The sheet owns it, so it closes when the step closes rather than being deleted.`,
    };
  }

  await deleteAssignment(id);
  await saveAudit([
    entry(
      uid("ae"),
      me.id,
      "task.deleted",
      task.title,
      `Deleted by ${me.name}. It was ${task.status === "done" ? "closed" : `open, due ${task.dueDate}`}, and had been with ${nameList(
        ws.users
          .filter((u) => task.assigneeIds.includes(u.id))
          .map((u) => u.name),
      )}.`,
    ),
  ]);

  const duty = task.recurringId
    ? ws.recurring.find((r) => r.id === task.recurringId)
    : undefined;

  return {
    workspace: await loadWorkspace(),
    message: duty
      ? `Deleted. "${duty.title}" is a standing duty, so it will appear again on its next day unless you pause it under Employees.`
      : `"${task.title}" is deleted. It stays in the audit trail.`,
  };
}

// --- standing duties -------------------------------------------------------

export async function addRecurringTask(input: {
  title: string;
  detail?: string;
  assigneeIds: string[];
  weekdays: number[];
  dueTime?: string;
  category: TaskCategory;
}): Promise<Workspace> {
  const me = await requireActor();
  const ws = await loadWorkspace();
  const assignees = ws.users.filter((u) => input.assigneeIds.includes(u.id));
  if (!input.title.trim() || assignees.length === 0 || input.weekdays.length === 0)
    return ws;

  await saveRecurring({
    id: uid("rt"),
    title: input.title.trim(),
    detail: input.detail?.trim() || undefined,
    assigneeIds: assignees.map((u) => u.id),
    weekdays: [...input.weekdays].sort(),
    dueTime: input.dueTime,
    category: input.category,
    active: true,
    createdAt: new Date().toISOString(),
  });
  await saveAudit([
    entry(
      uid("ae"),
      me.id,
      "recurring.added",
      input.title.trim(),
      `Standing duty for ${nameList(assignees.map((u) => u.name))}, ${input.weekdays.length === 5 ? "every working day" : `${input.weekdays.length} day${input.weekdays.length === 1 ? "" : "s"} a week`}`,
    ),
  ]);
  return loadWorkspace();
}

export async function setRecurringActive(
  id: string,
  active: boolean,
): Promise<Workspace> {
  const me = await requireActor();
  const ws = await loadWorkspace();
  const task = ws.recurring.find((r) => r.id === id);
  if (!task || task.active === active) return ws;

  await saveRecurring({ ...task, active });
  await saveAudit([
    entry(
      uid("ae"),
      me.id,
      "recurring.paused",
      task.title,
      active ? "Standing duty resumed" : "Standing duty paused",
    ),
  ]);
  return loadWorkspace();
}

export async function removeRecurringTask(id: string): Promise<Workspace> {
  await requireActor();
  await deleteRecurring(id);
  return loadWorkspace();
}

/**
 * Materialise every duty that falls on `date`. Idempotent: the id is derived
 * from the duty and the day, so this can run on every load and again from the
 * morning job without ever doubling anything up.
 */
export async function ensureRecurring(date: string): Promise<Workspace> {
  await requireActor();
  const ws = await loadWorkspace();
  const created = await materialiseRecurring(ws, date);
  return created > 0 ? loadWorkspace() : ws;
}

/** Shared with the scheduled job, which has no session to speak of. */
export async function materialiseRecurring(
  ws: Workspace,
  date: string,
): Promise<number> {
  const weekday = isoWeekday(new Date(`${date}T12:00:00`));
  const due = ws.recurring.filter(
    (r) => r.active && r.weekdays.includes(weekday),
  );
  if (due.length === 0) return 0;

  const taken = new Set(ws.assignments.map((a) => a.id));
  const owner = ws.users.find((u) => u.workRole === "owner");
  const fresh: Assignment[] = due
    .map((r) => ({
      id: `as_rec_${r.id}_${date}`,
      title: r.title,
      detail: r.detail,
      assigneeIds: r.assigneeIds,
      assignedById: owner?.id ?? r.assigneeIds[0],
      createdAt: new Date(`${date}T07:00:00`).toISOString(),
      dueDate: date,
      dueTime: r.dueTime,
      priority: "normal" as const,
      category: r.category,
      status: "open" as const,
      recurringId: r.id,
    }))
    .filter((a) => !taken.has(a.id));

  await saveAssignments(fresh);
  return fresh.length;
}

// --- the team --------------------------------------------------------------

/**
 * A seat, and the email that tells them about it. Returns a message rather
 * than only the workspace, because "added" and "told" are two different
 * things and the screen has to be able to say which happened.
 */
export async function addEmployee(input: {
  name: string;
  email: string;
  jobTitle: string;
  workRole: WorkRole;
}): Promise<{ workspace: Workspace; message: string }> {
  const me = await requireActor();
  if (me.role !== "admin")
    return {
      workspace: await loadWorkspace(),
      message: "Only management can add somebody to the team.",
    };

  const clean = {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    jobTitle: input.jobTitle.trim() || "Team member",
  };
  const ws = await loadWorkspace();
  if (!clean.name || !clean.email)
    return { workspace: ws, message: "They need a name and an email address." };
  if (ws.users.some((u) => u.email.toLowerCase() === clean.email))
    return {
      workspace: ws,
      message: `${clean.email} is already on the team.`,
    };

  const taken = new Set(ws.users.map((u) => u.tint));
  const tint = TINTS.find((t) => !taken.has(t)) ?? TINTS[0];

  const person: User = {
    id: uid("u"),
    role: "employee",
    workRole: input.workRole,
    duties: [],
    tint,
    ...clean,
  };
  await saveUser(person);

  const result = await invite(person);
  await saveAudit([
    entry(
      uid("ae"),
      me.id,
      "user.added",
      clean.name,
      `Added as ${clean.jobTitle} (${clean.email}), working as ${input.workRole}. ${
        result.sent
          ? "Invitation emailed."
          : "Invitation email failed, so they have not been told yet."
      }`,
    ),
  ]);

  return { workspace: await loadWorkspace(), message: result.message };
}

/** Send the invitation again, for somebody who never got it or lost it. */
export async function inviteEmployee(
  id: string,
): Promise<{ workspace: Workspace; message: string }> {
  const me = await requireActor();
  const ws = await loadWorkspace();
  if (me.role !== "admin")
    return { workspace: ws, message: "Only management can invite somebody." };

  const person = ws.users.find((u) => u.id === id);
  if (!person) return { workspace: ws, message: "No such person." };
  if (person.archivedAt)
    return {
      workspace: ws,
      message: `${person.name} is not on the team any more. Put them back first.`,
    };

  const result: InviteResult = await invite(person);
  await saveAudit([
    entry(
      uid("ae"),
      me.id,
      "user.added",
      person.name,
      result.sent
        ? `Invitation re-sent to ${person.email}`
        : `Invitation to ${person.email} failed to send`,
    ),
  ]);
  return { workspace: await loadWorkspace(), message: result.message };
}

/** Their job description. Work is routed by role, so this decides what reaches them. */
export async function updateEmployee(
  id: string,
  patch: { jobTitle?: string; workRole?: WorkRole; duties?: string[] },
): Promise<Workspace> {
  const me = await requireActor();
  if (me.role !== "admin") return loadWorkspace();

  const ws = await loadWorkspace();
  const user = ws.users.find((u) => u.id === id);
  if (!user) return ws;

  const duties = patch.duties?.map((d) => d.trim()).filter((d) => d.length > 0);
  const jobTitle = patch.jobTitle?.trim();
  const changed =
    (patch.workRole && patch.workRole !== user.workRole) ||
    (jobTitle && jobTitle !== user.jobTitle) ||
    (duties && duties.join("|") !== user.duties.join("|"));
  if (!changed) return ws;

  await saveUser({
    ...user,
    workRole: patch.workRole ?? user.workRole,
    jobTitle: jobTitle || user.jobTitle,
    duties: duties ?? user.duties,
  });
  await saveAudit([
    entry(
      uid("ae"),
      me.id,
      "user.added",
      user.name,
      `Job description updated: ${patch.workRole ?? user.workRole}, ${(duties ?? user.duties).length} duties listed`,
    ),
  ]);
  return loadWorkspace();
}

/** Leaving is an archive, never a delete: their trail has to stay readable. */
export async function archiveEmployee(id: string): Promise<Workspace> {
  const me = await requireActor();
  if (me.role !== "admin") return loadWorkspace();

  const ws = await loadWorkspace();
  const user = ws.users.find((u) => u.id === id);
  if (!user || user.archivedAt || user.role !== "employee") return ws;
  if (id === me.id) return ws;

  const open = ws.assignments.filter(
    (a) => a.status === "open" && a.assigneeIds.includes(id),
  ).length;

  await saveUser({ ...user, archivedAt: new Date().toISOString() });
  await saveAudit([
    entry(
      uid("ae"),
      me.id,
      "user.archived",
      user.name,
      open
        ? `Removed from the team with ${open} open task${open === 1 ? "" : "s"} still assigned`
        : "Removed from the team",
    ),
  ]);
  return loadWorkspace();
}

/**
 * Delete a person, rather than archive them. Their seat, their sign-in, their
 * standing duties and their own tasks all go.
 *
 * Three things it will not do. It will not delete you, or the last owner,
 * because either would lock the practice out of its own QC. And it will not
 * touch the audit trail: that is the record the practice is held to, and
 * losing it to a staff change would be the wrong trade. Their old entries
 * read as "a deleted person" from then on.
 *
 * Projects have to be handed to somebody first. The database will not let a
 * project exist without an owner, and silently deleting a client's project
 * because a consultant left is not a thing this should do quietly.
 */
export async function deleteEmployee(
  id: string,
): Promise<{ workspace: Workspace; message: string }> {
  const me = await requireActor();
  const ws = await loadWorkspace();
  const refuse = (message: string) => ({ workspace: ws, message });

  if (me.role !== "admin") return refuse("Only management can delete somebody.");

  const person = ws.users.find((u) => u.id === id);
  if (!person) return refuse("No such person.");
  if (id === me.id) return refuse("You cannot delete your own account.");

  const owners = ws.users.filter(
    (u) => u.workRole === "owner" && !u.archivedAt && u.id !== id,
  );
  if (person.workRole === "owner" && owners.length === 0)
    return refuse(
      "This is the last owner. Somebody has to be able to sign off QC, so make another person the owner first.",
    );

  const theirLeads = ws.leads.filter(
    (l) => l.ownerId === id && l.stage !== "won" && l.stage !== "lost",
  );
  if (theirLeads.length > 0)
    return refuse(
      `${person.name} still has ${theirLeads.length} open lead${theirLeads.length === 1 ? "" : "s"} (${theirLeads
        .slice(0, 3)
        .map((l) => l.company)
        .join(", ")}${theirLeads.length > 3 ? " and more" : ""}). Hand those to somebody else first, then delete.`,
    );

  const theirs = ws.projects.filter((p) => p.ownerId === id);
  if (theirs.length > 0)
    return refuse(
      `${person.name} still carries ${theirs.length} project${theirs.length === 1 ? "" : "s"} (${theirs
        .slice(0, 3)
        .map((p) => p.client)
        .join(", ")}${theirs.length > 3 ? " and more" : ""}). Hand those to somebody else first, then delete.`,
    );

  // Their sign-in goes with them, or a deleted person could still get in.
  let clerkNote = "";
  try {
    const clerk = await clerkClient();
    const found = await clerk.users.getUserList({
      emailAddress: [person.email],
    });
    for (const account of found.data) await clerk.users.deleteUser(account.id);
    clerkNote =
      found.data.length > 0
        ? " Their sign-in account was deleted too."
        : " They had never signed in, so there was no account to delete.";
  } catch (e) {
    clerkNote = ` Their Taskey seat is gone, but the sign-in account could not be deleted (${e instanceof Error ? e.message : "unknown error"}), so remove it in Clerk.`;
  }

  const wiped = await wipeUser(id);

  await saveAudit([
    entry(
      uid("ae"),
      me.id,
      "user.deleted",
      person.name,
      `Deleted permanently (${person.email}, ${person.workRole}). ${wiped.tasksDeleted} task${wiped.tasksDeleted === 1 ? "" : "s"} deleted, ${wiped.tasksReassigned} shared task${wiped.tasksReassigned === 1 ? "" : "s"} left with the others, ${wiped.dutiesDeleted} standing dut${wiped.dutiesDeleted === 1 ? "y" : "ies"} removed.${clerkNote}`,
    ),
  ]);

  return {
    workspace: await loadWorkspace(),
    message: `${person.name} is deleted. ${wiped.tasksDeleted} of their tasks and ${wiped.dutiesDeleted} standing dut${wiped.dutiesDeleted === 1 ? "y" : "ies"} went with them.${clerkNote}`,
  };
}

/** Hand every project somebody carries to another consultant. */
export async function reassignProjects(
  fromId: string,
  toId: string,
): Promise<{ workspace: Workspace; message: string }> {
  const me = await requireActor();
  const ws = await loadWorkspace();
  if (me.role !== "admin")
    return { workspace: ws, message: "Only management can move projects." };

  const from = ws.users.find((u) => u.id === fromId);
  const to = ws.users.find((u) => u.id === toId);
  if (!from || !to || fromId === toId)
    return { workspace: ws, message: "Pick somebody else to carry them." };

  const theirs = ws.projects.filter((p) => p.ownerId === fromId);
  const moved = await reassignProjectsTo(fromId, toId);
  if (moved === 0)
    return { workspace: ws, message: `${from.name} carries no projects.` };

  await saveAudit([
    entry(
      uid("ae"),
      me.id,
      "project.created",
      `${moved} project${moved === 1 ? "" : "s"} moved`,
      `Moved from ${from.name} to ${to.name}`,
    ),
  ]);

  // Each sheet is run through again, so the step it is on is handed to
  // whoever holds that role now and they are told. Without this a moved
  // project keeps a task pointed at somebody who has left.
  for (const project of theirs) {
    await onProject(project.id, (p) => ({ project: p }));
  }

  return {
    workspace: await loadWorkspace(),
    message: `${moved} project${moved === 1 ? "" : "s"} moved from ${from.name} to ${to.name}, and the open step handed on.`,
  };
}

export async function restoreEmployee(id: string): Promise<Workspace> {
  const me = await requireActor();
  if (me.role !== "admin") return loadWorkspace();

  const ws = await loadWorkspace();
  const user = ws.users.find((u) => u.id === id);
  if (!user?.archivedAt) return ws;

  await saveUser({ ...user, archivedAt: undefined });
  await saveAudit([
    entry(uid("ae"), me.id, "user.restored", user.name, "Put back on the team"),
  ]);
  return loadWorkspace();
}
