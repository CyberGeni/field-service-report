import { FieldDayOverride, FieldServiceDay, Settings } from '../types';
import { getDateString, isPriorityFieldDay } from './dateUtils';

/** What a date holds as far as going out is concerned, one-off changes included. */
export interface FieldDayOn {
  type: 'h2h' | 'cart';
  potentialHours: number;
  isPriority: boolean;
  // 'weekly': one of the usual days; 'override': set for this date alone
  source: 'weekly' | 'override';
  note?: string;
}

const weekdayOf = (date: string): number => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
};

/** The usual weekly field day that falls on `date`, ignoring one-off changes. */
export const getUsualFieldDay = (settings: Settings, date: string): FieldServiceDay | null =>
  settings.fieldServiceDays.find(fieldDay => fieldDay.day === weekdayOf(date)) ?? null;

export const getDayOverride = (settings: Settings, date: string): FieldDayOverride | null =>
  settings.dayOverrides?.find(override => override.date === date) ?? null;

/**
 * Whether the user goes out on `date` (YYYY-MM-DD), and for how long - or null when
 * they do not. A one-off change for the date wins over the usual week.
 */
export const getFieldDayOn = (settings: Settings, date: string): FieldDayOn | null => {
  const override = getDayOverride(settings, date);
  if (override?.kind === 'off') return null;

  const usual = getUsualFieldDay(settings, date);
  if (override?.kind === 'out') {
    return {
      type: override.type,
      potentialHours: override.potentialHours,
      // A date set aside on purpose is one the plan should lean on - most often it is
      // there to make up for a day taken off
      isPriority: true,
      source: 'override',
      note: override.note
    };
  }

  return usual
    ? { type: usual.type, potentialHours: usual.potentialHours, isPriority: isPriorityFieldDay(usual), source: 'weekly' }
    : null;
};

// Changes this far back no longer affect any plan, so they are let go on the next save
// rather than kept in the user's settings forever
const KEEP_PAST_DAYS = 62;

/**
 * The list of one-off changes with `date` set to `override`, or cleared when it is
 * null. A change that matches the usual week exactly is dropped as well - an "out"
 * with the usual hours on a usual day says nothing the week does not already say.
 */
export const withDayOverride = (
  settings: Settings,
  date: string,
  override: FieldDayOverride | null
): FieldDayOverride[] => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - KEEP_PAST_DAYS);
  const oldest = getDateString(cutoff);

  const usual = getUsualFieldDay(settings, date);
  const redundant =
    override?.kind === 'out' &&
    usual !== null &&
    usual.type === override.type &&
    usual.potentialHours === override.potentialHours &&
    !override.note;

  return [
    ...(settings.dayOverrides ?? []).filter(existing => existing.date !== date && existing.date >= oldest),
    ...(override && !redundant ? [override] : [])
  ].sort((a, b) => a.date.localeCompare(b.date));
};
