# Taskey

The practice's workflow chart, running itself. A client pays, a project sheet
opens with every date on it already worked out, and from then on the sheet
knows who is holding it up: the client sitting on a lease agreement, the QC
check waiting on the owner, the balance nobody has chased. Nothing here has to
be compiled by a person, because a rule is a pure function of the data and the
clock rather than a report somebody runs.

## Running it

```bash
npm install
npm run db:push        # schema to Postgres
npm run db:seed        # the team and their standing duties
npm run dev            # http://localhost:3000
```

`db:seed` writes the invented practice and expects an empty database: it seeds
people by a fixed id, so running it against a database whose team was added
through the app collides on the email address and stops. `-- --demo` adds
sample leads and sheets on top, and is for a fresh database only.

Sign in with Clerk. A Clerk account is not a seat: somebody has to have been
added to the team first, matched by email address, or you get the "not on the
team yet" screen. `npm run db:state` prints what is actually in the database,
and `npm run cron:local` runs the morning job by hand.

## The chart

The practice's own workflow runs 1 to 10, and the app means the same thing by
a step number as the people in the building do.

**Steps 1 to 4, the sales side.** An inquiry lands on **Leads** with where it
came from and who owns it. Two clocks start: an inquiry with no reply after 4
hours is flagged hard, because that is the actual leak, and a quote with no
movement for 3 days is flagged and re-prioritised. A lead that is won carries
its company, contact and service straight into intake, and the sheet it opens
closes the lead behind it.

**Steps 5 to 10, the project sheet.** Recording the payment builds the whole
thing: six dated steps spread across the service's own submission window, the
document request list for that service, and the first task on whoever holds
the role. Then, in order:

- **5. Acknowledgement.** The client hears what was opened, who is carrying
  it, the date we are working to and what comes next.
- **6. Client particulars.** The request list goes out, and the morning job
  chases every 3 days until the last item is in. Most of the delay on a
  project sits here, which is why nobody has to remember to chase.
- **7. Compilation.** Handing the pack up for QC is what closes it.
- **8. QC.** The owner's signature and nobody else's, enforced on the server.
  Sending it back is normal rather than exceptional, so it is counted, and the
  note travels by email as well as sitting on the sheet.
- **9. Submission.** Gated on QC. Nothing goes out unchecked or twice.
- **10. Balance.** Falls due the day we submit. The invoice goes out, and an
  unpaid one is chased weekly.

Afterwards the sheet still runs: queries from the authority, a monthly
follow-up cadence, the outcome, and the next phase on the bigger applications.

**No step is closed by ticking it.** Every gate is derived from the work
behind it, in both directions, so a QC sent back reopens step 7 by itself and
a task standing for a step refuses to be closed by hand, telling you what
would actually close it.

## What else is in there

**Tasks.** Everything with somebody's name on it, whether the sheet raised it
or management handed it out, plus standing weekly duties materialised day by
day. New work is emailed the moment it appears.

**The morning job.** 05:00 UTC, which is 07:00 in Johannesburg: today's
duties, the document chases, the balance chases, then one email each with
whatever is late or due. Idempotent, so running it twice changes nothing.

**Dashboards.** Management sees the practice, everybody else sees their own
day. The numbers page is management's alone and is measured entirely against
dates the practice set itself.

**The trail.** Append-only. Nothing in the application updates or deletes a
row, because this is the record performance reviews are held against. Emails
are logged sent or failed, and the failures surface on the admin dashboard:
a reminder that silently never went out is worse than no reminder at all.

## Design

Indigo and pink on a periwinkle ground, the whole app on one floating white
sheet. Single light theme by choice: this is a tool people use all day in
bright offices and on site.

Chart colour is picked by the job the data does, not by the brand. Status
series wear the status palette and are always ordered completed to partly to
missed, because amber sitting between green and red is what makes the trio
separable for red/green colour blindness. Amber is below the 3:1 contrast
floor against white, so every use of it carries a text label or a legend entry
and never colour alone.

## Layout

```
src/
  proxy.ts        every route behind a login (Next 16 renamed middleware)
  lib/
    types.ts      the domain model, the single source of truth for shape
    services.ts   the service catalogue, and the sheet a payment builds
    sheet.ts      what a sheet does to itself: gates, tasks, reopening
    rules.ts      every clock, as pure functions of state plus "now"
    actions.ts    every change to the practice's data, server side
    email.ts      the letters that go out on their own
    auth.ts       who is acting, and what they may sign off
    dashboard.ts  the numbers, derived from work that actually happened
  db/             schema and the translation between rows and the model
  components/     AppShell, ProjectSheet, LeadCard, dashboards, ui.tsx
  app/
    leads/        steps 1 to 4
    projects/     steps 5 to 10, one sheet per project
    tasks/        everything with your name on it
    dashboard/    the practice, or your own day
    kpis/         the numbers, management only
    api/cron/     the morning job
```

## Not built yet

- **Documents are checkboxes.** Receipt is tracked; the files themselves live
  in somebody's mailbox. No upload, no storage, nothing attached to the sheet.
- **The catalogue is code.** Fees, submission windows, phase splits and the
  standard document list are constants in `lib/services.ts`, so changing one
  needs a deploy.
- **Inspections are not modelled.** Three services carry one, and it appears
  as prose in an email and the intake hint, with no date and no flag.
- **The daily checklist and escalations** are still on disk and out of the
  app: `app/checklist`, `app/overview`, `app/admin` and `lib/kpi.ts`.
