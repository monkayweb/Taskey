"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Minus, Trash2, TriangleAlert, X } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { shortDate } from "@/lib/date";
import { money } from "@/lib/rules";
import { paidToDate, serviceById, stepsDone } from "@/lib/services";
import type { Project } from "@/lib/types";
import { Badge } from "./ui";

/**
 * Deleting a project sheet. A quiet line at the foot of the sheet, and the
 * weight of it inside the dialog, the same shape as deleting a person.
 *
 * The counts are the point: a sheet carries money received and documents
 * collected, and somebody about to delete one should see that before they do,
 * not after.
 */
export function DeleteProject({ project }: { project: Project }) {
  const me = useTaskey((s) =>
    s.users.find((u) => u.id === s.currentUserId),
  );
  const [open, setOpen] = useState(false);

  // Only management, and never a stray control for anybody else.
  if (me?.role !== "admin") return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-5">
        <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-faint">
          A finished project is better left complete than deleted. This is for
          a sheet opened by mistake.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-danger transition-colors hover:text-danger/75"
        >
          <Trash2 size={13} />
          Delete this project
        </button>
      </div>

      {open && <Dialog project={project} onClose={() => setOpen(false)} />}
    </>
  );
}

function Dialog({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const router = useRouter();
  const { assignments, deleteProjectSheet } = useTaskey();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  const service = serviceById(project.serviceId);
  const tasks = assignments.filter((a) => a.projectId === project.id);
  const openTasks = tasks.filter((a) => a.status === "open");
  const received = paidToDate(project);
  const documents = project.documents.filter((d) => d.received).length;
  const ready = typed.trim() === project.client && !busy;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    field.current?.focus();
  }, []);

  const remove = async () => {
    setBusy(true);
    await deleteProjectSheet(project.id);
    setBusy(false);
    router.push("/projects");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Delete ${project.client}`}
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
    >
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
        <div className="flex items-start gap-3.5 px-6 pb-5 pt-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-bold tracking-tight">
              Delete {project.client}?
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
              <Badge>{service.short}</Badge>
              opened from the {shortDate(project.paidAt)} payment ·{" "}
              {project.submittedAt
                ? `submitted ${shortDate(project.submittedAt)}`
                : "not submitted"}
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

        <div className="grid gap-px bg-line sm:grid-cols-2">
          <div className="bg-danger-soft/40 px-6 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-danger">
              Deleted
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {[
                `All ${project.milestones.length} steps, ${stepsDone(project)} of them closed`,
                `The request list, ${documents} of ${project.documents.length} documents in`,
                `${project.payments.length} payment${project.payments.length === 1 ? "" : "s"} recorded, ${money(received)}`,
                `${tasks.length} task${tasks.length === 1 ? "" : "s"} it raised${openTasks.length > 0 ? `, ${openTasks.length} still open` : ""}`,
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[12px]">
                  <Minus
                    size={13}
                    className="mt-0.5 shrink-0 text-danger"
                    strokeWidth={3}
                  />
                  <span className="text-ink">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-surface px-6 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ok">
              Kept
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {[
                "The audit trail, in full",
                "Every email it sent, and to whom",
                "Nothing about the client is deleted elsewhere",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[12px]">
                  <Check
                    size={13}
                    className="mt-0.5 shrink-0 text-ok"
                    strokeWidth={3}
                  />
                  <span className="text-muted">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {received > 0 && (
          <div className="flex items-start gap-3 border-t border-line bg-warn-soft/50 px-6 py-4">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" />
            <p className="text-[12px] leading-relaxed text-muted">
              <span className="font-semibold text-warn">
                {money(received)} has been received against this project.
              </span>{" "}
              Deleting the sheet does not refund anything or tell the client;
              it only removes the record of the work. If the project is over,
              record the outcome instead.
            </p>
          </div>
        )}

        <div className="border-t border-line bg-sunken/50 px-6 py-5">
          <label className="block">
            <span className="text-[12px] text-muted">
              Type{" "}
              <span className="font-semibold text-ink">{project.client}</span>{" "}
              to confirm. This cannot be undone.
            </span>
            <input
              ref={field}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && ready) void remove();
              }}
              placeholder={project.client}
              aria-label={`Type ${project.client} to confirm`}
              className={clsx(
                "field mt-2 h-10",
                typed && typed.trim() !== project.client && "ring-warn/40",
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
          </div>
        </div>
      </div>
    </div>
  );
}
