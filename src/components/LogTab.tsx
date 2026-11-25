import React, { useMemo, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { ServiceRecord, Settings, TimerState, Profile } from '../types';
import { generateFieldServicePlan } from '../utils/calculations';
import { getCurrentMonth, getDateString } from '../utils/dateUtils';
import { getAvailableActivities } from '../utils/activityTypes';
import { getDayOverride, getFieldDayOn } from '../utils/fieldDays';
import { formatPreferredDays, parseLocalDate, WEEKDAY_SHORT } from '../utils/people';
import { useStudents } from '../hooks/useStudents';
import { usePlanClock } from '../hooks/usePlanClock';
import { useToast } from './ui/toast';
import Timer from './Timer';
import CreditSheet from './CreditSheet';
import PersonSheet from './people/PersonSheet';
import VisitTodayCard from './people/VisitTodayCard';
import { PersonAvatar } from './people/PersonBits';

interface LogTabProps {
  records: ServiceRecord[];
  settings: Settings;
  profile?: Profile | null;
  onSaveRecord: (record: ServiceRecord) => void;
  timerState: TimerState;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onStopTimer: () => { totalTime: number; serviceType: 'h2h' | 'cart' };
  onSetServiceType: (type: 'h2h' | 'cart') => void;
  onOpenPerson?: (personId: string) => void;
  onOpenPeople?: () => void;
}

/**
 * The screen used out in the field: the timer, a one-tap way to note someone just
 * met, and who else to call on today.
 */
const LogTab: React.FC<LogTabProps> = ({
  records,
  settings,
  profile,
  onSaveRecord,
  timerState,
  onStartTimer,
  onPauseTimer,
  onStopTimer,
  onSetServiceType,
  onOpenPerson,
  onOpenPeople
}) => {
  usePlanClock();
  const { addToast } = useToast();
  const { students } = useStudents();
  const [creditOpen, setCreditOpen] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);

  const now = new Date();
  const today = getDateString(now);
  const dayOff = getDayOverride(settings, today);
  const isDayOff = dayOff?.kind === 'off';
  const canLogCredit = getAvailableActivities(profile).some(activity => !activity.timed);

  const running = timerState.isRunning && !timerState.isPaused;
  const paused = timerState.isPaused;

  // The heading says what the user is doing, not what the calendar says they should be
  const heading = running ? 'In the field' : paused ? 'Taking a break' : isDayOff ? 'Day off today' : 'Ready to go out?';

  // What the plan asks of today. Past the evening cutoff, or once today has a record,
  // the plan moves on to tomorrow - so fall back to the time set aside for today.
  const plan = generateFieldServicePlan(records, settings, getCurrentMonth(), profile);
  const targetHours =
    plan.days.find(day => day.date === today)?.plannedHours ??
    getFieldDayOn(settings, today)?.potentialHours ??
    null;

  // A field day in the last week with nothing logged against it is worth a nudge
  const missedDay = useMemo(() => {
    for (let back = 1; back <= 7; back++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
      const date = getDateString(day);
      if (getFieldDayOn(settings, date)) {
        return records.some(record => record.date === date) ? null : day;
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, settings, today]);

  // People added today, newest first
  const metToday = useMemo(
    () =>
      students
        .filter(person => person.date_met === today)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [students, today]
  );

  const handleTimerStop = () => {
    // Read the type back from the stopped session rather than from a render-time
    // value, so the record always matches what was selected for that session
    const { totalTime, serviceType } = onStopTimer();
    const totalMinutes = Math.floor(totalTime / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (totalMinutes > 0) {
      onSaveRecord({ id: crypto.randomUUID(), date: getDateString(new Date()), hours, minutes, type: serviceType });
      addToast({ type: 'success', title: 'Time logged', description: `${hours}h ${minutes}m recorded for today` });
    } else {
      addToast({ type: 'info', title: 'Timer stopped', description: 'Nothing was recorded - the timer ran for under a minute' });
    }
  };

  const metSummary = (person: (typeof students)[number]) => {
    const back = person.next_visit_date
      ? `Back ${WEEKDAY_SHORT[parseLocalDate(person.next_visit_date).getDay()]}`
      : formatPreferredDays(person.preferred_days)
        ? `Usually ${formatPreferredDays(person.preferred_days)}`
        : null;
    return [back, person.preferred_time?.toLowerCase(), person.publication_left].filter(Boolean).join(' · ') || person.address;
  };

  const addedAt = (person: (typeof students)[number]) => {
    const created = new Date(person.created_at);
    return Number.isNaN(created.getTime())
      ? ''
      : created.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4 -mx-2">
      <div className="px-1 pt-1 space-y-1.5">
        <p className="text-sm font-medium text-gray-600">
          {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-[28px] font-bold text-gray-800 font-libre-franklin tracking-tight">{heading}</h1>
        {isDayOff && !running && !paused && (
          <p className="text-sm text-gray-600">
            You marked today off{dayOff?.note ? ` (${dayOff.note})` : ''}. Its hours are spread over your other days.
          </p>
        )}
        {missedDay && !running && (
          <p className="text-sm font-medium text-amber-700">
            Nothing logged for {missedDay.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })} yet
          </p>
        )}
      </div>

      <Timer
        timerState={timerState}
        onStart={onStartTimer}
        onPause={onPauseTimer}
        onStop={handleTimerStop}
        onSetServiceType={onSetServiceType}
        targetHours={targetHours}
        onLogCredit={canLogCredit ? () => setCreditOpen(true) : undefined}
      />

      <button
        type="button"
        onClick={() => setAddingPerson(true)}
        className="w-full flex items-center gap-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-[20px] px-[18px] py-4 text-left"
      >
        <span className="w-11 h-11 rounded-[14px] bg-white/20 flex items-center justify-center flex-shrink-0">
          <Plus size={22} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="flex-1 flex flex-col gap-0.5">
          <span className="text-[17px] font-semibold">Add a return visit</span>
          <span className="text-sm text-blue-100">Someone you just spoke with</span>
        </span>
        <ChevronRight size={20} aria-hidden="true" />
      </button>

      <VisitTodayCard onOpenPerson={onOpenPerson} />

      {metToday.length > 0 && (
        <section aria-labelledby="met-today-title" className="bg-white rounded-[20px] px-4 py-[18px] shadow-sm">
          <div className="flex items-baseline justify-between mb-1.5">
            <h2 id="met-today-title" className="text-lg font-semibold text-gray-800 font-libre-franklin">Met today</h2>
            {onOpenPeople && (
              <button type="button" onClick={onOpenPeople} className="h-9 text-sm font-semibold text-blue-700">
                All people
              </button>
            )}
          </div>
          <ul>
            {metToday.map((person, index) => (
              <li key={person.id} className={index < metToday.length - 1 ? 'border-b border-gray-100' : ''}>
                <button
                  type="button"
                  onClick={onOpenPerson ? () => onOpenPerson(person.id) : undefined}
                  className="w-full flex items-center gap-3 py-2.5 text-left"
                >
                  <PersonAvatar status={person.status} />
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-[15px] font-semibold text-gray-800 truncate">{person.name}</span>
                    <span className="text-sm text-gray-600 truncate">{metSummary(person)}</span>
                  </span>
                  <span className="text-[13px] text-gray-600 tabular-nums">{addedAt(person)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CreditSheet isOpen={creditOpen} onClose={() => setCreditOpen(false)} profile={profile} onSaveRecord={onSaveRecord} />
      <PersonSheet isOpen={addingPerson} defaultStatus="return_visit" onClose={() => setAddingPerson(false)} />
    </div>
  );
};

export default LogTab;
