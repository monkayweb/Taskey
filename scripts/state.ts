// ---------------------------------------------------------------------------
// A read-only look at what is actually in the database, for checking a change
// landed the way it was meant to. Writes nothing.
//
//   npm run db:state
// ---------------------------------------------------------------------------

import { neon } from "@neondatabase/serverless";

const sql = neon(
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
);

async function main() {
  const users = await sql`
    select id, name, email, role, work_role, archived_at from users order by name`;
  console.log(`${users.length} users`);
  for (const u of users) {
    console.log(
      `  ${u.id.padEnd(12)} ${u.name.padEnd(20)} ${u.role.padEnd(9)} ${u.work_role.padEnd(11)} ${u.email}${u.archived_at ? "  (archived)" : ""}`,
    );
  }

  const projects = await sql`
    select client, status, paid_at, acknowledged_at, submitted_at
      from projects order by due_date`;
  console.log(`\n${projects.length} projects`);
  for (const p of projects) {
    console.log(
      `  ${p.client.padEnd(28)} ${p.status.padEnd(9)} ` +
        `ack ${p.acknowledged_at ? "yes" : "NO"}  ` +
        `submitted ${p.submitted_at ? "yes" : "no"}`,
    );
  }

  const leads = await sql`select company, stage, owner_id from leads`;
  console.log(`\n${leads.length} leads`);
  for (const l of leads) {
    console.log(`  ${l.company.padEnd(32)} ${l.stage.padEnd(11)} ${l.owner_id}`);
  }

  const [tasks] = await sql`select count(*)::int as n from assignments`;
  const [duties] = await sql`select count(*)::int as n from recurring_tasks`;
  const [trail] = await sql`select count(*)::int as n from audit`;
  console.log(`\n${tasks.n} tasks, ${duties.n} standing duties, ${trail.n} trail entries`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
