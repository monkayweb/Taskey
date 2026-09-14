// ---------------------------------------------------------------------------
// The real practice, from Patricia's own list.
//
//   npm run db:team
//
// Four people, five addresses: Tinerudo covers the academy seat as well as
// her own since it was vacated, and a seat is one address because that is
// what a sign-in is matched on. Her second address is recorded on her job
// description rather than as a second seat, because two seats would be two
// people everywhere that counts work.
//
// A seat is permission to sign in and nothing more: nobody is emailed from
// here. The invitation goes out from the Employees page, when Patricia is
// ready for them to have it.
//
// Safe to run twice: every row is written by id. The invented team this
// replaces is archived rather than deleted, so the sample sheets they carry
// and every trail entry with their name on it stay readable.
// ---------------------------------------------------------------------------

import { eq, inArray } from "drizzle-orm";
import { getDb } from "../src/db";
import { users as usersTable } from "../src/db/schema";
import { saveUser } from "../src/db/queries";
import type { User } from "../src/lib/types";

/**
 * Patricia keeps the seat she already has, so the sheets she carries and her
 * entries in the trail stay hers. Everything else about the row is corrected,
 * including the address: she signs in as patricia.n, not patricia.
 */
const TEAM: User[] = [
  {
    id: "u_patricia",
    name: "Patricia Ngassam",
    email: "patricia.n@pharmers.co.za",
    role: "admin",
    jobTitle: "Manager",
    // The QC check at step 8 is the owner's signature and nobody else's.
    workRole: "owner",
    duties: [],
    tint: "#4f46e5",
  },
  {
    id: "u_tshepiso",
    name: "Tshepiso",
    email: "info@pharmers.co.za",
    role: "employee",
    jobTitle: "Sales and administration",
    // The office: opens a sheet when a payment lands, acknowledges the client
    // at step 5 and sends the balance invoice at step 10.
    workRole: "admin",
    duties: [],
    tint: "#c2410c",
  },
  {
    id: "u_sindisiwe",
    name: "Sindisiwe",
    email: "consultants@pharmers.co.za",
    role: "employee",
    jobTitle: "Junior consultant",
    // Steps 6 and 7: the client's documents, then compiling the application.
    workRole: "consultant",
    duties: [],
    tint: "#0d9488",
  },
  {
    id: "u_tinerudo",
    name: "Tinerudo",
    email: "training@pharmers.co.za",
    role: "employee",
    jobTitle: "Coordinator",
    // Step 9: submission, once QC has cleared it.
    workRole: "coordinator",
    duties: ["Covering academy@pharmers.co.za as well, while that seat is vacant"],
    tint: "#7c3aed",
  },
];

/** The invented practice these four replace. Archived, never deleted. */
const INVENTED = ["u_lerato", "u_nadia", "u_rushdi", "u_sibongile"];

async function main() {
  const db = getDb();

  // The old row carries the address Patricia no longer uses, and a unique
  // index means it cannot sit there while hers is written.
  const clash = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "patricia@pharmers.co.za"));
  for (const row of clash) {
    if (row.id === "u_patricia") continue;
    console.log(`note   ${row.email} belongs to ${row.id}, leaving it alone`);
  }

  for (const person of TEAM) {
    await saveUser(person);
    console.log(
      `seat   ${person.name.padEnd(18)} ${person.workRole.padEnd(11)} ${person.email}`,
    );
  }

  const archived = await db
    .update(usersTable)
    .set({ archivedAt: new Date() })
    .where(inArray(usersTable.id, INVENTED))
    .returning({ name: usersTable.name });
  for (const a of archived) console.log(`park   ${a.name} archived`);

  console.log(
    "\nSeats written. Nobody has been emailed: send the invitations from" +
      "\nthe Employees page when the practice is ready for them.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
