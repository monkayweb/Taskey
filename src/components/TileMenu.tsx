"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, MoreHorizontal, MoreVertical, RotateCcw } from "lucide-react";

/**
 * The reference's "..." on every card. It is only worth the space if it does
 * something, so it carries the one action the board actually needs.
 */
export function TileMenu({
  done,
  onToggle,
  vertical,
}: {
  done: boolean;
  onToggle: () => void;
  vertical?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const Icon = vertical ? MoreVertical : MoreHorizontal;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Task actions"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "grid size-6 place-items-center rounded-lg text-white/80 transition-colors hover:bg-white/20 hover:text-white",
          open && "bg-white/20 text-white",
        )}
      >
        <Icon size={vertical ? 15 : 17} strokeWidth={2.4} />
      </button>

      {open && (
        <>
          {/* Click anywhere else to dismiss. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            className="absolute right-0 top-full z-20 mt-1 w-[136px] rounded-xl bg-surface p-1 ring-1 ring-line"
            style={{ boxShadow: "var(--shadow-pop)" }}
          >
            <button
              type="button"
              onClick={() => {
                onToggle();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-ink transition-colors hover:bg-sunken"
            >
              {done ? <RotateCcw size={13} /> : <Check size={13} />}
              {done ? "Reopen" : "Mark done"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
