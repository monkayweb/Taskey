// ---------------------------------------------------------------------------
// The service catalogue, and the sheet a payment builds.
//
// Every project we take on is one of a handful of licensing services, and each
// of those runs the same shape of workflow: prepare, submit, wait. What
// changes between them is how long we have to submit, how long the authority
// takes afterwards, whether the premises get inspected, and which documents we
// have to get out of the client.
//
// So the catalogue holds those differences and nothing else, and one builder
// turns "this client paid today" into a full project sheet with every date on
// it already worked out. Nobody types a project plan.
//
// The windows below are the "up to" times quoted on the brochure: up to 14
// days to submit a new premises licence, up to 10 for a renewal, and so on.
// They are a maximum, not an estimate, which is why a sheet counts down to one
// and flags it before it passes.
// ---------------------------------------------------------------------------

import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  addCalendarDays,
  nextWorkingDay,
  previousWorkingDay,
} from "./date";
import type {
  Milestone,
  Project,
  ProjectDocument,
  StepGate,
  StepRole,
  WorkRole,
} from "./types";

export interface ServiceStep {
  /** Its number on the practice's workflow chart, which runs 1 to 10. */
  step: number;
  label: string;
  /** Who the step waits on. */
  role: StepRole;
  detail?: string;
  /**
   * Relative share of the window before submission. Steps are dated by
   * spreading that window across these weights, so one workflow fits a
   * two-day release and a thirty-day licence application unchanged.
   */
  weight: number;
  gate: StepGate;
}

/** A billing phase. Bigger applications are quoted and collected in stages. */
export interface ServicePhase {
  key: number;
  label: string;
  /** Share of the total fee that falls due in this phase. */
  share: number;
}

export interface ServiceType {
  id: string;
  name: string;
  /** For chips and table cells, where the full name will not fit. */
  short: string;
  authority: string;
  /** Calendar days from payment received to submission. Quoted as "up to". */
  submissionDays: number;
  /** Calendar days the authority typically takes after submission. */
  processingDays: number;
  /** Whether the authority inspects the premises before issuing. */
  inspection: boolean;
  /** Standard fee in ZAR, across all phases. Editable per project at intake. */
  fee: number;
  phases: ServicePhase[];
  documents: string[];
}

/**
 * The document request list. Fixed for every premises application, which is
 * exactly why it can be pre-populated: the consultant only ever adds to it.
 */
export const STANDARD_DOCUMENTS = [
  "Certified ID copies of all directors",
  "Company registration documents (CIPC)",
  "Lease agreement or title deed for the premises",
  "Floor plan of the premises",
  "Municipal zoning certificate",
  "Tax clearance certificate",
  "Responsible pharmacist's council registration certificate",
  "Responsible pharmacist's qualification certificates",
  "Signed letter of appointment for the responsible pharmacist",
  "Photographs of the premises, inside and out",
];

const SINGLE_PHASE: ServicePhase[] = [{ key: 0, label: "Full fee", share: 1 }];

/**
 * Phases are quoted in equal amounts: three phases is three thirds. What a
 * client actually pays up front varies (sometimes a third, sometimes half),
 * but that is the payment recorded at intake, not the way the fee is split.
 */
const equalPhases = (labels: string[]): ServicePhase[] =>
  labels.map((label, i) => ({ key: i, label, share: 1 / labels.length }));

/**
 * The practice's own workflow, steps 5 to 10 of the chart on the wall.
 *
 * Steps 1 to 4 are the sales side: where the client came from, the service
 * request form and questionnaire, the consultation, and the quote. They happen
 * before there is a project to open, so they belong to the lead. Step 5 is the
 * one that marks the start of the project, and that is where a sheet begins.
 *
 * The numbers are deliberately the ones the team already says out loud. "Step
 * 8" means the QC check to everybody in the building, so the app had better
 * mean the same thing by it.
 */
export const CORE_STEPS: ServiceStep[] = [
  {
    step: 5,
    label: "Project checklist and info sheet",
    role: "admin",
    detail:
      "Marks the start of the project. Acknowledge to the client quickly and set out the guidelines that apply.",
    weight: 0,
    gate: "start",
  },
  {
    step: 6,
    label: "Collecting client particulars",
    role: "consultant",
    detail:
      "Request what this project needs, then chase until every item is in. Most of the delay on a project sits here.",
    weight: 4,
    gate: "documents",
  },
  {
    step: 7,
    label: "Project compilation",
    role: "consultant",
    detail:
      "Compile the documents and letters, send floor plans to the architect, and keep an eye on the timeline and any subcontractors.",
    weight: 3,
    gate: "compile",
  },
  {
    step: 8,
    label: "Completion QC",
    role: "owner",
    detail:
      "Approve it, or send it back with what is wrong or missing so it can be corrected and resent. Nothing is submitted before this.",
    weight: 2,
    gate: "qc",
  },
  {
    step: 9,
    label: "Project submission",
    role: "coordinator",
    detail:
      "Submit through the channel that service uses, portal or email, once QC has cleared it.",
    weight: 0,
    gate: "submit",
  },
  {
    step: 10,
    label: "Balance collection",
    role: "admin",
    detail:
      "The balance falls due the day we submit. Send the client the balance email with the invoice attached.",
    weight: 0,
    gate: "balance",
  },
];

