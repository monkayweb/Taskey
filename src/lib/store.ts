"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { buildSeed, blocksForDay } from "./seed";
import type {
  AuditEvent,
  AuditType,
  BlockStatus,
  DailyLog,
  Escalation,
  EscalationItem,
  EscalationSeverity,
  ExtraTask,
  Lead,
  LeadStage,
  Project,
  SkipReason,
  TimeBlockTemplate,
  User,
} from "./types";
import { dayKey } from "./date";

const uid = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

interface TaskeyState {
  users: User[];
  templates: TimeBlockTemplate[];
  logs: DailyLog[];
  leads: Lead[];
  projects: Project[];
  escalations: Escalation[];
  /** Append-only. No action in this store edits or removes an entry. */
  audit: AuditEvent[];
  currentUserId: string;

  setCurrentUser: (id: string) => void;

  // 1. Daily checklist
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

  // 2. Leads and quotes
  addLead: (input: {
    company: string;
    contactName: string;
    channel: Lead["channel"];
    ownerId: string;
    value: number;
  }) => void;
  logActivity: (
    leadId: string,
    kind: Lead["activity"][number]["kind"],
    detail: string,
  ) => void;
  markFirstResponse: (leadId: string, detail: string) => void;
  sendQuote: (leadId: string, value: number, detail: string) => void;
  setStage: (leadId: string, stage: LeadStage) => void;

  // 3. Projects and escalation
  toggleMilestone: (projectId: string, milestoneId: string) => void;
  raiseEscalation: (input: {
    severity: EscalationSeverity;
    items: EscalationItem[];
    note?: string;
  }) => void;
  acknowledgeEscalation: (id: string) => void;
  resolveEscalation: (id: string, adminNote?: string) => void;

  resetDemo: () => void;
}

/** Every mutation that matters lands here, and only ever by appending. */
function record(
  audit: AuditEvent[],
  actorId: string,
  type: AuditType,
  subject: string,
  detail: string,
): AuditEvent[] {
  return [
    {
      id: uid("ae"),
      at: new Date().toISOString(),
      actorId,
      type,
      subject,
      detail,
    },
    ...audit,
  ];
}

