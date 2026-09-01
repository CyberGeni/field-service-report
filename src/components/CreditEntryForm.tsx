import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { ServiceActivity, ServiceRecord } from '../types';
import { getActivityMeta } from '../utils/activityTypes';
import { getDateString, getMonthName } from '../utils/dateUtils';
import { useToast } from './ui/toast';

interface CreditEntryFormProps {
  activity: ServiceActivity;
  onSaveRecord: (record: ServiceRecord) => void;
}

/**
 * Logging hours that were awarded rather than worked.
 *
 * There is no timer here on purpose: a school credit or a volunteer assignment
 * arrives as a figure someone hands you, so the only thing to capture is how many
 * hours and which month they belong to.
 */
const CreditEntryForm: React.FC<CreditEntryFormProps> = ({ activity, onSaveRecord }) => {
  const meta = getActivityMeta(activity);
  const { addToast } = useToast();

  const [date, setDate] = useState(() => getDateString(new Date()));
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  // Resetting on a type switch keeps a half-typed school credit from being saved
  // against a volunteer assignment.
  const [lastActivity, setLastActivity] = useState(activity);
  if (lastActivity !== activity) {
    setLastActivity(activity);
    setHours('');
    setMinutes('');
    setDescription('');
    setError('');
  }

  const parsedHours = parseInt(hours, 10) || 0;
  const parsedMinutes = parseInt(minutes, 10) || 0;

  const handleSave = () => {
    if (parsedMinutes > 59) {
      setError('Minutes must be under 60 - use the hours field for anything longer');
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
      type: activity,
      notes: description.trim() || undefined
    });

    addToast({
      type: 'success',
      title: `${meta.label} Logged`,
      description: `${parsedHours}h ${parsedMinutes}m added to ${getMonthName(date.slice(0, 7))}`
    });

    setHours('');
    setMinutes('');
    setDescription('');
    setError('');
  };

  return (
    <div className="bg-white rounded-xl p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-1">Log {meta.label}</h3>
      {meta.hint && <p className="text-sm text-gray-500 mb-4">{meta.hint}</p>}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="credit-hours" className="block text-sm font-medium text-gray-700 mb-2">
            Hours credited
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <input
                id="credit-hours"
                type="number"
                inputMode="numeric"
                min="0"
                max="999"
                value={hours}
                onChange={e => setHours(e.target.value)}
                placeholder="0"
                className="w-full p-3 pr-12 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors tabular-nums"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                hrs
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="59"
                value={minutes}
                onChange={e => setMinutes(e.target.value)}
                placeholder="0"
                aria-label="Minutes credited"
                className="w-full p-3 pr-12 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors tabular-nums"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                min
              </span>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="credit-date" className="block text-sm font-medium text-gray-700 mb-2">
            Date credited
          </label>
          <input
            id="credit-date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full p-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
          />
          {date && (
            <p className="text-xs text-gray-500 mt-1.5">
              Counts toward {getMonthName(date.slice(0, 7))}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="credit-description"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            What it was for <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="credit-description"
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={
              activity === 'school'
                ? 'Pioneer School'
                : 'Kingdom Hall build - Springfield'
            }
            className="w-full p-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors"
        >
          <Plus size={18} />
          <span>Add Credit</span>
        </button>
      </div>
    </div>
  );
};

export default CreditEntryForm;
