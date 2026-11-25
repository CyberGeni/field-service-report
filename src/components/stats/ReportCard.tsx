import React, { useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleDashed, Copy, GraduationCap, HardHat } from 'lucide-react';
import { formatReportText, MonthlyReport } from '../../hooks/useMonthlyReport';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { ReportSubmission } from '../../hooks/useReportSubmissions';
import { formatHoursMinutesShort, formatHoursMinutesTight, getCurrentMonth } from '../../utils/dateUtils';
import { getReportStatus, ReportStatusTone } from '../../utils/reportReconciliation';
import { MINUTES_PER_HOUR } from '../../utils/reportRounding';
import { useToast } from '../ui/toast';
import MonthPicker from '../MonthPicker';

interface ReportCardProps {
  report: MonthlyReport;
  monthlyTarget: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
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
  loading?: boolean;
}

const STATUS_STYLE: Record<ReportStatusTone, { box: string; icon: React.ElementType }> = {
  pending: { box: 'bg-gray-50 text-gray-700', icon: CircleDashed },
  balanced: { box: 'bg-green-50 text-green-800', icon: CheckCircle2 },
  warning: { box: 'bg-amber-50 text-amber-800', icon: AlertTriangle }
};

/**
 * One month's report: the two numbers that go on it, whether it has been sent, and
 * the buttons to send it. It is what the Stats page is opened for, so it comes first.
 */