export const useTaskey = create<TaskeyState>()(
  persist(
    (set, get) => ({
      ...buildSeed(new Date()),
      currentUserId: "u_thandi",

      setCurrentUser: (id) => set({ currentUserId: id }),

      // --- daily checklist -------------------------------------------------

      ensureLog: (userId, date) => {
        const existing = get().logs.find(
          (l) => l.userId === userId && l.date === date,
        );
        if (existing) return existing;

        const fresh: DailyLog = {
          id: `log_${userId}_${date}`,
          userId,
          date,
          blocks: blocksForDay(userId, date),
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
                          // Clearing back to done drops the explanation with it.
                          skipReason:
                            status === "done"
                              ? undefined
                              : (patch?.skipReason ?? b.skipReason),
                          note:
                            status === "done"
                              ? undefined
                              : (patch?.note ?? b.note),
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
              : { ...l, extraTasks: [...l.extraTasks, { ...task, id: uid("xt") }] },
          ),
        })),

      removeExtraTask: (logId, taskId) =>
        set((s) => ({
          logs: s.logs.map((l) =>
            l.id !== logId || l.lockedAt
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

      submitLog: (logId) => {
        const log = get().logs.find((l) => l.id === logId);
        if (!log || log.lockedAt) return;

        const at = new Date().toISOString();
        const done = log.blocks.filter((b) => b.status === "done").length;
        const missed = log.blocks.filter((b) => b.status === "missed").length;

        let audit = record(
          get().audit,
          log.userId,
          "log.submitted",
          `Daily log · ${log.date}`,
          `${done}/${log.blocks.length} blocks completed, ${missed} missed`,
        );
        // Each missed block is recorded individually, because the aggregate
        // alone isn't enough to answer "what exactly slipped, and why".
        for (const b of log.blocks.filter((x) => x.status !== "done")) {
          audit = record(
            audit,
            log.userId,
            b.status === "missed" ? "block.missed" : "block.completed",
            `${b.start}–${b.end} ${b.label}`,
            b.note?.trim() ||
              (b.skipReason ? b.skipReason.replace(/_/g, " ") : "No reason given"),
          );
        }

        set((s) => ({
          logs: s.logs.map((l) =>
            l.id === logId ? { ...l, submittedAt: at, lockedAt: at } : l,
          ),
          audit,
        }));
      },

      // --- leads -----------------------------------------------------------

      addLead: ({ company, contactName, channel, ownerId, value }) => {
        const at = new Date().toISOString();
        set((s) => ({
          leads: [
            {
              id: uid("ld"),
              company,
              contactName,
              channel,
              ownerId,
              stage: "inquiry",
              value,
              createdAt: at,
              lastActivityAt: at,
              activity: [
                {
                  id: uid("la"),
                  at,
                  kind: channel === "whatsapp" ? "whatsapp" : "note",
                  detail: `Inbound ${channel.replace("_", " ")} inquiry logged.`,
                  byUserId: s.currentUserId,
                },
              ],
            },
            ...s.leads,
          ],
          // The idle-inquiry clock starts here, so the intake itself is
          // part of the record.
          audit: record(
            s.audit,
            s.currentUserId,
            "lead.activity",
            company,
            `New ${channel.replace("_", " ")} inquiry captured for ${contactName}`,
          ),
        }));
      },

      logActivity: (leadId, kind, detail) => {
        const lead = get().leads.find((l) => l.id === leadId);
        if (!lead) return;
        const actor = get().currentUserId;
        const at = new Date().toISOString();

        set((s) => ({
          leads: s.leads.map((l) =>
            l.id !== leadId
              ? l
              : {
                  ...l,
                  lastActivityAt: at,
                  firstResponseAt: l.firstResponseAt ?? at,
                  activity: [
                    { id: uid("la"), at, kind, detail, byUserId: actor },
                    ...l.activity,
                  ],
                },
          ),
          audit: record(s.audit, actor, "lead.activity", lead.company, `${kind}: ${detail}`),
        }));
      },

      markFirstResponse: (leadId, detail) => {
        const lead = get().leads.find((l) => l.id === leadId);
        if (!lead) return;
        const actor = get().currentUserId;
        const at = new Date().toISOString();

        set((s) => ({
          leads: s.leads.map((l) =>
            l.id !== leadId
              ? l
              : {
                  ...l,
                  stage: l.stage === "inquiry" ? "contacted" : l.stage,
                  firstResponseAt: l.firstResponseAt ?? at,
                  lastActivityAt: at,
                  activity: [
                    { id: uid("la"), at, kind: "note", detail, byUserId: actor },
                    ...l.activity,
                  ],
                },
          ),
          audit: record(
            s.audit,
            actor,
            "lead.responded",
            lead.company,
            `First response logged: ${detail}`,
          ),
        }));
      },

      sendQuote: (leadId, value, detail) => {
        const lead = get().leads.find((l) => l.id === leadId);
        if (!lead) return;
        const actor = get().currentUserId;
        const at = new Date().toISOString();

        set((s) => ({
          leads: s.leads.map((l) =>
            l.id !== leadId
              ? l
              : {
                  ...l,
                  stage: "quoted",
                  value,
                  quoteSentAt: at,
                  firstResponseAt: l.firstResponseAt ?? at,
                  lastActivityAt: at,
                  activity: [
                    { id: uid("la"), at, kind: "quote_sent", detail, byUserId: actor },
                    ...l.activity,
                  ],
                },
          ),
          audit: record(
            s.audit,
            actor,
            "lead.quote_sent",
            lead.company,
            `Quote sent for ${value.toLocaleString("en-ZA")} ZAR. Follow-up clock started.`,
          ),
        }));
      },

      setStage: (leadId, stage) => {
        const lead = get().leads.find((l) => l.id === leadId);
        if (!lead) return;
        const actor = get().currentUserId;
        const at = new Date().toISOString();
        const closing = stage === "won" || stage === "lost";

        set((s) => ({
          leads: s.leads.map((l) =>
            l.id !== leadId
              ? l
              : {
                  ...l,
                  stage,
                  lastActivityAt: at,
                  closedAt: closing ? at : undefined,
                  activity: [
                    {
                      id: uid("la"),
                      at,
                      kind: "stage_change",
                      detail: `${l.stage} → ${stage}`,
                      byUserId: actor,
                    },
                    ...l.activity,
                  ],
                },
          ),
          audit: record(
            s.audit,
            actor,
            "lead.stage_changed",
            lead.company,
            `${lead.stage} → ${stage}`,
          ),
        }));
      },

      // --- projects and escalation -----------------------------------------

      toggleMilestone: (projectId, milestoneId) => {
        const project = get().projects.find((p) => p.id === projectId);
        const milestone = project?.milestones.find((m) => m.id === milestoneId);
        if (!project || !milestone) return;
        const actor = get().currentUserId;
        const at = new Date().toISOString();
        const nowDone = !milestone.done;

        set((s) => ({
          projects: s.projects.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  milestones: p.milestones.map((m) =>
                    m.id !== milestoneId
                      ? m
                      : { ...m, done: nowDone, doneAt: nowDone ? at : undefined },
                  ),
                },
          ),
          audit: nowDone
            ? record(
                s.audit,
                actor,
                "milestone.completed",
                `${project.name} · ${milestone.label}`,
                `Milestone closed (due ${milestone.dueDate})`,
              )
            : s.audit,
        }));
      },

      raiseEscalation: ({ severity, items, note }) => {
        const actor = get().currentUserId;
        set((s) => ({
          escalations: [
            {
              id: uid("es"),
              userId: actor,
              createdAt: new Date().toISOString(),
              severity,
              items,
              note,
              status: "open",
            },
            ...s.escalations,
          ],
          audit: record(
            s.audit,
            actor,
            "escalation.raised",
            `Escalation · ${severity}`,
            note?.trim() || `${items.length} items flagged as falling behind`,
          ),
        }));
      },

      acknowledgeEscalation: (id) => {
        const actor = get().currentUserId;
        set((s) => ({
          escalations: s.escalations.map((e) =>
            e.id !== id
              ? e
              : {
                  ...e,
                  status: "acknowledged",
                  acknowledgedAt: new Date().toISOString(),
                  acknowledgedBy: actor,
                },
          ),
          audit: record(s.audit, actor, "escalation.acknowledged", `Escalation ${id}`, "Seen by management"),
        }));
      },

      resolveEscalation: (id, adminNote) => {
        const actor = get().currentUserId;
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
          audit: record(
            s.audit,
            actor,
            "escalation.resolved",
            `Escalation ${id}`,
            adminNote?.trim() || "Resolved",
          ),
        }));
      },

      resetDemo: () =>
        set({ ...buildSeed(new Date()), currentUserId: get().currentUserId }),
    }),
    {
      name: "taskey.v1",
      // The server has no localStorage, so rehydration is driven explicitly
      // from the client in <TaskeyGate>. Without this the first paint would
      // render seed data and then mismatch on hydration.
      skipHydration: true,
    },
  ),
);

export const todayKey = () => dayKey(new Date());

export const useUser = (id: string) =>
  useTaskey((s) => s.users.find((u) => u.id === id));

export const useCurrentUser = () =>
  useTaskey((s) => s.users.find((u) => u.id === s.currentUserId)!);
