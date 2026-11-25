import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Profile, ServiceActivity, ServiceRecord } from '../types';
import { getAvailableActivities } from '../utils/activityTypes';
import { getDateString, getMonthName } from '../utils/dateUtils';
import { useToast } from './ui/toast';

interface CreditSheetProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: Profile | null;
  onSaveRecord: (record: ServiceRecord) => void;
}

// The credit colours used across the app: amber for school, emerald for volunteer
const KIND_STYLE: Record<string, { on: string; label: string; placeholder: string }> = {
  school: { on: 'border-amber-600 bg-amber-50 text-amber-700', label: 'School', placeholder: 'e.g. Pioneer school' },
  volunteer: { on: 'border-emerald-700 bg-emerald-50 text-emerald-700', label: 'Volunteer', placeholder: 'e.g. Kingdom Hall build' }
};

/**
 * Log hours that were awarded rather than worked.
 *
 * There is no timer here on purpose: a school credit or a volunteer assignment
 * arrives as a figure someone hands you, so the only things to capture are how many
 * hours and which month they belong to. Only the credits this user can be given are
 * offered - school to regular pioneers, volunteer to those who have said they do it.
 */
const CreditSheet: React.FC<CreditSheetProps> = ({ isOpen, onClose, profile, onSaveRecord }) => {
  const { addToast } = useToast();
  const kinds = getAvailableActivities(profile).filter(activity => !activity.timed);
  const [kind, setKind] = useState<ServiceActivity | null>(null);
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [date, setDate] = useState(() => getDateString(new Date()));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setKind(kinds[0]?.id ?? null);
    setHours('');
    setMinutes('');
    setDate(getDateString(new Date()));
    setNote('');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !kind) return null;

  const meta = kinds.find(activity => activity.id === kind)!;

  const handleSave = () => {
    const parsedHours = parseInt(hours, 10) || 0;
    const parsedMinutes = parseInt(minutes, 10) || 0;
    if (parsedMinutes > 59) {
      setError('Minutes must be under 60 - use the hours box for anything longer');
      return;
    }
    if (parsedHours === 0 && parsedMinutes === 0) {
      setError('Enter how many hours you were credited');
      return;
    }
    if (!date) {
      setError('Pick the date this credit was given');
      return;
    }

    onSaveRecord({
      id: crypto.randomUUID(),
      date,
      hours: parsedHours,
      minutes: parsedMinutes,
      type: kind,
      notes: note.trim() || undefined
    });
    addToast({
      type: 'success',
      title: `${meta.label} logged`,
      description: `${parsedHours}h ${parsedMinutes}m added to ${getMonthName(date.slice(0, 7))}`
    });
    onClose();
  };

  const numberClass =
    'w-full h-[52px] pl-3.5 pr-12 bg-gray-50 rounded-xl border border-gray-300 text-xl font-semibold text-gray-800 tabular-nums placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const inputClass =
    'w-full h-12 px-3.5 bg-gray-50 rounded-xl border border-gray-300 text-base text-gray-800 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div role="dialog" aria-modal="true" aria-labelledby="credit-title" className="bg-white w-full max-w-md rounded-t-3xl max-h-[92vh] flex flex-col animate-fadeIn">
        <div className="flex justify-center pt-2">
          <span className="w-10 h-1.5 rounded-full bg-gray-300" />
        </div>
        <div className="flex items-center justify-between pl-5 pr-3 pt-2">
          <h2 id="credit-title" className="text-xl font-bold text-gray-800 font-libre-franklin">Log a credit</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100">
            <X size={22} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pt-3 pb-4 space-y-5">
          {kinds.length > 1 && (
            <div role="group" aria-label="Credit type" className="grid grid-cols-2 gap-2">
              {kinds.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={kind === id}
                  onClick={() => setKind(id)}
                  className={`h-14 rounded-2xl border text-base font-semibold flex items-center justify-center gap-2 ${
                    kind === id ? KIND_STYLE[id].on : 'border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  <Icon size={22} aria-hidden="true" />
                  {KIND_STYLE[id].label}
                </button>
              ))}
            </div>
          )}
          {meta.hint && <p className="text-sm text-gray-600 -mt-2">{meta.hint}</p>}

          {error && <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

          <div className="space-y-1.5">
            <span id="credit-hours-label" className="block text-sm font-semibold text-gray-800">Hours credited</span>
            <div role="group" aria-labelledby="credit-hours-label" className="grid grid-cols-2 gap-2.5">
              <div className="relative">
                <input aria-label="Hours" type="number" inputMode="numeric" min="0" max="999" value={hours} onChange={e => setHours(e.target.value)} placeholder={kind === 'school' ? '30' : '0'} className={numberClass} />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-600">hrs</span>
              </div>
              <div className="relative">
                <input aria-label="Minutes" type="number" inputMode="numeric" min="0" max="59" value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="0" className={numberClass} />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-600">min</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="credit-date" className="block text-sm font-semibold text-gray-800">Date credited</label>
            <input id="credit-date" type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
            {date && <p className="text-[13px] text-gray-600">Counts toward {getMonthName(date.slice(0, 7)).split(' ')[0]}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="credit-note" className="block text-sm font-semibold text-gray-800">Note (optional)</label>
            <input id="credit-note" value={note} onChange={e => setNote(e.target.value)} placeholder={KIND_STYLE[kind].placeholder} className={inputClass} />
          </div>
        </div>

        <div className="px-5 pt-3 pb-6 border-t border-gray-100">
          <button type="button" onClick={handleSave} className="w-full h-[54px] rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-[17px] font-semibold">
            Save credit
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreditSheet;
