import React, { useMemo } from 'react';
import { BookOpen, Check, MapPin } from 'lucide-react';
import { useStudents } from '../../hooks/useStudents';
import { usePlanClock } from '../../hooks/usePlanClock';
import { getDateString } from '../../utils/dateUtils';
import { DueVisit, formatShortDate, getVisitsDueOn } from '../../utils/people';
import { useToast } from '../ui/toast';

interface VisitTodayCardProps {
  // Opens a person's page; left out, the cards are not tappable
  onOpenPerson?: (personId: string) => void;
}

const reasonText = (due: DueVisit): string => {
  const { person, reason } = due;
  if (reason === 'overdue') return `Overdue · was due ${formatShortDate(person.next_visit_date!)}`;
  if (reason === 'promised') return 'Said to come back today';
  return `Usually home today${person.preferred_time ? ` · ${person.preferred_time.toLowerCase()}` : ''}`;
};

/**
 * The people to call on today: anyone whose usual day it is, who asked for today, or
 * who was promised a day that has slipped by.
 *
 * Shown on any day someone is due, whether or not it is one of the user's field
 * service days - a study who is only free on Tuesdays is still due on Tuesdays.
 */
const VisitTodayCard: React.FC<VisitTodayCardProps> = ({ onOpenPerson }) => {
  // Re-read at midnight, so a screen left open moves on to the new day's list
  usePlanClock();
  const today = getDateString(new Date());
  const { students, visits, saveStudentVisit, deleteStudentVisit } = useStudents();
  const { addToast } = useToast();

  const due = useMemo(() => getVisitsDueOn(students, today), [students, today]);
  if (due.length === 0) return null;

  const doneCount = due.filter(item => item.visitedToday).length;

  // A "visited" tap is undoable only while it is still just that: once a call today
  // has notes or a place against it, taking it back here would lose them
  const undoableVisit = (personId: string) =>
    visits
      .filter(visit => visit.student_id === personId && visit.visit_date === today)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .find(visit => !visit.notes && !visit.place_stopped);

  const markVisited = async (item: DueVisit) => {
    try {
      await saveStudentVisit({ student_id: item.person.id, visit_date: today }, { silent: true });
      addToast({
        type: 'success',
        title: 'Visited',
        description: `${item.person.name} is ticked off for today`,
        duration: 3000
      });
    } catch (err) {
      console.error('Could not mark visited:', err);
      addToast({ type: 'error', title: 'Not saved', description: 'Could not mark that visit. Please try again.' });
    }
  };

  const undoVisited = async (visitId: string) => {
    try {
      await deleteStudentVisit(visitId, { silent: true });
    } catch (err) {
      console.error('Could not undo visit:', err);
    }
  };

  return (
    <section aria-labelledby="visit-today-title" className="bg-white rounded-xl p-5 space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 id="visit-today-title" className="text-lg font-semibold text-gray-800">Visit today</h3>
        <span className="text-sm text-gray-600">
          {doneCount} of {due.length} done
        </span>
      </div>

      <ul className="space-y-2.5">
        {due.map(item => {
          const { person, visitedToday } = item;
          const undoable = visitedToday ? undoableVisit(person.id) : undefined;
          const isStudy = person.status === 'study';

          return (
            <li
              key={person.id}
              className={`rounded-2xl border p-3.5 flex items-start gap-3 ${
                visitedToday ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
              }`}
            >
              <button
                type="button"
                onClick={onOpenPerson ? () => onOpenPerson(person.id) : undefined}
                disabled={!onOpenPerson}
                className="flex-1 min-w-0 text-left space-y-1 disabled:cursor-default"
              >
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-semibold text-gray-800">{person.name}</span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      isStudy ? 'text-purple-700 bg-purple-100' : 'text-blue-700 bg-blue-100'
                    }`}
                  >
                    {isStudy ? 'Study' : 'Return visit'}
                  </span>
                </span>
                <span
                  className={`block text-sm font-semibold ${item.reason === 'overdue' ? 'text-amber-700' : 'text-gray-800'}`}
                >
                  {reasonText(item)}
                </span>
                {person.address && (
                  <span className="flex items-center gap-1.5 text-sm text-gray-600">
                    <MapPin size={14} className="flex-shrink-0" aria-hidden="true" />
                    <span className="truncate">{person.address}</span>
                  </span>
                )}
                {(person.place_stopped || person.publication_left) && (
                  <span className="flex items-center gap-1.5 text-sm text-gray-600">
                    <BookOpen size={14} className="flex-shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {isStudy && person.place_stopped ? person.place_stopped : person.publication_left}
                    </span>
                  </span>
                )}
              </button>

              {/* Both states share one size and border width, so ticking someone off
                  never shifts the card's text */}
              {visitedToday ? (
                <button
                  type="button"
                  onClick={undoable ? () => undoVisited(undoable.id) : undefined}
                  disabled={!undoable}
                  aria-label={undoable ? `Undo: mark ${person.name} as not visited` : `${person.name} visited today`}
                  className="flex-shrink-0 w-[104px] h-11 rounded-xl border border-green-600 bg-green-600 text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:cursor-default"
                >
                  <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                  Visited
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => markVisited(item)}
                  aria-label={`Mark ${person.name} as visited`}
                  className="flex-shrink-0 w-[104px] h-11 rounded-xl border border-gray-300 bg-white text-gray-800 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-gray-50"
                >
                  <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                  Visit
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default VisitTodayCard;
