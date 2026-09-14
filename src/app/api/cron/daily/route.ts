// ---------------------------------------------------------------------------
// The morning job. Runs at 05:00 UTC, which is 07:00 in Johannesburg.
//
// Three things, in order:
//   1. Put today's standing duties on the right people's lists.
//   2. Chase any client who has been sitting on their documents.
//   3. Chase any client sitting on an invoice.
//   4. Send each person one email with whatever is late or due today.
//
// Nobody is signed in when this runs, so it acts as "system" and says so in
// the trail. It is idempotent: running it twice in a morning changes nothing
// the second time, because the duty ids are derived from the date and the
// chase emails carry an idempotency key.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { loadWorkspace, saveAudit, saveProject } from "@/db/queries";
import { materialiseRecurring } from "@/lib/actions";
import {
  sendBalanceChaseEmail,
  sendChaseEmail,
  sendDailyDigestEmail,
} from "@/lib/email";
import { entry } from "@/lib/sheet";
import { allDocumentsIn, outstandingDocuments, phaseBalance } from "@/lib/services";
import {
  assignmentFlags,
  BALANCE_CHASE_DAYS,
  byPriority,
  DOC_CHASE_DAYS,
  isActiveEmployee,
  leadFlags,
  projectFlags,
} from "@/lib/rules";
import { dayKey, daysSince, isoWeekday } from "@/lib/date";
import type { Flag, Project } from "@/lib/types";

const uid = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

/** Vercel signs its cron calls with this. Anything else is turned away. */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = dayKey(now);
  const weekend = isoWeekday(now) > 5;

  let ws = await loadWorkspace();

  // --- 1. today's standing duties ----------------------------------------
  const duties = weekend ? 0 : await materialiseRecurring(ws, today);
  if (duties > 0) ws = await loadWorkspace();

  // --- 2. clients sitting on their documents -----------------------------
  const chased: string[] = [];
  if (!weekend) {
    for (const project of ws.projects) {
      if (!needsChasing(project, now)) continue;

      const missing = outstandingDocuments(project).length;
      const updated: Project = {
        ...project,
        docsRemindedAt: now.toISOString(),
        docChases: project.docChases + 1,
      };

      const consultant = ws.users.find((u) => u.id === project.ownerId);
      const { sent, error } = await sendChaseEmail(updated, consultant?.email);
      // Only count a chase that actually left the building.
      if (!sent) {
        console.error(`chase to ${project.client} failed: ${error}`);
        continue;
      }

      await saveProject(updated);
      await saveAudit([
        entry(
          uid("ae"),
          "system",
          "docs.reminded",
          project.client,
          `Chase ${updated.docChases} sent automatically to ${project.clientContact.name} for ${missing} outstanding item${missing === 1 ? "" : "s"}`,
        ),
      ]);
      chased.push(project.client);
    }
    if (chased.length > 0) ws = await loadWorkspace();
  }

  // --- 3. clients sitting on an invoice ----------------------------------
  const invoiced: string[] = [];
  if (!weekend) {
    for (const project of ws.projects) {
      if (!needsBalanceChasing(project, now)) continue;

      const consultant = ws.users.find((u) => u.id === project.ownerId);
      const { sent, error } = await sendBalanceChaseEmail(
        project,
        today,
        consultant?.email,
      );
      if (!sent) {
        console.error(`balance chase to ${project.client} failed: ${error}`);
        continue;
      }

      const updated: Project = {
        ...project,
        balanceRemindedAt: now.toISOString(),
      };
      await saveProject(updated);
      await saveAudit([
        entry(
          uid("ae"),
          "system",
          "balance.invoiced",
          project.client,
          `Reminder sent automatically to ${project.clientContact.name} for ${phaseBalance(project).toLocaleString("en-ZA")} ZAR still outstanding`,
        ),
      ]);
      invoiced.push(project.client);
    }
    if (invoiced.length > 0) ws = await loadWorkspace();
  }

  // --- 4. one email each, for whatever needs them ------------------------
  const digests: string[] = [];
  const digestFailures: string[] = [];
  const flags: Flag[] = [
    ...ws.assignments.flatMap((a) => assignmentFlags(a, now)),
    // An inquiry nobody answered outranks everything else in here.
    ...ws.leads.flatMap((l) => leadFlags(l, now)),
    ...ws.projects.flatMap((p) => projectFlags(p, now, ws.users)),
  ].sort(byPriority);

  for (const person of ws.users.filter(
    (u) => isActiveEmployee(u) || u.role === "admin",
  )) {
    const mine = flags.filter((f) => f.ownerId === person.id);
    if (mine.length === 0) continue;

    const { sent, error } = await sendDailyDigestEmail(
      person,
      mine.slice(0, 12).map((f) => ({
        title: f.title,
        detail: f.detail,
        href: f.href,
      })),
      today,
    );
    if (sent) digests.push(person.name);
    else digestFailures.push(`${person.name}: ${error ?? "not sent"}`);
  }

  return NextResponse.json({
    ran: now.toISOString(),
    weekend,
    dutiesRaised: duties,
    clientsChased: chased,
    balancesChased: invoiced,
    digestsSent: digests,
    digestsFailed: digestFailures,
  });
}

/**
 * The same rule the flag uses: the clock runs from the invoice and restarts
 * every time we remind, so a client hears about an unpaid balance weekly
 * until it is settled.
 */
function needsBalanceChasing(p: Project, now: Date): boolean {
  if (p.status === "complete") return false;
  if (!p.invoicedAt || phaseBalance(p) === 0) return false;
  const since = p.balanceRemindedAt ?? p.invoicedAt;
  return daysSince(since, now) >= BALANCE_CHASE_DAYS;
}

/**
 * The same rule the flag uses: the clock runs from the request and restarts
 * every time we chase, so a client hears from us every few days until the
 * last item is in and then never again.
 */
function needsChasing(p: Project, now: Date): boolean {
  if (p.status !== "active") return false;
  if (!p.docsRequestedAt || allDocumentsIn(p)) return false;
  const since = p.docsRemindedAt ?? p.docsRequestedAt;
  return daysSince(since, now) >= DOC_CHASE_DAYS;
}
