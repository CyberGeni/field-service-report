import React, { useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { ServiceRecord, Profile, Settings } from '../types';
import { canLogVolunteerHours } from '../utils/activityTypes';
import { getServiceTypeTargets, hasHourRequirement } from '../utils/serviceTypes';
import { formatHoursMinutesTight, getCurrentMonth, parseMonthKey } from '../utils/dateUtils';
import { getStatsYearOptions, isYearScopedPeriod, StatsPeriod, useStatsData } from '../hooks/useStatsData';
import { useMonthlyReport } from '../hooks/useMonthlyReport';
import { useStudentVisits } from '../hooks/useStudentVisits';
import { useReportSubmissions } from '../hooks/useReportSubmissions';
import Segmented from './ui/Segmented';
import ReportCard from './stats/ReportCard';
import MonthChart from './stats/MonthChart';
import MonthTiles from './stats/MonthTiles';

interface StatsPageProps {
  records: ServiceRecord[];
  settings: Settings;
  profile?: Profile | null;
  userId?: string;
}

const PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: 'serviceYear', label: 'Service yr' },
  { value: 'calendarYear', label: 'Year' },
  { value: 'lastQuarter', label: '3 months' },
  { value: 'allTime', label: 'All' }
];

/**
 * The month's report first - it is what this page is opened for - then how the
 * chosen period is going: four headline figures, hours by month against the target,
 * and every month as a tile. The chart and the tiles both open a month's report.
 */
