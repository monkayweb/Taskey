// ---------------------------------------------------------------------------
// Put the practice into an empty database: the five people and the standing
// duties they already do. Nothing else, because a project is supposed to exist
// only because a client paid.
//
//   npx dotenv -e .env.local -- node scripts/seed.js            team + duties
//   npx dotenv -e .env.local -- node scripts/seed.js --demo     plus samples
//
// Safe to run twice: every row is written by id.
// ---------------------------------------------------------------------------

import { RECURRING, USERS, buildSeed } from "../src/lib/seed";
import {
  saveAssignments,
  saveAudit,
  saveLead,
  saveProject,
  saveRecurring,
  saveUser,
} from "../src/db/queries";

async function main() {
  const demo = process.argv.includes("--demo");

  // A seat for whoever is building it, so the whole loop can be exercised
  // including the QC sign-off. Patricia can remove it at handover.
  if (process.argv.includes("--dev-seat")) {
    await saveUser({
      id: "u_dev",
      name: "Tristan Storm",
      email: "tristan@cirrusbridge.com",
      role: "admin",
      jobTitle: "Developer",
      workRole: "owner",
      duties: ["Build and maintain Taskey"],
      tint: "#0369a1",
    });
    console.log("user   Tristan Storm      owner (dev seat)");
  }

  for (const user of USERS) {
    await saveUser(user);
    console.log(`user   ${user.name.padEnd(18)} ${user.workRole}`);
  }

  for (const duty of RECURRING) {
    await saveRecurring(duty);
    console.log(`duty   ${duty.title}`);
  }

  if (demo) {
    const seed = buildSeed(new Date());
    for (const lead of seed.leads) {
      await saveLead(lead);
      console.log(`lead   ${lead.company.padEnd(28)} ${lead.stage}`);
    }
    for (const project of seed.projects) {
      await saveProject(project);
      console.log(`sheet  ${project.client}`);
    }
    // Only the tasks the sheets raised, not the sample handed-out work.
    await saveAssignments(seed.assignments.filter((a) => a.stepId));
    await saveAudit(
      seed.audit.filter((e) => e.type !== "log.submitted").slice(0, 120),
    );
  }

  console.log(
    demo
      ? "\nSeeded the team, their duties, the sample leads and sheets."
      : "\nSeeded the team and their duties. Projects come from real payments.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
