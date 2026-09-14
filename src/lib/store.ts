"use client";

// ---------------------------------------------------------------------------
// The client's copy of the workspace.
//
// This used to be the whole application: the rules, the data and localStorage
// in one place. Now the rules live in lib/services.ts and lib/sheet.ts, the
// data lives in Postgres, and every change goes through a server action in
// lib/actions.ts. What is left is a cache and a set of thin wrappers, so the
// components written against the old store keep working unchanged.
//
// Every action returns the whole workspace, so a change and the state that
// follows from it arrive together and no screen shows a sheet that has
// already moved on.
// ---------------------------------------------------------------------------

import { create } from "zustand";
import * as server from "./actions";
import type { Workspace } from "@/db/queries";
import type {
  AssignmentPriority,
  BlockStatus,
  ClientContact,
  DailyLog,
  Escalation,
  EscalationItem,
  EscalationSeverity,
  ExtraTask,
  Lead,
  LeadStage,
  ProjectStatus,
  SkipReason,
  TaskCategory,
  TimeBlockTemplate,
  User,
  WorkRole,
} from "./types";

interface TaskeyState extends Workspace {
  /** The signed-in team member. Handed down by the server, never chosen. */
  currentUserId: string;
  /** False until the first load lands, so nothing renders against nothing. */
  ready: boolean;
  /** The last thing the server refused, or could not do. */
  error: string | null;
  /** The last thing worth telling them, like an invitation going out. */
  notice: string | null;
  /**
   * How many server calls are in flight. Every action reloads the whole
   * workspace, so there is a real wait to show rather than pretend away.
   */
  busy: number;

  /** Parked features: still on disk, not yet on the server. */
  templates: TimeBlockTemplate[];
  logs: DailyLog[];
  escalations: Escalation[];

  load: () => Promise<void>;
  setCurrentUser: (id: string) => void;
  clearError: () => void;
  clearNotice: () => void;

  intakeProject: (input: {
    serviceId: string;
    client: string;
    clientContact: ClientContact;
    ownerId: string;
    fee: number;
    amountPaid: number;
    paidAt: string;
    name?: string;
    leadId?: string;
  }) => Promise<void>;
  completeStep: (projectId: string, stepId: string) => Promise<void>;
  /** Step 5: the acknowledgement to the client, which is what closes it. */
  acknowledgeClient: (projectId: string) => Promise<void>;
  requestDocuments: (projectId: string) => Promise<void>;
  remindClient: (projectId: string) => Promise<void>;
  toggleDocument: (projectId: string, documentId: string) => Promise<void>;
  addDocumentRequest: (projectId: string, label: string) => Promise<void>;
  removeDocumentRequest: (
    projectId: string,
    documentId: string,
  ) => Promise<void>;
  requestQc: (projectId: string) => Promise<void>;
  approveQc: (projectId: string, note?: string) => Promise<void>;
  returnQc: (projectId: string, note: string) => Promise<void>;
  submitToAuthority: (projectId: string, via?: string) => Promise<void>;
  sendBalanceInvoice: (projectId: string) => Promise<void>;
  addAuthorityQuery: (projectId: string, detail: string) => Promise<void>;
  clearAuthorityQuery: (projectId: string, queryId: string) => Promise<void>;
  logAuthorityFollowUp: (projectId: string, detail: string) => Promise<void>;
  recordPayment: (
    projectId: string,
    amount: number,
    note?: string,
  ) => Promise<void>;
  recordOutcome: (
    projectId: string,
    outcome: "approved" | "declined",
  ) => Promise<void>;
  advancePhase: (projectId: string) => Promise<void>;
  setProjectStatus: (projectId: string, status: ProjectStatus) => Promise<void>;
  /** Management only. Takes the sheet and its tasks; keeps the trail. */
  deleteProjectSheet: (projectId: string) => Promise<void>;

  assignTask: (input: {
    title: string;
    detail?: string;
    assigneeIds: string[];
    dueDate: string;
    dueTime?: string;
    priority: AssignmentPriority;
    category: TaskCategory;
  }) => Promise<void>;
  completeAssignment: (id: string, note?: string) => Promise<void>;
  reopenAssignment: (id: string) => Promise<void>;
  remindAssignment: (id: string) => Promise<void>;
  /** Management only, and refused on anything a project sheet owns. */
  deleteTask: (id: string) => Promise<void>;

