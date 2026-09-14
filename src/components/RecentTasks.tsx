"use client";

import { useMemo, useState, type ReactNode } from "react";
import clsx from "clsx";
import { BellRing, Check, ChevronDown, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useNow } from "@/lib/now";
import { useTaskey } from "@/lib/store";
import {
  clockTime,
  dayKey,
  daysUntil,
  dueAt,
  relativeDays,
  shortDate,
  timeLeft,
} from "@/lib/date";
import {
  capitalise,
  CATEGORY_LABEL,
  nameList,
  PRIORITY_LABEL,
} from "@/lib/labels";
import type { Assignment, User } from "@/lib/types";
import { Avatar, AvatarStack } from "./ui";
import { CategoryMark } from "./TaskMeta";
import { SearchField } from "./SearchField";

type TabKey = "active" | "pending" | "reviewed" | "completed" | "archived";

const TABS: { key: TabKey; label: string }[] = [
  { key: "active", label: "Active Tasks" },
  { key: "pending", label: "Pending" },
  { key: "reviewed", label: "Reviewed" },
  { key: "completed", label: "Completed" },
  { key: "archived", label: "Archived" },
];

/** Two of the reference's tabs have no state behind them yet. Say so. */
const NOT_YET: Partial<Record<TabKey, string>> = {
  reviewed: "There is no review step yet, so nothing lands here.",
  archived:
    "Nothing is archived yet. Tasks stay on the list once they are done.",
};

