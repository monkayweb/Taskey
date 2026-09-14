"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronRight, ShieldAlert, UserPlus, X } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { dayKey, shortDate } from "@/lib/date";
import { activeEmployees } from "@/lib/rules";
import { taskRecord } from "@/lib/dashboard";
import { ROLE_BLURB, ROLE_LABEL, ROLE_SHORT } from "@/lib/labels";
import type { User, WorkRole } from "@/lib/types";
import { Avatar, Badge, Chip, Empty, Field, Panel, StatTile } from "@/components/ui";
import { SearchField } from "@/components/SearchField";
import { RecurringDuties } from "@/components/JobDescription";

type Tab = "team" | "former";

const TABS: { key: Tab; label: string }[] = [
  { key: "team", label: "On the team" },
  { key: "former", label: "Former" },
];

export default function EmployeesPage() {
  const now = useNow();
  const today = dayKey(now);
  const { users, assignments, currentUserId } = useTaskey();
  const me = users.find((u) => u.id === currentUserId)!;

  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("team");

  const team = useMemo(
    () =>
      [...activeEmployees(users)].sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );
  const former = useMemo(
    () =>
      users
        .filter((u) => u.archivedAt)
        .sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? "")),
    [users],
  );

  const match = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return (u: User) =>
      `${u.name} ${u.jobTitle} ${ROLE_LABEL[u.workRole]} ${u.email}`
        .toLowerCase()
        .includes(q);
  }, [query]);

  const source = tab === "team" ? team : former;
  const shown = match ? source.filter(match) : source;

  // Read before the guard below, because hooks cannot sit after a return.
  const openFor = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assignments) {
      if (a.status !== "open") continue;
      for (const id of a.assigneeIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [assignments]);

  // Everybody is measured the same way: work closed against the date it was
  // due. Nothing on this page comes from anybody reporting on themselves.
  const recordFor = useMemo(() => {
    const out = new Map<string, ReturnType<typeof taskRecord>>();
    for (const u of users)
      out.set(
        u.id,
        taskRecord(
          assignments.filter((a) => a.assigneeIds.includes(u.id)),
          today,
        ),
      );
    return out;
  }, [users, assignments, today]);

  const practice = useMemo(
    () => taskRecord(assignments, today),
    [assignments, today],
  );

  useEffect(() => {
    if (!adding) return;
    document.getElementById("new-employee-name")?.focus();
  }, [adding]);

  useEffect(() => {
    if (!adding) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAdding(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adding]);

  if (me.role !== "admin") {
    return (
      <div className="p-5 md:p-8">
        <Panel>
          <Empty
            icon={<ShieldAlert size={22} />}
            title="Admin only"
            detail="Only management sees the team."
          />
        </Panel>
      </div>
    );
  }

  const open = assignments.filter((a) => a.status === "open");
  const openTotal = open.length;
  const overdueTotal = open.filter((a) => a.dueDate < today).length;

  return (
    <div className="min-h-dvh">
      <div className="min-w-0 space-y-8 p-5 md:p-8">
        <div className="flex items-center gap-3">
          <h1 className="text-[18px] font-bold tracking-tight">Employees</h1>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="ml-auto inline-flex h-7 items-center gap-1 rounded-full bg-accent px-3 text-[12px] font-semibold text-white transition-colors hover:bg-accent-ink"
          >
            <UserPlus size={13} strokeWidth={2.6} />
            Add employee
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatTile
            label="Closed on time"
            value={
              practice.rate === null
                ? "—"
                : `${Math.round(practice.rate * 100)}%`
            }
            hint={
              practice.rate === null
                ? "Nothing closed yet"
                : `${practice.onTime} of ${practice.closed} tasks across the team`
            }
            filled
          />
          <StatTile label="On the team" value={team.length} />
          <StatTile
            label="Outstanding tasks"
            value={openTotal}
            hint="Still open across the team"
          />
          <StatTile
            label="Overdue"
            value={overdueTotal}
            hint={overdueTotal ? "Past their due date" : "Nothing late"}
            tone={overdueTotal ? "danger" : "ok"}
          />
        </div>

        {/* The task page's header: tabs on the left, search pushed right,
            all sitting on one rule. */}
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
              label="Search employees"
              placeholder="Name, role, email"
              className="ml-auto mb-2 w-56"
            />
          </div>

          <div className="mt-6">
            {shown.length === 0 ? (
              <p className="px-1 py-12 text-center text-[13px] text-muted">
                {query.trim()
                  ? `Nobody ${tab === "team" ? "on the team" : "who has left"} matches “${query.trim()}”.`
                  : tab === "team"
                    ? "Nobody on the team yet. Add your first employee to start handing work out."
                    : "Nobody has left. Removing somebody keeps their tasks, logs and audit trail exactly where they are."}
              </p>
            ) : (
              <ul className="space-y-2">
                {shown.map((u) => {
                  const record = recordFor.get(u.id);
                  const open = openFor.get(u.id) ?? 0;
                  const gone = !!u.archivedAt;
                  return (
                    <li key={u.id}>
                      {/* The whole row is the link. Acting on somebody -
                          removing them, putting them back - happens on their
                          own page, so this list stays browsable. */}
                      <Link
                        href={`/employees/${u.id}`}
                        className="flex items-center gap-3 rounded-xl bg-surface px-3 py-3 ring-1 ring-line transition-colors hover:ring-line-strong sm:gap-4 sm:px-4"
                      >
                        <Avatar name={u.name} tint={u.tint} size={40} />

                        <span className="min-w-0 flex-1">
                          <span
                            className={clsx(
                              "block truncate text-[14px] font-bold",
                              gone ? "text-muted" : "text-ink",
                            )}
                          >
                            {u.name}
                          </span>
                          {/* The person's own colour, the way a task row
                              tints its second line. Former staff go quiet. */}
                          <span
                            className={clsx(
                              "block break-words text-[12px] font-medium sm:truncate",
                              gone && "text-faint",
                            )}
                            style={gone ? undefined : { color: u.tint }}
                          >
                            {gone
                              ? `${u.jobTitle} · left ${shortDate(u.archivedAt!)}`
                              : `${ROLE_LABEL[u.workRole]} · ${u.email}`}
                          </span>
                        </span>

                        <span className="hidden w-16 shrink-0 text-right text-[12px] text-muted sm:block">
                          {open} open
                        </span>

                        {/* How much of their work made its date. Somebody who
                            has closed nothing yet has nothing to show. */}
                        {gone ? (
                          <span className="w-11 shrink-0" />
                        ) : record && record.rate !== null ? (
                          <Badge
                            tone={
                              record.rate >= 0.85
                                ? "ok"
                                : record.rate >= 0.7
                                  ? "warn"
                                  : "danger"
                            }
                          >
                            {Math.round(record.rate * 100)}% on time
                          </Badge>
                        ) : (
                          <Badge>Nothing closed</Badge>
                        )}

                        <ChevronRight
                          size={16}
                          className="shrink-0 text-faint"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <RecurringDuties />
      </div>

      {/* --- add drawer ------------------------------------------------- */}
      <aside
        inert={!adding}
        aria-label="Add employee"
        className={clsx(
          "fixed inset-y-0 right-0 z-40 w-full max-w-[380px] overflow-y-auto border-l border-line bg-sheet p-5 transition-transform duration-300 ease-out md:p-8",
          adding ? "translate-x-0" : "translate-x-full",
        )}
        style={{ boxShadow: adding ? "var(--shadow-pop)" : undefined }}
      >
        <button
          type="button"
          onClick={() => setAdding(false)}
          aria-label="Close"
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink"
        >
          <X size={17} />
        </button>

        <AddEmployeeForm onDone={() => setAdding(false)} />
      </aside>
    </div>
  );
}

const ROLES = Object.keys(ROLE_LABEL) as WorkRole[];

function AddEmployeeForm({ onDone }: { onDone: () => void }) {
  const { users, addEmployee } = useTaskey();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [workRole, setWorkRole] = useState<WorkRole>("consultant");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const clean = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      jobTitle: jobTitle.trim(),
      workRole,
    };
    if (!clean.name) return setError("They need a name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email))
      return setError("That does not look like an email address.");
    if (users.some((u) => u.email.toLowerCase() === clean.email))
      return setError("Somebody already has that email address.");

    // Await it: adding a seat also emails them, and the drawer should not
    // close as though that already happened.
    setSending(true);
    await addEmployee(clean);
    setSending(false);
    setName("");
    setEmail("");
    setJobTitle("");
    setError(null);
    onDone();
  };

  return (
    <div>
      <h2 className="text-[18px] font-bold tracking-tight">Add employee</h2>
      <p className="mt-1 text-[12px] text-muted">
        Pick what they do and the workflow starts routing steps to them: no
        project has to be pointed at a person by hand.
      </p>

      <div className="mt-5 space-y-3">
        <label className="block">
          <span className="eyebrow">Name</span>
          <input
            id="new-employee-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Full name"
            className="field mt-1.5"
          />
        </label>

        <label className="block">
          <span className="eyebrow">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="name@pharmers.co.za"
            className="field mt-1.5"
          />
        </label>

        <label className="block">
          <span className="eyebrow">Job title</span>
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Project Consultant"
            className="field mt-1.5"
          />
        </label>

        <Field label="Role" hint={ROLE_BLURB[workRole]}>
          {/* Two across: the drawer is 380px and the longer names wrapped. */}
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <Chip key={r} on={r === workRole} onClick={() => setWorkRole(r)}>
                {ROLE_SHORT[r]}
              </Chip>
            ))}
          </div>
        </Field>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[12px] font-medium text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!name.trim() || !email.trim() || sending}
        className="btn btn-primary btn-md mt-5 w-full"
      >
        {sending ? "Adding and inviting…" : "Add to the team"}
      </button>
      <p className="mt-2.5 text-[11px] leading-relaxed text-faint">
        They get an email invitation straight away. There is no password to
        set: the link signs them in, and after that their own email address
        does.
      </p>
    </div>
  );
}
