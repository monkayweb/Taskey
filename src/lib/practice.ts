// ---------------------------------------------------------------------------
// Who the letters are from, and who they come back to.
//
// Taskey is the system that sends; the practice is whose letter it is. A
// client asked for a lease agreement should see the practice they hired, and
// their reply has to land with the consultant carrying their project, not in
// a mailbox nobody reads.
//
// So every email has three parts to its identity:
//
//   the sending domain   one domain, verified once, owned by Taskey
//   the display name     the practice, for client mail; Taskey, for the team
//   the reply-to         a real person at the practice
//
// That separation is what lets one verified domain serve any number of
// practices without each of them touching DNS.
// ---------------------------------------------------------------------------

/** The practice this installation belongs to. */
export const practice = {
  name: process.env.PRACTICE_NAME ?? "Pharmers",
  /** Where client replies go when no particular person owns the thread. */
  inbox: process.env.PRACTICE_INBOX ?? "info@pharmers.co.za",
};

/** The system's own name, which is what actually sends. */
export const SYSTEM_NAME = "Taskey";

/**
 * The address every email leaves from. One domain for the whole system, so
 * verification happens once rather than per practice.
 */
export function sendingAddress(): string {
  const override = process.env.RESEND_FROM?.trim();
  if (override) return override;
  const domain = process.env.RESEND_EMAIL_DOMAIN ?? "resend.dev";
  return `notifications@${domain}`;
}

/**
 * A client's letter carries the practice's name, followed by the system that
 * sent it. Mail clients show the name, so the client sees who they hired, and
 * the "via" is there because pretending a machine is a person is how trust
 * gets lost the first time somebody notices.
 */
export const clientFrom = () =>
  process.env.RESEND_FROM?.trim() ??
  `${practice.name} (via ${SYSTEM_NAME}) <${sendingAddress()}>`;

/** Mail to the team is from the system, because that is exactly what it is. */
export const teamFrom = () =>
  process.env.RESEND_FROM?.trim() ?? `${SYSTEM_NAME} <${sendingAddress()}>`;
