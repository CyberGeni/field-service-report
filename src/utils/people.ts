import { Student } from '../types';

/**
 * Why someone is on the list of calls for a day.
 *
 * - `promised`: they asked to be called on that very day.
 * - `overdue`: they asked for a day that has gone by, and nobody called since.
 * - `usualDay`: no date was agreed, but this is a day they are usually home.
 */
export type DueReason = 'promised' | 'overdue' | 'usualDay';

export interface DueVisit {
  person: Student;
  reason: DueReason;
  // Already called on today. They stay on the list, ticked off, so the day's list
  // reads as a record of what was done as well as what is left.
  visitedToday: boolean;
}

const weekdayOf = (date: string): number => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
};

/** Why `person` is due on `date` (YYYY-MM-DD), or null when they are not. */
export const getDueReason = (person: Student, date: string): DueReason | null => {
  const next = person.next_visit_date;
  const last = person.last_visit_date;

  if (next) {
    // A date they gave outranks the days they are usually home: someone who said
    // "come back in two weeks" should not turn up on next week's list
    if (next > date) return null;
    if (next === date) return 'promised';

    // The agreed day has passed. Still owed unless a call has been made since - and a
    // call made today keeps them on today's list, ticked off.
    if (!last || last < next || last === date) return 'overdue';
  }

  return person.preferred_days.includes(weekdayOf(date)) ? 'usualDay' : null;
};

const REASON_ORDER: Record<DueReason, number> = { overdue: 0, promised: 1, usualDay: 2 };

/**
 * Everyone to call on during `date`, most pressing first: anyone still to visit ahead
 * of anyone already visited, then overdue before promised before usual days.
 */
export const getVisitsDueOn = (people: Student[], date: string): DueVisit[] =>
  people
    .map(person => {
      const reason = getDueReason(person, date);
      return reason ? { person, reason, visitedToday: person.last_visit_date === date } : null;
    })
    .filter((due): due is DueVisit => due !== null)
    .sort(
      (a, b) =>
        Number(a.visitedToday) - Number(b.visitedToday) ||
        REASON_ORDER[a.reason] - REASON_ORDER[b.reason] ||
        a.person.name.localeCompare(b.person.name)
    );

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Chips run Monday first, the way a working week is read
export const WEEKDAYS_MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const WEEKEND = [0, 6];

/** "Weekdays", "Weekends", "Mon & Wed", "Tue, Thu & Sat" - or null for no days. */
export const formatPreferredDays = (days: number[]): string | null => {
  const set = new Set(days);
  if (set.size === 0) return null;
  if (set.size === 7) return 'Any day';

  const sameAs = (group: number[]) => set.size === group.length && group.every(day => set.has(day));
  if (sameAs(WEEKDAYS)) return 'Weekdays';
  if (sameAs(WEEKEND)) return 'Weekends';

  const names = WEEKDAYS_MONDAY_FIRST.filter(day => set.has(day)).map(day => WEEKDAY_SHORT[day]);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
};

/** A YYYY-MM-DD read as the local calendar day it names (never shifted by timezone). */
export const parseLocalDate = (date: string): Date => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** "Mon 3 Dec" style, for dates close enough that the year goes without saying. */
export const formatShortDate = (date: string): string =>
  parseLocalDate(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** The date `days` after `date`, as YYYY-MM-DD. */
export const addDays = (date: string, days: number): string => {
  const shifted = parseLocalDate(date);
  shifted.setDate(shifted.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
};

/** The next `weekday` strictly after `date` - "next Wednesday" said on a Wednesday is a week on. */
export const nextWeekday = (date: string, weekday: number): string => {
  const gap = (weekday - weekdayOf(date) + 7) % 7 || 7;
  return addDays(date, gap);
};

export type StatusTone = 'overdue' | 'today' | 'plain';

/** "Mon" for a date in the last week, "12 Nov" for anything older. */
const sinceLabel = (date: string, today: string): string => {
  const days = Math.round((parseLocalDate(today).getTime() - parseLocalDate(date).getTime()) / 86400000);
  return days <= 6
    ? WEEKDAY_SHORT[parseLocalDate(date).getDay()]
    : parseLocalDate(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/**
 * The one line that says where someone stands, worded the same on every screen:
 * overdue, due today (and why), the next agreed visit, or the days they are usually
 * home - in that order of importance.
 */
export const getPersonStatus = (person: Student, today: string): { text: string; tone: StatusTone } => {
  const reason = getDueReason(person, today);
  const time = person.preferred_time?.toLowerCase();

  if (reason === 'overdue') return { text: `Overdue since ${sinceLabel(person.next_visit_date!, today)}`, tone: 'overdue' };
  if (reason === 'promised') return { text: 'Due today · asked for today', tone: 'today' };
  if (reason === 'usualDay') return { text: `Due today${time ? ` · usually ${time}` : ''}`, tone: 'today' };
  if (person.next_visit_date && person.next_visit_date > today) {
    return { text: `Next visit ${formatShortDate(person.next_visit_date)}`, tone: 'plain' };
  }

  const days = formatPreferredDays(person.preferred_days);
  if (days) return { text: `Usually ${days}${time ? ` · ${time}` : ''}`, tone: 'plain' };
  if (time) return { text: `Best in the ${time}`, tone: 'plain' };
  return { text: person.status === 'study' ? 'No study day set' : 'No visit planned', tone: 'plain' };
};

/** How long ago a date was, in words: "today", "yesterday", "3 days ago", "2 weeks ago". */
export const timeSince = (date: string | undefined, today: string): string | null => {
  if (!date) return null;
  const days = Math.round((parseLocalDate(today).getTime() - parseLocalDate(date).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return '1 month ago';
  return `${Math.floor(days / 30)} months ago`;
};

/** Text colour for a status line: amber when overdue, blue when due today. */
export const statusToneClass = (tone: StatusTone) =>
  tone === 'overdue' ? 'text-amber-700 font-semibold' : tone === 'today' ? 'text-blue-700 font-semibold' : 'text-gray-600';
