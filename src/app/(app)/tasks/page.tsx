"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useTaskey } from "@/lib/store";
import clsx from "clsx";
import { AssignTaskPanel } from "@/components/Assignments";
import { RecentTasks } from "@/components/RecentTasks";

/**
 * The list is the page, so the route carries which task is open: ?task=<id>
 * is how a dashboard row lands on the task it names.
 */
export default function TasksPage() {
  return (
    <Suspense fallback={null}>
      <Tasks />
    </Suspense>
  );
}

function Tasks() {
  const openFirst = useSearchParams().get("task") ?? undefined;
  const { users, assignments, currentUserId } = useTaskey();
  const me = users.find((u) => u.id === currentUserId)!;
  const [composing, setComposing] = useState(false);

  // Opening the drawer should put the cursor where you are about to type.
  useEffect(() => {
    if (!composing) return;
    const el = document.getElementById("new-task-title");
    (el as HTMLInputElement | null)?.focus();
  }, [composing]);

  // Escape closes it, as with any panel over the page.
  useEffect(() => {
    if (!composing) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setComposing(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [composing]);

  // Everybody works off this list. Management sees the whole team's, and can
  // hand new work out; everybody else sees their own, including the project
  // steps the sheets routed to them.
  const mine = assignments.filter((a) => a.assigneeIds.includes(me.id));

  return (
    <div className="min-h-dvh">
      {/* --- main column ---------------------------------------------- */}
      {/* Frame 4 sets the spacing for this page: 20/32 padding, 32 between
          its children. Sections inside step down to 24 between blocks and 16
          between items, and nothing reaches past this padding. */}
      <div className="min-w-0 space-y-8 p-5 md:p-8">
        <RecentTasks
          tasks={me.role === "admin" ? assignments : mine}
          users={users}
          onNew={me.role === "admin" ? () => setComposing(true) : undefined}
          openFirst={openFirst}
        />
      </div>

      {/* --- compose drawer ------------------------------------------- */}
      {/* Kept mounted so it can slide, and inert while closed so nothing
          inside it can be tabbed into or read out. */}
      <aside
        inert={!composing}
        aria-label="New task"
        className={clsx(
          "fixed inset-y-0 right-0 z-40 w-full max-w-[380px] overflow-y-auto border-l border-line bg-sheet p-5 transition-transform duration-300 ease-out md:p-8",
          composing ? "translate-x-0" : "translate-x-full",
        )}
        style={{ boxShadow: composing ? "var(--shadow-pop)" : undefined }}
      >
        <button
          type="button"
          onClick={() => setComposing(false)}
          aria-label="Close"
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink"
        >
          <X size={17} />
        </button>

        <AssignTaskPanel />
      </aside>
    </div>
  );
}
