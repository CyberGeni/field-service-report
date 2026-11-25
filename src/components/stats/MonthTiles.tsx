import React from 'react';
import { CheckCircle2, CircleDashed } from 'lucide-react';
import { MonthlyStatPoint } from '../../hooks/useStatsData';
import { ReportSubmission } from '../../hooks/useReportSubmissions';
import { formatHoursMinutesShort, formatHoursMinutesTight, getCurrentMonth, getMonthName, parseMonthKey } from '../../utils/dateUtils';

interface MonthTilesProps {
  data: MonthlyStatPoint[];
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
  monthlyTarget: number;
  getSubmission: (monthKey: string) => ReportSubmission | undefined;
  // Months before this predate the report ledger, so "not reported" says nothing there
  trackingStartMonth: string | null;
}

type Reported = 'reported' | 'notYet' | 'unknown';

/**
 * Every month of the period as a small tile, three to a row, so a whole year is four
 * rows and fits on screen at once. The chart's table twin, and a second way into a
 * month's report. A long history is split by year so it stays easy to scan.
 */
const MonthTiles: React.FC<MonthTilesProps> = ({ data, selectedMonth, onSelectMonth, monthlyTarget, getSubmission, trackingStartMonth }) => {
  const currentMonth = getCurrentMonth();

  const reportedState = (monthKey: string): Reported => {
    if (getSubmission(monthKey)) return 'reported';
    if (monthKey === currentMonth) return 'notYet';
    return trackingStartMonth !== null && monthKey >= trackingStartMonth ? 'notYet' : 'unknown';
  };

  const years = new Map<number, MonthlyStatPoint[]>();
  data.forEach(point => {
    const { year } = parseMonthKey(point.month);
    years.set(year, [...(years.get(year) ?? []), point]);
  });
  const grouped = years.size > 1;

  return (
    <section aria-label="Month by month" className="bg-white rounded-[20px] p-4 flex flex-col gap-3 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold text-gray-800 font-libre-franklin">Month by month</h2>
        <span className="flex items-center gap-2.5 text-xs text-gray-600">
          <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-green-600" aria-hidden="true" />Reported</span>
          <span className="flex items-center gap-1"><CircleDashed size={12} className="text-gray-400" aria-hidden="true" />Not yet</span>
        </span>
      </div>

      {[...years.entries()].map(([year, points]) => (
        <div key={year} className="flex flex-col gap-2">
          {grouped && <h3 className="text-[13px] font-semibold text-gray-500">{year}</h3>}
          <div className="grid grid-cols-3 gap-2">
            {points.map(point => {
              const selected = point.month === selectedMonth;
              const state = reportedState(point.month);
              const name = getMonthName(point.month).split(' ')[0];
              const progress = monthlyTarget > 0 ? Math.min(100, (point.hours / monthlyTarget) * 100) : 0;
              return (
                <button
                  key={point.month}
                  type="button"
                  onClick={() => onSelectMonth(point.month)}
                  aria-pressed={selected}
                  aria-label={`${name} ${year}: ${formatHoursMinutesShort(point.hours)}, ${point.studies} ${point.studies === 1 ? 'study' : 'studies'}${state === 'reported' ? ', reported' : state === 'notYet' ? ', not reported yet' : ''}`}
                  className={`min-h-[96px] p-2.5 rounded-xl border-2 text-left flex flex-col items-start gap-1.5 transition-colors duration-200 ${
                    selected ? 'border-blue-600 bg-blue-50' : 'border-transparent bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <span className="w-full flex items-center justify-between">
                    <span className="text-[13px] font-bold text-gray-700">{name.slice(0, 3)}</span>
                    {state === 'reported' && <CheckCircle2 size={14} className="text-green-600" aria-hidden="true" />}
                    {state === 'notYet' && <CircleDashed size={14} className="text-gray-400" aria-hidden="true" />}
                  </span>
                  <span className="text-[17px] font-bold text-gray-900 whitespace-nowrap">{formatHoursMinutesTight(point.hours)}</span>
                  {monthlyTarget > 0 && (
                    <span className="block w-full h-1 rounded-full bg-gray-200 overflow-hidden" aria-hidden="true">
                      <span className="block h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
                    </span>
                  )}
                  <span className="text-xs text-gray-600">{point.studies} {point.studies === 1 ? 'study' : 'studies'}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
};

export default MonthTiles;
