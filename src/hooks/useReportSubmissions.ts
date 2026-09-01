import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';
import { ServiceRecord } from '../types';
import { addMonths, getCurrentMonth } from '../utils/dateUtils';
import { MINUTES_PER_HOUR, ReportRounding } from '../utils/reportRounding';

export interface ReportSubmission {
  copiedAt: string; // ISO timestamp of the copy that settled the month
  rounding: ReportRounding;
  loggedMinutes: number; // what the log held when the report went out
  carriedInMinutes: number; // minutes brought forward from the month before
  reportedMinutes: number; // what actually went on the report
  carryoverMinutes: number; // minutes pushed onto the next month's report
}

type SubmissionsByMonth = Record<string, ReportSubmission>;

// Where the ledger lived before it moved to Supabase. Still read once per account so
// nothing already reported on this device starts nagging again, then retired.
const LEGACY_SUBMISSIONS_PREFIX = 'fieldServiceReportSubmissions';
const LEGACY_TRACKING_START_PREFIX = 'fieldServiceReportTrackingStart';

const legacyKey = (prefix: string, userId: string) => `${prefix}:${userId}`;

/** A locally stored entry, which may predate fields the app reads today. */
type StoredSubmission = Partial<ReportSubmission> & { hours?: number };

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Bring a stored entry up to the shape the app reads.
 *
 * The first version of the ledger recorded whole hours rather than minutes, so those
 * entries are reconstructed from what they did keep - and anything still missing a
 * usable figure is dropped, because a month that reads as NaN is worse than a month
 * that simply asks to be reported again.
 */
const normalizeSubmission = (stored: StoredSubmission): ReportSubmission | null => {
  const reportedMinutes = isPositiveNumber(stored.reportedMinutes)
    ? stored.reportedMinutes
    : isPositiveNumber(stored.hours)
      ? stored.hours * MINUTES_PER_HOUR
      : null;

  if (reportedMinutes === null || !stored.copiedAt) return null;

  const carryoverMinutes = isPositiveNumber(stored.carryoverMinutes) ? stored.carryoverMinutes : 0;
  const carriedInMinutes = isPositiveNumber(stored.carriedInMinutes) ? stored.carriedInMinutes : 0;

  return {
    copiedAt: stored.copiedAt,
    rounding: stored.rounding || 'asIs',
    // Older entries never recorded the log they were built from; the closest honest
    // reading is the time the report accounted for.
    loggedMinutes: isPositiveNumber(stored.loggedMinutes)
      ? stored.loggedMinutes
      : reportedMinutes + carryoverMinutes - carriedInMinutes,
    carriedInMinutes,
    reportedMinutes,
    carryoverMinutes
  };
};

const readLegacySubmissions = (userId: string): SubmissionsByMonth => {
  try {
    const stored = localStorage.getItem(legacyKey(LEGACY_SUBMISSIONS_PREFIX, userId));
    if (!stored) return {};

    const parsed = JSON.parse(stored) as Record<string, StoredSubmission>;
    const submissions: SubmissionsByMonth = {};

    Object.entries(parsed).forEach(([monthKey, entry]) => {
      const normalized = entry && normalizeSubmission(entry);
      if (normalized) submissions[monthKey] = normalized;
    });

    return submissions;
  } catch (err) {
    // A corrupt or blocked store must not take the whole app down with it
    console.warn('Could not read local report submissions:', err);
    return {};
  }
};

const readLegacyTrackingStart = (userId: string): string | null => {
  try {
    return localStorage.getItem(legacyKey(LEGACY_TRACKING_START_PREFIX, userId));
  } catch {
    return null;
  }
};

const forgetLegacy = (userId: string) => {
  try {
    localStorage.removeItem(legacyKey(LEGACY_SUBMISSIONS_PREFIX, userId));
    localStorage.removeItem(legacyKey(LEGACY_TRACKING_START_PREFIX, userId));
  } catch {
    // Nothing to do either way: the rows are in Supabase now
  }
};

