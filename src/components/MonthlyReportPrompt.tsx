import React, { useState } from 'react';
import { Copy, FileText, X } from 'lucide-react';
import { ServiceRecord } from '../types';
import { formatReportText, useMonthlyReport } from '../hooks/useMonthlyReport';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { useStudentVisits } from '../hooks/useStudentVisits';
import { ReportSubmission } from '../hooks/useReportSubmissions';
import { formatHoursMinutes, parseMonthKey } from '../utils/dateUtils';
import {
  applyReportRounding,
  MINUTES_PER_HOUR,
  ReportRounding
} from '../utils/reportRounding';
import { useToast } from './ui/toast';
import Dialog from './ui/Dialog';

interface MonthlyReportPromptProps {
  monthKey: string; // the month being reported, YYYY-MM
  records: ServiceRecord[];
  carriedInMinutes: number; // minutes the month before held back for this one
  onCopied: (monthKey: string, submission: Omit<ReportSubmission, 'copiedAt'>) => void;
  onDismiss: () => void;
}

/**
 * The start-of-month nudge to send last month's report.
 *
 * Only copying the report puts the month to rest - dismissing closes the modal for
 * this visit and nothing more, so an unsent report is still waiting next time the app
 * opens. That is the whole point of the prompt, and it is easy to tap past by
 * accident on a phone.
 */
const MonthlyReportPrompt: React.FC<MonthlyReportPromptProps> = ({
  monthKey,
  records,
  carriedInMinutes,
  onCopied,
  onDismiss
}) => {
  const { visits } = useStudentVisits();
  const { copy } = useCopyToClipboard();
  const { addToast } = useToast();

  const { month, year } = parseMonthKey(monthKey);
  const { report } = useMonthlyReport(records, visits, { month, year });

  const loggedMinutes = Math.round(report.hours * MINUTES_PER_HOUR);
  const totalMinutes = loggedMinutes + carriedInMinutes;
  const leftoverMinutes = totalMinutes % MINUTES_PER_HOUR;
  const wholeHours = Math.floor(totalMinutes / MINUTES_PER_HOUR);

  // With the time already landing on a whole hour there is nothing to decide, and
  // every option would submit the same figure.
  const needsRounding = leftoverMinutes > 0;
  // Sending the logged time untouched is the only option that needs no explaining
  // later, so it is where the choice starts.
  const [rounding, setRounding] = useState<ReportRounding>('asIs');
  const chosenRounding: ReportRounding = needsRounding ? rounding : 'asIs';

  const rounded = applyReportRounding(totalMinutes, chosenRounding);
  const nextMonthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long' });

  const options: { value: ReportRounding; label: string; hint: string }[] = [
    {
      value: 'asIs',
      label: `Send as it is (${wholeHours}h ${leftoverMinutes}min)`,
      hint: 'Report exactly what you logged'
    },
    {
      value: 'carryOver',
      label: `Carry ${leftoverMinutes}min over`,
      hint: `Report ${wholeHours}h now, the rest counts toward ${nextMonthName}`
    },
    {
      value: 'roundUp',
      label: `Round up to ${wholeHours + 1}h`,
      hint: `Reports ${MINUTES_PER_HOUR - leftoverMinutes}min more than you logged`
    },
    {
      value: 'roundDown',
      label: `Round down to ${wholeHours}h`,
      hint: `Drops the extra ${leftoverMinutes}min`
    }
  ];

  const handleCopy = async () => {
    const succeeded = await copy(
      formatReportText({ ...report, hours: rounded.reportedMinutes / MINUTES_PER_HOUR })
    );

    if (!succeeded) {
      addToast({
        type: 'error',
        title: 'Copy Failed',
        description: 'Your browser blocked clipboard access'
      });
      return;
    }

    onCopied(monthKey, {
      rounding: chosenRounding,
      loggedMinutes,
      carriedInMinutes,
      reportedMinutes: rounded.reportedMinutes,
      carryoverMinutes: rounded.carryoverMinutes
    });

    addToast({
      type: 'success',
      title: 'Report Copied',
      description: 'Report copied to clipboard and ready to send to your group overseer'
    });
  };

  return (
    <Dialog open onClose={onDismiss} labelledBy="report-prompt-title" className="max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <FileText size={24} className="text-blue-500" />
            <h2 id="report-prompt-title" className="text-lg font-semibold text-gray-800">
              Send your {report.month} report
            </h2>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            className="p-1 -mr-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          {report.month} is over. Copy your report and send it to your congregation - this
          reminder keeps coming back until you do.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-5">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Time logged</span>
            <span className="font-semibold text-gray-900 tabular-nums">
              {formatHoursMinutes(report.hours)}
            </span>
          </div>
          {carriedInMinutes > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Carried over</span>
              <span className="font-semibold text-gray-900 tabular-nums">
                +{carriedInMinutes}min
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Bible studies</span>
            <span className="font-semibold text-gray-900 tabular-nums">{report.studies}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="text-gray-600">Reporting</span>
            <span className="font-semibold text-gray-900 tabular-nums">
              {formatHoursMinutes(rounded.reportedMinutes / MINUTES_PER_HOUR)}
            </span>
          </div>
        </div>

        {needsRounding && (
          <fieldset className="mb-5">
            <legend className="text-sm font-medium text-gray-700 mb-2">
              You have {leftoverMinutes}min over a whole hour
            </legend>
            <div className="space-y-2">
              {options.map(option => (
                <label
                  key={option.value}
                  className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    rounding === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-rounding"
                    value={option.value}
                    checked={rounding === option.value}
                    onChange={() => setRounding(option.value)}
                    className="mt-1 accent-blue-600"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-800">{option.label}</span>
                    <span className="block text-xs text-gray-500">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <button
          type="button"
          onClick={handleCopy}
          className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors"
        >
          <Copy size={18} />
          <span>Copy Report</span>
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className="w-full mt-2 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          Remind me later
        </button>
    </Dialog>
  );
};

export default MonthlyReportPrompt;
