"use client";

import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, CheckCircle2, Flame } from "lucide-react";
import type { Flag } from "@/lib/types";
import { FLAG_LABEL } from "@/lib/labels";

/**
 * The single most urgent thing, given its own card on the overview. The rest
 * of the queue lives on the tasks page, so this page never becomes a list to
 * wade through.
 */
export function UrgentCard({
  flags,
  tasksHref,
}: {
  flags: Flag[];
  tasksHref: string;
}) {
  const top = flags[0];
  const rest = flags.length - 1;

  if (!top) {
    return (
      <section className="card flex items-center gap-3 px-5 py-4 ring-ok/20">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ok-soft text-ok">
          <CheckCircle2 size={19} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">Nothing urgent</h2>
          <p className="mt-0.5 text-xs text-muted">
            No idle inquiries, no quotes past their follow-up window, no overdue
            milestones.
          </p>
        </div>
      </section>
    );
  }

  const critical = top.severity === "critical";

  return (
    <section
      className={clsx(
        "card overflow-hidden p-0",
        critical ? "ring-danger/25" : "ring-warn/25",
      )}
    >
      <div className="flex flex-wrap items-center gap-4 px-5 py-5">
        <span
          className={clsx(
            "grid size-12 shrink-0 place-items-center rounded-2xl text-white",
            critical ? "bg-danger-fill" : "bg-warn-fill",
          )}
        >
          <Flame size={22} />
        </span>

        <div className="min-w-0 flex-1">
          <p
            className={clsx(
              "text-[11px] font-semibold uppercase tracking-[0.08em]",
              critical ? "text-danger" : "text-warn",
            )}
          >
            Most urgent · {FLAG_LABEL[top.kind]}
          </p>
          <h2 className="mt-1 truncate text-[19px] font-semibold tracking-tight">
            {top.title}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">{top.detail}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link href={top.href} className="btn btn-primary btn-md">
            Handle it
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {rest > 0 && (
        <Link
          href={tasksHref}
          className="flex items-center justify-between gap-2 border-t border-line bg-sunken px-5 py-2.5 text-[12px] font-medium text-muted transition-colors hover:text-ink"
        >
          <span>
            {rest} more {rest === 1 ? "item needs" : "items need"} attention today
          </span>
          <ArrowRight size={14} />
        </Link>
      )}
    </section>
  );
}
