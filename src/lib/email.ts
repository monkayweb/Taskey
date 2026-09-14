// ---------------------------------------------------------------------------
// The emails that go out on their own.
//
// Four of them, each answering something Patricia asked for: ask the client
// for their documents, chase them when they sit on it, tell her when a QC is
// waiting, and send the balance invoice the day we submit.
//
// Every send is written to the `emails` table, sent or failed. That is the
// point: "we asked them three times" has to be provable, and a reminder that
// silently never went out is worse than no reminder at all.
// ---------------------------------------------------------------------------

import { Resend } from "resend";
import { logEmail } from "@/db/queries";
import { shortDate } from "./date";
import { money } from "./rules";
import { outstandingDocuments, phaseBalance, serviceById } from "./services";
import { clientFrom, practice, SYSTEM_NAME, teamFrom } from "./practice";
import type { Assignment, Project, User } from "./types";

const uid = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

// Who a letter is from, and who it comes back to, lives in lib/practice.ts.

/** Where to send somebody who needs to look at the sheet. */
function appUrl(path = ""): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return `${base}${path}`;
}

interface Send {
  kind: string;
  to: string;
  subject: string;
  html: string;
  /** Same key and same content will not send twice inside 24 hours. */
  idempotencyKey: string;
  projectId?: string;
  /**
   * "client" for a letter from the practice, "team" for the system talking to
   * its own people. It decides the name on the envelope.
   */
  voice: "client" | "team";
  /** A real person at the practice. Client mail without one is a dead end. */
  replyTo?: string;
}

/**
 * One way in and out. The SDK reports failures in its result rather than by
 * throwing, so a bad send is recorded and the caller carries on: losing a
 * state change because an email bounced would be the wrong trade.
 */
async function deliver(s: Send): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    await logEmail({
      id: uid("em"),
      kind: s.kind,
      to: s.to,
      subject: s.subject,
      projectId: s.projectId,
      error: "RESEND_API_KEY is not set",
    });
    return { sent: false, error: "RESEND_API_KEY is not set" };
  }

  const resend = new Resend(key);
  const { data, error } = await resend.emails.send(
    {
      from: s.voice === "client" ? clientFrom() : teamFrom(),
      to: [s.to],
      subject: s.subject,
      html: s.html,
      replyTo: s.replyTo,
    },
    { idempotencyKey: s.idempotencyKey.slice(0, 256) },
  );

  await logEmail({
    id: uid("em"),
    kind: s.kind,
    to: s.to,
    subject: s.subject,
    projectId: s.projectId,
    providerId: data?.id,
    error: error?.message,
  });

  return { sent: !error, error: error?.message };
}

// --- the shell every email shares -----------------------------------------

/**
 * The shell every email shares. A client's letter is headed by the practice,
 * because it is their letter; the team's mail is headed by the system, which
 * is who is actually talking.
 */
const layout = (
  body: string,
  voice: "client" | "team",
  footer?: string,
) => `
<div style="margin:0;padding:24px;background:#f4f5fb;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1c2b;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dcdfef;border-radius:4px;padding:28px 32px;">
    <p style="margin:0 0 20px;font-size:15px;font-weight:700;letter-spacing:-0.01em;">
      ${voice === "client" ? escape(practice.name) : SYSTEM_NAME}
    </p>
    ${body}
  </div>
  <p style="max-width:560px;margin:14px auto 0;font-size:11px;line-height:1.5;color:#6d7086;">
    ${
      footer ??
      (voice === "client"
        ? `Sent by ${escape(practice.name)} through ${SYSTEM_NAME}. Reply to this email and it reaches your consultant directly.`
        : `Sent by ${SYSTEM_NAME}. Nobody typed this.`)
    }
  </p>
</div>`;

const p = (text: string) =>
  `<p style="margin:0 0 14px;font-size:14px;line-height:1.55;">${text}</p>`;

const list = (items: string[]) => `
<ul style="margin:0 0 18px;padding-left:20px;font-size:14px;line-height:1.7;">
  ${items.map((i) => `<li>${i}</li>`).join("")}
</ul>`;

const button = (href: string, label: string) => `
<a href="${href}" style="display:inline-block;margin:4px 0 18px;padding:10px 18px;background:#4f57d2;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:999px;">${label}</a>`;

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// --- step 6: asking, then chasing -----------------------------------------

