"use client";

import { useEffect } from "react";
import { CalendarClock, CheckCircle2, ListChecks } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useMyFlags, useTodayLog } from "@/lib/selectors";
import { useNow } from "@/lib/now";
import { dayKey, prettyDate } from "@/lib/date";
import { TaskBoard } from "@/components/TaskBoard";
import { FlagCard } from "@/components/FlagCard";
import { OverwhelmedButton } from "@/components/OverwhelmedButton";
import { AgendaRail } from "@/components/AgendaRail";
import { AssignedToMe } from "@/components/Assignments";
import { Empty, Panel } from "@/components/ui";

export default function TasksPage() {
  const now = useNow();
  const today = dayKey(now);
  const { currentUserId, users, ensureLog } = useTaskey();
  const me = users.find((u) => u.id === currentUserId)!;
  const isEmployee = me.role === "employee";

  useEffect(() => {
    if (isEmployee) ensureLog(me.id, today);
  }, [me.id, isEmployee, today, ensureLog]);

  const log = useTodayLog(me.id);
  const flags = useMyFlags(me.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">My tasks</h1>
          <p className="mt-0.5 text-[13px] text-muted">{prettyDate(now)}</p>
        </div>
        <div className="md:hidden">{isEmployee && <OverwhelmedButton compact />}</div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_312px]">
        <div className="min-w-0 space-y-6">
      {/* --- what needs a human first --------------------------------- */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <ListChecks size={15} className="text-faint" />
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
            Needs action
          </h2>
          <span className="text-[11px] text-faint">
            {flags.length === 0 ? "all clear" : `${flags.length} open`}
          </span>
        </div>

        {flags.length === 0 ? (
          <Panel>
            <Empty
              icon={<CheckCircle2 size={20} />}
              title="Nothing is waiting on you"
              detail="No idle inquiries, no quotes past their follow-up window and no overdue milestones."
            />
          </Panel>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {flags.map((f) => (
              <FlagCard key={`${f.kind}:${f.refId}`} flag={f} />
            ))}
          </div>
        )}
      </section>

      {/* --- work management put on you -------------------------------- */}
      {isEmployee && <AssignedToMe userId={me.id} />}

      {/* --- the calendar-synced checklist ----------------------------- */}
          {log ? (
            <TaskBoard log={log} />
          ) : (
            <Panel title="Today's tasks">
              <Empty
                icon={<CalendarClock size={20} />}
                title="No checklist for this account"
                detail="Only team members with calendar tasks get a daily log. Switch user in the sidebar to see one."
              />
            </Panel>
          )}
        </div>

        {isEmployee && (
          <div className="xl:sticky xl:top-5 xl:self-start">
            <AgendaRail me={me} />
          </div>
        )}
      </div>
    </div>
  );
}
