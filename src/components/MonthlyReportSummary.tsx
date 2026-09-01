import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Copy,
  FileText
} from 'lucide-react';
import { formatReportText, MonthlyReport } from '../hooks/useMonthlyReport';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { ReportSubmission } from '../hooks/useReportSubmissions';
import { useToast } from './ui/toast';
import { formatHoursMinutes } from '../utils/dateUtils';
import { getReportStatus, ReportStatusTone } from '../utils/reportReconciliation';
import { MINUTES_PER_HOUR } from '../utils/reportRounding';
import { ACTIVITY_META } from '../utils/activityTypes';
import MonthPicker from './MonthPicker';

interface MonthlyReportSummaryProps {
  report: MonthlyReport;
  loading?: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  // Jumping straight to a month, from the picker opened off the month heading
  onSelectMonth: (month: number, year: number) => void;
  // The earliest month with anything logged - nothing before it is worth showing
  earliestMonth: string;
  // Minutes the previous month held back for this one
  carriedInMinutes: number;
  submission?: ReportSubmission;
  // Months before this one predate the ledger and are left unjudged; null while it loads
  trackingStartMonth: string | null;
  onMarkReported: (monthKey: string, submission: Omit<ReportSubmission, 'copiedAt'>) => void;
  onUnmarkReported: (monthKey: string) => void;
}

const STATUS_STYLES: Record<ReportStatusTone, { wrapper: string; icon: React.ElementType }> = {
  pending: { wrapper: 'bg-gray-50 text-gray-600', icon: CircleDashed },
  balanced: { wrapper: 'bg-green-50 text-green-800', icon: Check },
  warning: { wrapper: 'bg-amber-50 text-amber-800', icon: AlertTriangle }
};