interface SubmissionRow {
  month: string;
  rounding: ReportRounding;
  logged_minutes: number;
  carried_in_minutes: number;
  reported_minutes: number;
  carryover_minutes: number;
  copied_at: string;
}

const SUBMISSION_COLUMNS =
  'month, rounding, logged_minutes, carried_in_minutes, reported_minutes, carryover_minutes, copied_at';

const toSubmission = (row: SubmissionRow): ReportSubmission => ({
  copiedAt: row.copied_at,
  rounding: row.rounding,
  loggedMinutes: row.logged_minutes,
  carriedInMinutes: row.carried_in_minutes,
  reportedMinutes: row.reported_minutes,
  carryoverMinutes: row.carryover_minutes
});

const toRow = (userId: string, monthKey: string, submission: ReportSubmission) => ({
  user_id: userId,
  month: monthKey,
  rounding: submission.rounding,
  logged_minutes: Math.round(submission.loggedMinutes),
  carried_in_minutes: Math.round(submission.carriedInMinutes),
  reported_minutes: Math.round(submission.reportedMinutes),
  carryover_minutes: Math.round(submission.carryoverMinutes),
  copied_at: submission.copiedAt
});

interface LedgerState {
  userId?: string;
  submissions: SubmissionsByMonth;
  // Null until the ledger has loaded: until then nothing is claimed to be unreported
  trackingStartMonth: string | null;
}

const NO_SUBMISSIONS: SubmissionsByMonth = {};

const EMPTY_STATE: LedgerState = { submissions: NO_SUBMISSIONS, trackingStartMonth: null };

/**
 * One shared copy of the ledger.
 *
 * The start-of-month prompt and the stats card both read and write it, and a report
 * copied in one has to settle the other on the spot - prompting again for a month the
 * user has just reported is exactly the nagging this feature exists to avoid.
 */
const store = {
  state: EMPTY_STATE,
  loadedFor: undefined as string | undefined,
  loading: false,
  listeners: new Set<() => void>()
};

const emit = () => store.listeners.forEach(listener => listener());

const subscribe = (listener: () => void) => {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
};

/**
 * The month this ledger began for the user, written on first sight.
 *
 * Reports sent before the feature existed were never recorded, so months before it
 * are left alone - a year of "not reported yet" over history that was reported
 * perfectly well at the time would be noise, and untrue.
 */
const loadTrackingStart = async (userId: string): Promise<string> => {
  const { data, error } = await supabase
    .from('report_tracking')
    .select('start_month')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data?.start_month) return data.start_month;

  // A device that used the local ledger already started tracking back then
  const startMonth = readLegacyTrackingStart(userId) || getCurrentMonth();

  const { error: insertError } = await supabase
    .from('report_tracking')
    .upsert({ user_id: userId, start_month: startMonth }, { onConflict: 'user_id' });

  if (insertError) throw insertError;

  return startMonth;
};

const loadLedger = async (userId: string) => {
  if (store.loading || store.loadedFor === userId) return;
  store.loading = true;

  try {
    const [trackingStartMonth, { data, error }] = await Promise.all([
      loadTrackingStart(userId),
      supabase.from('report_submissions').select(SUBMISSION_COLUMNS).eq('user_id', userId)
    ]);

    if (error) throw error;

    const submissions: SubmissionsByMonth = {};
    (data as SubmissionRow[] | null)?.forEach(row => {
      submissions[row.month] = toSubmission(row);
    });

    // Months settled on this device before the move to Supabase: send them up rather
    // than asking the user again for reports they have already handed in.
    const unsynced = Object.entries(readLegacySubmissions(userId)).filter(
      ([monthKey]) => !submissions[monthKey]
    );

    if (unsynced.length > 0) {
      const { error: upsertError } = await supabase
        .from('report_submissions')
        .upsert(
          unsynced.map(([monthKey, submission]) => toRow(userId, monthKey, submission)),
          { onConflict: 'user_id,month' }
        );

      if (upsertError) throw upsertError;

      unsynced.forEach(([monthKey, submission]) => {
        submissions[monthKey] = submission;
      });
    }

    forgetLegacy(userId);

    store.state = { userId, submissions, trackingStartMonth };
    store.loadedFor = userId;
    emit();
  } catch (err) {
    console.error('Could not load report submissions:', err);
    // Fall back to whatever this device knows, so the prompt still behaves sanely
    store.state = {
      userId,
      submissions: readLegacySubmissions(userId),
      trackingStartMonth: readLegacyTrackingStart(userId)
    };
    emit();
  } finally {
    store.loading = false;
  }
};