const ReportCard: React.FC<ReportCardProps> = ({
  report,
  monthlyTarget,
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
  onUnmarkReported,
  loading = false
}) => {
  const { copy, copied } = useCopyToClipboard();
  const { addToast } = useToast();
  const [pickingMonth, setPickingMonth] = useState(false);

  const loggedMinutes = Math.round(report.hours * MINUTES_PER_HOUR);
  // Copying from here sends the time exactly as logged; the start-of-month prompt is
  // where rounding and carrying over are offered
  const reportedMinutes = loggedMinutes + carriedInMinutes;
  const status = getReportStatus(report.monthKey, loggedMinutes, carriedInMinutes, submission);
  // Whatever happened with a month the ledger never saw is between the user and their
  // records - only say something once there is something to say
  const showStatus = Boolean(submission) || (trackingStartMonth !== null && report.monthKey >= trackingStartMonth);
  const StatusIcon = STATUS_STYLE[status.tone].icon;
  const inProgress = report.monthKey === getCurrentMonth();

  const handleCopy = async () => {
    const succeeded = await copy(formatReportText({ ...report, hours: reportedMinutes / MINUTES_PER_HOUR }));
    addToast(
      succeeded
        ? { type: 'success', title: 'Report copied', description: 'Ready to paste and send to your group overseer' }
        : { type: 'error', title: 'Copy failed', description: 'Your browser blocked clipboard access' }
    );
  };

  // Settling a month is its own decision, never a side effect of copying - a report is
  // copied to show someone as often as it is to hand in
  const handleMarkReported = () => {
    onMarkReported(report.monthKey, {
      rounding: 'asIs',
      loggedMinutes,
      carriedInMinutes,
      reportedMinutes,
      carryoverMinutes: 0
    });
    addToast({ type: 'success', title: 'Marked as reported', description: `${report.month} ${report.year} is settled` });
  };

  const progress = monthlyTarget > 0 ? Math.min(100, (report.hours / monthlyTarget) * 100) : 0;

  // Credits count in the total; saying so keeps a month made of a school credit from
  // passing for a month in the field
  const credits = [
    report.schoolHours > 0 && { icon: GraduationCap, text: `${formatHoursMinutesShort(report.schoolHours)} school credit`, tone: 'text-amber-700' },
    report.volunteerHours > 0 && { icon: HardHat, text: `${formatHoursMinutesShort(report.volunteerHours)} volunteer credit`, tone: 'text-emerald-700' }
  ].filter(Boolean) as { icon: React.ElementType; text: string; tone: string }[];

  return (
    <section aria-label="Monthly report" className="bg-white rounded-[20px] p-4 flex flex-col gap-3.5 shadow-sm">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onPreviousMonth} disabled={!canGoPrevious} aria-label="Previous month" className="w-11 h-11 rounded-xl flex items-center justify-center text-gray-700 hover:bg-gray-100 disabled:opacity-30">
          <ChevronLeft size={22} />
        </button>
        <button type="button" onClick={() => setPickingMonth(true)} className="flex flex-col items-center px-3 py-0.5 rounded-xl hover:bg-gray-50">
          <span className="text-[13px] font-semibold text-gray-500">Report for</span>
          <span className="text-xl font-bold text-gray-800 font-libre-franklin">{report.month} {report.year}</span>
        </button>
        <button type="button" onClick={onNextMonth} disabled={!canGoNext} aria-label="Next month" className="w-11 h-11 rounded-xl flex items-center justify-center text-gray-700 hover:bg-gray-100 disabled:opacity-30">
          <ChevronRight size={22} />
        </button>
      </div>

      <MonthPicker isOpen={pickingMonth} onClose={() => setPickingMonth(false)} monthKey={report.monthKey} earliestMonth={earliestMonth} onSelect={onSelectMonth} />

      {/* Hold the figures while a month loads rather than flashing to empty */}
      <div className={`grid grid-cols-2 gap-2.5 transition-opacity duration-200 ${loading ? 'opacity-50' : ''}`}>
        <div className="bg-gray-50 rounded-[14px] p-3.5 flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-gray-600">Hours</span>
          <span className="text-[28px] leading-tight font-bold text-gray-900 whitespace-nowrap">{formatHoursMinutesTight(report.hours)}</span>
          {monthlyTarget > 0 && (
            <span className="block h-1.5 rounded-full bg-blue-100 overflow-hidden" aria-hidden="true">
              <span className="block h-full rounded-full bg-blue-600 transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
            </span>
          )}
          <span className="text-[13px] text-gray-600">
            {monthlyTarget > 0 ? `${inProgress ? 'So far, of' : 'Of'} ${monthlyTarget}h target` : inProgress ? 'So far this month' : 'For the month'}
          </span>
        </div>
        <div className="bg-gray-50 rounded-[14px] p-3.5 flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-gray-600">Bible studies</span>
          <span className="text-[28px] leading-tight font-bold text-gray-900">{report.studies}</span>
          <span className="block h-1.5" aria-hidden="true" />
          <span className="text-[13px] text-gray-600">Different people studied with</span>
        </div>
      </div>

      {(credits.length > 0 || carriedInMinutes > 0) && (
        <div className="flex flex-col gap-1 -mt-1">
          {credits.map(({ icon: Icon, text, tone }) => (
            <p key={text} className="flex items-center gap-2 text-sm text-gray-700">
              <Icon size={16} className={tone} aria-hidden="true" />
              Includes {text}
            </p>
          ))}
          {carriedInMinutes > 0 && (
            <p className="text-sm text-gray-700">Plus {carriedInMinutes} min carried over from last month</p>
          )}
        </div>
      )}

      {showStatus && (
        <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-sm ${STATUS_STYLE[status.tone].box}`}>
          <StatusIcon size={18} className="flex-shrink-0 mt-px" aria-hidden="true" />
          <span className="flex-1">
            <span className="block font-semibold">
              {status.tone === 'pending' && inProgress ? 'Not reported yet · month still open' : status.headline}
            </span>
            {status.detail && status.tone !== 'pending' && <span className="block text-[13px] opacity-90 mt-0.5">{status.detail}</span>}
          </span>
        </div>
      )}

      <div className={`grid gap-2 ${showStatus ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button type="button" onClick={handleCopy} disabled={loading} className="h-12 rounded-[14px] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[15px] font-semibold flex items-center justify-center gap-2">
          {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy report'}
        </button>
        {showStatus && (
          submission ? (
            <button type="button" onClick={() => onUnmarkReported(report.monthKey)} className="h-12 rounded-[14px] border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-[15px] font-semibold">
              Undo reported
            </button>
          ) : (
            <button type="button" onClick={handleMarkReported} disabled={loading} className="h-12 rounded-[14px] border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-800 text-[15px] font-semibold">
              Mark reported
            </button>
          )
        )}
      </div>
    </section>
  );
};

export default ReportCard;
