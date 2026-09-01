export type ReportRounding = 'asIs' | 'carryOver' | 'roundUp' | 'roundDown';

export interface RoundedReport {
  reportedMinutes: number; // what goes on the report
  carryoverMinutes: number; // minutes held back for next month
}

export const MINUTES_PER_HOUR = 60;

/**
 * Decide what a month's logged time looks like on the report.
 *
 * "As is" and "carry over" both keep every logged minute accounted for; rounding
 * either invents or drops the odd minutes, which is why the difference is recorded
 * alongside the submission rather than quietly applied.
 */
export const applyReportRounding = (
  totalMinutes: number,
  rounding: ReportRounding
): RoundedReport => {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const wholeHours = Math.floor(minutes / MINUTES_PER_HOUR);
  const leftover = minutes % MINUTES_PER_HOUR;

  switch (rounding) {
    case 'roundUp':
      return {
        reportedMinutes: (leftover > 0 ? wholeHours + 1 : wholeHours) * MINUTES_PER_HOUR,
        carryoverMinutes: 0
      };
    case 'roundDown':
      return { reportedMinutes: wholeHours * MINUTES_PER_HOUR, carryoverMinutes: 0 };
    case 'carryOver':
      return { reportedMinutes: wholeHours * MINUTES_PER_HOUR, carryoverMinutes: leftover };
    case 'asIs':
    default:
      return { reportedMinutes: minutes, carryoverMinutes: 0 };
  }
};
