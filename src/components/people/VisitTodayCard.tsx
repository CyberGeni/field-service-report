import React, { useMemo } from 'react';
import { BookOpen, Check, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { spring } from '../../lib/motion';
import { useStudents } from '../../hooks/useStudents';
import { usePlanClock } from '../../hooks/usePlanClock';
import { getDateString } from '../../utils/dateUtils';
import { DueVisit, formatShortDate, getVisitsDueOn, parseLocalDate, WEEKDAY_SHORT } from '../../utils/people';
import { useToast } from '../ui/toast';
import { PersonAvatar, PersonPhoto } from './PersonBits';

interface VisitTodayCardProps {
  // Opens a person's page; left out, the cards are not tappable
  onOpenPerson?: (personId: string) => void;
}

/** "Study · usually 11am", "Return visit · asked for today", "Return visit · overdue since Mon". */
const statusLine = (due: DueVisit, today: string): string => {
  const { person, reason } = due;
  const kind = person.status === 'study' ? 'Study' : 'Return visit';
  if (reason === 'overdue') {
    const days = Math.round((parseLocalDate(today).getTime() - parseLocalDate(person.next_visit_date!).getTime()) / 86400000);
    const since = days <= 6 ? WEEKDAY_SHORT[parseLocalDate(person.next_visit_date!).getDay()] : formatShortDate(person.next_visit_date!);
    return `${kind} · overdue since ${since}`;
  }
  if (reason === 'promised') return `${kind} · asked for today`;
  return `${kind} · ${person.preferred_time ? `usually ${person.preferred_time.toLowerCase()}` : 'usually home today'}`;
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
      addToast({ type: 'success', title: 'Visited', description: `${item.person.name} is ticked off for today`, duration: 3000 });
    } catch (err) {
      console.error('Could not mark visited:', err);
      addToast({ type: 'error', title: 'Not saved', description: 'Could not mark that visit. Please try again.' });
    }
  };

  return (
    <section aria-labelledby="visit-today-title" className="bg-white rounded-2xl p-4 pt-[18px] space-y-3 shadow-sm">
      <div className="flex items-baseline justify-between px-0.5">
        <h2 id="visit-today-title" className="text-lg font-semibold text-gray-800 font-libre-franklin">Visit today</h2>
        <span className="text-sm text-gray-600">
          {doneCount} of {due.length} done
        </span>
      </div>

      <ul className="space-y-3">
        {due.map(item => {
          const { person, visitedToday } = item;
          const undoable = visitedToday ? undoableVisit(person.id) : undefined;
          const hasDetails = Boolean(person.address || person.publication_left || person.place_stopped || person.photo_path);

          return (
            <motion.li
              key={person.id}
              layout
              transition={spring}
              className={`rounded-2xl border p-4 flex flex-col gap-3.5 transition-colors duration-300 ${
                visitedToday ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
              }`}
            >
              {/* Who, and why today */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenPerson ? () => onOpenPerson(person.id) : undefined}
                  disabled={!onOpenPerson}
                  className="flex-1 min-w-0 flex items-center gap-3 text-left disabled:cursor-default"
                >
                  <PersonAvatar status={person.status} />
                  <span className="min-w-0 flex flex-col gap-0.5">
                    <span className="text-base font-semibold text-gray-800 truncate">{person.name}</span>
                    <span className={`text-sm leading-5 line-clamp-2 ${item.reason === 'overdue' ? 'text-amber-700 font-semibold' : 'text-gray-600'}`}>
                      {statusLine(item, today)}
                    </span>
                  </span>
                </button>

                {/* Both states share one size and border width, so ticking someone off
                    never shifts the card's text */}
                {visitedToday ? (
                  <button
                    type="button"
                    onClick={undoable ? () => deleteStudentVisit(undoable.id, { silent: true }) : undefined}
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
              </div>

              {/* Where and what: set apart below, lined up under the name */}
              {hasDetails && (
                <div className={`ml-8 pt-3 border-t flex gap-3 ${visitedToday ? 'border-green-200' : 'border-gray-100'}`}>
                  <div className="flex-1 min-w-0 space-y-2">
                    {person.address && (
                      <p className="flex items-start gap-2 text-sm leading-5 text-gray-700">
                        <MapPin size={16} className="text-gray-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
                        {person.address}
                      </p>
                    )}
                    {(person.place_stopped || person.publication_left) && (
                      <p className="flex items-start gap-2 text-sm leading-5 text-gray-700">
                        <BookOpen size={16} className="text-gray-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
                        {person.status === 'study' && person.place_stopped
                          ? [person.publication_left, person.place_stopped].filter(Boolean).join(' · ')
                          : person.publication_left}
                      </p>
                    )}
                  </div>
                  {person.photo_path && (
                    <PersonPhoto path={person.photo_path} className="w-14 h-11 rounded-lg flex-shrink-0" />
                  )}
                </div>
              )}
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
};

export default VisitTodayCard;
