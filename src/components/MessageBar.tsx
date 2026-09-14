"use client";

import { useEffect } from "react";
import clsx from "clsx";
import { Check, TriangleAlert, X } from "lucide-react";
import { useTaskey } from "@/lib/store";

/** Something that went right clears itself; something that went wrong waits. */
const HOLD = 6000;

/**
 * The last thing the server said.
 *
 * It used to be a dark pill, the only dark surface in the app, which is why
 * it read as something bolted on. It is a card now, like everything else: the
 * colour is carried by a small icon chip rather than the whole surface, the
 * way the stat tiles and flags do it.
 */
export function MessageBar() {
  const { error, notice, clearError, clearNotice } = useTaskey();
  const message = error ?? notice;
  const bad = !!error;

  // A confirmation has been read by the time it fades. A refusal has not.
  useEffect(() => {
    if (!message || bad) return;
    const t = setTimeout(() => clearNotice(), HOLD);
    return () => clearTimeout(t);
  }, [message, bad, clearNotice]);

  if (!message) return null;

  return (
    // The bottom inset keeps it clear of the home indicator on a phone.
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:justify-end md:p-6"
      aria-live="polite"
    >
      {/* Keyed by the message, so a new one replays the movement. */}
      <div
        key={message}
        role={bad ? "alert" : "status"}
        className="card toast-in pointer-events-auto flex w-full max-w-[26rem] items-start gap-3 px-4 py-3.5"
        style={{ boxShadow: "var(--shadow-pop)" }}
      >
        <span
          className={clsx(
            "grid size-8 shrink-0 place-items-center rounded-xl",
            bad ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok",
          )}
        >
          {bad ? (
            <TriangleAlert size={16} />
          ) : (
            <Check size={16} strokeWidth={3} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p
            className={clsx(
              "text-[11px] font-semibold uppercase tracking-[0.08em]",
              bad ? "text-danger" : "text-ok",
            )}
          >
            {bad ? "Not done" : "Done"}
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-ink">{message}</p>
        </div>

        <button
          type="button"
          onClick={bad ? clearError : clearNotice}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-sunken hover:text-ink"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