export async function sendDocumentRequestEmail(
  project: Project,
  /** The consultant carrying it, so the documents come back to them. */
  replyTo?: string,
) {
  const service = serviceById(project.serviceId);
  const outstanding = outstandingDocuments(project);

  return deliver({
    kind: "docs_request",
    voice: "client",
    replyTo: replyTo ?? practice.inbox,
    to: project.clientContact.email,
    projectId: project.id,
    idempotencyKey: `docs-request/${project.id}`,
    subject: `${service.name}: the documents we need from you`,
    html: layout(
      p(`Good day ${escape(project.clientContact.name)},`) +
        p(
          `Thank you for your payment. We have opened your ${escape(service.name.toLowerCase())} and are aiming to submit to ${escape(service.authority)} by <strong>${shortDate(project.dueDate)}</strong>.`,
        ) +
        p("To keep to that date, we need the following from you:") +
        list(outstanding.map((d) => escape(d.label))) +
        p(
          "Reply to this email with the documents attached. Anything you cannot find, tell us and we will work around it.",
        ) +
        p(`Kind regards,<br>${escape(practice.name)}`),
      "client",
    ),
  });
}

export async function sendChaseEmail(project: Project, replyTo?: string) {
  const service = serviceById(project.serviceId);
  const outstanding = outstandingDocuments(project);
  const chase = project.docChases;

  return deliver({
    kind: "docs_chase",
    voice: "client",
    replyTo: replyTo ?? practice.inbox,
    to: project.clientContact.email,
    projectId: project.id,
    // The chase number is in the key, so each chase is its own email.
    idempotencyKey: `docs-chase/${project.id}-${chase}`,
    subject: `Still outstanding: ${outstanding.length} document${outstanding.length === 1 ? "" : "s"} for your ${service.short}`,
    html: layout(
      p(`Good day ${escape(project.clientContact.name)},`) +
        p(
          `We are still waiting on ${outstanding.length} item${outstanding.length === 1 ? "" : "s"} before we can compile your application:`,
        ) +
        list(outstanding.map((d) => escape(d.label))) +
        p(
          `Our submission date is <strong>${shortDate(project.dueDate)}</strong>. We can only hold that if these reach us in the next day or two, so please send whatever you have, even if it is not the whole list.`,
        ) +
        p(`Kind regards,<br>${escape(practice.name)}`),
      "client",
    ),
  });
}

// --- step 5: telling the client we have started ---------------------------

/**
 * The acknowledgement. Step 5 of the chart is "project checklist and info
 * sheet", and this is the client's half of it: what we have opened, who is
 * carrying it, the date we are working to, and what we will need from them.
 *
 * It goes out before the document request, because a client who has just paid
 * should hear from a person's practice before they hear a demand for paperwork.
 */
export async function sendWelcomeEmail(
  project: Project,
  /** The consultant carrying it, named so the client knows who has their file. */
  consultant?: User,
) {
  const service = serviceById(project.serviceId);

  return deliver({
    kind: "project_opened",
    voice: "client",
    replyTo: consultant?.email ?? practice.inbox,
    to: project.clientContact.email,
    projectId: project.id,
    idempotencyKey: `project-opened/${project.id}-${project.phase}`,
    subject: `${service.name}: we have your payment and have started`,
    html: layout(
      p(`Good day ${escape(project.clientContact.name)},`) +
        p(
          `Thank you for your payment. We have opened your ${escape(service.name.toLowerCase())} with ${escape(service.authority)}${consultant ? `, and ${escape(consultant.name)} is the consultant carrying it` : ""}.`,
        ) +
        p("So that you know what to expect:") +
        list([
          `We will submit to ${escape(service.authority)} by <strong>${shortDate(project.dueDate)}</strong>. That date is fixed from the day your payment landed, which is why we chase paperwork as hard as we do.`,
          "The next email from us is the list of documents we need from you. Nothing can be compiled until that list is complete.",
          `Once it is submitted, ${escape(service.authority)} take around ${service.processingDays} days${service.inspection ? ", and will arrange a premises inspection before issuing" : ""}. We follow up with them monthly and tell you the moment there is an outcome.`,
        ]) +
        p(
          "Reply to this email at any point. It reaches your consultant directly rather than a general mailbox.",
        ) +
        p(`Kind regards,<br>${escape(practice.name)}`),
      "client",
    ),
  });
}

// --- step 8: the QC waiting on the owner ----------------------------------

