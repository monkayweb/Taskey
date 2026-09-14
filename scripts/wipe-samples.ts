// ---------------------------------------------------------------------------
// Clear the invented practice so the real one starts on real work.
//
//   npm run db:wipe-samples
//
// Three things, in order:
//
//   1. Every task goes. They were all raised by or for the invented team, and
//      a task list that opens with 28 things nobody in the building recognises
//      is worse than an empty one.
//   2. Every sample sheet goes, and its steps, documents, payments and
//      authority queries go with it by cascade. Sample clients were invented
//      but their addresses were not obviously invented, and the morning job
//      has been chasing them daily from a verified domain.
//   3. The standing duties stay, handed to whoever now holds that role. They
//      are the practice's own work rather than sample data, and every one of
//      them was pointing at somebody who has been archived, which would have
//      raised a task each morning that nobody could see.
//
// What deliberately survives is the audit trail. It is the record the
// practice is held to, and nothing in the application has ever been allowed
// to edit it, so it keeps saying what happened to a sheet that no longer
// exists. The email log survives for the same reason: what went out, went out.
// ---------------------------------------------------------------------------

import { neon } from "@neondatabase/serverless";

const sql = neon(
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
);

/** Who each standing duty belongs to now, by the role that does that work. */
const DUTY_ROLE: { match: string; workRole: string }[] = [
  { match: "document", workRole: "consultant" },
  { match: "portal", workRole: "coordinator" },
  { match: "quote", workRole: "admin" },
  { match: "follow-up sweep", workRole: "coordinator" },
  { match: "payments", workRole: "admin" },
];

async function main() {
  // --- 1. tasks ------------------------------------------------------------
  const tasks = await sql`delete from assignments returning id`;
  console.log(`tasks    ${tasks.length} deleted`);

  // --- 2. sample sheets ----------------------------------------------------
  const projects = await sql`delete from projects returning client`;
  for (const p of projects) console.log(`sheet    ${p.client} deleted`);

  // --- 3. standing duties, handed to the people who are actually here -------
  const holders = await sql`
    select id, name, work_role from users where archived_at is null`;
  const duties = await sql`select id, title, assignee_ids from recurring_tasks`;

  for (const duty of duties) {
    const title = String(duty.title).toLowerCase();
    const rule = DUTY_ROLE.find((r) => title.includes(r.match));
    const holder = holders.find((h) => h.work_role === rule?.workRole);
    if (!holder) {
      console.log(`duty     ${String(duty.title).slice(0, 44)} left as it is`);
      continue;
    }
    await sql`
      update recurring_tasks
         set assignee_ids = ${[holder.id]}
       where id = ${duty.id}`;
    console.log(
      `duty     ${String(duty.title).slice(0, 44).padEnd(46)} -> ${holder.name}`,
    );
  }

  const [trail] = await sql`select count(*)::int as n from audit`;
  console.log(
    `\nThe practice is empty and ready. ${trail.n} trail entries kept: the record` +
      "\nof what happened does not go just because the sheets did.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
