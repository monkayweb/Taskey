"use client";

import { useState } from "react";
import clsx from "clsx";
import { Send } from "lucide-react";
import { useTaskey } from "@/lib/store";
import { shortDate } from "@/lib/date";
import type { User } from "@/lib/types";

/**
 * Whether anybody has told them, and whether they have ever been in.
 *
 * A row in the team table is a seat: it says this address may sign in, and
 * nothing more. "I never got an email" is otherwise unanswerable, so the
 * trail is read back here and the invitation can be sent again.
 */
export function SeatLine({ user }: { user: User }) {
  const { audit, inviteEmployee } = useTaskey();
  const [sending, setSending] = useState(false);

  const invited = audit.find(
    (e) =>
      e.subject === user.name &&
      (e.detail.includes("Invitation emailed") ||
        e.detail.includes("Invitation re-sent")),
  );

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
      <span
        className={clsx(
          "size-1.5 shrink-0 rounded-full",
          invited ? "bg-ok-fill" : "bg-warn-fill",
        )}
      />
      <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-muted">
        {invited ? (
          <>
            Invited {shortDate(invited.at)}. They sign in with{" "}
            <span className="font-medium text-ink">{user.email}</span>, no
            password.
          </>
        ) : (
          <>
            No invitation has gone out. They can sign in with{" "}
            <span className="font-medium text-ink">{user.email}</span>, but
            nobody has told them.
          </>
        )}
      </p>
      <button
        type="button"
        disabled={sending}
        onClick={async () => {
          setSending(true);
          await inviteEmployee(user.id);
          setSending(false);
        }}
        className="btn btn-ghost btn-sm shrink-0"
      >
        <Send size={13} />
        {sending
          ? "Sending…"
          : invited
            ? "Send it again"
            : "Send the invitation"}
      </button>
    </div>
  );
}

/** Has an invitation ever gone out? The main page warns when it has not. */
export function useNeverInvited(user?: User): boolean {
  const audit = useTaskey((s) => s.audit);
  if (!user) return false;
  return !audit.some(
    (e) =>
      e.subject === user.name &&
      (e.detail.includes("Invitation emailed") ||
        e.detail.includes("Invitation re-sent")),
  );
}
