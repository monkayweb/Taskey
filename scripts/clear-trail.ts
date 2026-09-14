// ---------------------------------------------------------------------------
// Empty the audit trail. Run this by hand, deliberately, or not at all.
//
//   npm run db:clear-trail
//
// Every entry in there right now was written by `scripts/seed.ts` about
// clients who do not exist, and the manager's home screen shows the newest
// seven of them under "Just happened". That is the only reason to do this.
//
// After the practice starts working, this script should never be run again.
// The trail is the record performance reviews are held against, no action in
// the application can edit it, and an audit log that somebody is willing to
// clear is not an audit log. Delete this file once the samples are gone.
// ---------------------------------------------------------------------------

import { neon } from "@neondatabase/serverless";

const sql = neon(
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
);

async function main() {
  const byActor = await sql`
    select actor_id, count(*)::int as n, max(at) as latest
      from audit group by actor_id order by n desc`;

  if (byActor.length === 0) {
    console.log("The trail is already empty.");
    return;
  }

  console.log("about to remove:");
  for (const a of byActor) {
    console.log(
      `   ${String(a.actor_id).padEnd(14)} ${String(a.n).padStart(4)} entries, latest ${new Date(String(a.latest)).toISOString().slice(0, 10)}`,
    );
  }

  const removed = await sql`delete from audit returning id`;
  console.log(
    `\n${removed.length} entries removed. Everything written from here is the` +
      "\npractice's own, and nothing in the app can edit it.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
