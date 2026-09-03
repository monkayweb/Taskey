# Taskey

Daily accountability for a small team. Employees tick off their calendar-synced
time blocks at the end of a shift; everything management needs — what was
finished, what slipped and why, which quotes are going cold, who is drowning —
falls out of that one submission instead of being chased for.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
```

The sidebar has a **Viewing as** switcher. Start as **Thandi Mokoena** (sales) to
see the employee side, then switch to **Tristan Storm** (owner) for the admin
dashboard and audit trail. **Reset demo** on the admin dashboard restores the
seeded data.

## What's built

**1. Calendar-synced daily checklist.** Each person's recurring calendar blocks
(`lib/seed.ts` → `TEMPLATES`) are instantiated into a day's checklist on first
visit. Every block is marked Done / Partly / Missed; anything not done *must*
carry a reason before the day can be submitted. Submitting locks the log —
`lockedAt` makes it permanently read-only — and writes a per-block breakdown to
the audit trail.

**2. Automated lead and quote tracking.** Sending a quote starts a 3-day clock.
A quote with no movement inside that window is flagged and jumps to the top of
the owner's priority list; an inbound inquiry with no reply after 4 hours is
flagged harder still, because that's the actual leak. The "Required today" panel
on the daily dashboard is generated from these rules — nobody compiles it.

**3. Escalation and workload flags.** The "I'm overwhelmed" button in the
sidebar forces the employee to pick *which* items are falling behind, then lands
on the admin dashboard immediately. Acknowledging is separate from resolving, so
the employee can see they've been heard before the problem is fixed. Active
projects stay pinned to the daily dashboard with milestone state.

**4. Admin dashboard and KPI tracking.** Today's submissions with reasons given,
the live escalation queue, every flag across the team ordered by cost of
ignoring it, and a weekly KPI table derived entirely from the submissions
(40% blocks completed, 30% logs submitted, 30% quotes followed up in time). The
audit trail is append-only and exports to CSV.

## Layout

```
src/
  lib/
    types.ts      domain model — the single source of truth for shape
    rules.ts      the 3-day clock, idle-inquiry safeguard, priority scoring
    kpi.ts        weekly rollup derived from submissions
    store.ts      zustand store + localStorage; audit log is append-only
    selectors.ts  derived state (flags, KPIs) memoised per render
    seed.ts       demo data, built relative to now so the clocks are live
    now.tsx       one shared clock for the whole tree
    date.ts       date helpers
    labels.ts     display labels and tones
  components/     AppShell, DailyChecklist, LeadCard, EscalationQueue, ui.tsx
  app/
    today/        employee daily dashboard
    leads/        pipeline with the follow-up engine
    projects/     projects and milestones
    admin/        management dashboard
    admin/audit/  immutable audit trail
```

Every rule is a pure function of state plus "now", so a flag exists the moment
the clock says it should — there is no cron job to fall behind.

## Current limits

State lives in `localStorage` behind the `lib/store.ts` interface, which is why
the whole app is client-rendered. Nothing else in the codebase touches
persistence, so the next step is a real Postgres schema mirroring `lib/types.ts`
plus auth, at which point the pages become server components and the role
switcher becomes a session. Calendar blocks are seeded rather than pulled from a
live Google Calendar; `TimeBlockTemplate.calendar` is the field that mapping
hangs off.
