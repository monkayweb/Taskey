// ---------------------------------------------------------------------------
// One-off backfill for step 5.
//
// Projects opened before the acknowledgement was a real step were all started
// by hand, so their acknowledgement happened off-system on the day the money
// landed. Dating it from the payment keeps every existing sheet exactly where
// it is, instead of sending submitted projects back to step 5 overnight.
// ---------------------------------------------------------------------------

import { neon } from "@neondatabase/serverless";

const sql = neon(
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
);

async function main() {
  const rows = await sql`
    update projects
       set acknowledged_at = (paid_at::timestamptz + interval '12 hours')
     where acknowledged_at is null
    returning client`;

  console.log(
    rows.length === 0
      ? "Nothing to backfill."
      : `Backfilled ${rows.length}: ${rows.map((r) => r.client).join(", ")}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