export const SERVICES: ServiceType[] = [
  {
    id: "pl_new",
    name: "New pharmacy premises licence",
    short: "New PL",
    authority: "SA Pharmacy Council",
    submissionDays: 14,
    processingDays: 90,
    inspection: true,
    fee: 24500,
    phases: SINGLE_PHASE,
    documents: STANDARD_DOCUMENTS,
  },
  {
    id: "pl_renewal",
    name: "Premises licence renewal",
    short: "PL renewal",
    authority: "SA Pharmacy Council",
    submissionDays: 10,
    processingDays: 60,
    inspection: false,
    fee: 9500,
    phases: SINGLE_PHASE,
    documents: [
      "Current licence certificate",
      "Certified ID copies of all directors",
      "Company registration documents (CIPC)",
      "Lease agreement or title deed for the premises",
      "Tax clearance certificate",
      "Responsible pharmacist's council registration certificate",
    ],
  },
  {
    id: "rp_change",
    name: "Responsible pharmacist change",
    short: "RP change",
    authority: "SA Pharmacy Council",
    submissionDays: 7,
    processingDays: 45,
    inspection: false,
    fee: 7200,
    phases: SINGLE_PHASE,
    documents: [
      "Resignation letter from the outgoing pharmacist",
      "Signed letter of appointment for the incoming pharmacist",
      "Incoming pharmacist's council registration certificate",
      "Incoming pharmacist's qualification certificates",
      "Certified ID copy of the incoming pharmacist",
      "Current licence certificate",
    ],
  },
  {
    id: "detained",
    name: "Detained consignment release",
    short: "Detained release",
    authority: "Port Health",
    submissionDays: 2,
    processingDays: 5,
    inspection: false,
    fee: 6800,
    phases: SINGLE_PHASE,
    documents: [
      "Bill of lading and commercial invoice",
      "Packing list for the consignment",
      "Import permit",
      "Certificate of analysis for the batch",
      "Certified ID copy of the importer",
      "Letter of authority to act on the importer's behalf",
    ],
  },
  {
    id: "s22a_permit",
    name: "Scheduled substances permit (Section 22A)",
    short: "22A permit",
    authority: "SAHPRA",
    submissionDays: 21,
    processingDays: 120,
    inspection: false,
    fee: 18400,
    phases: equalPhases([
      "Phase 0 · application",
      "Phase 1 · permit issue",
    ]),
    documents: [
      ...STANDARD_DOCUMENTS,
      "Schedule and quantities of the substances applied for",
      "Storage and security arrangements for the premises",
    ],
  },
  {
    id: "wholesale",
    name: "Wholesale and distribution licence",
    short: "Wholesale",
    authority: "SAHPRA",
    submissionDays: 21,
    processingDays: 180,
    inspection: true,
    fee: 62000,
    phases: equalPhases([
      "Phase 0 · scoping and gap check",
      "Phase 1 · application",
      "Phase 2 · inspection and licence",
    ]),
    documents: [
      ...STANDARD_DOCUMENTS,
      "Site master file",
      "Storage and cold chain details",
      "Fleet and distribution arrangements",
    ],
  },
  {
    id: "manufacturing",
    name: "Manufacturing licence",
    short: "Manufacturing",
    authority: "SAHPRA",
    submissionDays: 30,
    processingDays: 240,
    inspection: true,
    fee: 96000,
    phases: equalPhases([
      "Phase 0 · scoping and gap check",
      "Phase 1 · dossier and application",
      "Phase 2 · pre-inspection readiness",
      "Phase 3 · inspection and licence",
    ]),
    documents: [
      ...STANDARD_DOCUMENTS,
      "Site master file",
      "Quality manual and SOP index",
      "Equipment list with calibration certificates",
      "Validation master plan",
    ],
  },
];

export const serviceById = (id: string): ServiceType =>
  SERVICES.find((s) => s.id === id) ?? SERVICES[0];

/**
 * Lay `weights` out across a window, as date keys. The last date is the end of
 * the window by construction, so a workflow always finishes on the day it
 * promised to, however many steps it has and however short the window is.
 */
function spread(start: string, end: string, weights: number[]): string[] {
  const total = weights.reduce((a, b) => a + b, 0);
  const span = Math.max(
    differenceInCalendarDays(parseISO(end), parseISO(start)),
    0,
  );
  let acc = 0;
  return weights.map((w) => {
    acc += w;
    const offset = total === 0 ? span : Math.round((acc / total) * span);
    return nextWorkingDay(addCalendarDays(start, offset));
  });
}

/** The day the submission is due: payment plus the service's own window. */
export const submissionDue = (service: ServiceType, paidAt: string) =>
  nextWorkingDay(addCalendarDays(paidAt, service.submissionDays));

/**
 * Every service runs the same six steps. What differs between them is how long
 * the window is, and what the authority does afterwards, which is tracked
 * against the sheet rather than as steps somebody here has to tick.
 */
