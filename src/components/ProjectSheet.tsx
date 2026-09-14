"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  BadgeCheck,
  BellRing,
  Check,
  ChevronDown,
  ChevronRight,
  Landmark,
  Plus,
  Receipt,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { useProjectFlags } from "@/lib/selectors";
import { clockTime, dayKey, relativeDays, shortDate } from "@/lib/date";
import { money } from "@/lib/rules";
import {
  currentStep,
  outstandingDocuments,
  paidForPhase,
  paidToDate,
  phaseAmount,
  phaseBalance,
  phaseOf,
  phases,
  serviceById,
  stepsDone,
  WORKFLOW_STEPS,
} from "@/lib/services";
import {
  FLAG_LABEL,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TONE,
  STEP_ROLE_LABEL,
} from "@/lib/labels";
import type { Milestone, Project, StepRole, User } from "@/lib/types";
import { Avatar, Badge } from "./ui";
import { DeleteProject } from "./DeleteProject";

type TabKey = "workflow" | "documents" | "money" | "authority";

/**
 * A project sheet answers one question first: what needs doing, and whose is
 * it. So the page leads with that and nothing else, and the whole record sits
 * behind four tabs rather than stacked down the page.
 */
export function ProjectSheet({ project }: { project: Project }) {
  const now = useNow();
  const { users, currentUserId } = useTaskey();
  const me = users.find((u) => u.id === currentUserId)!;
  const service = serviceById(project.serviceId);
  const owner = users.find((u) => u.id === project.ownerId);
  const [tab, setTab] = useState<TabKey>("workflow");

  const outstanding = outstandingDocuments(project);
  const balance = phaseBalance(project);
  const late = !project.submittedAt && project.dueDate < dayKey(now);
  const open = currentStep(project);

  const TABS: { key: TabKey; label: string; value: string }[] = [
    {
      key: "workflow",
      label: "Workflow",
      value: open
        ? `Step ${open.step} of ${WORKFLOW_STEPS}`
        : `${stepsDone(project)} closed`,
    },
    {
      key: "documents",
      label: "Documents",
      value: `${project.documents.length - outstanding.length}/${project.documents.length}`,
    },
    {
      key: "money",
      label: "Money",
      value: balance > 0 ? money(balance) : "Settled",
    },
    {
      key: "authority",
      label: service.authority,
      value: project.submittedAt
        ? project.outcomeAt
          ? "Closed"
          : "Lodged"
        : "Not lodged",
    },
  ];

  return (
    <div className="space-y-5">
      {/* --- one line of who and what -------------------------------- */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[20px] font-bold tracking-tight">
              {project.client}
            </h1>
            {late && <Badge tone="danger">Past its submission date</Badge>}
            {project.status !== "active" && (
              <Badge tone={PROJECT_STATUS_TONE[project.status]}>
                {PROJECT_STATUS_LABEL[project.status]}
              </Badge>
            )}
            {phases(project).length > 1 && (
              <Badge tone="purple">{phaseOf(project).label}</Badge>
            )}
          </div>
          <p className="mt-0.5 text-[12px] text-muted">
            {service.short} · {service.authority} · paid{" "}
            {shortDate(project.paidAt)} · {project.clientContact.name},{" "}
            {project.clientContact.email}
            {project.clientContact.phone && `, ${project.clientContact.phone}`}
          </p>
        </div>
        {owner && (
          <div className="flex shrink-0 items-center gap-2">
            <Avatar name={owner.name} tint={owner.tint} size={28} />
            <span className="text-[11px] text-faint">
              {owner.name.split(" ")[0]} is carrying it
            </span>
          </div>
        )}
      </div>

      <NextUp project={project} me={me} />

      {/* --- the record, one panel at a time -------------------------- */}
      <div>
        <div
          role="tablist"
          aria-label="Project detail"
          className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line"
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
                  "-mb-px flex items-baseline gap-1.5 border-b-[2.5px] pb-2.5 pt-1 text-[13px] transition-colors",
                  on
                    ? "border-accent font-bold text-accent"
                    : "border-transparent text-faint hover:text-ink",
                )}
              >
                {t.label}
                <span
                  className={clsx(
                    "text-[11px] tabular-nums",
                    on ? "text-accent/80" : "text-faint",
                  )}
                >
                  {t.value}
                </span>
              </button>
            );
          })}
        </div>

        <div className="pt-4">
          {tab === "workflow" && <Workflow project={project} />}
          {tab === "documents" && <Documents project={project} />}
          {tab === "money" && (
            <Money
              project={project}
              isOwner={me.workRole === "owner" || me.role === "admin"}
            />
          )}
          {tab === "authority" && <Authority project={project} />}
        </div>
      </div>

      <DeleteProject project={project} />
    </div>
  );
}

