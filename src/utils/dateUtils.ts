import { FieldServiceDay } from '../types';

export const formatTime = (hours: number, minutes: number): string => {
  const h = Math.floor(hours);
  const m = Math.floor(minutes);
  return `${h}:${m.toString().padStart(2, '0')}`;
};

export const formatTimeFromMinutes = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return formatTime(hours, minutes);
};

/**
 * Split a duration into whole hours and minutes.
 *
 * Rounds the total to the nearest minute before splitting, so a value just shy of a
 * whole hour (1.999) reads as "2h 00min" rather than the impossible "1h 60min".
 */
const splitHoursMinutes = (totalHours: number): { hours: number; minutes: number } => {
  const totalMinutes = Math.round(totalHours * 60);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
};

export const formatHoursMinutes = (totalHours: number): string => {
  const { hours, minutes } = splitHoursMinutes(totalHours);
  return `${hours}h ${minutes.toString().padStart(2, '0')}min`;
};

export const formatHoursMinutesShort = (totalHours: number): string => {
  const { hours, minutes } = splitHoursMinutes(totalHours);
  if (hours === 0) {
    return `${minutes}min`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}min`;
};

/** "38h 30m" - for big figures and small tiles, where "min" would push it onto a second line. */
export const formatHoursMinutesTight = (totalHours: number): string => {
  const { hours, minutes } = splitHoursMinutes(totalHours);
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
};

export const getTotalMinutes = (hours: number, minutes: number): number => {
  return hours * 60 + minutes;
};

export const getTimerDisplay = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const isFieldServiceDay = (date: Date, fieldServiceDays: FieldServiceDay[]): boolean => {
  return fieldServiceDays.some(fsd => fsd.day === date.getDay());
};

/**
 * Whether a field day is one to fill before the others.
 *
 * A day saved before priority existed carries no flag, so the type stands in for
 * one: house to house is the work being planned around, cart is the fallback.
 */
export const isPriorityFieldDay = (fieldServiceDay: FieldServiceDay): boolean =>
  fieldServiceDay.isPriority ?? fieldServiceDay.type === 'h2h';

/**
 * A calendar date as YYYY-MM-DD, read in the user's own timezone.
 *
 * Built from the local parts rather than via toISOString: west of UTC an evening in
 * the field would otherwise be filed under tomorrow, and a credit logged late on the
 * last of the month would count toward the next one.
 */
export const getDateString = (date: Date): string => {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
};

// JW service years always start in September - this isn't a per-user preference.
export const SERVICE_YEAR_START_MONTH = 9;

/** The YYYY-09 the service year in progress right now began in. */
export const getCurrentServiceYearStart = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  // getMonth() is 0-indexed, so 8 = September
  return `${now.getMonth() >= 8 ? year : year - 1}-09`;
};

/**
 * The service year in progress, as YYYY-MM-DD bounds (start inclusive, end exclusive).
 *
 * Records are compared against these as strings, never as Dates: `new Date('2026-09-01')`
 * is UTC midnight, which west of UTC is still 31 August locally and east of UTC puts
 * the last day of the year past a local-midnight end bound - so a Date comparison
 * quietly drops a day (or, through getMonth() on the shifted start, a whole month)
 * depending on where the user lives.
 */
export const getCurrentServiceYearBounds = (): {
  startYear: number;
  startMonth: number; // 1-indexed
  start: string;
  endExclusive: string;
} => {
  const [startYear, startMonth] = getCurrentServiceYearStart().split('-').map(Number);
  const monthPad = String(startMonth).padStart(2, '0');
  return {
    startYear,
    startMonth,
    start: `${startYear}-${monthPad}-01`,
    endExclusive: `${startYear + 1}-${monthPad}-01`
  };
};

/** Whether a YYYY-MM-DD (or YYYY-MM) date falls in the service year in progress. */
export const isInCurrentServiceYear = (date: string): boolean => {
  const { start, endExclusive } = getCurrentServiceYearBounds();
  return date >= start.slice(0, date.length) && date < endExclusive.slice(0, date.length);
};

export const getMonthName = (monthString: string): string => {
  const [year, month] = monthString.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

export const getFirstDayOfMonth = (year: number, month: number): number => {
  return new Date(year, month - 1, 1).getDay();
};
// --- Month-key helpers (YYYY-MM) used by the stats and monthly report views ---

export const getMonthKey = (date: Date): string => {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
};

export const parseMonthKey = (monthKey: string): { year: number; month: number } => {
  const [year, month] = monthKey.split('-').map(Number);
  return { year, month };
};

export const addMonths = (monthKey: string, months: number): string => {
  const { year, month } = parseMonthKey(monthKey);
  return getMonthKey(new Date(year, month - 1 + months, 1));
};

// "Sep '25" - compact enough for a chart axis on a phone
export const getShortMonthLabel = (monthKey: string): string => {
  const { year, month } = parseMonthKey(monthKey);
  const date = new Date(year, month - 1);
  return `${date.toLocaleDateString('en-US', { month: 'short' })} '${date
    .getFullYear()
    .toString()
    .slice(-2)}`;
};

// First and last calendar day of a month, as YYYY-MM-DD (safe for date column filters)
export const getMonthBounds = (monthKey: string): { start: string; end: string } => {
  const { year, month } = parseMonthKey(monthKey);
  const lastDay = getDaysInMonth(year, month);
  return {
    start: `${monthKey}-01`,
    end: `${monthKey}-${lastDay.toString().padStart(2, '0')}`
  };
};

// Days that have actually happened in a month - the current month counts only up to
// today so its daily average isn't diluted by days not yet lived.
export const getDaysElapsedInMonth = (monthKey: string): number => {
  const { year, month } = parseMonthKey(monthKey);
  const daysInMonth = getDaysInMonth(year, month);
  const now = new Date();

  if (now.getFullYear() === year && now.getMonth() + 1 === month) {
    return Math.min(now.getDate(), daysInMonth);
  }

  // Months entirely in the future have no elapsed days yet
  if (new Date(year, month - 1, 1) > now) {
    return 0;
  }

  return daysInMonth;
};

// Inclusive list of month keys from start to end, e.g. 2025-07 .. 2025-09
export const listMonthKeys = (startMonth: string, endMonth: string): string[] => {
  const months: string[] = [];
  let current = startMonth;

  while (current <= endMonth) {
    months.push(current);
    current = addMonths(current, 1);
  }

  return months;
};
