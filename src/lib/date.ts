import {
  format,
  parseISO,
  differenceInHours,
  differenceInMinutes,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  subYears,
  addDays,
  subDays,
  getISODay,
} from "date-fns";

export const DATE_KEY = "yyyy-MM-dd";

export const dayKey = (d: Date | string) =>
  format(typeof d === "string" ? parseISO(d) : d, DATE_KEY);

export const prettyDate = (d: Date | string) =>
  format(typeof d === "string" ? parseISO(d) : d, "EEEE d MMMM");

export const shortDate = (d: Date | string) =>
  format(typeof d === "string" ? parseISO(d) : d, "d MMM");

export const clockTime = (d: Date | string) =>
  format(typeof d === "string" ? parseISO(d) : d, "HH:mm");

export const hoursSince = (iso: string, now: Date) =>
  differenceInHours(now, parseISO(iso));

export const daysSince = (iso: string, now: Date) =>
  differenceInCalendarDays(now, parseISO(iso));

export const daysUntil = (iso: string, now: Date) =>
  differenceInCalendarDays(parseISO(iso), now);

export const isoWeekday = (d: Date) => getISODay(d);

/** `n` weeks before `d`, for looking back a week at a time. */
export const weeksBefore = (d: Date, n: number) => subDays(d, n * 7);

/** The five working days of the ISO week containing `d`. */
export function workWeek(d: Date): string[] {
  const monday = startOfWeek(d, { weekStartsOn: 1 });
  return Array.from({ length: 5 }, (_, i) => dayKey(addDays(monday, i)));
}

/** Relative phrasing that reads naturally in a flag: "2 days ago", "in 3 days". */
export function relativeDays(iso: string, now: Date): string {
  const d = daysUntil(iso, now);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return d > 0 ? `in ${d} days` : `${Math.abs(d)} days ago`;
}

/** Duration of an "HH:mm"–"HH:mm" block, in minutes. */
export function blockMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

/** The moment a task is actually due: its time, or the end of its day. */
export const dueAt = (dueDate: string, dueTime?: string) =>
  parseISO(`${dueDate}T${dueTime ?? "23:59"}:00`);

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/**
 * How long is left, in the largest unit that still reads usefully: minutes
 * inside the hour, hours inside two days, days beyond that.
 */
export function timeLeft(due: Date, now: Date) {
  const mins = differenceInMinutes(due, now);
  const over = mins < 0;
  const m = Math.abs(mins);
  const size =
    m < 60
      ? plural(m, "minute")
      : m < 2880
        ? plural(Math.round(m / 60), "hour")
        : plural(Math.round(m / 1440), "day");
  return {
    overdue: over,
    /** Under four hours is the point where it needs looking at today. */
    tight: !over && mins <= 240,
    text: over ? `${size} overdue` : `${size} left`,
  };
}

export type PeriodKey = "week" | "month" | "year" | "all";

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  week: "Week",
  month: "Month",
  year: "Year",
  all: "All time",
};

/**
 * The working days of one period, plus a name for it. `back` steps to an
 * earlier one, which is how a period is compared against the one before it.
 *
 * A week deliberately includes the days still to come, so Monday reads "0/5"
 * rather than "0/1". Longer periods stop at today, because expecting logs for
 * next November would make every month look half missed.
 */
export function periodRange(
  period: PeriodKey,
  now: Date,
  back = 0,
  /**
   * The first day any records exist. Without it a year or an all-time window
   * counts working days from before the business was keeping logs, which
   * reads as months of missed submissions rather than no data.
   */
  from?: string,
): { days: string[]; label: string; comparable: boolean } {
  if (period === "week") {
    return {
      days: workWeek(weeksBefore(now, back)),
      label:
        back === 0
          ? "This week"
          : back === 1
            ? "Last week"
            : `${back} weeks ago`,
      comparable: true,
    };
  }

  if (period === "all") {
    // One list, so there is nothing before it to compare against.
    return {
      days: workingDaysBetween(from ? parseISO(from) : subYears(now, 3), now),
      label: "All time",
      comparable: back === 0,
    };
  }

  const anchor =
    period === "month" ? subMonths(now, back) : subYears(now, back);
  const opens = period === "month" ? startOfMonth(anchor) : startOfYear(anchor);
  const floor = from ? parseISO(from) : null;
  const start = floor && floor > opens ? floor : opens;
  const finish = period === "month" ? endOfMonth(anchor) : endOfYear(anchor);
  const end = finish > now ? now : finish;

  return {
    days: end < start ? [] : workingDaysBetween(start, end),
    label:
      back === 0
        ? period === "month"
          ? "This month"
          : "This year"
        : back === 1
          ? period === "month"
            ? "Last month"
            : "Last year"
          : format(start, period === "month" ? "MMM yyyy" : "yyyy"),
    comparable: true,
  };
}

function workingDaysBetween(start: Date, end: Date): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (getISODay(d) <= 5) out.push(dayKey(d));
  }
  return out;
}

/** `n` calendar days after a date key, as a date key. */
export const addCalendarDays = (iso: string, n: number) =>
  dayKey(addDays(parseISO(iso), n));

/**
 * The next working day on or after `iso`. Every target date on a project sheet
 * goes through this, because a deadline nobody is at work for is not a
 * deadline anybody can hit.
 */
export function nextWorkingDay(iso: string): string {
  let d = parseISO(iso);
  while (getISODay(d) > 5) d = addDays(d, 1);
  return dayKey(d);
}

/** The last working day on or before `iso`. */
export function previousWorkingDay(iso: string): string {
  let d = parseISO(iso);
  d = subDays(d, 1);
  while (getISODay(d) > 5) d = subDays(d, 1);
  return dayKey(d);
}

/** Whole months between two dates, for the monthly follow-up clock. */
export const monthsSince = (iso: string, now: Date) =>
  differenceInCalendarMonths(now, parseISO(iso));