/** Whoever holds a step, for the face and the name beside it. */
function useHolder(role: StepRole): User | undefined {
  const users = useTaskey((s) => s.users);
  if (role === "client" || role === "authority") return undefined;
  return users.find((u) => !u.archivedAt && u.workRole === role);
}

// ---------------------------------------------------------------------------
// What needs doing, and whose it is
// ---------------------------------------------------------------------------

function NextUp({ project, me }: { project: Project; me: User }) {
  const now = useNow();
  const flags = useProjectFlags(project.id);
  const service = serviceById(project.serviceId);
  const step = currentStep(project);
  const holder = useHolder(step?.role ?? "consultant");

  if (!step) {
    return (
      <div className="card flex flex-wrap items-center gap-3 bg-ok-soft/60 px-5 py-4 ring-ok/20">
        <Check size={16} className="text-ok" strokeWidth={3} />
        <p className="text-[14px] font-semibold">
          Every step is closed.
          {project.outcomeAt &&
            ` ${service.authority} ${project.outcome === "declined" ? "declined" : "approved"} it on ${shortDate(project.outcomeAt)}.`}
        </p>
      </div>
    );
  }

  // Who the ball is with, said the way somebody would say it out loud.
  const withWhom =
    step.role === "client"
      ? "Waiting on the client"
      : step.role === "authority"
        ? `With ${service.authority}`
        : holder?.id === me.id
          ? "Waiting on you"
          : holder
            ? `With ${holder.name.split(" ")[0]}`
            : "Nobody holds this role";

  const left = Math.round(
    (new Date(`${step.dueDate}T12:00:00`).getTime() - now.getTime()) /
      86_400_000,
  );

  // The one flag the action answers is already said by the card. Anything
  // else live on this project is worth a line, but not a panel.
  const alsoKinds = ["balance_due", "query_open", "authority_followup"];
  const also = flags.filter((f) => alsoKinds.includes(f.kind)).slice(0, 3);

  return (
    <div
      className={clsx(
        "card overflow-hidden",
        left < 0 && "bg-danger-soft/40 ring-danger/20",
      )}
    >
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">
            Next · step {step.step} of {WORKFLOW_STEPS}
          </p>
          <h2 className="mt-1 text-[17px] font-bold tracking-tight">
            {step.label}
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            <span
              className={clsx(
                "font-semibold",
                holder?.id === me.id ? "text-accent-ink" : "text-ink",
              )}
            >
              {withWhom}
            </span>
            {" · "}
            {context(project, step, now)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-1">
          <span
            className={clsx(
              "text-[13px] font-bold tabular-nums",
              left < 0 ? "text-danger" : left <= 1 ? "text-warn" : "text-ink",
            )}
          >
            {left < 0
              ? `${Math.abs(left)} day${Math.abs(left) === 1 ? "" : "s"} late`
              : left === 0
                ? "Due today"
                : `${left} day${left === 1 ? "" : "s"} left`}
          </span>
          <span className="text-[11px] text-faint">
            Target {shortDate(step.dueDate)}
          </span>
        </div>
      </div>

      <div className="px-5 pb-4">
        <StepAction project={project} step={step} />
      </div>

      {also.length > 0 && (
        <ul className="divide-y divide-line border-t border-line bg-surface/60">
          {also.map((f) => (
            <li
              key={`${f.kind}:${f.refId}`}
              className="flex flex-wrap items-baseline gap-x-2 px-5 py-2 text-[12px]"
            >
              <span
                className={clsx(
                  "font-semibold",
                  f.severity === "critical" ? "text-danger" : "text-warn",
                )}
              >
                {FLAG_LABEL[f.kind]}
              </span>
              <span className="text-muted">{f.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One line saying why this step is where it is. */
function context(project: Project, step: Milestone, now: Date): string {
  const missing = outstandingDocuments(project).length;

  switch (step.gate) {
    case "start":
      return project.acknowledgedAt
        ? `acknowledged ${shortDate(project.acknowledgedAt)}`
        : "the client has paid and has not heard from us yet";
    case "documents":
      if (!project.docsRequestedAt)
        return `${project.documents.length} documents to ask for. The list is ready.`;
      return project.docsRemindedAt
        ? `${missing} outstanding · chased ${project.docChases} time${project.docChases === 1 ? "" : "s"}, last ${shortDate(project.docsRemindedAt)}`
        : `${missing} outstanding · requested ${shortDate(project.docsRequestedAt)}`;
    case "compile":
      return project.qcReturnedAt
        ? `sent back on ${shortDate(project.qcReturnedAt)}: ${project.qcReturnNote}`
        : "documents, letters and floor plans, then hand it up for QC";
    case "qc":
      return project.qcRequestedAt
        ? `handed up ${shortDate(project.qcRequestedAt)}${project.qcReturns > 0 ? `, attempt ${project.qcReturns + 1}` : ""} · nothing submits until it is signed off`
        : "waiting on the pack to be compiled";
    case "submit":
      return project.qcApprovedAt
        ? `QC cleared ${shortDate(project.qcApprovedAt)} · ${money(phaseBalance(project))} falls due the day it goes in`
        : "waiting on the QC sign-off";
    case "balance":
      return project.invoicedAt
        ? `invoiced ${shortDate(project.invoicedAt)} · ${money(phaseBalance(project))} still outstanding`
        : `${money(phaseBalance(project))} fell due on submission · the balance email has not gone out`;
    default:
      return step.detail ?? `due ${relativeDays(step.dueDate, now)}`;
  }
}

/** The one move available on the step the project is sitting on. */
function StepAction({ project, step }: { project: Project; step: Milestone }) {
  const {
    users,
    currentUserId,
    acknowledgeClient,
    requestDocuments,
    remindClient,
    requestQc,
    approveQc,
    returnQc,
    submitToAuthority,
    sendBalanceInvoice,
    recordPayment,
  } = useTaskey();
  const me = users.find((u) => u.id === currentUserId)!;
  const [via, setVia] = useState("");
  const [sendBack, setSendBack] = useState(false);
  const [note, setNote] = useState("");

  if (step.gate === "start") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => acknowledgeClient(project.id)}
          className="btn btn-primary btn-md"
        >
          <Send size={14} />
          Send the acknowledgement
        </button>
        <span className="text-[11px] text-muted">
          Confirms the payment, names their consultant and sets out the
          submission date. The document request follows separately.
        </span>
      </div>
    );
  }

  if (step.gate === "documents") {
    if (!project.docsRequestedAt) {
      return (
        <button
          type="button"
          onClick={() => requestDocuments(project.id)}
          className="btn btn-primary btn-md"
        >
          <Send size={14} />
          Send the document request
        </button>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => remindClient(project.id)}
          className="btn btn-primary btn-md"
        >
          <BellRing size={14} />
          {project.docChases > 0 ? "Chase again" : "Chase the client"}
        </button>
        <span className="text-[11px] text-muted">
          Tick items off under Documents as they come in. The step closes
          itself when the last one lands.
        </span>
      </div>
    );
  }

  if (step.gate === "compile") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => requestQc(project.id)}
          className="btn btn-primary btn-md"
        >
          <ChevronRight size={14} />
          Hand up for QC
        </button>
        {project.qcReturnedAt && (
          <span className="text-[11px] font-medium text-warn">
            Correct what came back, then resend.
          </span>
        )}
      </div>
    );
  }

  if (step.gate === "qc") {
    const mine = me.workRole === "owner";
    if (!mine) {
      return (
        <p className="text-[12px] text-muted">
          Sitting with the owner. Only she can sign a QC check off or send it
          back.
        </p>
      );
    }
    if (sendBack) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !note.trim()) return;
              returnQc(project.id, note);
              setNote("");
              setSendBack(false);
            }}
            placeholder="What is wrong or outstanding?"
            aria-label="What to correct"
            className="field h-9 w-72 py-0 text-[12px]"
          />
          <button
            type="button"
            disabled={!note.trim()}
            onClick={() => {
              returnQc(project.id, note);
              setNote("");
              setSendBack(false);
            }}
            className="btn btn-danger btn-md"
          >
            Send it back
          </button>
          <button
            type="button"
            onClick={() => setSendBack(false)}
            className="btn btn-ghost btn-md"
          >
            Cancel
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => approveQc(project.id)}
          className="btn btn-primary btn-md"
        >
          <BadgeCheck size={14} />
          Approve for submission
        </button>
        <button
          type="button"
          onClick={() => setSendBack(true)}
          className="btn btn-danger btn-md"
        >
          <RotateCcw size={14} />
          Send back to correct
        </button>
      </div>
    );
  }

  if (step.gate === "submit") {
    if (!project.qcApprovedAt) {
      return (
        <p className="text-[12px] font-medium text-warn">
          Nothing can be submitted before QC has approved it.
        </p>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={via}
          onChange={(e) => setVia(e.target.value)}
          placeholder="Portal, email, reference"
          aria-label="How it was submitted"
          className="field h-9 w-52 py-0 text-[12px]"
        />
        <button
          type="button"
          onClick={() => submitToAuthority(project.id, via)}
          className="btn btn-primary btn-md"
        >
          <Send size={14} />
          Submit to {serviceById(project.serviceId).authority}
        </button>
      </div>
    );
  }

  if (step.gate === "balance") {
    const balance = phaseBalance(project);
    return (
      <div className="flex flex-wrap items-center gap-2">
        {!project.invoicedAt && (
          <button
            type="button"
            onClick={() => sendBalanceInvoice(project.id)}
            className="btn btn-primary btn-md"
          >
            <Receipt size={14} />
            Send the balance email and invoice
          </button>
        )}
        {project.invoicedAt && balance > 0 && (
          <>
            <button
              type="button"
              onClick={() => recordPayment(project.id, balance, "Balance received")}
              className="btn btn-primary btn-md"
            >
              <Check size={14} />
              Record {money(balance)} received
            </button>
            <span className="text-[11px] text-muted">
              Or enter a part payment under Money.
            </span>
          </>
        )}
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Workflow: what is closed, what is now, what is ahead
// ---------------------------------------------------------------------------

function Workflow({ project }: { project: Project }) {
  const [openClosed, setOpenClosed] = useState(false);
  const [openAhead, setOpenAhead] = useState(false);

  const closed = project.milestones.filter((m) => m.done);
  const open = project.milestones.filter((m) => !m.done);
  const [current, next, ...ahead] = open;

  return (
    <div className="card overflow-hidden">
      {closed.length > 0 && (
        <>
          <Fold
            open={openClosed}
            onToggle={() => setOpenClosed((v) => !v)}
            label={`${closed.length} step${closed.length === 1 ? "" : "s"} closed`}
            tone="ok"
          />
          {openClosed && (
            <ul className="divide-y divide-line border-b border-line bg-sunken/50">
              {closed.map((m) => (
                <StepRow key={m.id} step={m} state="closed" />
              ))}
            </ul>
          )}
        </>
      )}

      <ul className="divide-y divide-line">
        {current && <StepRow step={current} state="now" />}
        {next && <StepRow step={next} state="ahead" />}
      </ul>

      {ahead.length > 0 && (
        <>
          <Fold
            open={openAhead}
            onToggle={() => setOpenAhead((v) => !v)}
            label={`${ahead.length} more after that`}
          />
          {openAhead && (
            <ul className="divide-y divide-line border-t border-line bg-sunken/50">
              {ahead.map((m) => (
                <StepRow key={m.id} step={m} state="ahead" />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/** A collapsed group of steps, so the page never lists eleven of anything. */
function Fold({
  open,
  onToggle,
  label,
  tone,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  tone?: "ok";
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-2 px-5 py-2.5 text-left text-[12px] font-medium text-muted transition-colors hover:bg-sunken"
    >
      {tone === "ok" ? (
        <Check size={13} className="shrink-0 text-ok" strokeWidth={3} />
      ) : (
        <span className="w-[13px] shrink-0" />
      )}
      {label}
      <ChevronDown
        size={14}
        className={clsx("ml-auto shrink-0 transition-transform", open && "rotate-180")}
      />
    </button>
  );
}

function StepRow({
  step,
  state,
}: {
  step: Milestone;
  state: "closed" | "now" | "ahead";
}) {
  const users = useTaskey((s) => s.users);
  const holder = useHolder(step.role);
  const doneBy = users.find((u) => u.id === step.doneBy);

  return (
    <li className={clsx("flex items-start gap-3 px-5 py-2.5", state === "now" && "bg-accent-wash")}>
      <span
        className={clsx(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
          state === "closed"
            ? "bg-ok-soft text-ok"
            : state === "now"
              ? "bg-accent text-white"
              : "bg-sunken text-faint ring-1 ring-line",
        )}
      >
        {state === "closed" ? <Check size={11} strokeWidth={3} /> : step.step}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            "text-[13px]",
            state === "now" ? "font-semibold" : state === "closed" ? "text-muted" : "",
          )}
        >
          <span className="text-faint">Step {step.step}</span> {step.label}
        </p>
        <p className="mt-0.5 text-[11px] text-faint">
          {STEP_ROLE_LABEL[step.role]}
          {holder ? ` · ${holder.name.split(" ")[0]}` : ""}
          {" · "}
          {state === "closed"
            ? `closed ${step.doneAt ? shortDate(step.doneAt) : ""}${doneBy ? ` by ${doneBy.name.split(" ")[0]}` : ""}`
            : `target ${shortDate(step.dueDate)}`}
        </p>
      </div>

      {holder && state !== "closed" && (
        <Avatar name={holder.name} tint={holder.tint} size={22} />
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

function Documents({ project }: { project: Project }) {
  const {
    toggleDocument,
    addDocumentRequest,
    removeDocumentRequest,
    requestDocuments,
    remindClient,
  } = useTaskey();
  const [label, setLabel] = useState("");
  const outstanding = outstandingDocuments(project);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
        <p className="min-w-0 flex-1 text-[12px] text-muted">
          {project.docsRequestedAt
            ? `Sent to ${project.clientContact.name} on ${shortDate(project.docsRequestedAt)}${
                project.docsRemindedAt
                  ? `, last chased ${shortDate(project.docsRemindedAt)} at ${clockTime(project.docsRemindedAt)}`
                  : ""
              }`
            : "The standard list is already here. Add anything this project needs, then send it."}
        </p>
        {project.docsRequestedAt ? (
          outstanding.length > 0 && (
            <button
              type="button"
              onClick={() => remindClient(project.id)}
              className="btn btn-ghost btn-sm shrink-0"
            >
              <BellRing size={13} />
              Chase
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={() => requestDocuments(project.id)}
            className="btn btn-primary btn-sm shrink-0"
          >
            <Send size={13} />
            Send the request
          </button>
        )}
      </div>

      <ul className="divide-y divide-line">
        {project.documents.map((d) => (
          <li key={d.id} className="group flex items-center gap-3 px-5 py-2.5">
            <button
              type="button"
              role="checkbox"
              aria-checked={d.received}
              aria-label={d.label}
              onClick={() => toggleDocument(project.id, d.id)}
              className={clsx(
                "grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors",
                d.received
                  ? "border-ok bg-ok text-white"
                  : "border-line-strong bg-surface hover:border-accent",
              )}
            >
              {d.received && <Check size={12} strokeWidth={3} />}
            </button>
            <span className="min-w-0 flex-1">
              <span
                className={clsx(
                  "block text-[13px]",
                  d.received && "text-faint line-through",
                )}
              >
                {d.label}
              </span>
              {d.received && d.receivedAt && (
                <span className="block text-[11px] text-faint">
                  In on {shortDate(d.receivedAt)}
                </span>
              )}
            </span>
            {d.extra && <Badge tone="purple">Added</Badge>}
            {d.extra && (
              <button
                type="button"
                onClick={() => removeDocumentRequest(project.id, d.id)}
                aria-label={`Remove ${d.label}`}
                className="shrink-0 text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
              >
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="flex gap-2 border-t border-line px-5 py-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !label.trim()) return;
            addDocumentRequest(project.id, label);
            setLabel("");
          }}
          placeholder="Something else this project needs"
          aria-label="Add a document to the request list"
          className="field h-9 flex-1 py-0 text-[12px]"
        />
        <button
          type="button"
          disabled={!label.trim()}
          onClick={() => {
            addDocumentRequest(project.id, label);
            setLabel("");
          }}
          className="btn btn-ghost btn-sm"
        >
          <Plus size={13} />
          Add
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Money, by phase
// ---------------------------------------------------------------------------

function Money({ project, isOwner }: { project: Project; isOwner: boolean }) {
  const { recordPayment, advancePhase } = useTaskey();
  const [amount, setAmount] = useState("");
  const list = phases(project);
  const balance = phaseBalance(project);
  const canAdvance =
    isOwner && !!project.submittedAt && project.phase < list[list.length - 1].key;

  return (
    <div className="card overflow-hidden">
      <p className="border-b border-line px-5 py-3 text-[12px] text-muted">
        {money(project.fee)}{" "}
        {list.length === 1 ? "in one payment" : `in ${list.length} equal phases`}{" "}
        · {money(paidToDate(project))} received to date
      </p>

      <ul className="divide-y divide-line">
        {list.map((ph) => {
          const running = ph.key === project.phase;
          const due = phaseAmount(project, ph.key);
          const paid = paidForPhase(project, ph.key);
          return (
            <li
              key={ph.key}
              className={clsx("px-5 py-2.5", running && "bg-accent-wash")}
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                  {ph.label}
                </span>
                <span className="shrink-0 text-[13px] tabular-nums">
                  {money(due)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-faint">
                {paid >= due
                  ? "Settled"
                  : `${money(paid)} in, ${money(due - paid)} outstanding`}
                {running && project.submittedAt && paid < due && (
                  <span className="font-medium text-danger">
                    {" "}
                    · fell due on submission
                  </span>
                )}
              </p>
            </li>
          );
        })}
      </ul>

      {project.payments.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {project.payments.map((pay) => (
            <li key={pay.id} className="flex items-center gap-2 px-5 py-2">
              <Check size={13} className="shrink-0 text-ok" />
              <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
                {pay.note ?? "Payment"} · {shortDate(pay.at)}
              </span>
              <span className="shrink-0 text-[12px] tabular-nums">
                {money(pay.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 border-t border-line px-5 py-3">
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={balance > 0 ? String(balance) : "Amount"}
            aria-label="Payment amount"
            className="field h-9 flex-1 py-0 text-[12px] tabular-nums"
          />
          <button
            type="button"
            disabled={!(Number(amount) > 0)}
            onClick={() => {
              recordPayment(project.id, Number(amount), "Balance received");
              setAmount("");
            }}
            className="btn btn-primary btn-sm"
          >
            <Receipt size={13} />
            Record
          </button>
        </div>
        {canAdvance && (
          <button
            type="button"
            onClick={() => advancePhase(project.id)}
            className="btn btn-ghost btn-sm w-full"
          >
            <ChevronRight size={13} />
            Move to {phaseOf(project, project.phase + 1).label}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// While the authority has it
// ---------------------------------------------------------------------------

function Authority({ project }: { project: Project }) {
  const now = useNow();
  const service = serviceById(project.serviceId);
  const {
    addAuthorityQuery,
    clearAuthorityQuery,
    logAuthorityFollowUp,
    recordOutcome,
  } = useTaskey();
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");

  if (!project.submittedAt) {
    return (
      <div className="card px-5 py-4">
        <p className="text-[12px] leading-snug text-muted">
          Nothing lodged yet. Once it goes in, {service.authority} usually takes
          about {service.processingDays} days
          {service.inspection && ", plus a premises inspection"}. Queries and
          monthly follow-ups get logged here from that day, so the follow-up
          clock never depends on anybody remembering.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <p className="border-b border-line px-5 py-3 text-[12px] text-muted">
        Lodged {shortDate(project.submittedAt)} ·{" "}
        {project.lastFollowUpAt
          ? `last followed up ${relativeDays(project.lastFollowUpAt.slice(0, 10), now)}`
          : "no follow-up logged yet"}
        {project.outcomeAt && (
          <span className="font-semibold text-ok">
            {" "}
            · {project.outcome === "declined" ? "declined" : "approved"} on{" "}
            {shortDate(project.outcomeAt)}
          </span>
        )}
      </p>

      {project.queries.length > 0 && (
        <ul className="divide-y divide-line">
          {project.queries.map((q) => (
            <li key={q.id} className="flex items-start gap-2 px-5 py-2.5">
              <Landmark
                size={13}
                className={clsx(
                  "mt-0.5 shrink-0",
                  q.clearedAt ? "text-ok" : "text-danger",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] leading-snug">
                  {q.detail}
                </span>
                <span className="block text-[11px] text-faint">
                  {shortDate(q.at)}
                  {q.clearedAt && ` · cleared ${shortDate(q.clearedAt)}`}
                </span>
              </span>
              {!q.clearedAt && (
                <button
                  type="button"
                  onClick={() => clearAuthorityQuery(project.id, q.id)}
                  className="btn btn-ghost btn-sm shrink-0"
                >
                  Cleared
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!project.outcomeAt && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
          <span className="text-[12px] text-muted">
            When the outcome comes in:
          </span>
          <button
            type="button"
            onClick={() => recordOutcome(project.id, "approved")}
            className="btn btn-primary btn-sm"
          >
            <Check size={13} />
            Approved
          </button>
          <button
            type="button"
            onClick={() => recordOutcome(project.id, "declined")}
            className="btn btn-danger btn-sm"
          >
            <X size={13} />
            Declined
          </button>
        </div>
      )}

      <div className="space-y-2 border-t border-line px-5 py-3">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What did they come back asking for?"
            aria-label="Log an authority query"
            className="field h-9 flex-1 py-0 text-[12px]"
          />
          <button
            type="button"
            disabled={!query.trim()}
            onClick={() => {
              addAuthorityQuery(project.id, query);
              setQuery("");
            }}
            className="btn btn-ghost btn-sm"
          >
            Log
          </button>
        </div>
        <div className="flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Follow-up: who you spoke to, what they said"
            aria-label="Log a follow-up"
            className="field h-9 flex-1 py-0 text-[12px]"
          />
          <button
            type="button"
            onClick={() => {
              logAuthorityFollowUp(project.id, note);
              setNote("");
            }}
            className="btn btn-primary btn-sm"
          >
            Follow up
          </button>
        </div>
      </div>
    </div>
  );
}
