"use client";

import Link from "next/link";
import { ArrowRight, Lock, ShieldAlert } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useFlags, useWeekKpis } from "@/lib/selectors";
import { useNow } from "@/lib/now";
import { clockTime, dayKey, prettyDate, shortDate, workWeek } from "@/lib/date";
import { money } from "@/lib/rules";
import { scoreTone } from "@/lib/kpi";
import {
  FLAG_LABEL,
  FLAG_TONE,
  SKIP_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
} from "@/lib/labels";
import { EscalationQueue } from "@/components/EscalationQueue";
import {
  Avatar,
  Badge,
  Empty,
  Meter,
  Panel,
  StatTile,
  pctText,
} from "@/components/ui";

export default function AdminPage() {
  const now = useNow();
  const today = dayKey(now);
  const week = workWeek(now);
  const { users, logs, currentUserId, escalations, resetDemo } = useTaskey();
  const me = users.find((u) => u.id === currentUserId)!;
  const flags = useFlags();
  const kpis = useWeekKpis();
  // Read before the admin guard below — hooks can't sit after an early return.
  const openPipeline = useTaskey((st) =>
    st.leads
      .filter((l) => l.stage !== "won" && l.stage !== "lost")
      .reduce((sum, l) => sum + l.value, 0),
  );

  if (me.role !== "admin") {
    return (
      <Panel>
        <Empty
          icon={<ShieldAlert size={22} />}
          title="Admin only"
          detail="Switch to the owner account in the sidebar to see the management view."
        />
      </Panel>
    );
  }

  const employees = users.filter((u) => u.role === "employee");
  const todayLogs = employees.map((u) => ({
    user: u,
    log: logs.find((l) => l.userId === u.id && l.date === today),
  }));
  const submittedToday = todayLogs.filter((r) => r.log?.submittedAt).length;

  const openEscalations = escalations.filter((e) => e.status === "open").length;
  const criticalFlags = flags.filter((f) => f.severity === "critical");
  const teamScore =
    kpis.length > 0
      ? Math.round(kpis.reduce((a, k) => a + k.score, 0) / kpis.length)
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Admin dashboard</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {prettyDate(now)} · week of {shortDate(week[0])}. Everything below is built from the
            team&rsquo;s own submissions.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/audit" className="btn btn-ghost btn-md">
            Audit trail
            <ArrowRight size={15} />
          </Link>
          <button
            type="button"
            onClick={() => {
              if (confirm("Reset all demo data back to the seeded state?"))
                resetDemo();
            }}
            className="btn btn-ghost btn-md"
          >
            Reset demo
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Submitted today"
          value={`${submittedToday}/${employees.length}`}
          hint="End-of-day logs received"
          tone={submittedToday === employees.length ? "ok" : "warn"}
        />
        <StatTile
          label="Open escalations"
          value={openEscalations}
          hint="Waiting on you"
          tone={openEscalations ? "danger" : "ok"}
        />
        <StatTile
          label="Critical flags"
          value={criticalFlags.length}
          hint="Unanswered inquiries, breached quotes, late milestones"
          tone={criticalFlags.length ? "danger" : "ok"}
        />
        <StatTile
          label="Team score"
          value={teamScore}
          hint="Average of this week's KPI scores"
          tone={scoreTone(teamScore)}
        />
      </div>

      <EscalationQueue />

      {/* --- today's submissions ------------------------------------------ */}
      <Panel
        title="Today's submissions"
        subtitle="What was finished, what was missed and the reason given."
        bodyClassName=""
      >
        <ul className="divide-y divide-line">
          {todayLogs.map(({ user, log }) => {
            const blocks = log?.blocks ?? [];
            const done = blocks.filter((b) => b.status === "done").length;
            const partial = blocks.filter((b) => b.status === "partial").length;
            const missed = blocks.filter((b) => b.status === "missed").length;
            const pending = blocks.filter((b) => b.status === "pending").length;
            const notDone = blocks.filter((b) => b.status !== "done" && b.status !== "pending");

            return (
              <li key={user.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                  <Avatar name={user.name} tint={user.tint} size={26} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-medium">{user.name}</p>
                      {log?.submittedAt ? (
                        <Badge tone="ok">
                          <Lock size={11} />
                          Submitted {clockTime(log.submittedAt)}
                        </Badge>
                      ) : blocks.length === 0 ? (
                        <Badge>No blocks scheduled</Badge>
                      ) : (
                        <Badge tone="warn">
                          In progress · {pending} of {blocks.length} not logged
                        </Badge>
                      )}
                    </div>

                    {blocks.length > 0 && (
                      <>
                        <Meter
                          className="mt-2"
                          segments={[
                            { value: done, tone: "ok", title: `${done} done` },
                            { value: partial, tone: "warn", title: `${partial} partial` },
                            { value: missed, tone: "danger", title: `${missed} missed` },
                            { value: pending, tone: "neutral", title: `${pending} not logged` },
                          ]}
                        />
                        <p className="mt-1.5 text-xs text-muted">
                          {done} done · {partial} partly done · {missed} missed
                          {log?.extraTasks.length
                            ? ` · ${log.extraTasks.length} unplanned task${log.extraTasks.length === 1 ? "" : "s"}`
                            : ""}
                        </p>
                      </>
                    )}

                    {log?.summaryNote && (
                      <p className="mt-2 rounded-lg border border-line bg-sunken px-3 py-2 text-[13px]">
                        “{log.summaryNote}”
                      </p>
                    )}

                    {notDone.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {notDone.map((b) => (
                          <li key={b.id} className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge tone={STATUS_TONE[b.status]}>
                              {STATUS_LABEL[b.status]}
                            </Badge>
                            <span className="font-mono tabular-nums text-faint">
                              {b.start}
                            </span>
                            <span className="font-medium">{b.label}</span>
                            <span className="text-muted">
                              — {b.skipReason ? SKIP_LABEL[b.skipReason] : "no reason given"}
                              {b.note ? `: ${b.note}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      {/* --- KPI table ---------------------------------------------------- */}
      <Panel
        title="Weekly KPI report"
        subtitle="Fed automatically by the daily submissions — nobody fills this in."
        bodyClassName=""
      >
        <div className="scroll-x">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.06em] text-faint">
                <th className="px-4 py-2 font-semibold">Person</th>
                <th className="px-3 py-2 text-right font-semibold">Score</th>
                <th className="px-3 py-2 text-right font-semibold">Logs</th>
                <th className="px-3 py-2 text-right font-semibold">Blocks done</th>
                <th className="px-3 py-2 text-right font-semibold">Missed</th>
                <th className="px-3 py-2 text-right font-semibold">Quotes sent</th>
                <th className="px-3 py-2 text-right font-semibold">Late follow-ups</th>
                <th className="px-3 py-2 text-right font-semibold">Avg 1st reply</th>
                <th className="px-3 py-2 text-right font-semibold">Milestones</th>
                <th className="px-3 py-2 text-right font-semibold">Escalations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {kpis.map((k) => (
                <tr key={k.user.id} className="hover:bg-sunken">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={k.user.name} tint={k.user.tint} size={22} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{k.user.name}</p>
                        <p className="truncate text-[11px] text-faint">
                          {k.user.jobTitle}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="num px-3 py-2.5">
                    <Badge tone={scoreTone(k.score)}>{k.score}</Badge>
                  </td>
                  <td className="num px-3 py-2.5">
                    {k.logsSubmitted}/{k.logsExpected}
                  </td>
                  <td className="num px-3 py-2.5">{pctText(k.completionRate)}</td>
                  <td className="num px-3 py-2.5">
                    <span className={k.blocksMissed > 0 ? "text-danger" : ""}>
                      {k.blocksMissed}
                    </span>
                  </td>
                  <td className="num px-3 py-2.5">{k.quotesSent}</td>
                  <td className="num px-3 py-2.5">
                    <span className={k.followUpsBreached > 0 ? "text-danger" : ""}>
                      {k.followUpsBreached}
                    </span>
                  </td>
                  <td className="num px-3 py-2.5">
                    {k.avgFirstResponseHours === null
                      ? "—"
                      : `${k.avgFirstResponseHours.toFixed(1)}h`}
                  </td>
                  <td className="num px-3 py-2.5">{k.milestonesClosed}</td>
                  <td className="num px-3 py-2.5">{k.escalations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* --- business-wide flags ------------------------------------------ */}
      <Panel
        title="Everything currently slipping"
        subtitle="Across the whole team, ordered by cost of ignoring it."
        bodyClassName=""
      >
        {flags.length === 0 ? (
          <Empty title="Nothing is slipping" />
        ) : (
          <ul className="divide-y divide-line">
            {flags.map((f) => {
              const owner = users.find((u) => u.id === f.ownerId);
              return (
                <li key={`${f.kind}:${f.refId}`}>
                  <Link
                    href={f.href}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-sunken"
                  >
                    {owner && <Avatar name={owner.name} tint={owner.tint} size={22} />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{f.title}</p>
                      <p className="truncate text-xs text-muted">{f.detail}</p>
                    </div>
                    <Badge tone={FLAG_TONE[f.severity]}>
                      {FLAG_LABEL[f.kind]}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <p className="px-1 text-[11px] text-faint">
        Open pipeline across the team: {money(openPipeline)}
      </p>
    </div>
  );
}
