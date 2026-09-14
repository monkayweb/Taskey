"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  CalendarDays,
  Check,
  ClipboardList,
  RotateCcw,
  UserPlus,
} from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useAssignmentsFor } from "@/lib/selectors";
import { useNow } from "@/lib/now";
import { dayKey, relativeDays, shortDate } from "@/lib/date";
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  nameList,
} from "@/lib/labels";
import type { Assignment, AssignmentPriority, TaskCategory } from "@/lib/types";
import { DatePicker } from "./DatePicker";
import { TimePicker } from "./TimePicker";
import { AvatarStack, Badge, Chip, Empty, Field, Panel } from "./ui";
import { activeEmployees } from "@/lib/rules";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as TaskCategory[];

const firstName = (name: string) => name.split(" ")[0];

type DueTone = "danger" | "warn" | "ok" | "neutral";

/** Overdue, due today, later. Drives the tint on a card. */
function dueTone(a: Assignment, now: Date): DueTone {
  if (a.status === "done") return "ok";
  const today = dayKey(now);
  if (a.dueDate < today) return "danger";
  if (a.dueDate === today) return "warn";
  return "neutral";
}

// ---------------------------------------------------------------------------
// Employee side: what management has put on you.
// ---------------------------------------------------------------------------

export function AssignedToMe({ userId }: { userId: string }) {
  const now = useNow();
  const assignments = useAssignmentsFor(userId);
  const open = assignments.filter((a) => a.status === "open");
  const done = assignments.filter((a) => a.status === "done");

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList size={15} className="text-faint" />
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
          Assigned to you
        </h2>
        <span className="text-[11px] text-faint">
          {open.length === 0 ? "nothing open" : `${open.length} open`}
        </span>
      </div>

      {assignments.length === 0 ? (
        <Panel>
          <Empty
            icon={<ClipboardList size={20} />}
            title="Nothing has been assigned to you"
            detail="Work handed out by management shows up here as well as in the audit trail."
          />
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {open.map((a) => (
            <AssignmentCard key={a.id} assignment={a} now={now} />
          ))}
          {done.map((a) => (
            <AssignmentCard key={a.id} assignment={a} now={now} />
          ))}
        </div>
      )}
    </section>
  );
}

const SHELL: Record<DueTone, string> = {
  danger: "bg-danger-soft/40 ring-danger/20",
  warn: "bg-warn-soft/50 ring-warn/20",
  ok: "bg-ok-soft/50 ring-ok/20",
  neutral: "bg-surface ring-line",
};

