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
    select client, status, contact_email, acknowledged_at, submitted_at
      from projects order by due_date`;
  console.log(`\n${projects.length} projects`);
  for (const p of projects) {
    console.log(
      `  ${p.client.padEnd(28)} ${p.status.padEnd(9)} ${String(p.contact_email).padEnd(34)} ` +
        `submitted ${p.submitted_at ? "yes" : "no"}`,
    );
  }

  const leads = await sql`select company, stage, owner_id from leads`;
  console.log(`\n${leads.length} leads`);
  for (const l of leads) {
    console.log(`  ${l.company.padEnd(32)} ${l.stage.padEnd(11)} ${l.owner_id}`);
  }

  const tasks = await sql`
    select
      count(*)::int as total,
      count(*) filter (where project_id is not null)::int as from_sheets,
      count(*) filter (where recurring_id is not null)::int as from_duties,
      count(*) filter (where project_id is null and recurring_id is null)::int as by_hand,
      count(*) filter (where status = 'open')::int as open
    from assignments`;
  const t = tasks[0];
  console.log(
    `\n${t.total} tasks: ${t.from_sheets} off sheets, ${t.from_duties} off standing duties, ` +
      `${t.by_hand} handed out by name (${t.open} open)`,
  );

  const duties = await sql`
    select r.title, r.assignee_ids, r.active from recurring_tasks r order by r.title`;
  console.log(`\n${duties.length} standing duties`);
  for (const d of duties) {
    const who = await sql`
      select name, archived_at is not null as gone from users
       where id = any(${d.assignee_ids})`;
    console.log(
      `  ${String(d.title).slice(0, 40).padEnd(42)} ${d.active ? "active" : "paused"}  ` +
        who.map((w) => `${w.name}${w.gone ? " (archived)" : ""}`).join(", "),
    );
  }

  const [trail] = await sql`select count(*)::int as n from audit`;
  console.log(`\n${trail.n} trail entries`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
