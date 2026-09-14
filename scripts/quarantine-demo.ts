// ---------------------------------------------------------------------------
// Point the sample sheets at an address that cannot reach anybody.
//
//   npm run db:quarantine
//
// The sample clients were invented, but their addresses were not obviously
// invented: kirstenhofpharmacy.co.za is a plausible South African pharmacy,
// and the morning job has been chasing it daily from a verified domain. A
// letter signed by a real practice arriving at a stranger is worse than any
// amount of missing demo data.
//
// example.com is reserved by RFC 2606 for exactly this, so mail to it cannot
// be delivered to a real person. The sheets keep working; only the envelope
// changes. The original addresses are still in src/lib/seed.ts if a sample
// sheet ever needs to look real again.
// ---------------------------------------------------------------------------

import { neon } from "@neondatabase/serverless";

const sql = neon(
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
);

async function main() {
  const rows = await sql`
    select id, client, contact_email from projects
     where contact_email not like '%@example.com'`;

  if (rows.length === 0) {
    console.log("Nothing to quarantine: every sheet already points at example.com.");
    return;
  }

  for (const row of rows) {
    const local = String(row.contact_email).split("@")[0];
    const safe = `${local}@example.com`;
    await sql`
      update projects set contact_email = ${safe} where id = ${row.id}`;
    console.log(`${String(row.client).padEnd(28)} ${row.contact_email} -> ${safe}`);
  }

  console.log(
    `\n${rows.length} sheet${rows.length === 1 ? "" : "s"} quarantined. No client letter can leave the` +
      "\nbuilding for a sample project now, including the morning chases.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
