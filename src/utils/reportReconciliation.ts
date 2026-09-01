import { ReportSubmission } from '../hooks/useReportSubmissions';
import { addMonths, formatHoursMinutesShort, getMonthName } from './dateUtils';
import { MINUTES_PER_HOUR } from './reportRounding';

export type ReportStatusTone = 'pending' | 'balanced' | 'warning';

export interface ReportStatus {
  tone: ReportStatusTone;
  headline: string;
  detail?: string;
}

const getNextMonthName = (monthKey: string): string =>
  getMonthName(addMonths(monthKey, 1)).split(' ')[0];

/**
 * How the report that was sent lines up with what the log now holds.
 *
 * A publisher has to be able to stand behind the figure they handed in, so every way
 * the two can drift apart is named out loud: minutes added or dropped by rounding,
 * minutes moved to another month, and - the one that bites - time edited into the log
 * after the report had already gone.
 */
export const getReportStatus = (
  monthKey: string,
  loggedMinutes: number,
  carriedInMinutes: number,
  submission?: ReportSubmission
): ReportStatus => {
  const format = (minutes: number) => formatHoursMinutesShort(minutes / MINUTES_PER_HOUR);

  if (!submission) {
    return {
      tone: 'pending',
      headline: 'Not reported yet',
      detail: `${format(loggedMinutes + carriedInMinutes)} ready to send`
    };
  }

  const sentOn = new Date(submission.copiedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
  const headline = `Reported ${format(submission.reportedMinutes)} on ${sentOn}`;

  // The log is the record of what happened; a change after the fact means the figure
  // with the congregation is now the wrong one.
  const heldWhenSent = submission.loggedMinutes + submission.carriedInMinutes;
  const heldNow = loggedMinutes + carriedInMinutes;
  if (heldNow !== heldWhenSent) {
    return {
      tone: 'warning',
      headline,
      detail: `Your log has changed since - it now holds ${format(heldNow)}, not the ${format(
        heldWhenSent
      )} this report was built from`
    };
  }

  if (submission.carryoverMinutes > 0) {
    return {
      tone: 'balanced',
      headline,
      detail: `${format(submission.carryoverMinutes)} carried into ${getNextMonthName(monthKey)}`
    };
  }

  // Rounding is the only way the two figures can honestly differ, so say by how much.
  const difference = submission.reportedMinutes - heldWhenSent;
  if (difference !== 0) {
    return {
      tone: 'warning',
      headline,
      detail:
        difference > 0
          ? `${format(difference)} more than the ${format(heldWhenSent)} logged (rounded up)`
          : `${format(-difference)} less than the ${format(heldWhenSent)} logged (rounded down)`
    };
  }

  return { tone: 'balanced', headline, detail: 'Matches your log exactly' };
};