const StatsPage: React.FC<StatsPageProps> = ({ records, settings, profile, userId }) => {
  const splitCredits = canLogVolunteerHours(profile);
  const [period, setPeriod] = useState<StatsPeriod>('calendarYear');
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  // Service records are already loaded app-wide; study visits come from the people
  // store - so every period change and month step after that is local
  const { visits, loading, error } = useStudentVisits();

  const usesRequirement = Boolean(profile?.service_type && hasHourRequirement(profile.service_type));
  const monthlyTarget = usesRequirement ? getServiceTypeTargets(profile!.service_type).monthlyTarget : settings.monthlyTarget;
  const yearlyTarget = usesRequirement ? getServiceTypeTargets(profile!.service_type).yearlyTarget : settings.yearlyTarget;

  const yearOptions = useMemo(() => getStatsYearOptions(records, visits, period), [records, visits, period]);
  // Switching period can put the chosen year out of range, so fall back to the most
  // recent one on offer rather than charting a year that cannot be picked
  const yearIndex = Math.max(0, yearOptions.findIndex(option => option.value === selectedYear));
  const year = yearOptions[yearIndex]?.value ?? selectedYear;

  const data = useStatsData(records, visits, period, year);

  const { markSubmitted, clearSubmission, getSubmission, getCarryoverInto, trackingStartMonth } = useReportSubmissions(userId);
  const { report, earliestMonth, canGoPrevious, canGoNext, goToPreviousMonth, goToNextMonth, goToMonth } =
    useMonthlyReport(records, visits);

  // A month tapped lower down opens in the report card at the top: glide up to it,
  // or the change happens out of sight
  const reportRef = useRef<HTMLDivElement>(null);
  const openMonth = (monthKey: string) => {
    const { year: y, month } = parseMonthKey(monthKey);
    goToMonth(month, y);
    const card = reportRef.current;
    if (card && card.getBoundingClientRect().top < 0) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ── The period at a glance ──
  const currentMonth = getCurrentMonth();
  const finished = data.filter(point => point.month < currentMonth);
  const total = data.reduce((sum, point) => sum + point.hours, 0);
  const goal = period === 'serviceYear' ? yearlyTarget : monthlyTarget * data.length;
  const average = finished.length ? finished.reduce((sum, point) => sum + point.hours, 0) / finished.length : null;
  const onTarget = finished.filter(point => monthlyTarget > 0 && point.hours >= monthlyTarget).length;
  const latest = data[data.length - 1];
  const mostStudies = data.reduce((most, point) => Math.max(most, point.studies), 0);

  const figures = [
    {
      label: 'Total hours',
      value: formatHoursMinutesTight(total),
      meter: goal > 0 ? Math.min(100, (total / goal) * 100) : null,
      sub:
        goal <= 0
          ? `${data.length} ${data.length === 1 ? 'month' : 'months'}`
          : period === 'serviceYear'
            ? `Of ${yearlyTarget}h for the service year`
            : `Of ${goal}h · ${data.length} ${data.length === 1 ? 'month' : 'months'} × ${monthlyTarget}h`
    },
    { label: 'Monthly average', value: average === null ? '–' : formatHoursMinutesTight(average), meter: null, sub: 'Finished months only' },
    {
      label: 'Months on target',
      value: finished.length ? `${onTarget} of ${finished.length}` : '–',
      meter: null,
      sub: monthlyTarget > 0 ? `${monthlyTarget}h or more` : 'No monthly target set'
    },
    {
      label: 'Bible studies',
      value: latest ? String(latest.studies) : '0',
      meter: null,
      sub: `${latest?.month === currentMonth ? 'This month' : 'Latest month'} · most ${mostStudies}`
    }
  ];

  return (
    <div className="space-y-4 -mx-2">
      <div className="px-1 pt-1 space-y-1">
        <h1 className="text-[28px] font-bold text-gray-800 font-libre-franklin tracking-tight">Stats</h1>
        <p className="text-[15px] text-gray-600">Your report, and how the months are going</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Couldn't load your study visits</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      <div ref={reportRef} className="scroll-mt-4">
      <ReportCard
        report={report}
        monthlyTarget={monthlyTarget}
        canGoPrevious={canGoPrevious}
        canGoNext={canGoNext}
        onPreviousMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
        onSelectMonth={goToMonth}
        earliestMonth={earliestMonth}
        carriedInMinutes={getCarryoverInto(report.monthKey)}
        submission={getSubmission(report.monthKey)}
        trackingStartMonth={trackingStartMonth}
        onMarkReported={markSubmitted}
        onUnmarkReported={clearSubmission}
        loading={loading}
      />
      </div>

      {/* One filter row for everything below it. It sticks to the top once scrolled
          to, so the period can be changed from anywhere further down. */}
      <div className="sticky top-0 z-30 -mx-4 px-4 pt-2.5 pb-1.5 bg-gray-100/90 backdrop-blur-md border-b border-gray-200/80 space-y-1">
        <Segmented<StatsPeriod> label="Period" value={period} onChange={setPeriod} options={PERIODS} trackClassName="bg-gray-200" size="sm" />
        {isYearScopedPeriod(period) && (
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedYear(yearOptions[yearIndex + 1].value)}
              disabled={yearIndex >= yearOptions.length - 1}
              aria-label="Previous year"
              className="w-11 h-10 rounded-xl flex items-center justify-center text-gray-700 hover:bg-gray-200 disabled:opacity-30"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="min-w-[120px] text-center text-base font-semibold text-gray-800" aria-live="polite">
              {yearOptions[yearIndex]?.label ?? year}
            </span>
            <button
              type="button"
              onClick={() => setSelectedYear(yearOptions[yearIndex - 1].value)}
              disabled={yearIndex <= 0}
              aria-label="Next year"
              className="w-11 h-10 rounded-xl flex items-center justify-center text-gray-700 hover:bg-gray-200 disabled:opacity-30"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      <div className={`grid grid-cols-2 gap-2.5 transition-opacity duration-200 ${loading ? 'opacity-50' : ''}`}>
        {figures.map(figure => (
          <div key={figure.label} className="bg-white rounded-2xl p-3.5 flex flex-col gap-1 shadow-sm">
            <span className="text-[13px] font-semibold text-gray-600">{figure.label}</span>
            <span className="text-[22px] leading-tight font-bold text-gray-900">{figure.value}</span>
            {figure.meter !== null && (
              <span className="block h-1.5 my-0.5 rounded-full bg-blue-100 overflow-hidden" aria-hidden="true">
                <span className="block h-full rounded-full bg-blue-600 transition-[width] duration-500 ease-out" style={{ width: `${figure.meter}%` }} />
              </span>
            )}
            <span className="text-[13px] text-gray-600">{figure.sub}</span>
          </div>
        ))}
      </div>

      <section aria-label="Hours by month" className="bg-white rounded-[20px] px-4 pt-4 pb-3 flex flex-col gap-1 shadow-sm">
        <div>
          <h2 className="text-[17px] font-semibold text-gray-800 font-libre-franklin">Hours by month</h2>
          <p className="text-[13px] text-gray-600">Tap a month to open its report</p>
        </div>
        <MonthChart data={data} selectedMonth={report.monthKey} onSelectMonth={openMonth} monthlyTarget={monthlyTarget} splitCredits={splitCredits} />
      </section>

      {data.length > 0 && (
        <MonthTiles
          data={data}
          selectedMonth={report.monthKey}
          onSelectMonth={openMonth}
          monthlyTarget={monthlyTarget}
          getSubmission={getSubmission}
          trackingStartMonth={trackingStartMonth}
        />
      )}
    </div>
  );
};

export default StatsPage;
