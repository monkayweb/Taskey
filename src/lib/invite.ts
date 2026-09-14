// ---------------------------------------------------------------------------
// Inviting somebody onto the team.
//
// A row in `users` is a seat, not an invitation: it says this address may sign
// in, and nothing more. Adding a person without telling them is how somebody
// ends up waiting for an email that was never sent, so the two go together.
//
// The email comes from Clerk's own infrastructure, the same way its
// verification codes do. That matters: it works before our sending domain is
// verified, and it carries a link that signs them in rather than a password
// somebody has to invent and share.
// ---------------------------------------------------------------------------

import { clerkClient } from "@clerk/nextjs/server";
import { logEmail } from "@/db/queries";
import type { User } from "./types";

const uid = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

/** Where the invitation lands them. */
function signInUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return `${base}/sign-in`;
}

export interface InviteResult {
  sent: boolean;
  /** Said the way it would be said out loud, because it goes on the screen. */
  message: string;
}

/**
 * Invite one person, and record it either way. Never throws: a seat that was
 * created successfully should not be undone because an email failed.
 */
export async function invite(person: User): Promise<InviteResult> {
  const to = person.email;
  const first = person.name.split(" ")[0];

  try {
    const clerk = await clerkClient();
    const created = await clerk.invitations.createInvitation({
      emailAddress: to,
      redirectUrl: signInUrl(),
      // Re-inviting somebody is a normal thing to want, not an error.
      ignoreExisting: true,
      notify: true,
    });

    await logEmail({
      id: uid("em"),
      kind: "team_invite",
      to,
      subject: "You have been invited to Taskey",
      providerId: created.id,
    });

    return {
      sent: true,
      message: `Invitation emailed to ${to}. ${first} signs in with that address, no password needed.`,
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown error";

    await logEmail({
      id: uid("em"),
      kind: "team_invite",
      to,
      subject: "You have been invited to Taskey",
      error: reason,
    });

    return {
      sent: false,
      // The seat still works, so say what they can do about it.
      message: `${first} has a seat, but the invitation email could not be sent (${reason}). They can still sign in at ${signInUrl()} with ${to}.`,
    };
  }
}