function AssignmentCard({
  assignment: a,
  now,
}: {
  assignment: Assignment;
  now: Date;
}) {
  const { users, completeAssignment, reopenAssignment } = useTaskey();
  const [note, setNote] = useState("");
  const [noting, setNoting] = useState(false);
  const assigner = users.find((u) => u.id === a.assignedById);
  const tone = dueTone(a, now);

  return (
    <div
      className={clsx("flex flex-col rounded-2xl p-4 ring-1", SHELL[tone])}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium tabular-nums">
          <CalendarDays size={13} className="text-faint" />
          {shortDate(a.dueDate)}
        </span>
        <div className="flex shrink-0 gap-1">
          {a.priority === "urgent" && a.status === "open" && (
            <Badge tone={PRIORITY_TONE.urgent}>{PRIORITY_LABEL.urgent}</Badge>
          )}
          <Badge>{CATEGORY_LABEL[a.category]}</Badge>
        </div>
      </div>

      <h3 className="mt-2.5 text-[16px] font-semibold leading-snug tracking-tight">
        {a.title}
      </h3>
      {a.detail && (
        <p className="mt-1 text-[13px] leading-snug text-muted">{a.detail}</p>
      )}
      <p className="mt-1 text-xs text-muted">
        {assigner ? `From ${assigner.name}` : "Assigned"} · due{" "}
        {relativeDays(a.dueDate, now)}
      </p>

      {a.status === "done" ? (
        <div className="mt-4 space-y-1.5 border-t border-line/70 pt-3">
          <Badge tone="ok">
            <Check size={10} />
            Done
          </Badge>
          {a.completionNote && (
            <p className="text-xs leading-snug text-muted">
              {a.completionNote}
            </p>
          )}
          <button
            type="button"
            onClick={() => reopenAssignment(a.id)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-faint transition-colors hover:text-ink"
          >
            <RotateCcw size={11} />
            Reopen
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {noting && (
            <input
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && completeAssignment(a.id, note)
              }
              placeholder="Optional: what you did"
              className="field h-9 py-0 text-[13px]"
            />
          )}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => completeAssignment(a.id, note)}
              className="btn btn-primary btn-sm flex-1"
            >
              <Check size={14} />
              Mark done
            </button>
            {!noting && (
              <button
                type="button"
                onClick={() => setNoting(true)}
                className="btn btn-ghost btn-sm"
              >
                Add a note
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin side: hand work out, then watch it.
// ---------------------------------------------------------------------------

export function AssignTaskPanel({
  defaultAssigneeIds,
}: {
  /** Opened from one person's page, the work is already pointed at them. */
  defaultAssigneeIds?: string[];
} = {}) {
  const now = useNow();
  const { users, assignTask } = useTaskey();
  const employees = activeEmployees(users);

  const today = dayKey(now);

  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    defaultAssigneeIds?.length
      ? defaultAssigneeIds
      : employees[0]
        ? [employees[0].id]
        : [],
  );
  const [dueDate, setDueDate] = useState(today);
  const [dueTime, setDueTime] = useState<string | undefined>(undefined);
  const [priority, setPriority] = useState<AssignmentPriority>("normal");
  const [category, setCategory] = useState<TaskCategory>("other");
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const assignees = employees.filter((u) => assigneeIds.includes(u.id));
  const ready = title.trim().length > 0 && assignees.length > 0 && !!dueDate;

  const toggleAssignee = (id: string) =>
    setAssigneeIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );

  useEffect(() => {
    if (!confirmed) return;
    const t = setTimeout(() => setConfirmed(null), 4000);
    return () => clearTimeout(t);
  }, [confirmed]);

  function submit() {
    if (!ready) return;
    assignTask({
      title: title.trim(),
      detail,
      assigneeIds,
      dueDate,
      dueTime,
      priority,
      category,
    });
    setConfirmed(
      `Sent to ${nameList(assignees.map((u) => firstName(u.name)))}.`,
    );
    // Assignee and due date usually stay put across a run of tasks, so only
    // the task itself resets.
    setTitle("");
    setDetail("");
    setPriority("normal");
  }

  return (
    <section>
      <h2 className="text-[18px] font-bold tracking-tight">New Task</h2>

      <div className="mt-6 space-y-4">
        {/* Title and detail read as one field group, as in the reference. */}
        <div className="overflow-hidden rounded-lg bg-surface ring-1 ring-line-strong/70 focus-within:ring-2 focus-within:ring-accent/40">
          <input
            id="new-task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Task Title Here"
            aria-label="Task title"
            className="w-full bg-transparent px-3.5 py-2.5 text-[12px] font-semibold
                       text-ink outline-none placeholder:font-medium placeholder:text-faint"
          />
          <textarea
            rows={2}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Detail (optional)"
            aria-label="Detail"
            className="w-full resize-none border-t border-line bg-transparent px-3.5 py-2.5
                       text-[12px] leading-snug text-ink outline-none placeholder:text-faint"
          />
        </div>

        <div>
          <Field label="Category">
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => {
                const Icon = CATEGORY_ICON[c];
                return (
                  <Chip
                    key={c}
                    on={c === category}
                    onClick={() => setCategory(c)}
                  >
                    <Icon size={13} strokeWidth={2.2} aria-hidden />
                    {CATEGORY_LABEL[c]}
                  </Chip>
                );
              })}
            </div>
          </Field>
        </div>

        <div>
          <Field label="Due">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <DatePicker value={dueDate} min={today} onChange={setDueDate} />
              </div>
              <div className="w-[112px] shrink-0">
                <TimePicker value={dueTime} onChange={setDueTime} />
              </div>
            </div>
          </Field>
        </div>

        <div>
          <Field label="Priority">
            <div className="flex flex-wrap items-center gap-2">
              <Chip
                on={priority === "normal"}
                onClick={() => setPriority("normal")}
              >
                Normal
              </Chip>
              <Chip
                tone="danger"
                on={priority === "urgent"}
                onClick={() => setPriority("urgent")}
              >
                Urgent
              </Chip>
            </div>
          </Field>
        </div>

        {/* One task goes to one person, so this behaves like the category
            row: picking somebody replaces whoever was there. */}
        <div>
          <Field label="Members">
            <div className="grid grid-cols-3 gap-2">
              {employees.map((u) => (
                <Chip
                  key={u.id}
                  on={assigneeIds.includes(u.id)}
                  onClick={() => toggleAssignee(u.id)}
                >
                  {firstName(u.name)}
                </Chip>
              ))}
            </div>
          </Field>
        </div>

        <p className="text-[11px] leading-snug text-muted" aria-live="polite">
          {confirmed ? (
            <span className="inline-flex items-center gap-1 font-medium text-ok">
              <Check size={12} />
              {confirmed}
            </span>
          ) : assignees.length === 0 ? (
            "Pick at least one person to assign this to."
          ) : (
            <>
              Goes to{" "}
              <span className="font-medium text-ink">
                {nameList(assignees.map((u) => firstName(u.name)))}
              </span>
              , due {relativeDays(dueDate, now)}
              {dueTime && ` at ${dueTime}`}
              {priority === "urgent" && ", urgent"}
            </>
          )}
        </p>

        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          className="btn btn-primary h-11 w-full rounded-lg text-[15px] font-semibold"
        >
          Create Task
        </button>
      </div>
    </section>
  );
}

export function TeamAssignments() {
  const now = useNow();
  const { users, assignments } = useTaskey();
  const [showDone, setShowDone] = useState(false);

  const rows = assignments
    .filter((a) => showDone || a.status === "open")
    .sort(
      (a, b) =>
        Number(a.status === "done") - Number(b.status === "done") ||
        a.dueDate.localeCompare(b.dueDate),
    );
  const openCount = assignments.filter((a) => a.status === "open").length;
  const doneCount = assignments.length - openCount;

  return (
    <Panel
      title="Assigned work"
      subtitle={`${openCount} open across the team. Nobody can mark one done without it landing in the audit trail.`}
      bodyClassName=""
      action={
        doneCount > 0 && (
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="btn btn-ghost btn-sm"
          >
            {showDone ? "Hide" : "Show"} {doneCount} done
          </button>
        )
      }
    >
      {rows.length === 0 ? (
        <div className="px-5 pb-5">
          <Empty
            icon={<UserPlus size={20} />}
            title="Nothing is assigned right now"
            detail="Use the form above to put something on somebody's list."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((a) => {
            const who = users.filter((u) => a.assigneeIds.includes(u.id));
            const overdue = a.status === "open" && a.dueDate < dayKey(now);
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-sunken"
              >
                <AvatarStack people={who} size={24} />
                <div className="min-w-0 flex-1">
                  <p
                    className={clsx(
                      "truncate text-[13px] font-medium",
                      a.status === "done" && "text-muted line-through",
                    )}
                  >
                    {a.title}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {nameList(who.map((u) => u.name))} · due{" "}
                    {relativeDays(a.dueDate, now)}
                    {a.completionNote ? ` · “${a.completionNote}”` : ""}
                  </p>
                </div>
                {a.priority === "urgent" && a.status === "open" && (
                  <Badge tone="danger">Urgent</Badge>
                )}
                <Badge
                  tone={
                    a.status === "done" ? "ok" : overdue ? "danger" : "neutral"
                  }
                >
                  {a.status === "done" ? "Done" : overdue ? "Overdue" : "Open"}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
