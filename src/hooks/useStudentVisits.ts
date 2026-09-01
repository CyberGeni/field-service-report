import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { VisitSummary } from '../utils/calculations';
import { readCache, writeCache } from '../utils/offlineCache';
import { getErrorMessage } from '../utils/errors';

const VISITS_CACHE = 'visits';

// The Stats tab unmounts whenever the user navigates away, so without this a trip to
// any other tab and back would blank the studies figures while they refetched.
let visitsCache: { userId: string; visits: VisitSummary[] } | null = null;

// The stats screen and the start-of-month prompt can both be mounted at once; one
// request serves both rather than each racing - and failing - on its own.
let inFlight: { userId: string; request: Promise<VisitSummary[]> } | null = null;

const fetchVisits = (userId: string): Promise<VisitSummary[]> => {
  if (inFlight?.userId === userId) return inFlight.request;

  // Wrapped in Promise.resolve: the Supabase builder is only a thenable, so its own
  // .then() stays a PromiseLike with no .finally() to chain off of.
  const request = Promise.resolve(
    supabase
      .from('student_visits')
      .select('visit_date, student_id')
      .eq('user_id', userId)
  )
    .then(({ data, error }) => {
      if (error) throw error;
      return (data || []) as VisitSummary[];
    })
    .finally(() => {
      if (inFlight?.userId === userId) inFlight = null;
    });

  inFlight = { userId, request };
  return request;
};

/**
 * Every study visit for the signed-in user, loaded once and revalidated on remount.
 *
 * Only two columns come back, so even years of weekly studies is a few KB - far
 * cheaper than re-querying each time the reader changes month or period.
 */
export const useStudentVisits = () => {
  const [visits, setVisits] = useState<VisitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const loadVisits = useCallback(async () => {
    if (!user) {
      visitsCache = null;
      setVisits([]);
      setLoading(false);
      return;
    }

    // Show what we already have straight away, then quietly refresh it. The module
    // cache covers a tab switch; the device cache covers a cold start with no signal.
    const cached =
      (visitsCache?.userId === user.id ? visitsCache.visits : null) ||
      readCache<VisitSummary[]>(VISITS_CACHE, user.id);
    if (cached) {
      setVisits(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      setError(null);

      const loaded = await fetchVisits(user.id);

      visitsCache = { userId: user.id, visits: loaded };
      writeCache(VISITS_CACHE, user.id, loaded);
      setVisits(loaded);
    } catch (err: unknown) {
      console.error('Error loading student visits:', err);

      // A failed refresh shouldn't wipe figures that are already on screen
      if (cached) return;

      // Offline is a state, not a failure. The hours on this screen come from records
      // the device already holds; only the studies count is unknown until there is a
      // connection, and the sync banner already says so.
      setVisits([]);
      if (navigator.onLine) setError(getErrorMessage(err, 'Failed to load study visits'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  return { visits, loading, error, refetch: loadVisits };
};
