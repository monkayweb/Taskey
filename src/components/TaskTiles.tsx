"use client";

import clsx from "clsx";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { relativeDays } from "@/lib/date";
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  PRIORITY_ICON,
  PRIORITY_LABEL,
  TILE_FILL,
} from "@/lib/labels";
import type { Assignment, User } from "@/lib/types";
import { AvatarStack } from "./ui";
import { TileMenu } from "./TileMenu";

/**
 * The three headline tiles. Icons sit bare on the fill rather than in boxes:
 * a translucent square behind every glyph reads as chrome and competes with
 * the title, which is the thing you are meant to look at.
 */
export function TaskTiles({
  tasks,
  users,
}: {
  tasks: Assignment[];
  users: User[];
}) {
  const now = useNow();
  const { completeAssignment, reopenAssignment } = useTaskey();

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
        <p className="text-[14px] font-semibold">Nothing open right now</p>
        <p className="mt-0.5 text-[13px] text-muted">
          Anything you assign shows up here first.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {tasks.map((task, i) => {
        const who = users.filter((u) => task.assigneeIds.includes(u.id));
        const Icon = CATEGORY_ICON[task.category];
        const Priority = PRIORITY_ICON[task.priority];
        const done = task.status === "done";
        return (
          <article
            key={task.id}
            className={clsx(
              "flex min-h-[178px] flex-col rounded-2xl p-5 text-white",
              TILE_FILL[i % TILE_FILL.length],
            )}
          >
            {/* --- what kind of work it is ------------------------------ */}
            <div className="flex items-start justify-between gap-2">
              <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.07em]">
                <Icon size={16} strokeWidth={2.2} />
                {CATEGORY_LABEL[task.category]}
              </span>
              <TileMenu
                done={done}
                onToggle={() =>
                  done ? reopenAssignment(task.id) : completeAssignment(task.id)
                }
              />
            </div>

            {/* A card title, not a section: the page's one heading is the
                Tasks list below, and an h3 here would land before it. */}
            <p className="mt-4 text-[16px] font-bold leading-snug">
              {task.title}
            </p>

            {/* --- when, and who has it --------------------------------- */}
            <div className="mt-auto flex items-end justify-between gap-3 pt-5">
              <span
                className="flex items-center gap-1.5 text-[12px] font-semibold"
                title={`${PRIORITY_LABEL[task.priority]} priority`}
              >
                <Priority size={15} strokeWidth={2.4} />
                {relativeDays(task.dueDate, now)}
                {task.dueTime && ` · ${task.dueTime}`}
              </span>
              <AvatarStack people={who} size={30} />
            </div>
          </article>
        );
      })}
    </div>
  );
}