export const stepsFor = (): ServiceStep[] => CORE_STEPS;

/** The chart runs 1 to 10. A project sheet covers 5 to 10. */
export const WORKFLOW_STEPS = 10;

/**
 * Turn a payment into a dated workflow. Steps 6, 7 and 8 share the window
 * between the payment and the submission date, in that proportion, and the
 * submission and the balance both land on the date we promised.
 */
export function buildSteps(
  service: ServiceType,
  paidAt: string,
  /**
   * Step ids are prefixed per phase, so advancing a phase produces a fresh
   * set of steps rather than colliding with the closed ones behind it.
   */
  idPrefix: string,
): Milestone[] {
  const specs = stepsFor();
  const submitDay = submissionDue(service, paidAt);

  // The working window closes a day before the submission date wherever there
  // is room for it, so QC is not asked to sign off the same morning the
  // application has to go in.
  const prepareEnd =
    differenceInCalendarDays(parseISO(submitDay), parseISO(paidAt)) >= 5
      ? previousWorkingDay(submitDay)
      : submitDay;

  const working = specs.filter((spec) => spec.weight > 0);
  const workingDates = spread(
    paidAt,
    prepareEnd,
    working.map((spec) => spec.weight),
  );

  let w = 0;
  return specs.map((spec) => ({
    id: `${idPrefix}_s${spec.step}`,
    step: spec.step,
    label: spec.label,
    role: spec.role,
    detail: spec.detail,
    gate: spec.gate,
    // Submission and the balance both fall on the day we promised to submit.
    dueDate:
      spec.gate === "start"
        ? nextWorkingDay(paidAt)
        : spec.weight === 0
          ? submitDay
          : workingDates[w++],
    done: false,
  }));
}

export function buildDocuments(
  service: ServiceType,
  idPrefix: string,
): ProjectDocument[] {
  return service.documents.map((label, i) => ({
    id: `${idPrefix}_d${i + 1}`,
    label,
    received: false,
  }));
}

// --- reading a sheet -------------------------------------------------------

export const outstandingDocuments = (p: Project) =>
  p.documents.filter((d) => !d.received);

export const allDocumentsIn = (p: Project) =>
  p.documents.length > 0 && p.documents.every((d) => d.received);

/** The step the project is actually on: the first one not yet ticked. */
export const currentStep = (p: Project): Milestone | undefined =>
  p.milestones.find((m) => !m.done);

export const stepByGate = (p: Project, gate: StepGate) =>
  p.milestones.find((m) => m.gate === gate);

/** Whoever the ball is with right now, where that is somebody on the team. */
export const currentRole = (p: Project): StepRole | undefined =>
  currentStep(p)?.role;

export const stepsDone = (p: Project) =>
  p.milestones.filter((m) => m.done).length;

// --- money -----------------------------------------------------------------

export const phases = (p: Project) => serviceById(p.serviceId).phases;

export const phaseOf = (p: Project, key = p.phase) =>
  phases(p).find((ph) => ph.key === key) ?? phases(p)[0];

/** What this phase is worth: its share of the fee. */
/**
 * What one phase is worth. Taken as the difference between two running totals
 * rather than a rounded share of its own, so thirds of a fee still add up to
 * the fee instead of leaving a rand behind.
 */
export function phaseAmount(p: Project, key = p.phase): number {
  const list = phases(p);
  const upTo = (n: number) =>
    Math.round(
      p.fee * list.slice(0, n).reduce((a, ph) => a + ph.share, 0),
    );
  const i = Math.max(
    list.findIndex((ph) => ph.key === key),
    0,
  );
  return upTo(i + 1) - upTo(i);
}

export const paidForPhase = (p: Project, key = p.phase) =>
  p.payments
    .filter((pay) => pay.phase === key)
    .reduce((a, pay) => a + pay.amount, 0);

/** What is still owed on the phase that is running. */
export const phaseBalance = (p: Project, key = p.phase) =>
  Math.max(phaseAmount(p, key) - paidForPhase(p, key), 0);

export const paidToDate = (p: Project) =>
  p.payments.reduce((a, pay) => a + pay.amount, 0);

/**
 * A balance is owed rather than merely outstanding once the phase has been
 * submitted, which is the day we told the client it falls due.
 */
export const balanceIsDue = (p: Project) =>
  !!p.submittedAt && phaseBalance(p) > 0;

export const isFinalPhase = (p: Project) =>
  p.phase >= phases(p)[phases(p).length - 1].key;

// --- routing ---------------------------------------------------------------

/**
 * A step is written against a role, so this is how it finds a person. The
 * owner role is management; everything else is whoever holds the job.
 */
export function holdersOf(
  users: { id: string; workRole: WorkRole; archivedAt?: string }[],
  role: StepRole,
): string[] {
  if (role === "client" || role === "authority") return [];
  return users.filter((u) => !u.archivedAt && u.workRole === role).map((u) => u.id);
}

export const holderOf = (
  users: { id: string; workRole: WorkRole; archivedAt?: string }[],
  role: StepRole,
): string | undefined => holdersOf(users, role)[0];
