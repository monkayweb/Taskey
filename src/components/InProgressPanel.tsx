"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useNow } from "@/lib/now";
import { dayKey, relativeDays } from "@/lib/date";
import { serviceById, stepsDone, WORKFLOW_STEPS } from "@/lib/services";
import type { Project } from "@/lib/types";
import { Empty, Panel, ProgressRow } from "./ui";

/**
 * A project cannot be created from here, or anywhere else by hand: a sheet
 * exists because a client paid. So this panel reads, and points at the sheet.
 */
export function InProgressPanel({ projects }: { projects: Project[] }) {
  const now = useNow();
  const today = dayKey(now);
  const active = projects.filter((p) => p.status !== "complete");

  return (
    <Panel
      title="In progress"
      action={
        <Link
          href="/projects"
          className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent-ink hover:bg-accent/15"
        >
          View all
        </Link>
      }
    >
      {active.length === 0 ? (
        <Empty
          title="No active projects"
          detail="A project sheet opens itself the moment a client's payment is recorded."
        />
      ) : (
        <div className="space-y-4">
          {active.slice(0, 3).map((p) => {
            const done = stepsDone(p);
            const total = p.milestones.length;
            const step = p.milestones.find((m) => !m.done);
            const behind = p.milestones.some(
              (m) => !m.done && m.dueDate < today,
            );
            return (
              <ProgressRow
                key={p.id}
                label={p.client}
                detail={`${serviceById(p.serviceId).short} · step ${step ? step.step : WORKFLOW_STEPS} of ${WORKFLOW_STEPS} · ${p.submittedAt ? "submitted" : `submits ${relativeDays(p.dueDate, now)}`}`}
                pct={total === 0 ? 0 : done / total}
                behind={behind}
              />
            );
          })}
        </div>
      )}

      <Link
        href="/projects"
        className="btn btn-primary btn-md mt-4 w-full"
      >
        Open the project sheets
        <ArrowRight size={15} />
      </Link>
    </Panel>
  );
}
