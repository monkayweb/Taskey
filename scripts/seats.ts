// Who has a seat, and whether they have signed in yet.
import { desc } from "drizzle-orm";
import { getDb } from "../src/db";
import { audit, users } from "../src/db/schema";

async function main() {
  const db = getDb();
  for (const u of await db.select().from(users))
    console.log(
      `${u.email.padEnd(30)} ${u.workRole.padEnd(12)} ${u.clerkId ? "claimed" : "no account yet"}`,
    );
  console.log("\nlatest trail:");
  for (const e of await db.select().from(audit).orderBy(desc(audit.at)).limit(4))
    console.log(`   ${e.type.padEnd(18)} ${e.subject} :: ${e.detail.slice(0, 80)}`);
}
main();
