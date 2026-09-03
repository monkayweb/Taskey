"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Download, ShieldAlert, ShieldCheck } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { clockTime, shortDate } from "@/lib/date";
import type { AuditType } from "@/lib/types";
import { Avatar, Badge, Empty, Panel } from "@/components/ui";
import type { Tone } from "@/components/ui";

const TYPE_LABEL: Record<AuditType, string> = {
  "log.submitted": "Day submitted",
  "block.completed": "Block partly done",
  "block.missed": "Block missed",
  "lead.quote_sent": "Quote sent",
  "lead.responded": "First response",
  "lead.stage_changed": "Stage changed",
  "lead.activity": "Lead activity",
  "project.created": "Project created",
  "milestone.completed": "Milestone closed",
  "escalation.raised": "Escalation raised",
  "escalation.acknowledged": "Escalation seen",
  "escalation.resolved": "Escalation resolved",
};

const TYPE_TONE: Record<AuditType, Tone> = {
  "log.submitted": "ok",
  "block.completed": "warn",
  "block.missed": "danger",
  "lead.quote_sent": "accent",
  "lead.responded": "ok",
  "lead.stage_changed": "neutral",
  "lead.activity": "neutral",
  "project.created": "accent",
  "milestone.completed": "ok",
  "escalation.raised": "danger",
  "escalation.acknowledged": "accent",
  "escalation.resolved": "ok",
};

const GROUPS: { value: string; label: string; types: AuditType[] }[] = [
  { value: "all", label: "Everything", types: [] },
  {
    value: "discipline",
    label: "Completed vs missed",
    types: ["log.submitted", "block.completed", "block.missed"],
  },
  {
    value: "sales",
    label: "Leads & quotes",
    types: [
      "lead.quote_sent",
      "lead.responded",
      "lead.stage_changed",
      "lead.activity",
    ],
  },
  {
    value: "delivery",
    label: "Delivery & escalations",
    types: [
      "project.created",
      "milestone.completed",
      "escalation.raised",
      "escalation.acknowledged",
      "escalation.resolved",
    ],
  },
];

const PAGE = 60;

export default function AuditPage() {
  const { audit, users, currentUserId } = useTaskey();
  const me = users.find((u) => u.id === currentUserId)!;
  const [group, setGroup] = useState("all");
  const [person, setPerson] = useState("all");
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const types = GROUPS.find((g) => g.value === group)?.types ?? [];
    return audit
      .filter((e) => (types.length === 0 ? true : types.includes(e.type)))
      .filter((e) => (person === "all" ? true : e.actorId === person));
  }, [audit, group, person]);

  if (me.role !== "admin") {
    return (
      <Panel>
        <Empty
          icon={<ShieldAlert size={22} />}
          title="Admin only"
          detail="The audit trail is management-only. Switch to the owner account in the sidebar."
        />
      </Panel>
    );
  }

  function exportCsv() {
    const rows = [
      ["timestamp", "person", "event", "subject", "detail"],
      ...filtered.map((e) => [
        e.at,
        users.find((u) => u.id === e.actorId)?.name ?? e.actorId,
        TYPE_LABEL[e.type],
        e.subject,
        e.detail,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `taskey-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Audit trail</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Append-only record of completed versus missed work. Nothing here can be
            edited or deleted, which is the point.
          </p>
        </div>
        <button type="button" onClick={exportCsv} className="btn btn-ghost btn-md">
          <Download size={15} />
          Export CSV
        </button>
      </div>

      <div className="card flex items-center gap-2 bg-ok-soft px-5 py-3">
        <ShieldCheck size={16} className="shrink-0 text-ok" />
        <p className="text-[13px] text-ok">
          {audit.length.toLocaleString()} immutable entries. Submitted daily logs are
          locked at submission and cannot be revised afterwards.
        </p>
      </div>

      <Panel
        action={
          <select
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            className="field h-8 w-[170px] py-0 text-[13px]"
            aria-label="Filter by person"
          >
            <option value="all">Everyone</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        }
        title={`${filtered.length.toLocaleString()} entries`}
        bodyClassName=""
      >
        <div className="flex gap-1 overflow-x-auto border-b border-line px-4 pb-3">
          {GROUPS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => {
                setGroup(g.value);
                setLimit(PAGE);
              }}
              className={clsx(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                group === g.value
                  ? "bg-accent-soft text-accent-ink"
                  : "text-muted hover:bg-sunken",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <Empty title="No entries match these filters" />
        ) : (
          <>
            <div className="scroll-x">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.06em] text-faint">
                    <th className="px-5 py-2 font-semibold">When</th>
                    <th className="px-3 py-2 font-semibold">Who</th>
                    <th className="px-3 py-2 font-semibold">Event</th>
                    <th className="px-3 py-2 font-semibold">Subject</th>
                    <th className="px-3 py-2 font-semibold">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.slice(0, limit).map((e) => {
                    const who = users.find((u) => u.id === e.actorId);
                    return (
                      <tr key={e.id} className="hover:bg-sunken">
                        <td className="whitespace-nowrap px-5 py-2 font-mono text-[12px] tabular-nums text-muted">
                          {shortDate(e.at)} {clockTime(e.at)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {who && (
                            <span className="flex items-center gap-1.5">
                              <Avatar name={who.name} tint={who.tint} size={20} />
                              {who.name}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <Badge tone={TYPE_TONE[e.type]}>{TYPE_LABEL[e.type]}</Badge>
                        </td>
                        <td className="px-3 py-2">{e.subject}</td>
                        <td className="px-3 py-2 text-muted">{e.detail}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {limit < filtered.length && (
              <div className="border-t border-line p-3 text-center">
                <button
                  type="button"
                  onClick={() => setLimit((l) => l + PAGE)}
                  className="btn btn-ghost btn-sm"
                >
                  Show {Math.min(PAGE, filtered.length - limit)} more
                </button>
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
