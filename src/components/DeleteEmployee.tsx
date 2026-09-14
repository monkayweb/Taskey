"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowRight, Check, Minus, Trash2, TriangleAlert, X } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/labels";
import type { User } from "@/lib/types";
import { Avatar } from "./ui";

/**
 * Deleting somebody. A quiet line on the page, and the weight of the thing
 * inside the dialog it opens, rather than a red block sitting under every
 * employee for the ninety-nine times out of a hundred nobody is deleting
 * anyone.
 */
export function DeleteEmployee({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const me = useTaskey((s) => s.currentUserId);

  // Nobody needs the option of deleting themselves.
  if (user.id === me) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-5">
        <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-faint">
          Removing {user.name.split(" ")[0]} from the team keeps everything of
          theirs. Deleting them does not.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-danger transition-colors hover:text-danger/75"
        >
          <Trash2 size={13} />
          Delete permanently
        </button>
      </div>

      {open && <Dialog user={user} onClose={() => setOpen(false)} />}
    </>
  );
}

function Dialog({ user, onClose }: { user: User; onClose: () => void }) {
  const router = useRouter();
  const {
    users,
    projects,
    assignments,
    recurring,
    deleteEmployee,
    reassignProjects,
  } = useTaskey();

  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const nameField = useRef<HTMLInputElement>(null);

  // --- what this will actually do -----------------------------------------
  const theirs = projects.filter((p) => p.ownerId === user.id);
  const soleTasks = assignments.filter(
    (a) => a.assigneeIds.length === 1 && a.assigneeIds[0] === user.id,
  );
  const sharedTasks = assignments.filter(
    (a) => a.assigneeIds.length > 1 && a.assigneeIds.includes(user.id),
  );
  const duties = recurring.filter((r) => r.assigneeIds.includes(user.id));

  const owners = users.filter(
    (u) => u.workRole === "owner" && !u.archivedAt && u.id !== user.id,
  );
  const lastOwner = user.workRole === "owner" && owners.length === 0;

  const candidates = users.filter(
    (u) => u.id !== user.id && !u.archivedAt && u.workRole === "consultant",
  );
  const takers =
    candidates.length > 0
      ? candidates
      : users.filter((u) => u.id !== user.id && !u.archivedAt);
  const [moveTo, setMoveTo] = useState(takers[0]?.id ?? "");

  const blocker = lastOwner
    ? "last-owner"
    : theirs.length > 0
      ? "projects"
      : null;
  const ready = !blocker && typed.trim() === user.name && !busy;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!blocker) nameField.current?.focus();
  }, [blocker]);

  const remove = async () => {
    setBusy(true);
    await deleteEmployee(user.id);
    setBusy(false);
    router.push("/employees");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Delete ${user.name}`}
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
    >
      {/* Clicking away is a cancel, which is the safe direction. */}
      <button
        type="button"
        aria-label="Cancel"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/40"
      />

      <div
        className="relative w-full max-w-[34rem] overflow-hidden rounded-2xl bg-surface"
        style={{ boxShadow: "var(--shadow-pop)" }}
      >
        {/* --- who ---------------------------------------------------- */}
        <div className="flex items-start gap-3.5 px-6 pb-5 pt-6">
          <Avatar name={user.name} tint={user.tint} size={40} />
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-bold tracking-tight">
              Delete {user.name}?
            </h2>
            <p className="mt-0.5 text-[12px] text-muted">
              {ROLE_LABEL[user.workRole]} · {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel"
            className="-mr-1.5 -mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-sunken hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>

        {/* --- what goes, and what stays ------------------------------ */}
        <div className="grid gap-px bg-line sm:grid-cols-2">
          <Column
            tone="gone"
            title="Deleted"
            items={[
              "Their seat and their sign-in",
              `${soleTasks.length} task${soleTasks.length === 1 ? "" : "s"} only they hold`,
              `${duties.length} standing dut${duties.length === 1 ? "y" : "ies"}`,
            ]}
          />
          <Column
            tone="kept"
            title="Kept"
            items={[
              "The audit trail, in full",
              `${sharedTasks.length} shared task${sharedTasks.length === 1 ? "" : "s"}, minus their name`,
              "Every QC signature and step they closed",
            ]}
          />
        </div>

        {/* --- the one thing that has to happen first ----------------- */}
        {blocker === "projects" && (
          <div className="flex flex-wrap items-start gap-3 border-t border-line bg-warn-soft/50 px-6 py-4">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-warn">
                {user.name.split(" ")[0]} still carries {theirs.length} project
                {theirs.length === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                {theirs.map((p) => p.client).join(", ")}. A project cannot exist
                without an owner, so hand these over first. The sheets carry on
                from wherever they are.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="min-w-0">
                  <span className="sr-only">Hand them to</span>
                  <select
                    value={moveTo}
                    onChange={(e) => setMoveTo(e.target.value)}
                    className="field h-9 w-44 py-0 text-[12px]"
                  >
                    {takers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy || !moveTo}
                  onClick={async () => {
                    setBusy(true);
                    await reassignProjects(user.id, moveTo);
                    setBusy(false);
                  }}
                  className="btn btn-ghost btn-sm"
                >
                  {busy ? "Moving…" : "Hand them over"}
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {blocker === "last-owner" && (
          <div className="flex items-start gap-3 border-t border-line bg-warn-soft/50 px-6 py-4">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" />
            <p className="text-[12px] leading-relaxed text-muted">
              <span className="font-semibold text-warn">
                This is the last owner.
              </span>{" "}
              Somebody has to be able to sign off QC, or no project could ever
              be submitted again. Make another person the owner first.
            </p>
          </div>
        )}

        {/* --- the act itself ----------------------------------------- */}
        <div className="border-t border-line bg-sunken/50 px-6 py-5">
          <label className="block">
            <span className="text-[12px] text-muted">
              Type{" "}
              <span className="font-semibold text-ink">{user.name}</span> to
              confirm. This cannot be undone.
            </span>
            <input
              ref={nameField}
              value={typed}
              disabled={!!blocker}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && ready) void remove();
              }}
              placeholder={user.name}
              aria-label={`Type ${user.name} to confirm`}
              className={clsx(
                "field mt-2 h-10",
                typed && typed.trim() !== user.name && "ring-warn/40",
              )}
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!ready}
              onClick={remove}
              className="btn btn-md bg-danger-fill text-white hover:bg-danger disabled:bg-danger-fill/40"
            >
              <Trash2 size={14} />
              {busy ? "Deleting…" : "Delete permanently"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-md"
            >
              Cancel
            </button>
            <span className="ml-auto text-[11px] text-faint">
              Or remove them from the team instead, and keep everything.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One side of the split: what goes, or what survives. */
function Column({
  tone,
  title,
  items,
}: {
  tone: "gone" | "kept";
  title: string;
  items: string[];
}) {
  const gone = tone === "gone";
  return (
    <div className={clsx("px-6 py-4", gone ? "bg-danger-soft/40" : "bg-surface")}>
      <p
        className={clsx(
          "text-[11px] font-bold uppercase tracking-[0.08em]",
          gone ? "text-danger" : "text-ok",
        )}
      >
        {title}
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-[12px]">
            {gone ? (
              <Minus size={13} className="mt-0.5 shrink-0 text-danger" strokeWidth={3} />
            ) : (
              <Check size={13} className="mt-0.5 shrink-0 text-ok" strokeWidth={3} />
            )}
            <span className={gone ? "text-ink" : "text-muted"}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
