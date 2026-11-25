import { useMemo } from 'react';
import { ServiceRecord } from '../types';
import { calculateMonthlyTotals, getDataMonthBounds, VisitSummary } from '../utils/calculations';
import {
  addMonths,
  getMonthKey,
  getShortMonthLabel,
  listMonthKeys,
  parseMonthKey,
  SERVICE_YEAR_START_MONTH
} from '../utils/dateUtils';

export type StatsPeriod = 'lastQuarter' | 'calendarYear' | 'serviceYear' | 'allTime';

export interface MonthlyStatPoint {
  month: string; // YYYY-MM
  label: string; // "Sep '25"
  hours: number; // credits included, since they count toward the month
  preachingHours: number;
  volunteerHours: number;
  schoolHours: number;
  creditHours: number;
  studies: number;
  dailyAverage: number;
  weeklyAverage: number;
}

// Whole calendar months are the unit here, so a "quarter" is the current month plus
// the two before it rather than a rolling 90 days that would cut a month in half.
const QUARTER_MONTH_SPAN = 3;

/** The two periods that chart a named year, and so need a year to be picked. */
export const isYearScopedPeriod = (period: StatsPeriod): boolean =>
  period === 'calendarYear' || period === 'serviceYear';

export interface StatsYearOption {
  value: number; // the year the period starts in
  label: string; // "2026" or "2025-2026"
}

/**
 * Which year a month belongs to for the given period: the calendar year, or - for a
 * service year - the year its September falls in, so January 2026 belongs to the
 * 2025 service year.
 */
const getPeriodYear = (monthKey: string, period: StatsPeriod): number => {
  const { year, month } = parseMonthKey(monthKey);
  if (period === 'serviceYear' && month < SERVICE_YEAR_START_MONTH) return year - 1;
  return year;
};

interface PeriodRange {
  startMonth: string | null; // null = no lower bound (all time)
  endMonth: string;
}

const getPeriodRange = (period: StatsPeriod, year: number): PeriodRange => {
  const currentMonth = getMonthKey(new Date());
  // A twelve-month window ends where it ends, but there is no point charting months
  // that haven't happened yet, so the current month caps every bounded period.
  const twelveMonthsFrom = (startMonth: string): PeriodRange => ({
    startMonth,
    endMonth: [addMonths(startMonth, 11), currentMonth].sort()[0]
  });

  switch (period) {
    case 'lastQuarter':
      return {
        startMonth: addMonths(currentMonth, -(QUARTER_MONTH_SPAN - 1)),
        endMonth: currentMonth
      };
    case 'calendarYear':
      return twelveMonthsFrom(`${year}-01`);
    case 'serviceYear':
      return twelveMonthsFrom(`${year}-09`);
    case 'allTime':
    default:
      return { startMonth: null, endMonth: currentMonth };
  }
};

/**
 * The years a user can chart, newest first: every year their data touches, up to the
 * one in progress. Empty for periods that aren't scoped to a named year.
 */
export const getStatsYearOptions = (
  records: ServiceRecord[],
  visits: VisitSummary[],
  period: StatsPeriod
): StatsYearOption[] => {
  if (!isYearScopedPeriod(period)) return [];

  const currentMonth = getMonthKey(new Date());
  const bounds = getDataMonthBounds(records, visits);

  // The year in progress is always offered, even before anything is logged in it.
  const latest = getPeriodYear(currentMonth, period);
  const earliest = bounds
    ? Math.min(latest, getPeriodYear(bounds.first, period))
    : latest;

  const options: StatsYearOption[] = [];
  for (let year = latest; year >= earliest; year--) {
    options.push({
      value: year,
      label: period === 'serviceYear' ? `${year}-${year + 1}` : `${year}`
    });
  }

  return options;
};

/**
 * Monthly hours and bible studies for a period, one entry per calendar month.
 *
 * Derived from data the app already holds rather than fetched, so changing the period
 * re-renders on the spot instead of waiting for a round-trip.
 */
export const useStatsData = (
  records: ServiceRecord[],
  visits: VisitSummary[],
  period: StatsPeriod,
  year: number
): MonthlyStatPoint[] => {
  return useMemo(() => {
    const { startMonth, endMonth } = getPeriodRange(period, year);
    const dataBounds = getDataMonthBounds(records, visits);

    // With no lower bound, start at the first month that actually has data so the
    // chart isn't padded with empty months from before the user signed up.
    const firstMonth = startMonth || dataBounds?.first || endMonth;

    // A bounded period stops where it says it does; only All Time stretches to cover
    // a record dated past the current month.
    const openEnded = startMonth === null && dataBounds ? dataBounds.last : endMonth;
    const lastMonth = [endMonth, firstMonth, openEnded].sort().slice(-1)[0];

    const months = listMonthKeys(firstMonth, lastMonth);
    const totals = calculateMonthlyTotals(records, visits, months);

    return months.map(monthKey => ({
      month: monthKey,
      label: getShortMonthLabel(monthKey),
      ...totals[monthKey]
    }));
  }, [records, visits, period, year]);
};
