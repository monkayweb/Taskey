"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { SignOutButton, UserProfile } from "@clerk/nextjs";
import {
  BadgeCheck,
  ChevronRight,
  FolderKanban,
  KeyRound,
  ListChecks,
  LogOut,
  Receipt,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { dayKey } from "@/lib/date";
import { money } from "@/lib/rules";
import { balanceIsDue, phaseBalance } from "@/lib/services";
import { ROLE_BLURB, ROLE_LABEL } from "@/lib/labels";
import { Avatar, Badge, Panel } from "@/components/ui";
import { Duties, RecurringDuties } from "@/components/JobDescription";
import type { User } from "@/lib/types";

type Tab = "you" | "security";

/**
 * Your own account, which is not an employee's record. That page is
 * management looking at somebody; this is you looking at yourself, so almost
 * all of it is read-only: your role, your job description and your standing
 * duties are management's to set.
 *
 * What is genuinely yours is how you get in, and that has a tab to itself
 * because Clerk's panel is a screen in its own right. Squeezing it inside a
 * card is what made it look cropped.
 */
export default function AccountPage() {
  const now = useNow();
  const { users, currentUserId } = useTaskey();
  const me = users.find((u) => u.id === currentUserId)!;
  const isManagement = me.role === "admin";
  const [tab, setTab] = useState<Tab>("you");

  const TABS: { key: Tab; label: string }[] = [
    { key: "you", label: isManagement ? "You and the practice" : "You" },
    { key: "security", label: "Sign-in and security" },
  ];

  return (
    <div className="min-h-dvh">
      <div className="min-w-0 space-y-6 p-5 md:p-8">
        {/* --- who you are, and the way out --------------------------- */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Avatar name={me.name} tint={me.tint} size={52} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-bold tracking-tight">
                {me.name}
              </h1>
              <Badge tone="accent">{ROLE_LABEL[me.workRole]}</Badge>
              {isManagement && <Badge>Management</Badge>}
            </div>
            <p className="mt-0.5 text-[13px] text-muted">
              {me.jobTitle} · {me.email}
            </p>
          </div>
          <SignOutButton>
            <button type="button" className="btn btn-ghost btn-sm shrink-0">
              <LogOut size={13} />
              Sign out
            </button>
          </SignOutButton>
        </div>

        {/* --- the same tab row the rest of the app uses -------------- */}
        <div
          role="tablist"
          aria-label="Account"
          className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-line"
        >
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
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
        </div>

        {tab === "you" ? (
          <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]">
            <div className="min-w-0 space-y-6">
              {isManagement ? (
                <Management me={me} />
              ) : (
                <Yours me={me} now={now} />
              )}

              <Panel bodyClassName="">
                <div className="flex items-start gap-2.5 px-5 py-4">
                  <ShieldCheck
                    size={15}
                    className="mt-0.5 shrink-0 text-faint"
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold">
                      Your role is {ROLE_LABEL[me.workRole].toLowerCase()}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                      {ROLE_BLURB[me.workRole]}. Project steps are written
                      against roles rather than people, so this is what decides
                      which work reaches you.
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
                      {isManagement
                        ? "You can change anybody's role, job description and standing duties, including your own, from Employees."
                        : "Your name, role, job description and standing duties are management's to set. How you sign in is yours."}
                    </p>
                  </div>
                </div>
              </Panel>
            </div>

            <div className="min-w-0 space-y-6">
              <Duties user={me} readOnly />
              <RecurringDuties user={me} readOnly />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="flex max-w-[46rem] items-start gap-2 text-[12px] leading-relaxed text-muted">
              <KeyRound size={13} className="mt-0.5 shrink-0 text-faint" />
              Taskey has no password of its own: signing in emails you a code,
              or uses Google. Add a passkey below and you will need neither.
              Whatever else the practice has enabled appears here by itself.
            </p>
            {/* Clerk's panel, given the room it expects. Deliberately
                unstyled beyond its width: fighting its internal layout is
                what cropped it before. */}
            <UserProfile
              routing="hash"
              appearance={{ elements: { rootBox: "w-full" } }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * What management alone can do, and anything waiting. The point is not the
 * list of powers, it is that an owner opens this and sees whether something
 * is sitting on their signature.
 */
function Management({ me }: { me: User }) {
  const { users, projects } = useTaskey();

  const team = users.filter((u) => !u.archivedAt && u.role === "employee");
  const qcWaiting = projects.filter(
    (p) => p.qcRequestedAt && !p.qcApprovedAt && p.status === "active",
  );
  const balances = projects.filter((p) => balanceIsDue(p));
  const owed = balances.reduce((a, p) => a + phaseBalance(p), 0);

  return (
    <Panel
      title="The practice"
      subtitle="What only management can do, and anything waiting on you."
      bodyClassName=""
    >
      <ul className="divide-y divide-line border-t border-line">
        {me.workRole === "owner" && (
          <Row
            icon={<BadgeCheck size={15} />}
            tone={qcWaiting.length > 0 ? "warn" : "quiet"}
            title="Sign off QC"
            detail={
              qcWaiting.length === 0
                ? "Nothing is waiting on your signature."
                : `${qcWaiting.length} pack${qcWaiting.length === 1 ? "" : "s"} waiting: ${qcWaiting
                    .slice(0, 2)
                    .map((p) => p.client)
                    .join(", ")}${qcWaiting.length > 2 ? " and more" : ""}. Nothing submits until you do.`
            }
            href={qcWaiting[0] ? `/projects/${qcWaiting[0].id}` : "/projects"}
            action={qcWaiting.length > 0 ? "Open" : "Projects"}
          />
        )}

        <Row
          icon={<UserPlus size={15} />}
          title="The team"
          detail={`${team.length} ${team.length === 1 ? "person" : "people"}. Adding somebody invites them by email; removing them keeps every task and signature they leave behind.`}
          href="/employees"
          action="Employees"
        />

        <Row
          icon={<FolderKanban size={15} />}
          title="Load a payment"
          detail="A sheet exists because a client paid, so this is the only way one opens."
          href="/projects"
          action="Projects"
        />

        <Row
          icon={<Receipt size={15} />}
          tone={owed > 0 ? "warn" : "quiet"}
          title="Balances due"
          detail={
            owed === 0
              ? "Nothing outstanding on anything submitted."
              : `${money(owed)} across ${balances.length} project${balances.length === 1 ? "" : "s"}, due since the day each was submitted.`
          }
          href="/projects"
          action="Projects"
        />
      </ul>
    </Panel>
  );
}

/** For everybody else: what is theirs, without controls that would refuse them. */
function Yours({ me, now }: { me: User; now: Date }) {
  const { projects, assignments } = useTaskey();
  const today = dayKey(now);

  const mine = assignments.filter(
    (a) => a.assigneeIds.includes(me.id) && a.status === "open",
  );
  const late = mine.filter((a) => a.dueDate < today);
  const carrying = projects.filter(
    (p) => p.ownerId === me.id && p.status !== "complete",
  );

  return (
    <Panel
      title="What is yours"
      subtitle="Live, and never a report you have to write."
      bodyClassName=""
    >
      <ul className="divide-y divide-line border-t border-line">
        <Row
          icon={<ListChecks size={15} />}
          tone={late.length > 0 ? "warn" : "quiet"}
          title="Your list"
          detail={
            mine.length === 0
              ? "Nothing open."
              : `${mine.length} open${late.length > 0 ? `, ${late.length} past its date` : ", nothing late"}.`
          }
          href="/tasks"
          action="Open"
        />
        <Row
          icon={<FolderKanban size={15} />}
          title="Projects you carry"
          detail={
            carrying.length === 0
              ? "None at the moment."
              : `${carrying.length} live sheet${carrying.length === 1 ? "" : "s"}. Each hands you its next step when it reaches you.`
          }
          href="/projects"
          action="Open"
        />
      </ul>
    </Panel>
  );
}

function Row({
  icon,
  title,
  detail,
  href,
  action,
  tone = "quiet",
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  href: string;
  action: string;
  tone?: "quiet" | "warn";
}) {
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2 px-5 py-3.5">
      <span
        className={clsx(
          "grid size-8 shrink-0 place-items-center rounded-xl",
          tone === "warn"
            ? "bg-warn-soft text-warn"
            : "bg-accent-soft text-accent",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">
          {detail}
        </span>
      </span>
      <Link href={href} className="btn btn-ghost btn-sm shrink-0">
        {action}
        <ChevronRight size={13} />
      </Link>
    </li>
  );
}
