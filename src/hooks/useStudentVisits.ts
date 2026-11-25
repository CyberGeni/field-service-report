import { useMemo } from 'react';
import { VisitSummary } from '../utils/calculations';
import { useStudents } from './useStudents';

/**
 * Every Bible study call for the signed-in user, as the stats views count them.
 *
 * Read from the shared people store rather than fetched separately, so a study
 * recorded with no signal counts the moment it is saved - and so a return visit call
 * never does: only calls recorded as studies go on the report.
 */
export const useStudentVisits = () => {
  const { visits, loading, error, refetch } = useStudents();

  const studyVisits = useMemo<VisitSummary[]>(
    () =>
      visits
        .filter(visit => visit.is_study)
        .map(visit => ({ visit_date: visit.visit_date, student_id: visit.student_id })),
    [visits]
  );

  return { visits: studyVisits, loading, error, refetch };
};
