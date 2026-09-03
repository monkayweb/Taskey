"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { LifeBuoy, X } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { useNow } from "@/lib/now";
import { dayKey } from "@/lib/date";
import { isOpen } from "@/lib/rules";
import type { EscalationItem, EscalationSeverity } from "@/lib/types";
import { Badge } from "./ui";

const SEVERITIES: {
  value: EscalationSeverity;
  label: string;
  hint: string;
}[] = [
  { value: "stretched", label: "Stretched", hint: "Coping, but something will slip" },
  { value: "overloaded", label: "Overloaded", hint: "Cannot finish today's list" },
  { value: "blocked", label: "Blocked", hint: "Waiting on someone else to move" },
];

/**
 * One click to say "I'm swamped", then a forced pick of *which* items are
 * falling behind — a bare alert with no specifics can't be acted on.
 */
export function OverwhelmedButton({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const now = useNow();
  const { logs, leads, projects, currentUserId, raiseEscalation, escalations } =
    useTaskey();

  const [severity, setSeverity] = useState<EscalationSeverity>("overloaded");
  const [picked, setPicked] = useState<Record<string, EscalationItem>>({});
  const [note, setNote] = useState("");

  const myOpen = escalations.find(
    (e) => e.userId === currentUserId && e.status !== "resolved",
  );

  const candidates = useMemo(() => {
    const today = dayKey(now);
    const log = logs.find((l) => l.userId === currentUserId && l.date === today);

    const blocks: EscalationItem[] = (log?.blocks ?? [])
      .filter((b) => b.status !== "done")
      .map((b) => ({
        kind: "block",
        refId: b.id,
        label: `${b.start}–${b.end} ${b.label}`,
      }));

    const leadItems: EscalationItem[] = leads
      .filter((l) => l.ownerId === currentUserId && isOpen(l))
      .map((l) => ({
        kind: "lead",
        refId: l.id,
        label: `${l.company} — ${l.stage.replace("_", " ")}`,
      }));

    const milestoneItems: EscalationItem[] = projects
      .filter((p) => p.ownerId === currentUserId && p.status !== "complete")
      .flatMap((p) =>
        p.milestones
          .filter((m) => !m.done)
          .map((m) => ({
            kind: "milestone" as const,
            refId: m.id,
            label: `${p.name} · ${m.label}`,
          })),
      );

    return [
      { group: "Today's time blocks", items: blocks },
      { group: "Open leads & quotes", items: leadItems },
      { group: "Project milestones", items: milestoneItems },
    ].filter((g) => g.items.length > 0);
  }, [logs, leads, projects, currentUserId, now]);

  const chosen = Object.values(picked);

  function submit() {
    if (chosen.length === 0) return;
    raiseEscalation({ severity, items: chosen, note: note.trim() || undefined });
    setPicked({});
    setNote("");
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          "btn btn-danger w-full",
          compact ? "btn-sm" : "btn-md",
        )}
      >
        <LifeBuoy size={15} />
        {myOpen ? "Escalation open" : "I'm overwhelmed"}
      </button>

      {myOpen && !compact && (
        <p className="mt-1.5 text-[11px] leading-snug text-muted">
          Management was notified{" "}
          {myOpen.status === "acknowledged" ? "and has seen it" : "— awaiting response"}.
        </p>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Flag a bottleneck"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface shadow-[var(--shadow-pop)] sm:rounded-3xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Flag a bottleneck</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Pick what is actually falling behind so it can be reassigned today.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-ghost btn-sm px-2"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div>
                <p className="eyebrow mb-1.5">How bad is it?</p>
                <div className="grid gap-1.5 sm:grid-cols-3">
                  {SEVERITIES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSeverity(s.value)}
                      className={clsx(
                        "rounded-xl px-3 py-2.5 text-left ring-1 transition-colors",
                        severity === s.value
                          ? "bg-accent-soft ring-accent/40"
                          : "ring-line hover:bg-sunken",
                      )}
                    >
                      <span className="block text-[13px] font-medium">{s.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                        {s.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="eyebrow">What is falling behind?</p>
                  <Badge tone={chosen.length ? "accent" : "neutral"}>
                    {chosen.length} selected
                  </Badge>
                </div>

                {candidates.length === 0 ? (
                  <p className="rounded-xl bg-sunken px-3 py-4 text-center text-xs text-muted">
                    Nothing open to flag — your list is clear.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {candidates.map((group) => (
                      <div key={group.group}>
                        <p className="mb-1 text-[11px] font-medium text-faint">
                          {group.group}
                        </p>
                        <div className="space-y-1">
                          {group.items.map((item) => {
                            const key = `${item.kind}:${item.refId}`;
                            const on = !!picked[key];
                            return (
                              <label
                                key={key}
                                className={clsx(
                                  "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] ring-1 transition-colors",
                                  on
                                    ? "bg-accent-soft ring-accent/40"
                                    : "ring-line hover:bg-sunken",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() =>
                                    setPicked((prev) => {
                                      const next = { ...prev };
                                      if (next[key]) delete next[key];
                                      else next[key] = item;
                                      return next;
                                    })
                                  }
                                  className="size-4 accent-[var(--color-accent)]"
                                />
                                <span className="min-w-0 flex-1 truncate">
                                  {item.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="eyebrow mb-1.5 block" htmlFor="esc-note">
                  Anything management should know?
                </label>
                <textarea
                  id="esc-note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Two quotes due today and the WhatsApp queue is backing up."
                  className="field resize-none"
                />
              </div>
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-line bg-sunken px-5 py-4">
              <p className="text-[11px] text-muted">
                Sends immediately and lands on the admin dashboard.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={chosen.length === 0}
                  className="btn btn-primary btn-sm"
                >
                  Send escalation
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
