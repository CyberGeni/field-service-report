import { useCallback, useMemo, useState } from 'react';
import { ServiceRecord } from '../types';
import { calculateMonthlyTotals, VisitSummary } from '../utils/calculations';
import { addMonths, formatHoursMinutes, getCurrentMonth, parseMonthKey } from '../utils/dateUtils';

export interface MonthlyReport {
  monthKey: string; // YYYY-MM
  month: string; // "September"
  year: number;
  hours: number;
  studies: number;
  dailyAverage: number;
  weeklyAverage: number;
}

/** The plain-text report a publisher pastes into their congregation's reporting form. */
export const formatReportText = (report: MonthlyReport): string =>
  [
    `Service Report - ${report.month} ${report.year}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `Total Hours: ${formatHoursMinutes(report.hours)}`,
    `Bible Studies Conducted: ${report.studies}`
  ].join('\n');

// Records can't predate the app, and there is nothing to report on a future month.
const EARLIEST_MONTH = '2020-01';

const toMonthKey = (month: number, year: number): string =>
  `${year}-${month.toString().padStart(2, '0')}`;

const getFullMonthName = (monthKey: string): string => {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' });
};

/**
 * Hours and bible studies for a single month, with prev/next navigation clamped to
 * months that can actually hold data.
 *
 * The figures are derived from data already in memory, so an arrow press repaints
 * immediately - the month heading never sits on a stale value waiting for a fetch.
 */
export const useMonthlyReport = (
  records: ServiceRecord[],
  visits: VisitSummary[],
  initial?: { month: number; year: number }
) => {
  const [monthKey, setMonthKey] = useState<string>(() =>
    initial ? toMonthKey(initial.month, initial.year) : getCurrentMonth()
  );

  const currentMonth = getCurrentMonth();
  const canGoNext = monthKey < currentMonth;
  const canGoPrevious = monthKey > EARLIEST_MONTH;

  const report = useMemo<MonthlyReport>(() => {
    const totals = calculateMonthlyTotals(records, visits, [monthKey])[monthKey];

    return {
      monthKey,
      month: getFullMonthName(monthKey),
      year: parseMonthKey(monthKey).year,
      ...totals
    };
  }, [records, visits, monthKey]);

  const goToPreviousMonth = useCallback(() => {
    setMonthKey(prev => (prev > EARLIEST_MONTH ? addMonths(prev, -1) : prev));
  }, []);

  const goToNextMonth = useCallback(() => {
    setMonthKey(prev => (prev < getCurrentMonth() ? addMonths(prev, 1) : prev));
  }, []);

  const goToMonth = useCallback((month: number, year: number) => {
    const next = toMonthKey(month, year);
    if (next >= EARLIEST_MONTH && next <= getCurrentMonth()) {
      setMonthKey(next);
    }
  }, []);

  return {
    report,
    monthKey,
    canGoPrevious,
    canGoNext,
    goToPreviousMonth,
    goToNextMonth,
    goToMonth
  };
};
