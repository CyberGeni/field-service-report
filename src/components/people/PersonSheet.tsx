import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { PersonStatus, Student, StudentInput } from '../../types';
import { useStudents } from '../../hooks/useStudents';
import { PhotoField } from './PersonBits';
import { getDateString } from '../../utils/dateUtils';
import {
  WEEKDAYS,
  WEEKDAYS_MONDAY_FIRST,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  WEEKEND,
  addDays,
  formatShortDate,
  nextWeekday,
  parseLocalDate
} from '../../utils/people';

interface PersonSheetProps {
  isOpen: boolean;
  onClose: () => void;
  // Set to edit someone; left out to add someone new
  person?: Student | null;
  // What a new person starts as
  defaultStatus?: PersonStatus;
  onSaved?: (person: Student) => void;
}

const TIMES = ['Morning', 'Afternoon', 'Evening'];

interface FormState {
  name: string;
  address: string;
  status: PersonStatus;
  publication_left: string;
  preferred_days: number[];
  preferred_time: string;
  next_visit_date: string;
  last_study_notes: string;
  date_met: string;
  place_stopped: string;
  last_visit_date: string;
}

const emptyForm = (status: PersonStatus): FormState => ({
  name: '',
  address: '',
  status,
  publication_left: '',
  preferred_days: [],
  preferred_time: '',
  next_visit_date: '',
  last_study_notes: '',
  date_met: getDateString(new Date()),
  place_stopped: '',
  last_visit_date: ''
});

const fromPerson = (person: Student): FormState => ({
  name: person.name,
  address: person.address,
  status: person.status,
  publication_left: person.publication_left ?? '',
  preferred_days: person.preferred_days,
  preferred_time: person.preferred_time ?? '',
  next_visit_date: person.next_visit_date ?? '',
  last_study_notes: person.last_study_notes ?? '',
  date_met: person.date_met,
  place_stopped: person.place_stopped ?? '',
  last_visit_date: person.last_visit_date ?? ''
});

// Selected and unselected looks for the two kinds of choice on the sheet
const chipClass = (on: boolean) =>
  `min-h-[44px] px-3.5 rounded-xl text-[15px] font-semibold border transition-colors ${
    on ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
  }`;

const tileClass = (on: boolean) =>
  `h-11 rounded-xl text-sm font-semibold border transition-colors ${
    on ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
  }`;

const inputClass =
  'w-full h-12 px-3.5 bg-gray-50 rounded-xl border border-gray-300 text-base text-gray-800 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent';

/**
 * Add or edit a return visit or study.
 *
 * Built for the doorstep first: a name is all it insists on, every other answer is a
 * tap, and it saves on the phone with or without a signal. The fields a study needs
 * beyond that (date met, where the study has got to) are there too, but only shown
 * once they apply.
 */
