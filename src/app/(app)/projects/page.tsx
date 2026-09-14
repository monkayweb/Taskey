"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ChevronRight, FolderKanban, Plus, X } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { dayKey, relativeDays, shortDate } from "@/lib/date";
import { money } from "@/lib/rules";
import {
  allDocumentsIn,
  currentStep,
  outstandingDocuments,
  phaseBalance,
  phaseOf,
  phases,
  serviceById,
  WORKFLOW_STEPS,
} from "@/lib/services";
import { capitalise, STEP_ROLE_LABEL } from "@/lib/labels";
import type { Project } from "@/lib/types";
import { Avatar, Badge, StatTile } from "@/components/ui";
import { SearchField } from "@/components/SearchField";
import { ProjectIntake } from "@/components/ProjectIntake";

type Tab = "active" | "clients" | "authority" | "complete";

const TABS: { key: Tab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "clients", label: "Waiting on clients" },
  { key: "authority", label: "At the authority" },
  { key: "complete", label: "Complete" },
];

export default function ProjectsPage() {
  const now = useNow();
  const today = dayKey(now);
  const { projects, leads, users, currentUserId } = useTaskey();
  const router = useRouter();
  const params = useSearchParams();
  const me = users.find((u) => u.id === currentUserId)!;
  // The office loads a paid project; everybody else reads the sheet.
  const canIntake = me.role === "admin" || me.workRole === "admin";

  const [tab, setTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");
  const [intakeOpen, setIntakeOpen] = useState(false);

  // A won lead sends the office here to record what the client paid. The
  // sheet it opens closes the lead behind it, so the two halves of the chart
  // are one record rather than two lists.
  const fromLead = params.get("lead");
  const lead = leads.find((l) => l.id === fromLead && !l.projectId);

  // The drawer is open because the office asked for it, or because a won
  // lead sent them here. Derived rather than stored, so arriving on the link
  // and closing it again cannot disagree about which it is.
  const intake = intakeOpen || !!lead;

  const closeIntake = useCallback(() => {
    setIntakeOpen(false);
    if (fromLead) router.replace("/projects");
  }, [fromLead, router]);

  useEffect(() => {
    if (!intake) return;
    document.getElementById("intake-client")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeIntake();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [intake, closeIntake]);

  const rows = useMemo(() => {
    const byTab = projects.filter((p) => {
      if (tab === "complete") return p.status === "complete";
      if (tab === "clients")
        return (
          p.status !== "complete" &&
          !!p.docsRequestedAt &&
          !allDocumentsIn(p)
        );
      if (tab === "authority")
        return p.status !== "complete" && !!p.submittedAt && !p.outcomeAt;
      return p.status !== "complete";
    });

    const q = query.trim().toLowerCase();
    const matched = !q
      ? byTab
      : byTab.filter((p) =>
          `${p.client} ${p.name} ${serviceById(p.serviceId).short} ${serviceById(p.serviceId).authority} ${p.clientContact.name}`
            .toLowerCase()
            .includes(q),
        );

    // Anything still needing work outranks anything already lodged, and
    // inside each group the closest to breaking its promise comes first.
    return [...matched].sort(
      (a, b) =>
        Number(!!a.submittedAt) - Number(!!b.submittedAt) ||
        a.dueDate.localeCompare(b.dueDate),
    );
  }, [projects, tab, query]);

  const live = projects.filter((p) => p.status !== "complete");
  const waiting = live.filter(
    (p) => p.docsRequestedAt && !allDocumentsIn(p),
  ).length;
  const submitSoon = live.filter(
    (p) => !p.submittedAt && p.dueDate <= dayKey(new Date(now.getTime() + 6 * 86_400_000)),
  ).length;
  const owed = live.reduce(
    (a, p) => a + (p.submittedAt ? phaseBalance(p) : 0),
    0,
  );

  return (
    <div className="min-h-dvh">
      <div className="min-w-0 space-y-8 p-5 md:p-8">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-[18px] font-bold tracking-tight">Projects</h1>
            <p className="mt-0.5 text-[12px] text-muted">
              One sheet per paid project, dated from the day the money came in.
            </p>
          </div>
          {canIntake && (
            <button
              type="button"
              onClick={() => setIntakeOpen(true)}
              className="ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-accent px-3 text-[12px] font-semibold text-white transition-colors hover:bg-accent-ink"
            >
              <Plus size={13} strokeWidth={2.8} />
              Payment received
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Open sheets" value={live.length} filled />
          <StatTile
            label="Waiting on clients"
            value={waiting}
            hint={waiting ? "Documents still outstanding" : "Nothing outstanding"}
            tone={waiting ? "warn" : "ok"}
          />
          <StatTile
            label="Submitting inside a week"
            value={submitSoon}
            hint="Counted from each payment date"
            tone={submitSoon ? "warn" : "neutral"}
          />
          <StatTile
            label="Balances due"
            value={money(owed)}
            hint={owed ? "Fell due on submission" : "Nothing outstanding"}
            tone={owed ? "danger" : "ok"}
          />
        </div>

        <section>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-line">
            {TABS.map((t) => {
              const on = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  aria-current={on ? "true" : undefined}
                  className={clsx(
                    "-mb-px border-b-[2.5px] pb-3 text-[13px] transition-colors",
                    on
                      ? "border-accent font-bold text-accent"
                      : "border-transparent text-faint hover:text-ink",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
            <SearchField
              value={query}
              onChange={setQuery}
              label="Search projects"
              placeholder="Client, service, contact"
              className="ml-auto mb-2 w-56"
            />
          </div>

          <div className="mt-6">
            {rows.length === 0 ? (
              <p className="px-1 py-12 text-center text-[13px] text-muted">
                {query.trim()
                  ? `Nothing matches “${query.trim()}”.`
                  : tab === "active"
                    ? "No open sheets. One opens itself the moment a payment is loaded."
                    : "Nothing on this list."}
              </p>
            ) : (
              <ul className="space-y-2">
                {rows.map((p) => (
                  <li key={p.id}>
                    <ProjectRow project={p} today={today} now={now} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* --- intake drawer -------------------------------------------- */}
      <aside
        inert={!intake}
        aria-label="Payment received"
        className={clsx(
          "fixed inset-y-0 right-0 z-40 w-full max-w-[420px] overflow-y-auto border-l border-line bg-sheet p-5 transition-transform duration-300 ease-out md:p-8",
          intake ? "translate-x-0" : "translate-x-full",
        )}
        style={{ boxShadow: intake ? "var(--shadow-pop)" : undefined }}
      >
        <button
          type="button"
          onClick={closeIntake}
          aria-label="Close"
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink"
        >
          <X size={17} />
        </button>
        <ProjectIntake
          key={lead?.id ?? "blank"}
          lead={lead}
          onDone={closeIntake}
        />
      </aside>
    </div>
  );
}

function ProjectRow({
  project: p,
  today,
  now,
}: {
  project: Project;
  today: string;
  now: Date;
}) {
  const users = useTaskey((s) => s.users);
  const service = serviceById(p.serviceId);
  const owner = users.find((u) => u.id === p.ownerId);
  const step = currentStep(p);
  const late = !p.submittedAt && p.dueDate < today;
  const balance = p.submittedAt ? phaseBalance(p) : 0;
  const missing = outstandingDocuments(p).length;

  return (
    <Link
      href={`/projects/${p.id}`}
      className={clsx(
        "flex items-center gap-4 rounded-xl px-4 py-3 ring-1 transition-colors",
        late
          ? "bg-danger-soft ring-danger/20 hover:bg-danger-soft/70"
          : "bg-surface ring-line hover:ring-line-strong",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
        <FolderKanban size={17} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate text-[14px] font-bold">
            {p.client}
          </span>
          <Badge>{service.short}</Badge>
          {phases(p).length > 1 && (
            <Badge tone="purple">{phaseOf(p).label.split(" · ")[0]}</Badge>
          )}
        </span>
        <span className="block truncate text-[12px] font-medium text-muted">
          {p.status === "complete"
            ? `Closed · ${service.authority} ${p.outcome === "declined" ? "declined" : "approved"} ${p.outcomeAt ? shortDate(p.outcomeAt) : ""}`
            : step
              ? `Step ${step.step} of ${WORKFLOW_STEPS}: ${step.label} · ${STEP_ROLE_LABEL[step.role]}`
              : "Every step closed"}
        </span>
      </span>

      <span className="hidden w-28 shrink-0 text-right text-[11px] text-muted sm:block">
        {missing > 0 && p.docsRequestedAt ? `${missing} docs out` : ""}
        {balance > 0 && (
          <span className="block font-medium text-danger">
            {money(balance)} due
          </span>
        )}
      </span>

      <span className="w-24 shrink-0 text-right">
        <span
          className={clsx(
            "block text-[12px] font-semibold tabular-nums",
            late ? "text-danger" : "text-ink",
          )}
        >
          {shortDate(p.submittedAt ?? p.dueDate)}
        </span>
        <span className="block text-[11px] text-faint">
          {p.submittedAt
            ? "Submitted"
            : capitalise(relativeDays(p.dueDate, now).replace("in ", ""))}
        </span>
      </span>

      <span className="hidden shrink-0 sm:block">
        {owner && <Avatar name={owner.name} tint={owner.tint} size={28} />}
      </span>
      <ChevronRight size={16} className="shrink-0 text-faint" />
    </Link>
  );
}
