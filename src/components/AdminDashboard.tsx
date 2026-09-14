"use client";

import { useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  Landmark,
  Receipt,
  Send,
  Users,
} from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { useFlags } from "@/lib/selectors";
import { dayKey, clockTime, prettyDate, relativeDays, shortDate } from "@/lib/date";
import { money } from "@/lib/rules";
import { phaseBalance, serviceById } from "@/lib/services";
import {
  practiceNumbers,
  sheetsByStep,
  teamRows,
  waitingOn,
} from "@/lib/dashboard";
import { AUDIT_LABEL, capitalise } from "@/lib/labels";
import { Avatar, Badge, Empty, Panel, StatTile } from "@/components/ui";
import { RankedBars } from "@/components/charts";
import { FlagCard } from "@/components/FlagCard";
import type { Project, User } from "@/lib/types";

/**
 * The whole practice on one screen, for whoever is running it.
 *
 * The order is deliberate: what is going wrong, then what is coming, then who
 * is carrying it, then what has just happened. Somebody who opens this and
 * closes it again should know whether today needs them.
 */
export function AdminDashboard({ me }: { me: User }) {
  const now = useNow();
  const today = dayKey(now);
  const { projects, assignments, users, audit, emailFailures } = useTaskey();
  const flags = useFlags();

  const n = useMemo(() => practiceNumbers(projects, now), [projects, now]);
  const team = useMemo(
    () => teamRows(users, assignments, projects, today),
    [users, assignments, projects, today],
  );

  // Everything the practice is late on, worst first, capped so the screen
  // stays a summary rather than becoming a second task list.
  const needsAPerson = flags.filter((f) => f.severity !== "info");
  const shown = needsAPerson.slice(0, 6);

  const coming = [...n.live]
    .filter((p) => !p.submittedAt)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);

  const openTasks = assignments.filter((a) => a.status === "open");
  const overdueTasks = openTasks.filter((a) => a.dueDate < today);

  return (
    <div className="min-w-0 space-y-8 p-5 md:p-8">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold tracking-tight">
            {greeting(now)}, {me.name.split(" ")[0]}
          </h1>
          <p className="mt-0.5 text-[12px] text-muted">
            {capitalise(prettyDate(now))} · the whole practice, as it stands
            right now.
          </p>
        </div>
        <Link
          href="/kpis"
          className="ml-auto shrink-0 btn btn-ghost btn-sm"
        >
          The numbers
          <ArrowRight size={13} />
        </Link>
      </div>

      {/* --- the four that matter -------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="Open sheets"
          value={n.live.length}
          hint={
            n.lateSheets.length > 0
              ? `${n.lateSheets.length} past the date we promised`
              : "None past the date we promised"
          }
          filled
        />
        <StatTile
          label="Submitting inside a week"
          value={n.submitSoon.length}
          hint="Counted from each payment date"
          tone={n.submitSoon.length > 0 ? "warn" : "neutral"}
          icon={<Send size={14} />}
        />
        <StatTile
          label="Waiting on clients"
          value={n.waitingOnClients.length}
          hint={
            n.waitingOnClients.length > 0
              ? "Documents still out, chased automatically"
              : "Nothing outstanding"
          }
          tone={n.waitingOnClients.length > 0 ? "warn" : "ok"}
          icon={<Users size={14} />}
        />
        <StatTile
          label="Money outstanding"
          value={money(n.owed)}
          hint={
            n.owed > 0
              ? `Across ${n.balancesDue.length} submitted project${n.balancesDue.length === 1 ? "" : "s"}`
              : "Nothing owed on anything submitted"
          }
          tone={n.owed > 0 ? "danger" : "ok"}
          icon={<Receipt size={14} />}
        />
      </div>

      {/* --- what is going wrong -------------------------------------- */}
      <section>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-[15px] font-semibold tracking-tight">
            Needs a person
          </h2>
          <p className="text-[12px] text-muted">
            {needsAPerson.length === 0
              ? "Nothing is late anywhere."
              : `${needsAPerson.length} thing${needsAPerson.length === 1 ? "" : "s"} the practice is behind on, worst first.`}
          </p>
        </div>

        {shown.length === 0 ? (
          <div className="card mt-4">
            <Empty
              icon={<BadgeCheck size={19} />}
              title="Everything is on its date"
              detail="No late steps, no client sitting on documents, no QC waiting and nothing overdue at the authority."
            />
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((f) => (
                <FlagCard key={`${f.kind}:${f.refId}`} flag={f} />
              ))}
            </div>
            {needsAPerson.length > shown.length && (
              <p className="mt-3 text-[12px] text-faint">
                And {needsAPerson.length - shown.length} more, on the projects
                and tasks lists.
              </p>
            )}
          </>
        )}
      </section>

      {/* --- letters that never left the building --------------------- */}
      {emailFailures.length > 0 && (
        <section>
          <Panel
            title="Emails that did not go out"
            subtitle="Recorded rather than retried silently, because a client who was never actually asked has to be asked again by a person."
          >
            <ul className="divide-y divide-line">
              {emailFailures.slice(0, 5).map((e) => (
                <li key={e.id} className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-3">
                  <span className="w-[76px] shrink-0 text-[12px] tabular-nums text-faint">
                    {shortDate(e.at)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">
                      {e.subject}
                    </span>
                    <span className="block truncate text-[12px] text-muted">
                      to {e.to} · {e.error}
                    </span>
                  </span>
                  {e.projectId && (
                    <Link
                      href={`/projects/${e.projectId}`}
                      className="btn btn-ghost btn-sm"
                    >
                      Open the sheet
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      )}

      {/* --- what is coming, and who is holding it -------------------- */}
      <div className="grid items-start gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Panel
          title="Submitting next"
          subtitle="Every open sheet, closest promise first."
          action={
            <Link href="/projects" className="btn btn-ghost btn-sm">
              All projects
              <ChevronRight size={13} />
            </Link>
          }
          bodyClassName=""
        >
          {coming.length === 0 ? (
            <p className="px-5 pb-5 text-[12px] text-muted">
              Nothing open. A sheet opens itself the moment a payment is
              loaded.
            </p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {coming.map((p) => (
                <li key={p.id}>
                  <SheetRow project={p} today={today} now={now} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="The team right now"
          subtitle="Whoever is furthest behind comes first."
          action={
            <Link href="/employees" className="btn btn-ghost btn-sm">
              Employees
              <ChevronRight size={13} />
            </Link>
          }
          bodyClassName=""
        >
          {team.length === 0 ? (
            <p className="px-5 pb-5 text-[12px] text-muted">
              Nobody on the team yet.
            </p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {team.map(({ user, record, carrying }) => (
                <li key={user.id}>
                  <Link
                    href={`/employees/${user.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-sunken/60"
                  >
                    <Avatar name={user.name} tint={user.tint} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">
                        {user.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {record.open} open
                        {record.dueToday > 0
                          ? ` · ${record.dueToday} due today`
                          : ""}
                        {carrying > 0
                          ? ` · ${carrying} sheet${carrying === 1 ? "" : "s"}`
                          : ""}
                      </span>
                    </span>
                    {record.overdue > 0 ? (
                      <Badge tone="danger">{record.overdue} late</Badge>
                    ) : (
                      <span className="text-[11px] text-faint">On top</span>
                    )}
                    <ChevronRight size={14} className="shrink-0 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* --- where the work is sitting, and what just happened -------- */}
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_1.35fr]">
        <Panel
          title="Where the sheets are sitting"
          subtitle={`${n.live.length} open sheet${n.live.length === 1 ? "" : "s"}, by the step each is on.`}
        >
          <RankedBars
            rows={sheetsByStep(n.live)}
            empty="No open sheets to place."
          />

          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
            <Fact
              label="QC waiting"
              value={n.qcWaiting.length}
              bad={n.qcWaiting.length > 0}
            />
            <Fact
              label="At the authority"
              value={n.atAuthority.length}
            />
            <Fact
              label="Queries open"
              value={n.queriesOpen.length}
              bad={n.queriesOpen.length > 0}
            />
          </dl>
        </Panel>

        <Panel
          title="Just happened"
          subtitle="The audit trail, newest first. Nothing here can be edited."
          bodyClassName=""
        >
          {audit.length === 0 ? (
            <p className="px-5 pb-5 text-[12px] text-muted">
              Nothing recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {[...audit]
                .sort((a, b) => b.at.localeCompare(a.at))
                .slice(0, 7)
                .map((e) => {
                  const actor = users.find((u) => u.id === e.actorId);
                  return (
                    <li
                      key={e.id}
                      className="flex items-start gap-3 px-5 py-3"
                    >
                      {actor ? (
                        <Avatar
                          name={actor.name}
                          tint={actor.tint}
                          size={26}
                        />
                      ) : (
                        <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                          <Landmark size={12} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-semibold">
                          {AUDIT_LABEL[e.type]}
                          <span className="font-normal text-muted">
                            {" · "}
                            {e.subject}
                          </span>
                        </span>
                        <span className="block truncate text-[11px] text-faint">
                          {e.detail}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-[11px] tabular-nums text-faint">
                        {shortDate(e.at)}
                        <span className="block">{clockTime(e.at)}</span>
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
        </Panel>
      </div>

      <p className="text-[11px] text-faint">
        {openTasks.length} task{openTasks.length === 1 ? "" : "s"} open across
        the team
        {overdueTasks.length > 0
          ? `, ${overdueTasks.length} past its date`
          : ", none late"}
        . {money(n.received)} received against {money(n.fees)} of live work.
      </p>
    </div>
  );
}

/** One open sheet: who it is, what it waits on, and when it must go in. */
function SheetRow({
  project: p,
  today,
  now,
}: {
  project: Project;
  today: string;
  now: Date;
}) {
  const users = useTaskey((s) => s.users);
  const owner = users.find((u) => u.id === p.ownerId);
  const late = p.dueDate < today;
  const balance = p.submittedAt ? phaseBalance(p) : 0;

  return (
    <Link
      href={`/projects/${p.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-sunken/60 sm:px-5"
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 max-w-full truncate text-[13px] font-semibold">
            {p.client}
          </span>
          <Badge>{serviceById(p.serviceId).short}</Badge>
        </span>
        <span className="mt-0.5 block text-[11px] text-muted sm:truncate">
          {waitingOn(p, now)}
          {balance > 0 ? ` · ${money(balance)} due` : ""}
        </span>
        <span
          className={clsx(
            "mt-1 block text-[11px] font-semibold tabular-nums sm:hidden",
            late ? "text-danger" : "text-muted",
          )}
        >
          {shortDate(p.dueDate)} ·{" "}
          {capitalise(relativeDays(p.dueDate, now).replace("in ", ""))}
        </span>
      </span>

      <span className="hidden w-24 shrink-0 text-right sm:block">
        <span
          className={clsx(
            "block text-[12px] font-semibold tabular-nums",
            late ? "text-danger" : "text-ink",
          )}
        >
          {shortDate(p.dueDate)}
        </span>
        <span
          className={clsx(
            "block text-[11px]",
            late ? "text-danger" : "text-faint",
          )}
        >
          {capitalise(relativeDays(p.dueDate, now).replace("in ", ""))}
        </span>
      </span>

      {owner && <Avatar name={owner.name} tint={owner.tint} size={26} />}
      <ChevronRight size={14} className="shrink-0 text-faint" />
    </Link>
  );
}

function Fact({
  label,
  value,
  bad,
}: {
  label: string;
  value: number;
  bad?: boolean;
}) {
  return (
    <div>
      {/* Three of these across a phone means a two-line label next to a
          one-line label, so the box is held at two lines and the numbers
          keep a common baseline. */}
      <dt className="eyebrow min-h-[26px] leading-tight sm:min-h-0">{label}</dt>
      <dd
        className={clsx(
          "mt-1 text-[18px] font-medium tabular-nums",
          bad ? "text-warn" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** Local time of day, since the practice runs on South African hours. */
function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