  addRecurringTask: (input: {
    title: string;
    detail?: string;
    assigneeIds: string[];
    weekdays: number[];
    dueTime?: string;
    category: TaskCategory;
  }) => Promise<void>;
  setRecurringActive: (id: string, active: boolean) => Promise<void>;
  removeRecurringTask: (id: string) => Promise<void>;
  ensureRecurring: (date: string) => Promise<void>;

  /**
   * The parked screens: the daily checklist and escalations. They are not on
   * the server yet, so these work in the session and are gone on reload, and
   * neither is reachable from the navigation meanwhile.
   */
  ensureLog: (userId: string, date: string) => DailyLog;
  setBlockStatus: (
    logId: string,
    blockId: string,
    status: BlockStatus,
    patch?: { skipReason?: SkipReason; note?: string },
  ) => void;
  addExtraTask: (logId: string, task: Omit<ExtraTask, "id">) => void;
  removeExtraTask: (logId: string, taskId: string) => void;
  setSummaryNote: (logId: string, note: string) => void;
  submitLog: (logId: string) => void;
  addLead: (input: {
    company: string;
    contactName: string;
    contactEmail?: string;
    contactPhone?: string;
    channel: Lead["channel"];
    serviceId?: string;
    ownerId: string;
    value: number;
    detail?: string;
  }) => Promise<void>;
  logActivity: (
    leadId: string,
    kind: Lead["activity"][number]["kind"],
    detail: string,
  ) => Promise<void>;
  markFirstResponse: (leadId: string, detail: string) => Promise<void>;
  sendQuote: (leadId: string, value: number, detail: string) => Promise<void>;
  setStage: (leadId: string, stage: LeadStage) => Promise<void>;
  raiseEscalation: (input: {
    severity: EscalationSeverity;
    items: EscalationItem[];
    note?: string;
  }) => void;
  acknowledgeEscalation: (id: string) => void;
  resolveEscalation: (id: string, adminNote?: string) => void;
  resetDemo: () => void;

  addEmployee: (input: {
    name: string;
    email: string;
    jobTitle: string;
    workRole: WorkRole;
  }) => Promise<void>;
  updateEmployee: (
    id: string,
    patch: { jobTitle?: string; workRole?: WorkRole; duties?: string[] },
  ) => Promise<void>;
  /** Sends the invitation again, for somebody who never got it. */
  inviteEmployee: (id: string) => Promise<void>;
  archiveEmployee: (id: string) => Promise<void>;
  restoreEmployee: (id: string) => Promise<void>;
  /** A delete, not an archive. Keeps the audit trail and nothing else. */
  deleteEmployee: (id: string) => Promise<void>;
  reassignProjects: (fromId: string, toId: string) => Promise<void>;
}

const empty: Workspace = {
  users: [],
  leads: [],
  emailFailures: [],
  projects: [],
  assignments: [],
  recurring: [],
  audit: [],
};

