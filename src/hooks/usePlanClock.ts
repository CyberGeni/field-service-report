import { useEffect, useState } from 'react';
import { PLAN_DAY_CUTOFF_HOUR } from '../utils/calculations';
import { getDateString } from '../utils/dateUtils';

/**
 * Which stretch of the day it is as far as the plan cares: today before the cutoff,
 * or today after it. The plan only changes shape at those two boundaries.
 */
const getPlanPeriod = (now: Date = new Date()): string =>
  `${getDateString(now)}-${now.getHours() >= PLAN_DAY_CUTOFF_HOUR ? 'late' : 'early'}`;

const msUntilNextBoundary = (now: Date): number => {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), PLAN_DAY_CUTOFF_HOUR);
  const next = now < cutoff ? cutoff : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  // A beat past the boundary so the new period is what gets read
  return next.getTime() - now.getTime() + 1000;
};

/**
 * A key that changes when the plan built from "now" goes stale - at the evening
 * cutoff, when today drops out of the plan, and at midnight.
 *
 * A screen left open across either boundary would otherwise keep showing hours for
 * a day the plan no longer counts on. Phones suspend timers in the background, so
 * the period is also re-read whenever the app comes back into view.
 */
export const usePlanClock = (): string => {
  const [period, setPeriod] = useState(() => getPlanPeriod());

  useEffect(() => {
    const refresh = () => setPeriod(getPlanPeriod());
    const timer = window.setTimeout(refresh, msUntilNextBoundary(new Date()));

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // Re-armed for the next boundary each time the period moves on
  }, [period]);

  return period;
};
