"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ShieldAlert,
  UserMinus,
  UserRoundCheck,
} from "lucide-react";
import { useTaskey } from "@/lib/store";
import { ROLE_BLURB, ROLE_LABEL, ROLE_SHORT } from "@/lib/labels";
import type { WorkRole } from "@/lib/types";
import { Avatar, Badge, Chip, Empty, Panel } from "@/components/ui";
import { SeatLine } from "@/components/SeatLine";
import { DeleteEmployee } from "@/components/DeleteEmployee";
import { Duties, RecurringDuties } from "@/components/JobDescription";

const ROLES = Object.keys(ROLE_LABEL) as WorkRole[];

/**
 * Everything about a person that is a setting rather than work: what they do,
 * what repeats, whether they can get in, and whether they are still here.
 *
 * All four used to be stacked on their record, which buried the thing anybody
 * actually opens that page for.
 */
export default function EmployeeSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const { users, currentUserId, updateEmployee, archiveEmployee, restoreEmployee } =
    useTaskey();
  const me = users.find((u) => u.id === currentUserId)!;
  const user = users.find((u) => u.id === id);
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (me.role !== "admin") {
    return (
      <div className="p-5 md:p-8">
        <Panel>
          <Empty
            icon={<ShieldAlert size={22} />}
            title="Admin only"
            detail="Only management changes somebody's role or access."
          />
        </Panel>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-5 md:p-8">
        <Panel>
          <Empty
            title="No such employee"
            detail="They may have been deleted, or the link is wrong."
          />
        </Panel>
        <Link
          href="/employees"
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent-ink"
        >
          <ArrowLeft size={14} />
          Back to employees
        </Link>
      </div>
    );
  }

  const gone = !!user.archivedAt;
  const removable = user.role === "employee" && user.id !== currentUserId && !gone;

  return (
    <div className="min-h-dvh">
      <div className="min-w-0 space-y-6 p-5 md:p-8">
        <Link
          href={`/employees/${user.id}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={14} />
          {user.name}
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <Avatar name={user.name} tint={user.tint} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[18px] font-bold tracking-tight">
                {user.name}
              </h1>
              <Badge tone={gone ? "danger" : "accent"}>
                {gone ? "Not on the team" : ROLE_LABEL[user.workRole]}
              </Badge>
            </div>
            <p className="mt-0.5 text-[12px] text-muted">
              Settings · {user.jobTitle} · {user.email}
            </p>
          </div>
        </div>

        {/* --- what they do, which decides what reaches them ---------- */}
        <Panel
          title="Role"
          subtitle={ROLE_BLURB[user.workRole]}
          bodyClassName="px-5 pb-5"
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {ROLES.map((r) => (
              <Chip
                key={r}
                on={r === user.workRole}
                onClick={() => updateEmployee(user.id, { workRole: r })}
              >
                {ROLE_SHORT[r]}
              </Chip>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-faint">
            Project steps are written against roles, not people. Change this
            and the next step of that kind reaches them instead of whoever
            holds it now.
          </p>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="min-w-0 space-y-6">
            <Duties user={user} />

            <Panel title="Access" bodyClassName="">
              <div className="border-t border-line">
                <SeatLine user={user} />
              </div>
            </Panel>
          </div>

          <div className="min-w-0">
            <RecurringDuties user={user} />
          </div>
        </div>

        {/* --- leaving ------------------------------------------------ */}
        <Panel
          title="Leaving"
          subtitle="Two ways out, and they are not the same thing."
          bodyClassName="px-5 pb-5"
        >
          <div className="flex flex-wrap items-start gap-x-4 gap-y-3 border-t border-line pt-4">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold">
                {gone ? "Put them back on the team" : "Remove from the team"}
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                {gone
                  ? "They go back on every list and can be handed work again. Nothing of theirs was lost."
                  : "They drop off every list and cannot be handed new work. Every task, log and signature stays exactly where it is, and they can be put back."}
              </p>
            </div>

            {gone ? (
              <button
                type="button"
                onClick={() => restoreEmployee(user.id)}
                className="btn btn-ghost btn-sm shrink-0"
              >
                <UserRoundCheck size={13} />
                Put back
              </button>
            ) : (
              removable &&
              // Two clicks, never one.
              (confirmRemove ? (
                <span className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      archiveEmployee(user.id);
                      setConfirmRemove(false);
                    }}
                    className="btn btn-danger btn-sm"
                  >
                    Yes, remove them
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(false)}
                    className="btn btn-ghost btn-sm"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(true)}
                  className="btn btn-ghost btn-sm shrink-0"
                >
                  <UserMinus size={13} />
                  Remove from the team
                </button>
              ))
            )}
          </div>

          {!gone && (
            <div className="mt-1">
              <DeleteEmployee user={user} />
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
