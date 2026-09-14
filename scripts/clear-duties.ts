// ---------------------------------------------------------------------------
// Remove the standing duties the seed invented.
//
//   npm run db:clear-duties
//
// They were written by `scripts/seed.ts` against a team that never existed,
// and one of them says monthly while running every Monday. Patricia's real
// standing work goes in from the Tasks screen once she has said what it is,
// and takes effect the next morning.
//
// It also clears tasks left behind by a duty that no longer exists. Opening
// the app raises the day's duties as well as the morning job does, so one
// signed-in page load between removing the duties and looking again is
// enough to leave five orphans on somebody's list.
// ---------------------------------------------------------------------------

import { neon } from "@neondatabase/serverless";

const sql = neon(
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
);

async function main() {
  const duties = await sql`select title from recurring_tasks order by title`;
  for (const d of duties) console.log(`duty     ${d.title}`);
  const removed = await sql`delete from recurring_tasks returning id`;

  // Anything still carrying a recurring_id now points at a rule that is gone.
  const orphans = await sql`
    delete from assignments
     where recurring_id is not null
       and recurring_id not in (select id from recurring_tasks)
    returning title`;
  for (const o of orphans) console.log(`orphan   ${o.title}`);

  console.log(
    `\n${removed.length} standing duties and ${orphans.length} tasks left behind by them removed.` +
      "\nNothing will be raised tomorrow morning that the practice did not ask for.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
