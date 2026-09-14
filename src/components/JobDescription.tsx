"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, Pause, Play, Plus, Trash2, X } from "lucide-react";
import { useTaskey } from "@/lib/store";
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  WEEKDAY_LABEL,
  nameList,
} from "@/lib/labels";
import type { TaskCategory, User } from "@/lib/types";
import { TimePicker } from "./TimePicker";
import { Badge, Chip, Field, Panel } from "./ui";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as TaskCategory[];
const WORKING_WEEK = [1, 2, 3, 4, 5];

/**
 * What somebody is responsible for, in their own words. Compact on purpose:
 * it is a reference for writing standing duties against, not the main event
 * on anybody's screen.
 */
export function Duties({
  user,
  readOnly,
}: {
  user: User;
  /** On your own account: this is management's to set, not yours. */
  readOnly?: boolean;
}) {
  const updateEmployee = useTaskey((s) => s.updateEmployee);
  const [duties, setDuties] = useState(user.duties);
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);

  const commit = (next: string[]) => {
    setDuties(next);
    setDirty(false);
    void updateEmployee(user.id, { duties: next });
  };

  return (
    <Panel
      title="Job description"
      subtitle={
        readOnly
          ? "What you are responsible for, as set by management."
          : "What they are responsible for. Standing duties are written against these."
      }
      bodyClassName=""
    >
      <ul className="divide-y divide-line border-t border-line">
        {duties.length === 0 && (
          <li className="px-5 py-2.5 text-[12px] text-muted">
            {readOnly
              ? "Nothing written down yet. Management sets this."
              : "Nothing listed yet."}
          </li>
        )}
        {duties.map((d, i) => (
          <li
            key={`${i}-${d}`}
            className="group flex items-start gap-2.5 px-5 py-2"
          >
            <Check size={12} className="mt-1.5 shrink-0 text-ok" strokeWidth={3} />
            {readOnly ? (
              <p className="min-w-0 flex-1 text-[12px] leading-snug text-ink">
                {d}
              </p>
            ) : (
              <>
                <input
                  value={d}
                  onChange={(e) => {
                    const next = [...duties];
                    next[i] = e.target.value;
                    setDuties(next);
                    setDirty(true);
                  }}
                  onBlur={() => dirty && commit(duties.filter((x) => x.trim()))}
                  aria-label={`Duty ${i + 1}`}
                  className="min-w-0 flex-1 bg-transparent text-[12px] leading-snug text-ink outline-none"
                />
                <button
                  type="button"
                  onClick={() => commit(duties.filter((_, j) => j !== i))}
                  aria-label={`Remove duty ${i + 1}`}
                  className="shrink-0 text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                >
                  <X size={13} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {readOnly ? (
        duties.length > 0 && (
          <p className="border-t border-line px-5 py-2.5 text-[11px] text-faint">
            Ask management to change any of this.
          </p>
        )
      ) : (
      <div className="flex gap-2 border-t border-line px-5 py-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !draft.trim()) return;
            commit([...duties, draft.trim()]);
            setDraft("");
          }}
          placeholder="Add a responsibility"
          aria-label="Add a responsibility"
          className="field h-9 flex-1 py-0 text-[12px]"
        />
        <button
          type="button"
          disabled={!draft.trim()}
          onClick={() => {
            commit([...duties, draft.trim()]);
            setDraft("");
          }}
          className="btn btn-ghost btn-sm"
        >
          <Plus size={13} />
          Add
        </button>
      </div>
      )}
    </Panel>
  );
}

/**
 * The duties that repeat. These are materialised into one task per person per
 * matching day, which is the difference between a job description and a list
 * somebody actually works through.
 */
export function RecurringDuties({
  user,
  readOnly,
}: {
  user?: User;
  /** On your own account: management decides what repeats for you. */
  readOnly?: boolean;
}) {
  const {
    users,
    recurring,
    addRecurringTask,
    setRecurringActive,
    removeRecurringTask,
  } = useTaskey();

  const rows = user
    ? recurring.filter((r) => r.assigneeIds.includes(user.id))
    : recurring;

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>(WORKING_WEEK);
  const [dueTime, setDueTime] = useState<string | undefined>(undefined);
  const [category, setCategory] = useState<TaskCategory>("admin");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    user ? [user.id] : [],
  );

  const team = users.filter((u) => !u.archivedAt && u.role === "employee");

  const submit = () => {
    if (!title.trim() || assigneeIds.length === 0 || weekdays.length === 0)
      return;
    addRecurringTask({
      title,
      detail,
      assigneeIds,
      weekdays,
      dueTime,
      category,
    });
    setTitle("");
    setDetail("");
    setAdding(false);
  };

  return (
    <Panel
      title="Standing duties"
      subtitle={
        readOnly
          ? "These land on your list every day they fall on. Management sets them."
          : "Generated onto the task list every day they fall on. Nobody hands these out."
      }
      bodyClassName=""
      action={
        readOnly ? undefined : (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="btn btn-ghost btn-sm"
          >
            {adding ? <X size={13} /> : <Plus size={13} />}
            {adding ? "Cancel" : "Add"}
          </button>
        )
      }
    >
      <ul className="divide-y divide-line">
        {rows.length === 0 && (
          <li className="px-5 py-3 text-[12px] text-muted">
            No standing duties yet.
          </li>
        )}
        {rows.map((r) => {
          const who = users.filter((u) => r.assigneeIds.includes(u.id));
          const Icon = CATEGORY_ICON[r.category];
          return (
            <li key={r.id} className="group flex items-center gap-3 px-5 py-2.5">
              <span
                className={clsx(
                  "grid size-7 shrink-0 place-items-center rounded-lg",
                  r.active
                    ? "bg-accent-soft text-accent"
                    : "bg-sunken text-faint",
                )}
              >
                <Icon size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={clsx(
                    "block truncate text-[13px] font-medium",
                    !r.active && "text-muted line-through",
                  )}
                >
                  {r.title}
                </span>
                <span className="block truncate text-[11px] text-faint">
                  {r.weekdays.length === 5 &&
                  r.weekdays.every((d) => d <= 5)
                    ? "Every working day"
                    : r.weekdays.map((d) => WEEKDAY_LABEL[d]).join(", ")}
                  {r.dueTime && ` at ${r.dueTime}`}
                  {!user && ` · ${nameList(who.map((u) => u.name))}`}
                </span>
              </span>
              {!r.active && <Badge>Paused</Badge>}
              {!readOnly && (
                <>
                  <button
                    type="button"
                    onClick={() => setRecurringActive(r.id, !r.active)}
                    aria-label={r.active ? "Pause" : "Resume"}
                    className="shrink-0 text-faint transition-colors hover:text-ink"
                  >
                    {r.active ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRecurringTask(r.id)}
                    aria-label="Remove"
                    className="shrink-0 text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {adding && (
        <div className="space-y-4 border-t border-line px-5 py-4">
          <div className="overflow-hidden rounded-lg bg-surface ring-1 ring-line-strong/70 focus-within:ring-2 focus-within:ring-accent/40">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="What do they do every day?"
              aria-label="Duty"
              className="w-full bg-transparent px-3.5 py-2.5 text-[12px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-faint"
            />
            <input
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Detail (optional)"
              aria-label="Detail"
              className="w-full border-t border-line bg-transparent px-3.5 py-2.5 text-[12px] text-ink outline-none placeholder:text-faint"
            />
          </div>

          <Field label="Days">
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <Chip
                  key={d}
                  on={weekdays.includes(d)}
                  onClick={() =>
                    setWeekdays((days) =>
                      days.includes(d)
                        ? days.filter((x) => x !== d)
                        : [...days, d].sort(),
                    )
                  }
                  className="w-14"
                >
                  {WEEKDAY_LABEL[d]}
                </Chip>
              ))}
            </div>
          </Field>

          <div className="flex items-start gap-3">
            <div className="w-[112px] shrink-0">
              <Field label="Time">
                <TimePicker value={dueTime} onChange={setDueTime} />
              </Field>
            </div>
            <div className="min-w-0 flex-1">
              <Field label="Category">
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((c) => (
                    <Chip
                      key={c}
                      on={c === category}
                      onClick={() => setCategory(c)}
                    >
                      {CATEGORY_LABEL[c]}
                    </Chip>
                  ))}
                </div>
              </Field>
            </div>
          </div>

          {!user && (
            <Field label="Who">
              <div className="grid grid-cols-3 gap-2">
                {team.map((u) => (
                  <Chip
                    key={u.id}
                    on={assigneeIds.includes(u.id)}
                    onClick={() =>
                      setAssigneeIds((ids) =>
                        ids.includes(u.id)
                          ? ids.filter((x) => x !== u.id)
                          : [...ids, u.id],
                      )
                    }
                  >
                    {u.name.split(" ")[0]}
                  </Chip>
                ))}
              </div>
            </Field>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={
              !title.trim() || weekdays.length === 0 || assigneeIds.length === 0
            }
            className="btn btn-primary btn-md w-full"
          >
            Add the standing duty
          </button>
        </div>
      )}
    </Panel>
  );
}
