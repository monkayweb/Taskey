"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ChevronDown,
  Clock,
  FileText,
  FolderKanban,
  MessageCircleReply,
  TriangleAlert,
} from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { clockTime, hoursSince, relativeDays, shortDate } from "@/lib/date";
import {
  FOLLOW_UP_DAYS,
  INQUIRY_IDLE_HOURS,
  followUpSlack,
  isOpen,
  money,
} from "@/lib/rules";
import { CHANNEL_LABEL, STAGE_LABEL, STAGE_TONE } from "@/lib/labels";
import type { ActivityKind, Lead, LeadStage } from "@/lib/types";
import { Avatar, Badge } from "./ui";

const STAGES: LeadStage[] = [
  "inquiry",
  "contacted",
  "quoted",
  "negotiating",
  "won",
  "lost",
];

/** The countdown that makes the 3-day rule visible before it's breached. */
function FollowUpClock({ lead }: { lead: Lead }) {
  const now = useNow();
  const slack = followUpSlack(lead, now);
  if (slack === null) return null;

  if (slack < 0)
    return (
      <Badge tone="danger">
        <TriangleAlert size={11} />
        {Math.abs(slack)}d past follow-up
      </Badge>
    );
  if (slack === 0)
    return (
      <Badge tone="warn">
        <Clock size={11} />
        Follow up today
      </Badge>
    );
  return (
    <Badge tone="neutral">
      <Clock size={11} />
      {slack}d of {FOLLOW_UP_DAYS} left
    </Badge>
  );
}

export function LeadCard({ lead }: { lead: Lead }) {
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [quoteValue, setQuoteValue] = useState(lead.value);

  const { users, logActivity, markFirstResponse, sendQuote, setStage } = useTaskey();
  const owner = users.find((u) => u.id === lead.ownerId)!;

  const unanswered = isOpen(lead) && !lead.firstResponseAt;
  const idleHours = unanswered ? hoursSince(lead.createdAt, now) : 0;
  const breached = unanswered && idleHours >= INQUIRY_IDLE_HOURS;
  const slack = followUpSlack(lead, now);

  return (
    <li
      className={clsx(
        "border-l-2",
        breached || (slack !== null && slack < 0)
          ? "border-l-danger"
          : slack === 0
            ? "border-l-warn"
            : "border-l-transparent",
      )}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 px-5 py-3">
        <Avatar name={owner.name} tint={owner.tint} size={26} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[14px] font-medium">{lead.company}</p>
            <Badge tone={STAGE_TONE[lead.stage]}>{STAGE_LABEL[lead.stage]}</Badge>
            <Badge>{CHANNEL_LABEL[lead.channel]}</Badge>
            {breached && (
              <Badge tone="danger">
                <TriangleAlert size={11} />
                No reply in {idleHours}h
              </Badge>
            )}
            <FollowUpClock lead={lead} />
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {lead.contactName} · {owner.name} · last touched{" "}
            {relativeDays(lead.lastActivityAt, now)}
            {lead.quoteSentAt && ` · quoted ${shortDate(lead.quoteSentAt)}`}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[13px] tabular-nums">{money(lead.value)}</p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink"
            aria-expanded={open}
          >
            {lead.activity.length} update{lead.activity.length === 1 ? "" : "s"}
            <ChevronDown
              size={12}
              className={clsx("transition-transform", open && "rotate-180")}
            />
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-line bg-sunken px-5 py-3">
          {isOpen(lead) && (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={
                  unanswered
                    ? "What did you tell them? (logging this stops the idle-inquiry alert)"
                    : "Log a call, email or WhatsApp reply…"
                }
                className="field h-9 py-0 text-[13px]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!reply.trim()}
                  onClick={() => {
                    const kind: ActivityKind =
                      lead.channel === "whatsapp"
                        ? "whatsapp"
                        : lead.channel === "phone"
                          ? "call"
                          : "email";
                    if (unanswered) markFirstResponse(lead.id, reply.trim());
                    else logActivity(lead.id, kind, reply.trim());
                    setReply("");
                  }}
                  className="btn btn-primary btn-sm"
                >
                  <MessageCircleReply size={14} />
                  Log reply
                </button>
              </div>
            </div>
          )}

          {isOpen(lead) && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted">Quote value</span>
                <input
                  type="number"
                  step={500}
                  value={quoteValue}
                  onChange={(e) => setQuoteValue(Number(e.target.value))}
                  className="field h-8 w-[120px] py-0 text-[13px]"
                  aria-label="Quote value"
                />
                <button
                  type="button"
                  onClick={() =>
                    sendQuote(
                      lead.id,
                      quoteValue,
                      `Quote sent for ${money(quoteValue)}.`,
                    )
                  }
                  className="btn btn-ghost btn-sm"
                >
                  <FileText size={14} />
                  {lead.quoteSentAt ? "Re-send quote" : "Send quote"}
                </button>
              </div>

              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[11px] text-muted">Stage</span>
                <select
                  value={lead.stage}
                  onChange={(e) => setStage(lead.id, e.target.value as LeadStage)}
                  className="field h-8 w-[130px] py-0 text-[13px]"
                  aria-label="Lead stage"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {lead.stage === "won" && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-ok-soft/50 px-3 py-2.5">
              {lead.projectId ? (
                <>
                  <span className="text-[13px] font-medium">
                    Won, and the sheet is open.
                  </span>
                  <Link
                    href={`/projects/${lead.projectId}`}
                    className="btn btn-ghost btn-sm"
                  >
                    <FolderKanban size={14} />
                    Open the project
                  </Link>
                </>
              ) : (
                <>
                  <span className="text-[13px] font-medium">
                    Won. The sheet opens when the payment is recorded.
                  </span>
                  <Link
                    href={`/projects?lead=${lead.id}`}
                    className="btn btn-primary btn-sm"
                  >
                    <FolderKanban size={14} />
                    Open the project sheet
                  </Link>
                </>
              )}
            </div>
          )}

          <ol className="space-y-1.5 border-t border-line pt-3">
            {lead.activity.map((a) => (
              <li key={a.id} className="flex gap-2 text-xs">
                <span className="w-[76px] shrink-0 tabular-nums text-faint">
                  {shortDate(a.at)} {clockTime(a.at)}
                </span>
                <span className="text-muted">
                  <span className="font-medium text-ink">
                    {a.kind.replace(/_/g, " ")}
                  </span>{" "}
                  · {a.detail}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </li>
  );
}