export async function sendQcWaitingEmail(project: Project, owner: User) {
  const service = serviceById(project.serviceId);

  return deliver({
    kind: "qc_waiting",
    voice: "team",
    to: owner.email,
    projectId: project.id,
    idempotencyKey: `qc-waiting/${project.id}-${project.qcReturns}`,
    subject: `QC to check: ${project.client} (${service.short})`,
    html: layout(
      p(`${escape(project.client)} is ready for your QC check.`) +
        p(
          `${escape(service.name)} to ${escape(service.authority)}. Submission is due <strong>${shortDate(project.dueDate)}</strong>, and nothing can be submitted until you have signed it off.`,
        ) +
        (project.qcReturns > 0
          ? p(
              `This is attempt ${project.qcReturns + 1}. It was last sent back for: ${escape(project.qcReturnNote ?? "corrections")}.`,
            )
          : "") +
        button(appUrl(`/projects/${project.id}`), "Open the project sheet") +
        p("You can approve it there, or send it back with what needs fixing."),
      "team",
      "Sent by Taskey because a QC check is waiting on you.",
    ),
  });
}

// --- step 10: the balance --------------------------------------------------

export async function sendBalanceEmail(project: Project, replyTo?: string) {
  const service = serviceById(project.serviceId);
  const balance = phaseBalance(project);

  return deliver({
    kind: "balance_invoice",
    voice: "client",
    replyTo: replyTo ?? practice.inbox,
    to: project.clientContact.email,
    projectId: project.id,
    idempotencyKey: `balance-invoice/${project.id}-${project.phase}`,
    subject: `${service.name}: submitted, and your balance of ${money(balance)}`,
    html: layout(
      p(`Good day ${escape(project.clientContact.name)},`) +
        p(
          `Your ${escape(service.name.toLowerCase())} was submitted to ${escape(service.authority)} today${project.submittedVia ? ` via ${escape(project.submittedVia)}` : ""}. We will follow up with them monthly and let you know the moment there is an outcome.`,
        ) +
        p(
          `As set out in your quote, the balance of <strong>${money(balance)}</strong> falls due on submission. Our invoice follows from our accounts department.`,
        ) +
        p(
          `${escape(service.authority)} usually takes around ${service.processingDays} days on an application of this kind${service.inspection ? ", and will arrange a premises inspection before issuing" : ""}.`,
        ) +
        p(`Kind regards,<br>${escape(practice.name)}`),
      "client",
    ),
  });
}

/** The invoiced balance, chased the way the documents are chased. */
export async function sendBalanceChaseEmail(
  project: Project,
  /** The day this chase goes out, so each one is its own email. */
  today: string,
  replyTo?: string,
) {
  const service = serviceById(project.serviceId);
  const balance = phaseBalance(project);

  return deliver({
    kind: "balance_chase",
    voice: "client",
    replyTo: replyTo ?? practice.inbox,
    to: project.clientContact.email,
    projectId: project.id,
    idempotencyKey: `balance-chase/${project.id}-${today}`,
    subject: `Reminder: ${money(balance)} outstanding on your ${service.short}`,
    html: layout(
      p(`Good day ${escape(project.clientContact.name)},`) +
        p(
          `Your ${escape(service.name.toLowerCase())} was submitted to ${escape(service.authority)} on ${shortDate(project.submittedAt?.slice(0, 10) ?? project.dueDate)}, and the balance of <strong>${money(balance)}</strong> fell due on submission.`,
        ) +
        p(
          "If it has already gone off, thank you, and please ignore this. If not, a proof of payment by reply is all we need.",
        ) +
        p(`Kind regards,<br>${escape(practice.name)}`),
      "client",
    ),
  });
}

// --- step 9 and after: what the client hears without asking ---------------

/**
 * Submission confirmed, where there is no balance to invoice. A client who
 * paid in full still has to be told their application went in: the balance
 * email carries that news for everybody else, and without this they would
 * simply never hear it.
 */
export async function sendSubmittedEmail(project: Project, replyTo?: string) {
  const service = serviceById(project.serviceId);

  return deliver({
    kind: "submitted",
    voice: "client",
    replyTo: replyTo ?? practice.inbox,
    to: project.clientContact.email,
    projectId: project.id,
    idempotencyKey: `submitted/${project.id}-${project.phase}`,
    subject: `${service.name}: submitted to ${service.authority}`,
    html: layout(
      p(`Good day ${escape(project.clientContact.name)},`) +
        p(
          `Your ${escape(service.name.toLowerCase())} was submitted to ${escape(service.authority)} today${project.submittedVia ? ` via ${escape(project.submittedVia)}` : ""}, inside the window we quoted you.`,
        ) +
        p(
          `They usually take around ${service.processingDays} days on an application of this kind${service.inspection ? ", and will arrange a premises inspection before issuing" : ""}. We follow up with them monthly and will let you know the moment there is an outcome, including anything they come back to us for.`,
        ) +
        p("Your account is settled in full. Thank you.") +
        p(`Kind regards,<br>${escape(practice.name)}`),
      "client",
    ),
  });
}

