"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Inbox, Plus } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import {
  FOLLOW_UP_DAYS,
  INQUIRY_IDLE_HOURS,
  followUpSlack,
  isOpen,
  leadFlags,
  money,
  activeEmployees,
} from "@/lib/rules";
import { SERVICES, serviceById } from "@/lib/services";
import { CHANNEL_LABEL } from "@/lib/labels";
import type { LeadChannel } from "@/lib/types";
import { LeadCard } from "@/components/LeadCard";
import { Empty, Panel, StatTile } from "@/components/ui";

type Filter = "needs_action" | "open" | "quoted" | "closed" | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "needs_action", label: "Needs action" },
  { value: "open", label: "Open" },
  { value: "quoted", label: "Awaiting decision" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

export default function LeadsPage() {
  const now = useNow();
  const { leads, users, currentUserId } = useTaskey();
  const me = users.find((u) => u.id === currentUserId)!;
  const [filter, setFilter] = useState<Filter>("needs_action");
  const [mineOnly, setMineOnly] = useState(me.role === "employee");

  const scoped = useMemo(
    () => (mineOnly ? leads.filter((l) => l.ownerId === me.id) : leads),
    [leads, mineOnly, me.id],
  );

  const stats = useMemo(() => {
    const unanswered = scoped.filter((l) => isOpen(l) && !l.firstResponseAt);
    const overdue = scoped.filter((l) => {
      const s = followUpSlack(l, now);
      return s !== null && s < 0;
    });
    const dueToday = scoped.filter((l) => followUpSlack(l, now) === 0);
    const pipeline = scoped.filter(isOpen).reduce((sum, l) => sum + l.value, 0);
    return { unanswered, overdue, dueToday, pipeline };
  }, [scoped, now]);

  const visible = useMemo(() => {
    // Priority ordering comes straight from the rules engine, so the list
    // matches what the morning briefing told them to do.
    const priority = new Map<string, number>();
    for (const lead of scoped) {
      const top = leadFlags(lead, now).reduce(
        (max, f) => Math.max(max, f.priority),
        0,
      );
      priority.set(lead.id, top);
    }

    const filtered = scoped.filter((l) => {
      switch (filter) {
        case "needs_action":
          return (priority.get(l.id) ?? 0) > 0;
        case "open":
          return isOpen(l);
        case "quoted":
          return l.stage === "quoted" || l.stage === "negotiating";
        case "closed":
          return !isOpen(l);
        default:
          return true;
      }
    });

    return filtered.sort((a, b) => {
      const pd = (priority.get(b.id) ?? 0) - (priority.get(a.id) ?? 0);
      if (pd !== 0) return pd;
      return b.lastActivityAt.localeCompare(a.lastActivityAt);
    });
  }, [scoped, filter, now]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Leads & quotes
          </h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Quotes are chased automatically after {FOLLOW_UP_DAYS} days of
            silence; inquiries are flagged after {INQUIRY_IDLE_HOURS} hours
            without a reply.
          </p>
        </div>
        <NewInquiry />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Unanswered inquiries"
          value={stats.unanswered.length}
          hint={`Flagged after ${INQUIRY_IDLE_HOURS}h with no reply`}
          tone={stats.unanswered.length ? "danger" : "ok"}
        />
        <StatTile
          label="Quotes past follow-up"
          value={stats.overdue.length}
          hint={`Silent more than ${FOLLOW_UP_DAYS} days`}
          tone={stats.overdue.length ? "danger" : "ok"}
        />
        <StatTile
          label="Due today"
          value={stats.dueToday.length}
          hint="Hits the follow-up window today"
          tone={stats.dueToday.length ? "warn" : "neutral"}
        />
        <StatTile
          label="Open pipeline"
          value={money(stats.pipeline)}
          hint={`${scoped.filter(isOpen).length} live opportunities`}
        />
      </div>

      <Panel
        title="Pipeline"
        subtitle="Ordered by what will cost you money first, not by date created."
        action={
          <label className="flex items-center gap-1.5 text-[11px] text-muted">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
              className="size-3.5 accent-[var(--color-accent)]"
            />
            Only mine
          </label>
        }
        bodyClassName=""
      >
        <div className="flex gap-1 overflow-x-auto border-b border-line px-4 pb-3">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={clsx(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                filter === f.value
                  ? "bg-accent-soft text-accent-ink"
                  : "text-muted hover:bg-sunken",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <Empty
            icon={<Inbox size={22} />}
            title={
              filter === "needs_action"
                ? "Nothing is slipping"
                : "No leads match this filter"
            }
            detail={
              filter === "needs_action"
                ? "Every inquiry has been answered and every quote is inside its follow-up window."
                : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

const CHANNELS = Object.keys(CHANNEL_LABEL) as LeadChannel[];

/** Intake form. Starts the idle-inquiry clock the moment something lands. */
function NewInquiry() {
  const { addLead, users, currentUserId } = useTaskey();
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [channel, setChannel] = useState<LeadChannel>("whatsapp");
  const [serviceId, setServiceId] = useState("");
  const [detail, setDetail] = useState("");
  const [value, setValue] = useState(0);
  const [ownerId, setOwnerId] = useState(currentUserId);

  const employees = activeEmployees(users);

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-primary btn-md"
      >
        <Plus size={15} />
        Log inquiry
      </button>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!company.trim()) return;
        addLead({
          company: company.trim(),
          contactName: contactName.trim() || "Unknown contact",
          contactEmail: contactEmail.trim() || undefined,
          channel,
          serviceId: serviceId || undefined,
          ownerId,
          value: value || (serviceId ? serviceById(serviceId).fee : 0),
          detail: detail.trim() || undefined,
        });
        setCompany("");
        setContactName("");
        setContactEmail("");
        setDetail("");
        setServiceId("");
        setValue(0);
        setOpen(false);
      }}
      className="card flex w-full flex-wrap items-end gap-2 p-3"
    >
      <div className="min-w-[150px] flex-1">
        <label className="eyebrow mb-1 block">Company</label>
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="field h-9 py-0 text-[13px]"
          autoFocus
        />
      </div>
      <div className="min-w-[140px] flex-1">
        <label className="eyebrow mb-1 block">Contact</label>
        <input
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          className="field h-9 py-0 text-[13px]"
        />
      </div>
      <div className="min-w-[170px] flex-1">
        <label className="eyebrow mb-1 block">Email</label>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="So the sheet can ask them for documents later"
          className="field h-9 py-0 text-[13px]"
        />
      </div>
      <div>
        <label className="eyebrow mb-1 block">Asking about</label>
        <select
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value);
            if (e.target.value && !value) setValue(serviceById(e.target.value).fee);
          }}
          className="field h-9 w-[150px] py-0 text-[13px]"
        >
          <option value="">Not sure yet</option>
          {SERVICES.map((sv) => (
            <option key={sv.id} value={sv.id}>
              {sv.short}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="eyebrow mb-1 block">Channel</label>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as LeadChannel)}
          className="field h-9 w-[120px] py-0 text-[13px]"
        >
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABEL[c]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="eyebrow mb-1 block">Owner</label>
        <select
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          className="field h-9 w-[140px] py-0 text-[13px]"
        >
          {employees.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="eyebrow mb-1 block">Est. value</label>
        <input
          type="number"
          step={500}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="field h-9 w-[110px] py-0 text-[13px]"
        />
      </div>
      <div className="min-w-[200px] flex-1">
        <label className="eyebrow mb-1 block">What they asked</label>
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="In their words, so whoever picks it up knows"
          className="field h-9 py-0 text-[13px]"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary btn-md">
          Save
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn btn-ghost btn-md"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
