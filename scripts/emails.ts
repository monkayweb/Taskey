import { desc } from "drizzle-orm";
import { getDb } from "../src/db";
import { emails } from "../src/db/schema";

async function main() {
  const rows = await getDb().select().from(emails).orderBy(desc(emails.at)).limit(15);
  console.log(`logged emails: ${rows.length}\n`);
  for (const e of rows)
    console.log(
      `${e.at.toISOString().slice(0, 16)}  ${e.kind.padEnd(14)} ${e.to.padEnd(26)} ` +
        (e.error ? `FAILED: ${e.error.slice(0, 90)}` : `sent (${e.providerId})`),
    );
}
main();
