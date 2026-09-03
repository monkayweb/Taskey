"use client";

import Link from "next/link";
import clsx from "clsx";
import { useNow } from "@/lib/now";
import { dayKey, daysUntil, shortDate } from "@/lib/date";
import { useTaskey } from "@/lib/store";
import type { Project } from "@/lib/types";
import { AvatarStack, Badge, pctText } from "./ui";

/**
 * The 3-up project row. Progress is milestone completion, and the pill on the
 * right is the honest deadline signal — red once it's behind.
 */
export function ProgressCards({ projects }: { projects: Project[] }) {
  const now = useNow();
  const today = dayKey(now);
  const users = useTaskey((s) => s.users);

  if (projects.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.slice(0, 3).map((project) => {
        const owner = users.find((u) => u.id === project.ownerId);
        const done = project.milestones.filter((m) => m.done).length;
        const total = project.milestones.length || 1;
        const pct = done / total;
        const late = project.milestones.filter(
          (m) => !m.done && m.dueDate < today,
        ).length;
        const left = daysUntil(project.dueDate, now);

        return (
          <Link
            key={project.id}
            href="/projects"
            className="card group px-5 py-4 transition-shadow hover:shadow-[var(--shadow-pop)]"
          >
            <p className="font-mono text-[11px] tabular-nums text-faint">
              {shortDate(project.dueDate)}
            </p>
            <p className="mt-1 truncate text-[15px] font-semibold tracking-tight group-hover:text-accent-ink">
              {project.name}
            </p>
            <p className="truncate text-xs text-muted">{project.client}</p>

            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="text-muted">Progress</span>
              <span className="font-mono font-medium tabular-nums">{pctText(pct)}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-track">
              {pct > 0 && (
                <div
                  className={clsx(
                    "h-full rounded-full",
                    late > 0 ? "bg-danger-fill" : "bg-accent",
                  )}
                  style={{ width: `${Math.max(pct * 100, 4)}%` }}
                />
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <AvatarStack people={owner ? [owner] : []} />
              {late > 0 ? (
                <Badge tone="danger">
                  {late} milestone{late === 1 ? "" : "s"} late
                </Badge>
              ) : project.status === "on_hold" ? (
                <Badge>On hold</Badge>
              ) : (
                <Badge tone={left <= 2 ? "warn" : "accent"}>
                  {left < 0
                    ? `${Math.abs(left)} days over`
                    : left === 0
                      ? "Due today"
                      : `${left} days left`}
                </Badge>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
