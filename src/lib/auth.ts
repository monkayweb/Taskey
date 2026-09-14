// ---------------------------------------------------------------------------
// Who is acting.
//
// Signing in with Clerk is not the same as being on the team. A person can
// only use Taskey if somebody already added them, so a Clerk account is
// matched to a row in `users` by email and then remembered by its Clerk id.
// A signed-in stranger gets nothing, which is what keeps the practice's data
// and its audit trail honest.
// ---------------------------------------------------------------------------

import { eq, sql } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { users as usersTable } from "@/db/schema";
import type { Role, User, WorkRole } from "./types";

export class NotOnTheTeam extends Error {
  constructor(readonly email: string | undefined) {
    super(
      email
        ? `${email} is signed in but is not on the team.`
        : "Signed in without an email address.",
    );
    this.name = "NotOnTheTeam";
  }
}

const toUser = (u: typeof usersTable.$inferSelect): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role as Role,
  jobTitle: u.jobTitle,
  workRole: u.workRole as WorkRole,
  duties: u.duties,
  tint: u.tint,
  archivedAt: u.archivedAt?.toISOString(),
});

/**
 * The team member behind the current session, or null when nobody is signed
 * in or the account has no seat.
 */
export async function actor(): Promise<User | null> {
  const clerk = await currentUser();
  if (!clerk) return null;

  const db = getDb();

  // Already claimed: the fast path on every request after the first.
  const claimed = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerk.id))
    .limit(1);
  if (claimed[0]) return toUser(claimed[0]);

  // First sign-in: claim the seat that carries this email address.
  const email = clerk.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!email) return null;

  const seat = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = ${email}`)
    .limit(1);
  if (!seat[0]) return null;

  await db
    .update(usersTable)
    .set({ clerkId: clerk.id })
    .where(eq(usersTable.id, seat[0].id));

  return toUser(seat[0]);
}

/** For anything that writes: there has to be somebody to hold responsible. */
export async function requireActor(): Promise<User> {
  const me = await actor();
  if (!me) {
    const clerk = await currentUser();
    throw new NotOnTheTeam(clerk?.primaryEmailAddress?.emailAddress);
  }
  if (me.archivedAt) throw new NotOnTheTeam(me.email);
  return me;
}

/** Loading a paid project is the office's job, and management's. */
export const canOpenProjects = (u: User) =>
  u.role === "admin" || u.workRole === "admin";

/** A QC check is the owner's signature and nobody else's. */
export const canSignOffQc = (u: User) => u.workRole === "owner";