export function RecentTasks({
  tasks,
  users,
  onNew,
  heading = "h1",
  openFirst,
}: {
  tasks: Assignment[];
  users: User[];
  /** Omitted where there is nothing to create from, e.g. one person's list. */
  onNew?: () => void;
  /** The page owns the h1 when this list is not the page's subject. */
  heading?: "h1" | "h2";
  /**
   * A task to open on arrival, so a link from a dashboard lands on the task
   * itself rather than on the list with the reader hunting for it.
   */
  openFirst?: string;
}) {
  const now = useNow();
  const today = dayKey(now);
  // A link to something already closed has to land on the tab that holds it.
  const [tab, setTab] = useState<TabKey>(() =>
    tasks.find((t) => t.id === openFirst)?.status === "done"
      ? "completed"
      : "active",
  );
  const [openId, setOpenId] = useState<string | null>(openFirst ?? null);
  const [query, setQuery] = useState("");
  const Heading = heading;

  const rows = useMemo(() => {
    const byTab = tasks.filter((a) => {
      if (tab === "completed") return a.status === "done";
      if (tab === "pending") return a.status === "open" && a.dueDate < today;
      if (tab === "active") return a.status === "open";
      return false;
    });

    const q = query.trim().toLowerCase();
    const matched = !q
      ? byTab
      : byTab.filter((a) => {
          const who = users
            .filter((u) => a.assigneeIds.includes(u.id))
            .map((u) => u.name)
            .join(" ");
          return `${a.title} ${a.detail ?? ""} ${who}`
            .toLowerCase()
            .includes(q);
        });

    // Same day sorts by time, with untimed work after everything booked.
    return [...matched].sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99"),
    );
  }, [tasks, users, tab, today, query]);

  // The reference groups the list by day, with the day as a quiet label.
  const groups = useMemo(() => {
    const out: { label: string; items: Assignment[] }[] = [];
    for (const a of rows) {
      const label = capitalise(relativeDays(a.dueDate, now));
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(a);
      else out.push({ label, items: [a] });
    }
    return out;
  }, [rows, now]);

  return (
    <section>
      <div className="flex items-center gap-3">
        <Heading className="text-[18px] font-bold tracking-tight">
          Tasks
        </Heading>
        {onNew && (
          <button
            type="button"
            onClick={onNew}
            className="ml-auto inline-flex h-7 items-center gap-1 rounded-full bg-accent px-3 text-[12px] font-semibold text-white transition-colors hover:bg-accent-ink"
          >
            <Plus size={13} strokeWidth={2.8} />
            New
          </button>
        )}
      </div>

      {/* --- tabs and search ------------------------------------------ */}
      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-line">
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={on ? "true" : undefined}
              className={clsx(
                "-mb-px border-b-[2.5px] pb-3 text-[13px] transition-colors",
                on
                  ? "border-accent font-bold text-accent"
                  : "border-transparent text-faint hover:text-ink",
              )}
            >
              {t.label}
            </button>
          );
        })}

        <SearchField
          value={query}
          onChange={setQuery}
          label="Search tasks"
          className="ml-auto mb-2 w-44"
        />
      </div>

      {/* --- the list -------------------------------------------------- */}
      {/* One rhythm, 8px, for every vertical gap in here: row to row, day
          label to row, group to group, and a row to its own detail card in
          TaskDetail. Move one and move all of them. */}
      {groups.length === 0 ? (
        <p className="px-1 py-12 text-center text-[13px] text-muted">
          {NOT_YET[tab] ??
            (query.trim()
              ? `Nothing matches “${query.trim()}”.`
              : "Nothing on this list.")}
        </p>
      ) : (
        <div className="mt-6 space-y-2">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-[12px] text-faint">{group.label}</p>
              <ul className="space-y-2">
                {group.items.map((a) => {
                  const who = users.filter((u) => a.assigneeIds.includes(u.id));
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenId((id) => (id === a.id ? null : a.id))
                        }
                        aria-expanded={openId === a.id}
                        className={clsx(
                          "flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left ring-1 transition-colors",
                          // Urgency is carried by the fill, so it only applies
                          // while the task is still open. Everything else is
                          // white, against the tinted ground of the page.
                          a.priority === "urgent" && a.status === "open"
                            ? "bg-danger-soft ring-danger/20 hover:bg-danger-soft/70"
                            : "bg-surface ring-line hover:ring-line-strong",
                        )}
                      >
                        <CategoryMark category={a.category} />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p
                              className={clsx(
                                "min-w-0 truncate text-[14px] font-bold",
                                a.status === "done" &&
                                  "text-muted line-through",
                              )}
                            >
                              {a.title}
                            </p>
                            {/* The fill is the only visible sign of urgency,
                                so the word still has to be readable out. */}
                            {a.priority === "urgent" && (
                              <span className="sr-only">Urgent</span>
                            )}
                          </div>
                          <p className="truncate text-[12px] font-medium text-muted">
                            {a.detail ??
                              `${CATEGORY_LABEL[a.category]} for ${nameList(
                                who.map((u) => u.name),
                              )}`}
                          </p>
                        </div>
                        {/* DM Sans has no tabular figures, so the time gets a
                            fixed box: without it a 09:30 and a 15:00 are
                            different widths and every icon after them shifts. */}
                        {a.dueTime && (
                          <span className="w-[38px] shrink-0 text-right text-[12px] text-muted">
                            {a.dueTime}
                          </span>
                        )}
                        <AvatarStack people={who} size={28} />
                        <ChevronDown
                          size={16}
                          className={clsx(
                            "shrink-0 text-faint transition-transform",
                            openId === a.id && "rotate-180",
                          )}
                        />
                      </button>

                      {openId === a.id && (
                        <TaskDetail task={a} who={who} users={users} />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * "today at 15:00" beats a bare date up close; a week out, the date wins.
 * The plain date only follows as a second line when the headline is relative,
 * since otherwise it would just say the same thing twice.
 */
function dueLabel(task: Assignment, now: Date) {
  const relative = Math.abs(daysUntil(task.dueDate, now)) <= 1;
  // relativeDays() is lowercase because most callers embed it mid-sentence.
  // Here it opens a standalone value, so it gets a capital.
  const day = capitalise(
    relative ? relativeDays(task.dueDate, now) : shortDate(task.dueDate),
  );
  return {
    main: task.dueTime ? `${day} at ${task.dueTime}` : `${day}, any time`,
    sub: relative ? shortDate(task.dueDate) : null,
  };
}

/** One labelled fact. Three of these sit across the top of the card. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/**
 * The row carries the headline. This carries the things you actually need in
 * order to act on it: when it lands, how long is left, who is holding it, and
 * the one move the viewer can make about it.
 */
function TaskDetail({
  task,
  who,
  users,
}: {
  task: Assignment;
  who: User[];
  users: User[];
}) {
  const now = useNow();
  const {
    completeAssignment,
    reopenAssignment,
    remindAssignment,
    deleteTask,
    users: team,
    currentUserId,
  } = useTaskey();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const assigner = users.find((u) => u.id === task.assignedById);
  const done = task.status === "done";
  const left = timeLeft(dueAt(task.dueDate, task.dueTime), now);
  const due = dueLabel(task, now);

  // Management hands work out; the person holding it is the one who closes it.
  // So the action follows the task: yours to finish, or theirs to be chased.
  const mine = task.assigneeIds.includes(currentUserId);
  const isManagement =
    team.find((u) => u.id === currentUserId)?.role === "admin";
  // A step belongs to its sheet, so there is nothing to delete here.
  const deletable = isManagement && !task.stepId;

  return (
    <div className="card mt-2">
      <div className="px-5 py-4">
        <p className="eyebrow flex items-center gap-1.5">
          {CATEGORY_LABEL[task.category]}
          <span aria-hidden>·</span>
          <span
            className={task.priority === "urgent" ? "text-danger" : undefined}
          >
            {PRIORITY_LABEL[task.priority]}
          </span>
        </p>

        {task.detail && (
          <p className="mt-3 max-w-[60ch] text-[13px] leading-snug text-ink">
            {task.detail}
          </p>
        )}

        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          <Fact label="Due">
            <p className="text-[14px] font-semibold text-ink">{due.main}</p>
            {due.sub && (
              <p className="mt-0.5 text-[12px] text-faint">{due.sub}</p>
            )}
          </Fact>

          <Fact label={done ? "Closed" : "Time left"}>
            {done ? (
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ok">
                <Check size={14} strokeWidth={3} />
                {task.completedAt ? shortDate(task.completedAt) : "Done"}
              </p>
            ) : (
              <p
                className={clsx(
                  "text-[14px] font-bold",
                  left.overdue
                    ? "text-danger"
                    : left.tight
                      ? "text-warn"
                      : "text-ink",
                )}
              >
                {left.text}
              </p>
            )}
          </Fact>

          <Fact label={who.length > 1 ? "With" : "Sitting with"}>
            <ul className="space-y-1">
              {who.map((u) => (
                <li key={u.id} className="flex items-center gap-2">
                  <Avatar name={u.name} tint={u.tint} size={24} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-ink">
                      {u.name}
                    </span>
                    <span className="block truncate text-[11px] text-faint">
                      {u.jobTitle}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Fact>
        </div>

        {task.completionNote && (
          <p className="mt-4 border-l-2 border-ok pl-3 text-[12px] italic text-muted">
            {task.completionNote}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
          <p className="text-[12px] text-faint">
            Set by {assigner?.name ?? "Management"} on{" "}
            {shortDate(task.createdAt)}
            {task.remindedAt && !done && (
              <>
                {" · "}
                <span className="text-muted">
                  Reminded {clockTime(task.remindedAt)} on{" "}
                  {shortDate(task.remindedAt)}
                </span>
              </>
            )}
          </p>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {deletable &&
              (confirmDelete ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      void deleteTask(task.id);
                      setConfirmDelete(false);
                    }}
                    className="btn btn-danger btn-sm"
                  >
                    <Trash2 size={13} />
                    Delete for good
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="btn btn-ghost btn-sm"
                  >
                    Keep it
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Delete this task"
                  title="Delete this task"
                  className="grid size-8 place-items-center rounded-full text-faint transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 size={14} />
                </button>
              ))}

            {!done && (
              <button
                type="button"
                onClick={() => remindAssignment(task.id)}
                className={clsx(
                  "btn btn-sm",
                  // Once chased, chasing again is a deliberate second act.
                  task.remindedAt || mine ? "btn-ghost" : "btn-primary",
                )}
              >
                <BellRing size={13} />
                {task.remindedAt ? "Remind again" : "Send a reminder"}
              </button>
            )}
            {mine && (
              <button
                type="button"
                onClick={() =>
                  done ? reopenAssignment(task.id) : completeAssignment(task.id)
                }
                className={clsx(
                  "btn btn-sm",
                  done ? "btn-ghost" : "btn-primary",
                )}
              >
                {done ? <RotateCcw size={13} /> : <Check size={13} />}
                {done ? "Reopen" : "Mark done"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