const PersonSheet: React.FC<PersonSheetProps> = ({ isOpen, onClose, person, defaultStatus = 'return_visit', onSaved }) => {
  const { students, saveStudent, updateStudent, setPhoto, removePhoto } = useStudents();
  // A photo taken here is kept aside until Save, so closing the sheet throws it away
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultStatus));
  const [pickingDate, setPickingDate] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(person);
  const today = getDateString(new Date());

  // Publications this user has left before, suggested as they type
  const publications = useMemo(
    () => [...new Set(students.map(student => student.publication_left).filter((pub): pub is string => Boolean(pub)))],
    [students]
  );

  useEffect(() => {
    if (!isOpen) return;
    const initial = person ? fromPerson(person) : emptyForm(defaultStatus);
    setForm(initial);
    setPickingDate(false);
    setError('');
    setSaving(false);
    setPendingPhoto(null);
    setPhotoRemoved(false);
    // Straight to the name: at a door every second counts
    if (!person) setTimeout(() => nameRef.current?.focus(), 50);
    // Only on opening - re-running when the list of people changes would wipe the form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, person?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const toggleDay = (day: number) =>
    set('preferred_days', form.preferred_days.includes(day)
      ? form.preferred_days.filter(existing => existing !== day)
      : [...form.preferred_days, day]);

  const sameDays = (group: number[]) =>
    form.preferred_days.length === group.length && group.every(day => form.preferred_days.includes(day));

  // "Go back" suggestions: the next of their usual days, then a week or two out
  const nextUsualDay = form.preferred_days.length
    ? form.preferred_days.map(day => nextWeekday(today, day)).sort()[0]
    : null;
  const goBackOptions = [
    ...(nextUsualDay ? [{ label: `Next ${WEEKDAY_SHORT[parseLocalDate(nextUsualDay).getDay()]}`, date: nextUsualDay }] : []),
    { label: 'In 1 week', date: addDays(today, 7) },
    { label: 'In 2 weeks', date: addDays(today, 14) }
  ].filter((option, index, all) => all.findIndex(other => other.date === option.date) === index);
  const nextDateIsCustom = Boolean(form.next_visit_date) && !goBackOptions.some(option => option.date === form.next_visit_date);

  const customTime = form.preferred_time && !TIMES.includes(form.preferred_time) ? form.preferred_time : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Add a name so you can find them again');
      nameRef.current?.focus();
      return;
    }

    setSaving(true);
    setError('');
    try {
      const input: StudentInput = {
        name: form.name,
        address: form.address,
        status: form.status,
        publication_left: form.publication_left,
        preferred_days: form.preferred_days,
        preferred_time: form.preferred_time,
        next_visit_date: form.next_visit_date,
        last_study_notes: form.last_study_notes,
        date_met: form.date_met || today,
        place_stopped: form.place_stopped,
        last_visit_date: form.last_visit_date
      };
      const saved = person ? await updateStudent(person.id, input) : await saveStudent(input);
      if (pendingPhoto) {
        // Never lose the person over a photo that could not be processed
        await setPhoto(saved.id, pendingPhoto).catch(err => console.error('Could not save photo:', err));
      } else if (photoRemoved) {
        await removePhoto(saved.id);
      }
      onSaved?.(saved);
      onClose();
    } catch (err) {
      console.error('Could not save person:', err);
      setError('Could not save. Please try again.');
      setSaving(false);
    }
  };

  const title = isEdit
    ? `Edit ${form.status === 'study' ? 'study' : 'return visit'}`
    : form.status === 'study' ? 'New Bible study' : 'New return visit';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-sheet-title"
        className="bg-white w-full max-w-md rounded-t-3xl max-h-[92vh] flex flex-col animate-fadeIn"
      >
        <div className="flex justify-center pt-2">
          <span className="w-10 h-1.5 rounded-full bg-gray-300" />
        </div>

        <div className="flex items-center justify-between pl-5 pr-3 pt-2 pb-1">
          <h2 id="person-sheet-title" className="text-xl font-bold text-gray-800 font-libre-franklin">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="overflow-y-auto px-5 pt-2 pb-4 space-y-5">
            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
            )}

            {/* What they are - only worth asking when it is not already obvious */}
            {(isEdit || defaultStatus === 'study') && (
              <div role="group" aria-label="Type" className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl">
                {(['return_visit', 'study'] as PersonStatus[]).map(status => (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={form.status === status}
                    onClick={() => set('status', status)}
                    className={`h-11 rounded-lg text-[15px] font-semibold ${
                      form.status === status ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'
                    }`}
                  >
                    {status === 'study' ? 'Bible study' : 'Return visit'}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="person-name" className="block text-sm font-semibold text-gray-800">Name</label>
              <input
                id="person-name"
                ref={nameRef}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                autoComplete="off"
                className={inputClass}
                placeholder="A name or how you will remember them"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="person-where" className="block text-sm font-semibold text-gray-800">Where</label>
              <input
                id="person-where"
                value={form.address}
                onChange={e => set('address', e.target.value)}
                autoComplete="off"
                className={inputClass}
                placeholder="Street, flat number or a landmark"
              />
              <div className="pt-1">
                <PhotoField
                  path={photoRemoved ? undefined : person?.photo_path}
                  pending={pendingPhoto}
                  onPick={file => {
                    setPendingPhoto(file);
                    setPhotoRemoved(false);
                  }}
                  onRemove={() => {
                    setPendingPhoto(null);
                    setPhotoRemoved(true);
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="person-publication" className="block text-sm font-semibold text-gray-800">
                {form.status === 'study' ? 'Studying' : 'Publication left with them'}
              </label>
              <input
                id="person-publication"
                value={form.publication_left}
                onChange={e => set('publication_left', e.target.value)}
                list="person-publication-suggestions"
                autoComplete="off"
                className={inputClass}
                placeholder={form.status === 'study' ? 'The publication you study from' : 'A tract, magazine or brochure'}
              />
              {/* What they have left before, offered as the field is typed in */}
              <datalist id="person-publication-suggestions">
                {publications.map(pub => <option key={pub} value={pub} />)}
              </datalist>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">Usually home</span>
                <span className="flex">
                  <button
                    type="button"
                    onClick={() => set('preferred_days', sameDays(WEEKDAYS) ? [] : WEEKDAYS)}
                    className="h-8 px-2 text-sm font-semibold text-blue-700"
                  >
                    Weekdays
                  </button>
                  <button
                    type="button"
                    onClick={() => set('preferred_days', sameDays(WEEKEND) ? [] : WEEKEND)}
                    className="h-8 px-2 text-sm font-semibold text-blue-700"
                  >
                    Weekends
                  </button>
                </span>
              </div>
              <div role="group" aria-label="Days usually home" className="grid grid-cols-7 gap-1.5">
                {WEEKDAYS_MONDAY_FIRST.map(day => {
                  const on = form.preferred_days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={on}
                      aria-label={WEEKDAY_LONG[day]}
                      onClick={() => toggleDay(day)}
                      className={tileClass(on)}
                    >
                      {WEEKDAY_SHORT[day].slice(0, 2)}
                    </button>
                  );
                })}
              </div>
              <div role="group" aria-label="Best time" className="grid grid-cols-3 gap-1.5">
                {TIMES.map(time => {
                  const on = form.preferred_time === time;
                  return (
                    <button
                      key={time}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set('preferred_time', on ? '' : time)}
                      className={tileClass(on)}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
              {customTime && (
                <p className="text-sm text-gray-600">
                  Best time: <span className="font-semibold">{customTime}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <span className="block text-sm font-semibold text-gray-800">Go back</span>
              <div className="flex flex-wrap gap-2">
                {goBackOptions.map(option => {
                  const on = form.next_visit_date === option.date;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setPickingDate(false);
                        set('next_visit_date', on ? '' : option.date);
                      }}
                      className={chipClass(on)}
                    >
                      {option.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={pickingDate || nextDateIsCustom}
                  onClick={() => setPickingDate(true)}
                  className={chipClass(pickingDate || nextDateIsCustom)}
                >
                  {nextDateIsCustom ? formatShortDate(form.next_visit_date) : 'Pick a date'}
                </button>
              </div>
              {(pickingDate || nextDateIsCustom) && (
                <input
                  type="date"
                  aria-label="Next visit date"
                  value={form.next_visit_date}
                  min={today}
                  onChange={e => set('next_visit_date', e.target.value)}
                  className={inputClass}
                />
              )}
              {form.next_visit_date && (
                <p className="text-sm text-gray-600">
                  On your list for <span className="font-semibold">{formatShortDate(form.next_visit_date)}</span>
                  {' · '}
                  <button
                    type="button"
                    onClick={() => {
                      setPickingDate(false);
                      set('next_visit_date', '');
                    }}
                    className="font-semibold text-blue-700 underline underline-offset-2"
                  >
                    No set date
                  </button>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="person-notes" className="block text-sm font-semibold text-gray-800">
                {form.status === 'study' ? 'Notes' : 'What you talked about'}
              </label>
              <textarea
                id="person-notes"
                rows={3}
                value={form.last_study_notes}
                onChange={e => set('last_study_notes', e.target.value)}
                className="w-full px-3.5 py-3 bg-gray-50 rounded-xl border border-gray-300 text-base text-gray-800 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Their question, the scripture you read, what to bring next time"
              />
            </div>

            {/* The rest only matters once they are studying, or when tidying a record */}
            {(form.status === 'study' || isEdit) && (
              <div className="space-y-4 pt-1">
                {form.status === 'study' && (
                  <div className="space-y-1.5">
                    <label htmlFor="person-place" className="block text-sm font-semibold text-gray-800">Where the study is up to</label>
                    <input
                      id="person-place"
                      value={form.place_stopped}
                      onChange={e => set('place_stopped', e.target.value)}
                      className={inputClass}
                      placeholder="e.g. Lesson 12, point 3"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="person-met" className="block text-sm font-semibold text-gray-800">Date met</label>
                    <input
                      id="person-met"
                      type="date"
                      value={form.date_met}
                      max={today}
                      onChange={e => set('date_met', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  {isEdit && (
                    <div className="space-y-1.5">
                      <label htmlFor="person-last" className="block text-sm font-semibold text-gray-800">Last visit</label>
                      <input
                        id="person-last"
                        type="date"
                        value={form.last_visit_date}
                        max={today}
                        onChange={e => set('last_visit_date', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="px-5 pt-3 pb-6 border-t border-gray-100 space-y-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full h-[54px] rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-[17px] font-semibold"
            >
              {isEdit ? 'Save changes' : form.status === 'study' ? 'Save study' : 'Save return visit'}
            </button>
            <p className="text-center text-[13px] text-gray-600">Saves on your phone even with no signal</p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PersonSheet;
