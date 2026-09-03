"use client";

import Link from "next/link";
import { ArrowRight, Bell, CheckCircle2 } from "lucide-react";
import type { Flag } from "@/lib/types";
import { FLAG_LABEL, FLAG_TONE } from "@/lib/labels";
import { Badge, Empty, Panel } from "./ui";

/**
 * The morning briefing. Anything the rules say needs a human today, ordered
 * so the top row is the thing most likely to cost the business money.
 */
export function DailyActions({ flags }: { flags: Flag[] }) {
  const critical = flags.filter((f) => f.severity === "critical").length;

  return (
    <Panel
      title="Required today"
      subtitle="Generated from your quotes, inquiries and project deadlines — no one has to compile this."
      action={
        <Badge tone={critical ? "danger" : flags.length ? "warn" : "ok"}>
          <Bell size={11} />
          {flags.length === 0 ? "All clear" : `${flags.length} to action`}
        </Badge>
      }
      bodyClassName=""
    >
      {flags.length === 0 ? (
        <Empty
          icon={<CheckCircle2 size={22} />}
          title="Nothing is waiting on you"
          detail="No idle inquiries, no quotes past their follow-up window and no overdue milestones."
        />
      ) : (
        <ul className="divide-y divide-line">
          {flags.map((flag) => (
            <li key={`${flag.kind}:${flag.refId}`}>
              <Link
                href={flag.href}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-sunken"
              >
                <span
                  className={
                    flag.severity === "critical"
                      ? "size-1.5 shrink-0 rounded-full bg-danger"
                      : flag.severity === "warning"
                        ? "size-1.5 shrink-0 rounded-full bg-warn"
                        : "size-1.5 shrink-0 rounded-full bg-line-strong"
                  }
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{flag.title}</p>
                  <p className="truncate text-xs text-muted">{flag.detail}</p>
                </div>
                <Badge tone={FLAG_TONE[flag.severity]}>
                  {FLAG_LABEL[flag.kind]}
                </Badge>
                <ArrowRight size={15} className="shrink-0 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