/** A payment, receipted the moment it is recorded rather than at month end. */
export async function sendReceiptEmail(
  project: Project,
  payment: { id: string; amount: number },
  replyTo?: string,
) {
  const service = serviceById(project.serviceId);
  const left = phaseBalance(project);

  return deliver({
    kind: "payment_receipt",
    voice: "client",
    replyTo: replyTo ?? practice.inbox,
    to: project.clientContact.email,
    projectId: project.id,
    idempotencyKey: `payment-receipt/${payment.id}`,
    subject: `Received with thanks: ${money(payment.amount)} for your ${service.short}`,
    html: layout(
      p(`Good day ${escape(project.clientContact.name)},`) +
        p(
          `We have received <strong>${money(payment.amount)}</strong> against your ${escape(service.name.toLowerCase())}.`,
        ) +
        p(
          left > 0
            ? `That leaves <strong>${money(left)}</strong> outstanding on the current phase.`
            : "Your account is settled in full. Thank you.",
        ) +
        p(`Kind regards,<br>${escape(practice.name)}`),
      "client",
    ),
  });
}

/** The outcome, the day it lands, from the practice rather than on request. */
export async function sendOutcomeEmail(
  project: Project,
  outcome: "approved" | "declined",
  replyTo?: string,
) {
  const service = serviceById(project.serviceId);

  return deliver({
    kind: "outcome",
    voice: "client",
    replyTo: replyTo ?? practice.inbox,
    to: project.clientContact.email,
    projectId: project.id,
    idempotencyKey: `outcome/${project.id}-${project.phase}-${outcome}`,
    subject:
      outcome === "approved"
        ? `Approved: your ${service.short}`
        : `Outcome on your ${service.short}`,
    html: layout(
      p(`Good day ${escape(project.clientContact.name)},`) +
        (outcome === "approved"
          ? p(
              `${escape(service.authority)} have approved your ${escape(service.name.toLowerCase())}. We will forward the paperwork as soon as it reaches us.`,
            )
          : p(
              `${escape(service.authority)} have declined your ${escape(service.name.toLowerCase())}. Your consultant will call you to go through their reasons and what our options are from here.`,
            )) +
        p(
          "Thank you for trusting us with it, and do reply here if you would like to talk it through.",
        ) +
        p(`Kind regards,<br>${escape(practice.name)}`),
      "client",
    ),
  });
}

// --- work landing on somebody --------------------------------------------

/**
 * "You have been given this." Sent the moment a task is created, with
 * everything needed to act on it, so nobody has to be told twice or find out
 * at the morning digest.
 */
