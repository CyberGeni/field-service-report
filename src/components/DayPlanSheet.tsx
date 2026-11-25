import React, { useMemo, useRef, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { FieldDayOverride, Profile, ServiceRecord, Settings } from '../types';
import { generateFieldServicePlan } from '../utils/calculations';
import { formatHoursMinutesShort } from '../utils/dateUtils';
import { getDayOverride, getFieldDayOn, getUsualFieldDay, withDayOverride } from '../utils/fieldDays';
import { parseLocalDate } from '../utils/people';
import { useToast } from './ui/toast';
import BottomSheet from './ui/BottomSheet';
import Segmented from './ui/Segmented';

interface DayPlanSheetProps {
  // The day being changed, YYYY-MM-DD; null keeps the sheet closed
  date: string | null;
  records: ServiceRecord[];
  settings: Settings;
  profile?: Profile | null;
  onUpdateSettings: (settings: Partial<Settings>) => Promise<void> | void;
  onClose: () => void;
}

type Choice = 'out' | 'off';

const typeLabel = (type: 'h2h' | 'cart') => (type === 'h2h' ? 'House to house' : 'Cart witnessing');

/**
 * Change one date without touching the usual week: take a field day off, add a day
 * that is not normally one, or give a day more or less time than usual.
 *
 * The plan is rebuilt with the change before it is saved, so the sheet can say what
 * it does to the month - where a day off's hours go, or that the other days cannot
 * carry them and an extra day is needed.
 */
const DayPlanSheet: React.FC<DayPlanSheetProps> = ({ date, records, settings, profile, onUpdateSettings, onClose }) => {
  const { addToast } = useToast();
  // Closing clears `date`, but the sheet is still sliding away for a moment after -
  // keep showing the day it was opened for until it has gone
  const lastDate = useRef<string | null>(null);
  if (date) lastDate.current = date;
  const day = date ?? lastDate.current;

  const usual = day ? getUsualFieldDay(settings, day) : null;
  const existing = day ? getDayOverride(settings, day) : null;

  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const [choice, setChoice] = useState<Choice>('off');
  const [hours, setHours] = useState(2);
  const [type, setType] = useState<'h2h' | 'cart'>('h2h');
  const [note, setNote] = useState('');

  // Reset for each date while rendering rather than in an effect, so the sheet never
  // shows one frame of the previous day's choice before switching
  if (date !== openedFor) {
    setOpenedFor(date);
    if (date) {
      const current = getFieldDayOn(settings, date);
      // Opening a usual field day is nearly always to take it off; opening any other
      // day is nearly always to add it - so each starts on the change it is opened for
      setChoice(existing ? existing.kind : usual ? 'off' : 'out');
      setHours(current?.potentialHours ?? usual?.potentialHours ?? 2);
      setType(current?.type ?? usual?.type ?? 'h2h');
      setNote(existing?.note ?? '');
    }
  }

  const draft: FieldDayOverride | null = useMemo(() => {
    if (!day) return null;
    const trimmed = note.trim() || undefined;
    return choice === 'off'
      ? { date: day, kind: 'off', note: trimmed }
      : { date: day, kind: 'out', type, potentialHours: hours, note: trimmed };
  }, [day, choice, hours, type, note]);

  // What the change does to the month, worked out from the plan before and after
  const effect = useMemo(() => {
    if (!day || !draft) return null;
    const month = day.slice(0, 7);
    const before = generateFieldServicePlan(records, settings, month, profile);
    const after = generateFieldServicePlan(
      records,
      { ...settings, dayOverrides: withDayOverride(settings, day, draft) },
      month,
      profile
    );
    const plannedBefore = before.days.find(planned => planned.date === day)?.plannedHours ?? 0;
    const plannedAfter = after.days.find(planned => planned.date === day)?.plannedHours ?? 0;
    const newShortfall = after.shortfallHours - before.shortfallHours;

    if (choice === 'off') {
      if (plannedBefore <= 0) return { tone: 'neutral' as const, text: 'Your plan was not counting on this day, so nothing else changes.' };
      if (newShortfall > 1e-6) {
        return {
          tone: 'warn' as const,
          text: `Your other days cannot take all of its ${formatHoursMinutesShort(plannedBefore)}: you would end the month ${formatHoursMinutesShort(after.shortfallHours)} short. Add an extra day to make it up.`
        };
      }
      return { tone: 'good' as const, text: `Its ${formatHoursMinutesShort(plannedBefore)} moves onto your other field days.` };
    }

    if (plannedAfter <= 0) return { tone: 'neutral' as const, text: 'Your plan does not need this day at the moment.' };
    if (after.shortfallHours < before.shortfallHours - 1e-6) {
      return {
        tone: 'good' as const,
        text: after.shortfallHours > 1e-6
          ? `Plan ${formatHoursMinutesShort(plannedAfter)} here. You would still be ${formatHoursMinutesShort(after.shortfallHours)} short this month.`
          : `Plan ${formatHoursMinutesShort(plannedAfter)} here - that covers the month.`
      };
    }
    return { tone: 'good' as const, text: `Plan ${formatHoursMinutesShort(plannedAfter)} here, which eases your other days.` };
  }, [day, draft, choice, records, settings, profile]);

  if (!day || !draft) return null;

  const save = async (override: FieldDayOverride | null) => {
    await onUpdateSettings({ dayOverrides: withDayOverride(settings, day, override) });
    addToast({
      type: 'success',
      title: override?.kind === 'off' ? 'Day off saved' : override ? 'Day saved' : 'Back to your usual week',
      description: 'Your plan for the month has been updated',
      duration: 3000
    });
    onClose();
  };

  const dayLabel = parseLocalDate(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const choices: { id: Choice; label: string }[] = usual
    ? [{ id: 'out', label: 'Going out' }, { id: 'off', label: 'Not going out' }]
    : [{ id: 'off', label: 'Not going out' }, { id: 'out', label: 'Going out' }];
  const toneClass = {
    good: 'bg-green-50 border-green-200 text-green-800',
    warn: 'bg-amber-50 border-amber-200 text-amber-800',
    neutral: 'bg-gray-50 border-gray-200 text-gray-700'
  };

  return (
    <BottomSheet open={date !== null} onClose={onClose} labelledBy="day-plan-title">
        <div className="flex items-start justify-between pl-5 pr-3 pt-1">
          <div>
            <h2 id="day-plan-title" className="text-xl font-bold text-gray-800 font-libre-franklin">{dayLabel}</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              {usual ? `Usually ${typeLabel(usual.type).toLowerCase()} · ${formatHoursMinutesShort(usual.potentialHours)}` : 'Not one of your usual field service days'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100">
            <X size={22} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pt-4 pb-4 space-y-5">
          <Segmented<Choice>
            label="This day"
            value={choice}
            onChange={setChoice}
            options={choices.map(option => ({ value: option.id, label: option.label }))}
          />

          {choice === 'out' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span id="day-hours-label" className="text-sm font-semibold text-gray-800">Time you have</span>
                <div className="flex items-center gap-2" role="group" aria-labelledby="day-hours-label">
                  <button
                    type="button"
                    onClick={() => setHours(h => Math.max(0.5, h - 0.5))}
                    aria-label="Half an hour less"
                    className="w-11 h-11 rounded-xl border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-50"
                  >
                    <Minus size={18} />
                  </button>
                  <span className="w-20 text-center text-lg font-semibold text-gray-800 tabular-nums" aria-live="polite">
                    {formatHoursMinutesShort(hours)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setHours(h => Math.min(12, h + 0.5))}
                    aria-label="Half an hour more"
                    className="w-11 h-11 rounded-xl border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-50"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
              <div role="group" aria-label="Service type" className="grid grid-cols-2 gap-1.5">
                {(['h2h', 'cart'] as const).map(option => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={type === option}
                    onClick={() => setType(option)}
                    className={`h-11 rounded-xl text-sm font-semibold border ${
                      type === option ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700'
                    }`}
                  >
                    {typeLabel(option)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="day-note" className="block text-sm font-semibold text-gray-800">
              {choice === 'off' ? 'Why (optional)' : 'Note (optional)'}
            </label>
            <input
              id="day-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={choice === 'off' ? 'e.g. Wedding, convention' : 'e.g. Making up for Saturday'}
              className="w-full h-12 px-3.5 bg-gray-50 rounded-xl border border-gray-300 text-base text-gray-800 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {effect && (
            <p className={`p-3 rounded-xl border text-sm ${toneClass[effect.tone]}`} aria-live="polite">{effect.text}</p>
          )}
        </div>

        <div className="px-5 pt-3 pb-6 border-t border-gray-100 space-y-2">
          <button
            type="button"
            onClick={() => save(draft)}
            className="w-full h-[54px] rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-[17px] font-semibold"
          >
            {choice === 'off' ? 'Save day off' : 'Save'}
          </button>
          {existing && (
            <button type="button" onClick={() => save(null)} className="w-full h-11 rounded-xl text-[15px] font-semibold text-gray-700 hover:bg-gray-100">
              Back to my usual week
            </button>
          )}
        </div>
    </BottomSheet>
  );
};

export default DayPlanSheet;
