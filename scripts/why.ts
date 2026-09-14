import { desc } from "drizzle-orm";
import { getDb } from "../src/db";
import { assignments, audit, emails, users } from "../src/db/schema";

async function main() {
  const db = getDb();
  const team = await db.select().from(users);
  console.log("seats:", team.map((u) => `${u.email}(${u.id})`).join(", "), "\n");

  for (const a of await db.select().from(assignments)) {
    const who = a.assigneeIds.map(
      (id) => team.find((u) => u.id === id)?.email ?? `${id} DELETED`,
    );
    console.log(
      `task "${a.title}" status=${a.status} due=${a.dueDate}\n   assignees: ${who.join(", ")}\n   remindedAt: ${a.remindedAt?.toISOString() ?? "never"}`,
    );
  }

  console.log("\nlast trail entries:");
  for (const e of await db.select().from(audit).orderBy(desc(audit.at)).limit(5))
    console.log(`   ${e.at.toISOString().slice(11, 16)} ${e.type.padEnd(16)} ${e.detail.slice(0, 70)}`);

  console.log("\nlast emails:");
  for (const e of await db.select().from(emails).orderBy(desc(emails.at)).limit(4))
    console.log(`   ${e.at.toISOString().slice(11, 16)} ${e.kind.padEnd(14)} ${e.to.padEnd(26)} ${e.error ? "FAILED" : "sent"}`);
}
main();