/**
 * Which months the user has already copied a report for, and what they did with the
 * leftover minutes.
 *
 * The prompt keeps coming back until a month is in here, so only an actual copy is
 * allowed to write to it - dismissing the modal deliberately leaves no trace.
 */
export const useReportSubmissions = (userId?: string) => {
  const state = useSyncExternalStore(subscribe, () => store.state);

  useEffect(() => {
    if (!userId) {
      // Signing out must not leave the next account reading this one's ledger
      store.state = EMPTY_STATE;
      store.loadedFor = undefined;
      emit();
      return;
    }

    loadLedger(userId);
  }, [userId]);

  // A ledger loaded for someone else is not this user's answer
  const submissions = useMemo(
    () => (state.userId === userId ? state.submissions : NO_SUBMISSIONS),
    [state, userId]
  );
  const trackingStartMonth = state.userId === userId ? state.trackingStartMonth : null;

  const markSubmitted = useCallback(
    async (monthKey: string, submission: Omit<ReportSubmission, 'copiedAt'>) => {
      if (!userId) return;

      const entry: ReportSubmission = { ...submission, copiedAt: new Date().toISOString() };

      // Settle the month on screen first: the copy has already happened, and the user
      // should not be nagged again while a round-trip is in flight.
      store.state = {
        ...store.state,
        userId,
        submissions: { ...store.state.submissions, [monthKey]: entry }
      };
      emit();

      const { error } = await supabase
        .from('report_submissions')
        .upsert(toRow(userId, monthKey, entry), { onConflict: 'user_id,month' });

      if (error) console.error('Could not save report submission:', error);
    },
    [userId]
  );

  /** Undo a month marked as reported, for a tap that was never meant. */
  const clearSubmission = useCallback(
    async (monthKey: string) => {
      if (!userId) return;

      const remaining = { ...store.state.submissions };
      delete remaining[monthKey];
      store.state = { ...store.state, userId, submissions: remaining };
      emit();

      const { error } = await supabase
        .from('report_submissions')
        .delete()
        .eq('user_id', userId)
        .eq('month', monthKey);

      if (error) console.error('Could not clear report submission:', error);
    },
    [userId]
  );

  const isSubmitted = useCallback(
    (monthKey: string): boolean => Boolean(submissions[monthKey]),
    [submissions]
  );

  const getSubmission = useCallback(
    (monthKey: string): ReportSubmission | undefined => submissions[monthKey],
    [submissions]
  );

  /** Minutes the previous month held back for this one. */
  const getCarryoverInto = useCallback(
    (monthKey: string): number => submissions[addMonths(monthKey, -1)]?.carryoverMinutes || 0,
    [submissions]
  );

  return {
    submissions,
    isSubmitted,
    markSubmitted,
    clearSubmission,
    getSubmission,
    getCarryoverInto,
    trackingStartMonth
  };
};

/**
 * The month the user still owes a report for: last month, once it is over and if they
 * logged anything in it. Null when there is nothing to send, it has already gone, or
 * the ledger has yet to load.
 */
export const getPendingReportMonth = (
  records: ServiceRecord[],
  isSubmitted: (monthKey: string) => boolean,
  trackingStartMonth: string | null
): string | null => {
  if (!trackingStartMonth) return null;

  const lastMonth = addMonths(getCurrentMonth(), -1);

  // Nothing before the ledger existed was ever tracked, so nothing before it is owed
  if (lastMonth < trackingStartMonth) return null;
  if (isSubmitted(lastMonth)) return null;
  if (!records.some(record => record.date.slice(0, 7) === lastMonth)) return null;

  return lastMonth;
};
