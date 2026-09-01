import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { VisitSummary } from '../utils/calculations';

// The Stats tab unmounts whenever the user navigates away, so without this a trip to
// any other tab and back would blank the studies figures while they refetched.
let visitsCache: { userId: string; visits: VisitSummary[] } | null = null;

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

    // Show what we already have straight away, then quietly refresh it
    const cached = visitsCache?.userId === user.id ? visitsCache.visits : null;
    if (cached) {
      setVisits(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      setError(null);

      const { data, error: visitsError } = await supabase
        .from('student_visits')
        .select('visit_date, student_id')
        .eq('user_id', user.id);

      if (visitsError) throw visitsError;

      const loaded = data || [];
      visitsCache = { userId: user.id, visits: loaded };
      setVisits(loaded);
    } catch (err: any) {
      console.error('Error loading student visits:', err);
      setError(err.message || 'Failed to load study visits');
      // A failed refresh shouldn't wipe figures that are already on screen
      if (!cached) setVisits([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  return { visits, loading, error, refetch: loadVisits };
};