const MonthlyReportSummary: React.FC<MonthlyReportSummaryProps> = ({
  report,
  loading = false,
  canGoPrevious,
  canGoNext,
  onPreviousMonth,
  onNextMonth,
  onSelectMonth,
  earliestMonth,
  carriedInMinutes,
  submission,
  trackingStartMonth,
  onMarkReported,
  onUnmarkReported
}) => {
  const { copy, copied } = useCopyToClipboard();
  const { addToast } = useToast();
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const loggedMinutes = Math.round(report.hours * MINUTES_PER_HOUR);
  // Copying from here sends the time exactly as logged; the start-of-month prompt is
  // where rounding and carrying over are offered.
  const reportedMinutes = loggedMinutes + carriedInMinutes;
  const status = getReportStatus(report.monthKey, loggedMinutes, carriedInMinutes, submission);
  const StatusIcon = STATUS_STYLES[status.tone].icon;
  // Whatever happened with a month the ledger never saw is between the user and their
  // records - only say something once there is something to say.
  const showStatus =
    Boolean(submission) || (trackingStartMonth !== null && report.monthKey >= trackingStartMonth);

  // Copying here is just getting the text - a month is only settled by saying so,
  // since a report gets copied to show someone as often as it does to hand in.
  const handleCopy = async () => {
    const succeeded = await copy(
      formatReportText({ ...report, hours: reportedMinutes / MINUTES_PER_HOUR })
    );

    addToast(
      succeeded
        ? {
            type: 'success',
            title: 'Report Copied',
            description: 'Report copied to clipboard and ready to send to your group overseer'
          }
        : {
            type: 'error',
            title: 'Copy Failed',
            description: 'Your browser blocked clipboard access'
          }
    );
  };

  const handleMarkReported = () => {
    onMarkReported(report.monthKey, {
      rounding: 'asIs',
      loggedMinutes,
      carriedInMinutes,
      reportedMinutes,
      carryoverMinutes: 0
    });

    addToast({
      type: 'success',
      title: 'Marked as Reported',
      description: `${report.month} ${report.year} is settled`
    });
  };

  // Credited hours are already inside the total - the split is here so the user can
  // see what the month was made of. It is deliberately not in the copied text, which
  // stays the plain total the congregation asks for.
  const breakdown = [
    { label: 'Field Service', hours: report.preachingHours, indent: true },
    { label: ACTIVITY_META.volunteer.label, hours: report.volunteerHours, indent: true },
    { label: ACTIVITY_META.school.label, hours: report.schoolHours, indent: true }
  ].filter(row => row.hours > 0);

  const stats = [
    { label: 'Total Hours', value: formatHoursMinutes(report.hours), indent: false },
    ...(report.creditHours > 0
      ? breakdown.map(row => ({
          label: row.label,
          value: formatHoursMinutes(row.hours),
          indent: true
        }))
      : []),
    ...(carriedInMinutes > 0
      ? [{ label: 'Carried Over', value: `+${carriedInMinutes}min`, indent: false }]
      : []),
    { label: 'Bible Studies Conducted', value: `${report.studies}`, indent: false },
    {
      label: 'Weekly Average',
      value: `${formatHoursMinutes(report.weeklyAverage)}/week`,
      indent: false
    }
  ];

  return (
    <div className="bg-white rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-4">
        <FileText size={24} className="text-blue-500" />
        <h3 className="text-lg font-semibold text-gray-800">Monthly Report</h3>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={onPreviousMonth}
          disabled={!canGoPrevious}
          aria-label="Previous month"
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronLeft size={20} />
        </button>

        <button
          type="button"
          onClick={() => setShowMonthPicker(true)}
          className="text-base font-semibold text-gray-800 px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {report.month} {report.year}
        </button>

        <button
          type="button"
          onClick={onNextMonth}
          disabled={!canGoNext}
          aria-label="Next month"
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <MonthPicker
        isOpen={showMonthPicker}
        onClose={() => setShowMonthPicker(false)}
        monthKey={report.monthKey}
        earliestMonth={earliestMonth}
        onSelect={onSelectMonth}
      />

      {/* Hold the previous month's figures while the next one loads */}
      <div className={`space-y-3 transition-opacity duration-200 ${loading ? 'opacity-50' : 'opacity-100'}`}>
        {stats.map(stat => (
          <div key={stat.label} className="flex justify-between items-center">
            <span className={stat.indent ? 'text-gray-500 text-sm pl-4' : 'text-gray-600'}>
              {stat.label}
            </span>
            <span
              className={`font-semibold tabular-nums ${
                stat.indent ? 'text-sm text-gray-600' : 'text-lg text-gray-900'
              }`}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* What was actually sent, and how it squares with the log */}
      {showStatus && (
        <div
          className={`mt-5 flex items-start space-x-2 rounded-xl px-3 py-2.5 ${
            STATUS_STYLES[status.tone].wrapper
          }`}
        >
          <StatusIcon size={16} className="flex-shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            <p className="font-medium">{status.headline}</p>
            {status.detail && <p className="text-xs opacity-90 mt-0.5">{status.detail}</p>}
          </div>
          {submission && (
            <button
              type="button"
              onClick={() => onUnmarkReported(report.monthKey)}
              className="text-xs font-medium underline underline-offset-2 opacity-80 hover:opacity-100"
            >
              Undo
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleCopy}
        disabled={loading}
        className={`w-full ${showStatus ? 'mt-4' : 'mt-6'} flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors`}
      >
        {copied ? <Check size={18} /> : <Copy size={18} />}
        <span>{copied ? 'Copied' : 'Copy Report'}</span>
      </button>

      {/* Settling a month is its own decision, never a side effect of copying */}
      {showStatus && !submission && (
        <button
          type="button"
          onClick={handleMarkReported}
          disabled={loading}
          className="w-full mt-2 flex items-center justify-center space-x-2 border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 font-medium py-3 rounded-xl transition-colors"
        >
          <CheckCircle2 size={18} />
          <span>Mark as reported</span>
        </button>
      )}
    </div>
  );
};

export default MonthlyReportSummary;
