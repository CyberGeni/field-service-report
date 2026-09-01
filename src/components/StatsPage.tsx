import React, { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { ServiceRecord, Profile } from '../types';
import { canLogVolunteerHours } from '../utils/activityTypes';
import { getStatsYearOptions, StatsPeriod, useStatsData } from '../hooks/useStatsData';
import { useMonthlyReport } from '../hooks/useMonthlyReport';
import { useStudentVisits } from '../hooks/useStudentVisits';
import { useReportSubmissions } from '../hooks/useReportSubmissions';
import StatsChart from './StatsChart';
import StatsTable from './StatsTable';
import MonthlyReportSummary from './MonthlyReportSummary';

interface StatsPageProps {
  records: ServiceRecord[];
  profile?: Profile | null;
  userId?: string;
}

const StatsPage: React.FC<StatsPageProps> = ({ records, profile, userId }) => {
  // Splitting the hours out only says something for someone who has both kinds
  const splitVolunteer = canLogVolunteerHours(profile);
  const [period, setPeriod] = useState<StatsPeriod>('calendarYear');
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  // Service records are already loaded app-wide; only the study visits need fetching,
  // and only once - every period change and month step after that is local.
  const { visits, loading, error } = useStudentVisits();

  const yearOptions = useMemo(
    () => getStatsYearOptions(records, visits, period),
    [records, visits, period]
  );

  // Switching period can put the chosen year out of range (a 2019 service year, say,
  // once the list starts at 2024), so fall back to the most recent one on offer
  // rather than charting a year the dropdown no longer shows.
  const year = yearOptions.some(option => option.value === selectedYear)
    ? selectedYear
    : yearOptions[0]?.value ?? selectedYear;

  const data = useStatsData(records, visits, period, year);

  const { markSubmitted, clearSubmission, getSubmission, getCarryoverInto, trackingStartMonth } =
    useReportSubmissions(userId);

  const {
    report,
    earliestMonth,
    canGoPrevious,
    canGoNext,
    goToPreviousMonth,
    goToNextMonth,
    goToMonth
  } = useMonthlyReport(records, visits);

  return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 font-libre-franklin">Stats</h1>
        <p className="text-gray-600">Your hours and studies over time</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Couldn't load your study visits</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      <StatsChart
        data={data}
        period={period}
        onPeriodChange={setPeriod}
        yearOptions={yearOptions}
        year={year}
        onYearChange={setSelectedYear}
        loading={loading}
        splitVolunteer={splitVolunteer}
      />

      <StatsTable data={data} splitVolunteer={splitVolunteer} />

      <MonthlyReportSummary
        report={report}
        loading={loading}
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
      />
    </div>
  );
};

export default StatsPage;