export const useTaskey = create<TaskeyState>()((set, get) => {
  /**
   * Every wrapper is this shape: ask the server, keep what it hands back. A
   * refusal is not an exception here, it is a message on the screen.
   */
  const run = async (work: () => Promise<Workspace>) => {
    set({ busy: get().busy + 1 });
    try {
      const ws = await work();
      set({ ...ws, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      set({ busy: Math.max(get().busy - 1, 0) });
    }
  };

  /** For actions whose result is worth a sentence, not just new state. */
  const told = async (
    work: () => Promise<{ workspace: Workspace; message: string }>,
  ) => {
    set({ busy: get().busy + 1 });
    try {
      const { workspace, message } = await work();
      set({ ...workspace, error: null, notice: message });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      set({ busy: Math.max(get().busy - 1, 0) });
    }
  };

  return {
    ...empty,
    currentUserId: "",
    ready: false,
    error: null,
    notice: null,
    busy: 0,
    templates: [],
    logs: [],
    escalations: [],

    load: async () => {
      await run(server.getWorkspace);
      set({ ready: true });
    },

    setCurrentUser: (id) => set({ currentUserId: id }),
    clearError: () => set({ error: null }),
    clearNotice: () => set({ notice: null }),

    // --- projects ---------------------------------------------------------
    intakeProject: (input) => run(() => server.intakeProject(input)),
    completeStep: (projectId, stepId) =>
      run(() => server.completeStep(projectId, stepId)),
    acknowledgeClient: (projectId) =>
      run(() => server.acknowledgeClient(projectId)),
    requestDocuments: (projectId) =>
      run(() => server.requestDocuments(projectId)),
    remindClient: (projectId) => run(() => server.remindClient(projectId)),
    toggleDocument: (projectId, documentId) =>
      run(() => server.toggleDocument(projectId, documentId)),
    addDocumentRequest: (projectId, label) =>
      run(() => server.addDocumentRequest(projectId, label)),
    removeDocumentRequest: (projectId, documentId) =>
      run(() => server.removeDocumentRequest(projectId, documentId)),
    requestQc: (projectId) => run(() => server.requestQc(projectId)),
    approveQc: (projectId, note) => run(() => server.approveQc(projectId, note)),
    returnQc: (projectId, note) => run(() => server.returnQc(projectId, note)),
    submitToAuthority: (projectId, via) =>
      run(() => server.submitToAuthority(projectId, via)),
    sendBalanceInvoice: (projectId) =>
      run(() => server.sendBalanceInvoice(projectId)),
    addAuthorityQuery: (projectId, detail) =>
      run(() => server.addAuthorityQuery(projectId, detail)),
    clearAuthorityQuery: (projectId, queryId) =>
      run(() => server.clearAuthorityQuery(projectId, queryId)),
    logAuthorityFollowUp: (projectId, detail) =>
      run(() => server.logAuthorityFollowUp(projectId, detail)),
    recordPayment: (projectId, amount, note) =>
      run(() => server.recordPayment(projectId, amount, note)),
    recordOutcome: (projectId, outcome) =>
      run(() => server.recordOutcome(projectId, outcome)),
    advancePhase: (projectId) => run(() => server.advancePhase(projectId)),
    setProjectStatus: (projectId, status) =>
      run(() => server.setProjectStatus(projectId, status)),
    deleteProjectSheet: (projectId) =>
      told(() => server.deleteProjectSheet(projectId)),

    // --- work handed out --------------------------------------------------
    assignTask: async (input) => {
      set({ busy: get().busy + 1 });
      try {
        const { workspace, failed } = await server.assignTask(input);
        set({
          ...workspace,
          error:
            failed.length > 0
              ? `The task was created, but the email could not be sent to ${failed.join(", ")}.`
              : null,
          notice: failed.length === 0 ? "Task created and emailed." : null,
        });
      } catch (e) {
        set({ error: e instanceof Error ? e.message : "Something went wrong." });
      }
    },
    completeAssignment: (id, note) =>
      run(() => server.completeAssignment(id, note)),
    reopenAssignment: (id) => run(() => server.reopenAssignment(id)),
    remindAssignment: async (id) => {
      set({ busy: get().busy + 1 });
      try {
        const { workspace, failed } = await server.remindAssignment(id);
        set({
          ...workspace,
          error:
            failed.length > 0
              ? `The reminder could not be emailed to ${failed.join(", ")}.`
              : null,
          notice: failed.length === 0 ? "Reminder emailed." : null,
        });
      } catch (e) {
        set({ error: e instanceof Error ? e.message : "Something went wrong." });
      }
    },

    deleteTask: (id) => told(() => server.deleteTask(id)),

    // --- standing duties --------------------------------------------------
    addRecurringTask: (input) => run(() => server.addRecurringTask(input)),
    setRecurringActive: (id, active) =>
      run(() => server.setRecurringActive(id, active)),
    removeRecurringTask: (id) => run(() => server.removeRecurringTask(id)),
    ensureRecurring: async (date) => {
      // Runs on every load and usually has nothing to do, so it stays quiet
      // until the first workspace has landed.
      if (!get().ready) return;
      await run(() => server.ensureRecurring(date));
    },

    // --- steps 1 to 4 -----------------------------------------------------
    addLead: (input) => run(() => server.addLead(input)),
    logActivity: (leadId, kind, detail) =>
      run(() => server.logLeadActivity(leadId, kind, detail)),
    markFirstResponse: (leadId, detail) =>
      run(() => server.logLeadActivity(leadId, "note", detail)),
    sendQuote: (leadId, value, detail) =>
      run(() => server.sendQuote(leadId, value, detail)),
    setStage: (leadId, stage) => run(() => server.setLeadStage(leadId, stage)),

    // --- parked screens, in memory only -----------------------------------
    // The checklist and escalations are not written anywhere yet.

    ensureLog: (userId, date) => {
      const found = get().logs.find(
        (l) => l.userId === userId && l.date === date,
      );
      if (found) return found;
      const fresh: DailyLog = {
        id: `log_${userId}_${date}`,
        userId,
        date,
        blocks: [],
        extraTasks: [],
      };
      set((s) => ({ logs: [...s.logs, fresh] }));
      return fresh;
    },
    setBlockStatus: (logId, blockId, status, patch) =>
      set((s) => ({
        logs: s.logs.map((l) =>
          l.id !== logId || l.lockedAt
            ? l
            : {
                ...l,
                blocks: l.blocks.map((b) =>
                  b.id !== blockId
                    ? b
                    : {
                        ...b,
                        status,
                        skipReason:
                          status === "done" ? undefined : patch?.skipReason,
                        note: status === "done" ? undefined : patch?.note,
                      },
                ),
              },
        ),
      })),
    addExtraTask: (logId, task) =>
      set((s) => ({
        logs: s.logs.map((l) =>
          l.id !== logId || l.lockedAt
            ? l
            : {
                ...l,
                extraTasks: [
                  ...l.extraTasks,
                  { ...task, id: `xt_${l.extraTasks.length + 1}` },
                ],
              },
        ),
      })),
    removeExtraTask: (logId, taskId) =>
      set((s) => ({
        logs: s.logs.map((l) =>
          l.id !== logId
            ? l
            : { ...l, extraTasks: l.extraTasks.filter((t) => t.id !== taskId) },
        ),
      })),
    setSummaryNote: (logId, note) =>
      set((s) => ({
        logs: s.logs.map((l) =>
          l.id !== logId || l.lockedAt ? l : { ...l, summaryNote: note },
        ),
      })),
    submitLog: (logId) =>
      set((s) => {
        const at = new Date().toISOString();
        return {
          logs: s.logs.map((l) =>
            l.id !== logId || l.lockedAt
              ? l
              : { ...l, submittedAt: at, lockedAt: at },
          ),
        };
      }),

    raiseEscalation: ({ severity, items, note }) =>
      set((s) => ({
        escalations: [
          {
            id: `es_${s.escalations.length + 1}`,
            userId: s.currentUserId,
            createdAt: new Date().toISOString(),
            severity,
            items,
            note,
            status: "open",
          },
          ...s.escalations,
        ],
      })),
    acknowledgeEscalation: (id) =>
      set((s) => ({
        escalations: s.escalations.map((e) =>
          e.id !== id
            ? e
            : {
                ...e,
                status: "acknowledged",
                acknowledgedAt: new Date().toISOString(),
                acknowledgedBy: s.currentUserId,
              },
        ),
      })),
    resolveEscalation: (id, adminNote) =>
      set((s) => ({
        escalations: s.escalations.map((e) =>
          e.id !== id
            ? e
            : {
                ...e,
                status: "resolved",
                resolvedAt: new Date().toISOString(),
                adminNote,
              },
        ),
      })),
    /** There is no demo data to reset any more: the database is the truth. */
    resetDemo: () => set({ logs: [], escalations: [] }),

    // --- the team ---------------------------------------------------------
    addEmployee: (input) => told(() => server.addEmployee(input)),
    inviteEmployee: (id) => told(() => server.inviteEmployee(id)),
    updateEmployee: (id, patch) => run(() => server.updateEmployee(id, patch)),
    archiveEmployee: (id) => run(() => server.archiveEmployee(id)),
    deleteEmployee: (id) => told(() => server.deleteEmployee(id)),
    reassignProjects: (fromId, toId) =>
      told(() => server.reassignProjects(fromId, toId)),
    restoreEmployee: (id) => run(() => server.restoreEmployee(id)),
  };
});

export const todayKey = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const useUser = (id: string): User | undefined =>
  useTaskey((s) => s.users.find((u) => u.id === id));

/** Safe to assert: nothing renders until the gate has both the user and the data. */
export const useCurrentUser = (): User =>
  useTaskey((s) => s.users.find((u) => u.id === s.currentUserId)!);
