import {
  format,
  parseISO,
  differenceInHours,
  differenceInCalendarDays,
  startOfWeek,
  addDays,
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
