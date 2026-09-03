"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, FolderKanban } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { dayKey, relativeDays, shortDate } from "@/lib/date";
import { PROJECT_DUE_SOON_DAYS } from "@/lib/rules";
import { Avatar, Badge, Empty, Meter, Panel, StatTile } from "@/components/ui";

export default function ProjectsPage() {
  const now = useNow();
  const today = dayKey(now);
  const { projects, users, currentUserId, toggleMilestone } = useTaskey();
  const me = users.find((u) => u.id === currentUserId)!;
  const [mineOnly, setMineOnly] = useState(me.role === "employee");

  const scoped = mineOnly
    ? projects.filter((p) => p.ownerId === me.id)
    : projects;

  const active = scoped.filter((p) => p.status === "active");
  const overdueMilestones = scoped
    .filter((p) => p.status !== "complete")
    .flatMap((p) => p.milestones)
    .filter((m) => !m.done && m.dueDate < today);
  const dueSoon = active.filter((p) => {
    const days =
      (new Date(`${p.dueDate}T12:00:00`).getTime() - now.getTime()) / 86_400_000;
    return days >= 0 && days <= PROJECT_DUE_SOON_DAYS;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Milestones tick over here and land in the audit trail — nobody has to
            ask for a status update.
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-muted">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
            className="size-3.5 accent-[var(--color-accent)]"
          />
          Only mine
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Active projects" value={active.length} />
        <StatTile
          label="Overdue milestones"
          value={overdueMilestones.length}
          hint="Flagged on the owner's daily list"
          tone={overdueMilestones.length ? "danger" : "ok"}
        />
        <StatTile
          label={`Delivering in ${PROJECT_DUE_SOON_DAYS} days`}
          value={dueSoon.length}
          tone={dueSoon.length ? "warn" : "neutral"}
        />
      </div>

      {scoped.length === 0 ? (
        <Panel>
          <Empty icon={<FolderKanban size={22} />} title="No projects yet" />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {scoped.map((project) => {
            const owner = users.find((u) => u.id === project.ownerId)!;
            const doneCount = project.milestones.filter((m) => m.done).length;
            const late = project.milestones.filter(
              (m) => !m.done && m.dueDate < today,
            ).length;

            return (
              <Panel
                key={project.id}
                title={project.name}
                subtitle={`${project.client} · delivers ${relativeDays(project.dueDate, now)} (${shortDate(project.dueDate)})`}
                action={
                  <div className="flex items-center gap-1.5">
                    {late > 0 && <Badge tone="danger">{late} late</Badge>}
                    {project.status === "on_hold" && <Badge>On hold</Badge>}
                    <Avatar name={owner.name} tint={owner.tint} size={24} />
                  </div>
                }
                bodyClassName=""
              >
                <div className="px-4 pt-3">
                  <Meter
                    segments={[
                      { value: doneCount, tone: "ok" },
                      { value: late, tone: "danger" },
                      {
                        value: project.milestones.length - doneCount - late,
                        tone: "neutral",
                      },
                    ]}
                  />
                  <p className="mt-1.5 text-[11px] text-faint">
                    {doneCount}/{project.milestones.length} milestones complete
                  </p>
                </div>

                <ul className="mt-1 divide-y divide-line">
                  {project.milestones.map((m) => {
                    const isLate = !m.done && m.dueDate < today;
                    return (
                      <li key={m.id} className="px-4 py-2.5">
                        <label className="flex cursor-pointer items-center gap-2.5">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={m.done}
                            onClick={() => toggleMilestone(project.id, m.id)}
                            className={clsx(
                              "grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors",
                              m.done
                                ? "border-ok bg-ok text-white"
                                : "border-line-strong bg-surface hover:border-accent",
                            )}
                          >
                            {m.done && <Check size={12} strokeWidth={3} />}
                          </button>
                          <span
                            className={clsx(
                              "min-w-0 flex-1 text-[13px]",
                              m.done && "text-faint line-through",
                            )}
                          >
                            {m.label}
                          </span>
                          <span
                            className={clsx(
                              "shrink-0 font-mono text-[11px] tabular-nums",
                              isLate ? "text-danger" : "text-faint",
                            )}
                          >
                            {shortDate(m.dueDate)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