export async function sendTaskAssignedEmail(
  person: User,
  task: Assignment,
  assigner?: User,
  project?: Project,
) {
  const due = `${shortDate(task.dueDate)}${task.dueTime ? ` at ${task.dueTime}` : ""}`;
  const urgent = task.priority === "urgent";

  return deliver({
    kind: "task_assigned",
    voice: "team",
    to: person.email,
    projectId: task.projectId,
    // One email per task, however many times this is retried.
    idempotencyKey: `task-assigned/${task.id}-${person.id}`,
    subject: `${urgent ? "Urgent: " : ""}${task.title}`,
    html: layout(
      p(`Good day ${escape(person.name.split(" ")[0])},`) +
        p(
          assigner && assigner.id !== person.id
            ? `${escape(assigner.name)} has put this on your list.`
            : "This has been added to your list.",
        ) +
        `<div style="margin:0 0 18px;padding:14px 16px;background:#f4f5fb;border-left:3px solid ${urgent ? "#b3261e" : "#4f57d2"};">
          <p style="margin:0 0 6px;font-size:15px;font-weight:700;line-height:1.35;">${escape(task.title)}</p>
          ${task.detail ? `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#494c63;">${escape(task.detail)}</p>` : ""}
          <p style="margin:0;font-size:12px;color:#494c63;">
            Due <strong>${due}</strong>${urgent ? " &middot; <strong style=\'color:#b3261e\'>marked urgent</strong>" : ""}
            ${project ? `<br>${escape(serviceById(project.serviceId).short)} for ${escape(project.client)}` : ""}
          </p>
        </div>` +
        (project
          ? p(
              `The project sheet has everything else on it: what has been done, what is outstanding, and who has it next.`,
            )
          : "") +
        button(
          appUrl(project ? `/projects/${project.id}` : "/tasks"),
          project ? "Open the project sheet" : "Open your list",
        ),
      "team",
      "Sent by Taskey when work lands on your list. Nobody typed this.",
    ),
  });
}

/**
 * A nudge, not a new assignment. Somebody has looked at this task, seen it is
 * still open, and pressed the button: the email should say that plainly.
 */
export async function sendTaskReminderEmail(
  person: User,
  task: Assignment,
  chaser?: User,
  project?: Project,
) {
  const overdue = task.dueDate < new Date().toISOString().slice(0, 10);
  const chases = task.remindedAt ? "again" : "";

  return deliver({
    kind: "task_reminder",
    voice: "team",
    to: person.email,
    projectId: task.projectId,
    // A second nudge is a second email, so the timestamp is in the key.
    idempotencyKey: `task-reminder/${task.id}-${person.id}-${Date.now()}`,
    subject: `${overdue ? "Overdue" : "Still open"}: ${task.title}`,
    html: layout(
      p(`Good day ${escape(person.name.split(" ")[0])},`) +
        p(
          `${chaser ? escape(chaser.name) : "Management"} is asking about this ${chases}.`,
        ) +
        `<div style="margin:0 0 18px;padding:14px 16px;background:#f4f5fb;border-left:3px solid ${overdue ? "#b3261e" : "#4f57d2"};">
          <p style="margin:0 0 6px;font-size:15px;font-weight:700;line-height:1.35;">${escape(task.title)}</p>
          ${task.detail ? `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#494c63;">${escape(task.detail)}</p>` : ""}
          <p style="margin:0;font-size:12px;color:#494c63;">
            Due <strong>${shortDate(task.dueDate)}</strong>${task.dueTime ? ` at ${task.dueTime}` : ""}
            ${overdue ? " &middot; <strong style='color:#b3261e'>past its date</strong>" : ""}
            ${project ? `<br>${escape(serviceById(project.serviceId).short)} for ${escape(project.client)}` : ""}
          </p>
        </div>` +
        p("If it is done, close it off. If it is stuck, say what on.") +
        button(
          appUrl(project ? `/projects/${project.id}` : "/tasks"),
          project ? "Open the project sheet" : "Open your list",
        ),
      "team",
      "Sent by Taskey because somebody chased this task.",
    ),
  });
}

/**
 * Step 8 sending a pack back. The note travels with it, because "it came
 * back" without saying why is worse than not being told.
 */
export async function sendQcReturnedEmail(
  consultant: User,
  project: Project,
  note: string,
  owner?: User,
) {
  const service = serviceById(project.serviceId);

  return deliver({
    kind: "qc_returned",
    voice: "team",
    to: consultant.email,
    projectId: project.id,
    idempotencyKey: `qc-returned/${project.id}-${project.qcReturns}`,
    subject: `Sent back: ${project.client} (${service.short})`,
    html: layout(
      p(`Good day ${escape(consultant.name.split(" ")[0])},`) +
        p(
          `${owner ? escape(owner.name) : "The owner"} has sent the ${escape(service.short)} for ${escape(project.client)} back for correction.`,
        ) +
        `<div style="margin:0 0 18px;padding:14px 16px;background:#fbf1de;border-left:3px solid #8a5a00;">
          <p style="margin:0;font-size:13px;line-height:1.55;">${escape(note)}</p>
        </div>` +
        p(
          `Submission is due <strong>${shortDate(project.dueDate)}</strong>, so this is back on step 7 until it is corrected and handed up again.`,
        ) +
        button(appUrl(`/projects/${project.id}`), "Open the project sheet"),
      "team",
      "Sent by Taskey because a QC check came back.",
    ),
  });
}

// --- the morning summary --------------------------------------------------

/**
 * One email a person, listing what is late or due today on their own list.
 * This is what replaces somebody being reminded by hand.
 */
export async function sendDailyDigestEmail(
  person: User,
  lines: { title: string; detail: string; href: string }[],
  date: string,
) {
  if (lines.length === 0) return { sent: false };

  return deliver({
    kind: "task_digest",
    voice: "team",
    to: person.email,
    idempotencyKey: `task-digest/${person.id}-${date}`,
    subject:
      lines.length === 1
        ? `1 thing needs you today`
        : `${lines.length} things need you today`,
    html: layout(
      p(`Good morning ${escape(person.name.split(" ")[0])},`) +
        p("This is what is late or due today on your list:") +
        list(
          lines.map(
            (l) =>
              `<strong>${escape(l.title)}</strong><br><span style="color:#565a73;font-size:13px;">${escape(l.detail)}</span>`,
          ),
        ) +
        button(appUrl("/dashboard"), "Open Taskey"),
      "team",
      "Sent by Taskey each working morning. Nothing here was typed by a person.",
    ),
  });
}
