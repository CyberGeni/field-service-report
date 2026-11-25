import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  ChevronRight,
  Clock,
  Edit,
  GraduationCap,
  MapPin,
  Plus,
  Search,
  Trash2,
  Users,
  X
} from 'lucide-react';
import { PersonStatus, Student, StudentVisit } from '../types';
import { useStudents } from '../hooks/useStudents';
import { getDateString } from '../utils/dateUtils';
import {
  formatPreferredDays,
  formatShortDate,
  getDueReason,
  getPersonStatus,
  parseLocalDate,
  statusToneClass,
  timeSince
} from '../utils/people';
import PersonSheet from './people/PersonSheet';
import { PersonAvatar, PersonPhoto, PhotoField } from './people/PersonBits';
import { useToast } from './ui/toast';

// Read as local calendar days: `new Date('2026-11-26')` is UTC midnight, which west
// of UTC is still the 25th and would print as the day before
const formatDayMonth = (date: string) =>
  parseLocalDate(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

const formatVisitDate = (date: string) =>
  parseLocalDate(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

const kindLabel = (status: PersonStatus) => (status === 'study' ? 'Bible study' : 'Return visit');

/** "Wed & Sat · evening", or null when they gave no days or time. */
const describeAvailability = (person: Student): string | null => {
  const days = formatPreferredDays(person.preferred_days);
  const time = person.preferred_time?.toLowerCase();
  if (days && time) return `${days} · ${time}`;
  return days ?? (time ? `Best in the ${time}` : null);
};

// ── Record or edit a call ────────────────────────────────────────────────────

interface VisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: Student;
  visit?: StudentVisit | null;
}

const VisitModal: React.FC<VisitModalProps> = ({ isOpen, onClose, person, visit }) => {
  const { saveStudentVisit, updateStudentVisit, deleteStudentVisit, updateStudent } = useStudents();
  const today = getDateString(new Date());
  const [visitDate, setVisitDate] = useState(today);
  const [placeStopped, setPlaceStopped] = useState('');
  const [notes, setNotes] = useState('');
  const [nextVisit, setNextVisit] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setVisitDate(visit?.visit_date ?? today);
    setPlaceStopped(visit?.place_stopped ?? '');
    setNotes(visit?.notes ?? '');
    // A date they asked for that this call has now met is spent; offer a fresh one
    setNextVisit(person.next_visit_date && person.next_visit_date > today ? person.next_visit_date : '');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, visit?.id]);

  if (!isOpen) return null;

  const isStudy = visit ? visit.is_study : person.status === 'study';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!visitDate) {
      setError('Pick the day of the visit');
      return;
    }
    try {
      if (visit) {
        await updateStudentVisit(visit.id, { visit_date: visitDate, place_stopped: placeStopped, notes });
      } else {
        await saveStudentVisit({ student_id: person.id, visit_date: visitDate, place_stopped: placeStopped, notes });
      }
      if ((nextVisit || '') !== (person.next_visit_date ?? '')) {
        await updateStudent(person.id, { next_visit_date: nextVisit }, { silent: true });
      }
      onClose();
    } catch (err) {
      console.error('Could not save visit:', err);
      setError('Could not save the visit. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (!visit || !window.confirm('Delete this visit?')) return;
    await deleteStudentVisit(visit.id);
    onClose();
  };

  const inputClass =
    'w-full h-12 px-3.5 bg-gray-50 rounded-xl border border-gray-300 text-base text-gray-800 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div role="dialog" aria-modal="true" aria-labelledby="visit-modal-title" className="bg-white w-full max-w-md rounded-t-3xl max-h-[92vh] flex flex-col animate-fadeIn">
        <div className="flex justify-center pt-2">
          <span className="w-10 h-1.5 rounded-full bg-gray-300" />
        </div>
        <div className="flex items-start justify-between pl-5 pr-3 pt-2">
          <div>
            <h2 id="visit-modal-title" className="text-xl font-bold text-gray-800 font-libre-franklin">
              {visit ? 'Edit visit' : 'Record visit'}
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              {person.name} · {isStudy ? 'counts as a Bible study' : 'return visit'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="overflow-y-auto px-5 pt-4 pb-4 space-y-4">
            {error && <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}
            <div className="space-y-1.5">
              <label htmlFor="visit-date" className="block text-sm font-semibold text-gray-800">Visit date</label>
              <input id="visit-date" type="date" value={visitDate} max={today} onChange={e => setVisitDate(e.target.value)} className={inputClass} required />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="visit-place" className="block text-sm font-semibold text-gray-800">
                {isStudy ? 'Where you stopped' : 'What you covered'}
              </label>
              <input
                id="visit-place"
                value={placeStopped}
                onChange={e => setPlaceStopped(e.target.value)}
                className={inputClass}
                placeholder={isStudy ? 'e.g. Lesson 12, point 3' : 'e.g. Read Psalm 37:29'}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="visit-notes" className="block text-sm font-semibold text-gray-800">Notes</label>
              <textarea
                id="visit-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-3 bg-gray-50 rounded-xl border border-gray-300 text-base text-gray-800 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="What you discussed, what to bring next time"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="visit-next" className="block text-sm font-semibold text-gray-800">Next visit (optional)</label>
              <input id="visit-next" type="date" value={nextVisit} min={today} onChange={e => setNextVisit(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="px-5 pt-3 pb-6 border-t border-gray-100 space-y-2">
            <button type="submit" className="w-full h-[54px] rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-[17px] font-semibold">
              {visit ? 'Save visit' : 'Record visit'}
            </button>
            {visit && (
              <button type="button" onClick={handleDelete} className="w-full h-11 rounded-xl text-[15px] font-semibold text-red-600 hover:bg-red-50">
                Delete this visit
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Delete ───────────────────────────────────────────────────────────────────

const DeleteConfirmModal: React.FC<{ person: Student | null; onClose: () => void; onConfirm: () => void }> = ({
  person,
  onClose,
  onConfirm
}) => {
  if (!person) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div role="alertdialog" aria-modal="true" aria-labelledby="delete-title" className="bg-white rounded-2xl max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-red-100 p-2 rounded-lg">
            <Trash2 size={20} className="text-red-600" />
          </div>
          <h3 id="delete-title" className="text-lg font-semibold text-gray-800">Delete {kindLabel(person.status).toLowerCase()}</h3>
        </div>
        <p className="text-gray-600 mb-6">
          Delete <strong>{person.name}</strong> and every visit recorded with them? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 h-12 rounded-xl font-semibold">Cancel</button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-700 text-white h-12 rounded-xl font-semibold">Delete</button>
        </div>
      </div>
    </div>
  );
};

// ── One person ───────────────────────────────────────────────────────────────

interface PersonDetailsProps {
  person: Student;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRecordVisit: () => void;
  onEditVisit: (visit: StudentVisit) => void;
}

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <div className="flex items-start gap-3">
    <span className="text-gray-500 mt-0.5 flex-shrink-0">{icon}</span>
    <span className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[13px] font-semibold text-gray-500">{label}</span>
      <span className="text-[15px] text-gray-800 break-words">{children}</span>
    </span>
  </div>
);

const PersonDetails: React.FC<PersonDetailsProps> = ({ person, onBack, onEdit, onDelete, onRecordVisit, onEditVisit }) => {
  const { visits, updateStudent, setPhoto, removePhoto } = useStudents();
  const { addToast } = useToast();
  const today = getDateString(new Date());
  const isStudy = person.status === 'study';
  const theirVisits = useMemo(
    () =>
      visits
        .filter(visit => visit.student_id === person.id)
        .sort((a, b) => b.visit_date.localeCompare(a.visit_date) || b.created_at.localeCompare(a.created_at)),
    [visits, person.id]
  );

  const reason = getDueReason(person, today);
  const availability = describeAvailability(person);
  const since = timeSince(person.last_visit_date, today);

  // The box at the top says whether to go today, and why - or when they are next due
  const dueBox =
    reason === 'overdue'
      ? { tone: 'bg-amber-50 text-amber-800', text: `Overdue · was due ${formatShortDate(person.next_visit_date!)}` }
      : reason === 'promised'
        ? { tone: 'bg-blue-50 text-blue-800', text: 'Due today · they asked you to come back today' }
        : reason === 'usualDay'
          ? { tone: 'bg-blue-50 text-blue-800', text: `Due today · usually home today${person.preferred_time ? `, ${person.preferred_time.toLowerCase()}` : ''}` }
          : person.next_visit_date && person.next_visit_date > today
            ? { tone: 'bg-gray-50 text-gray-700', text: `Next visit ${formatShortDate(person.next_visit_date)}` }
            : null;

  const startStudy = async () => {
    await updateStudent(person.id, { status: 'study' }, { silent: true });
    addToast({ type: 'success', title: 'Study started', description: `${person.name} is now one of your Bible studies` });
  };

  const takePhoto = async (file: File) => {
    try {
      await setPhoto(person.id, file);
    } catch (err) {
      console.error('Could not save photo:', err);
      addToast({ type: 'error', title: 'Photo not saved', description: 'That photo could not be used. Please try another.' });
    }
  };

  return (
    <div className="space-y-4 -mt-4">
      <div className="flex items-center justify-between -mx-2">
        <button onClick={onBack} aria-label="Back to people" className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-700 hover:bg-gray-200">
          <ArrowLeft size={22} />
        </button>
        <span className="flex">
          <button onClick={onEdit} aria-label={`Edit ${person.name}`} className="w-11 h-11 flex items-center justify-center rounded-xl text-blue-700 hover:bg-blue-50">
            <Edit size={20} />
          </button>
          <button onClick={onDelete} aria-label={`Delete ${person.name}`} className="w-11 h-11 flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50">
            <Trash2 size={20} />
          </button>
        </span>
      </div>

      <div className="flex items-center gap-3.5 px-1">
        <PersonAvatar name={person.name} status={person.status} size="lg" />
        <div className="min-w-0 flex flex-col gap-1 items-start">
          <h1 className="text-[26px] leading-tight font-bold text-gray-800 font-libre-franklin break-words">{person.name}</h1>
          <span className={`text-[13px] font-semibold px-2.5 py-0.5 rounded-full ${isStudy ? 'text-purple-700 bg-purple-100' : 'text-blue-700 bg-blue-100'}`}>
            {kindLabel(person.status)}
          </span>
        </div>
      </div>

      <section className="bg-white rounded-2xl p-4 space-y-3.5 shadow-sm">
        {dueBox && (
          <p className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[15px] font-semibold ${dueBox.tone}`}>
            <CalendarClock size={18} className="flex-shrink-0" aria-hidden="true" />
            {dueBox.text}
          </p>
        )}
        <div className={`grid gap-2 ${isStudy ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <button onClick={onRecordVisit} className="h-12 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-semibold flex items-center justify-center gap-2">
            <Plus size={18} />
            Record visit
          </button>
          {/* The step this whole feature exists for: a return visit who starts studying
              keeps their history rather than being re-entered */}
          {!isStudy && (
            <button onClick={startStudy} className="h-12 rounded-2xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-semibold flex items-center justify-center gap-2">
              <GraduationCap size={18} />
              Start a study
            </button>
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl p-4 space-y-4 shadow-sm">
        {person.photo_path && <PersonPhoto path={person.photo_path} className="w-full h-44 rounded-xl" />}
        <PhotoField
          path={person.photo_path}
          pending={null}
          variant={person.photo_path ? 'actions' : 'full'}
          onPick={takePhoto}
          onRemove={() => removePhoto(person.id)}
        />
        <InfoRow icon={<MapPin size={18} />} label="Where">
          {person.address || <span className="text-gray-500">No address yet</span>}
        </InfoRow>
        {availability && <InfoRow icon={<Clock size={18} />} label="Usually home">{availability}</InfoRow>}
        {person.publication_left && (
          <InfoRow icon={<BookOpen size={18} />} label={isStudy ? 'Studying' : 'Publication left with them'}>
            {person.publication_left}
          </InfoRow>
        )}
        {person.place_stopped && (
          <InfoRow icon={<BookOpen size={18} />} label={isStudy ? 'Up to' : 'Last covered'}>{person.place_stopped}</InfoRow>
        )}
        <div className="grid grid-cols-2 gap-3 pt-3.5 border-t border-gray-100">
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-gray-500">Met</span>
            <span className="text-[15px] text-gray-800">{formatDayMonth(person.date_met)}</span>
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-gray-500">Last visit</span>
            <span className="text-[15px] text-gray-800">{person.last_visit_date ? formatDayMonth(person.last_visit_date) : 'Not yet'}</span>
            {since && <span className="text-[13px] text-gray-500">{since}</span>}
          </span>
        </div>
      </section>

      {person.last_study_notes && (
        <section className="bg-white rounded-2xl p-4 space-y-2 shadow-sm">
          <h2 className="text-[17px] font-semibold text-gray-800 font-libre-franklin">Latest notes</h2>
          <p className="text-[15px] leading-[22px] text-gray-700 whitespace-pre-line">{person.last_study_notes}</p>
        </section>
      )}

      <section className="bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="text-[17px] font-semibold text-gray-800 font-libre-franklin mb-2">Visits</h2>
        <ul>
          {theirVisits.map((visit, index) => (
            <li key={visit.id} className="border-b border-gray-100">
              <button onClick={() => onEditVisit(visit)} className="w-full text-left flex gap-3 py-2.5 hover:bg-gray-50 rounded-lg">
                <span className={`w-2.5 h-2.5 mt-1.5 rounded-full flex-shrink-0 ${index === 0 ? 'bg-blue-600' : 'bg-gray-300'}`} aria-hidden="true" />
                <span className="flex-1 min-w-0 flex flex-col gap-1">
                  <span className="flex justify-between gap-2">
                    <span className="text-[15px] font-semibold text-gray-800">{formatVisitDate(visit.visit_date)}</span>
                    <span className="text-[13px] text-gray-500 flex-shrink-0">{visit.is_study ? 'Bible study' : 'Return visit'}</span>
                  </span>
                  {(visit.place_stopped || visit.notes) && (
                    <span className="text-sm leading-5 text-gray-600 whitespace-pre-line">
                      {[visit.place_stopped, visit.notes].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {/* Where the history starts */}
          <li className="flex gap-3 py-2.5">
            <span className="w-2.5 h-2.5 mt-1.5 rounded-full flex-shrink-0 bg-gray-300" aria-hidden="true" />
            <span className="flex-1 flex justify-between gap-2">
              <span className="text-[15px] font-semibold text-gray-800">{formatVisitDate(person.date_met)}</span>
              <span className="text-[13px] text-gray-500">First met</span>
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
};

// ── The tab ──────────────────────────────────────────────────────────────────

interface PeopleTabProps {
  // A person to open straight away, e.g. tapped on today's visit list
  openPersonId?: string | null;
  onOpenPersonHandled?: () => void;
}

const PeopleTab: React.FC<PeopleTabProps> = ({ openPersonId, onOpenPersonHandled }) => {
  const { students, loading, deleteStudent } = useStudents();
  const today = getDateString(new Date());
  const returnVisits = students.filter(person => person.status === 'return_visit');
  const studies = students.filter(person => person.status === 'study');

  // Open on return visits once there are any - they are what gets added most
  const [segment, setSegment] = useState<PersonStatus>(() =>
    returnVisits.length > 0 || studies.length === 0 ? 'return_visit' : 'study'
  );
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ person: Student | null } | null>(null);
  const [visitModal, setVisitModal] = useState<{ visit: StudentVisit | null } | null>(null);
  const [toDelete, setToDelete] = useState<Student | null>(null);

  useEffect(() => {
    if (!openPersonId) return;
    const person = students.find(candidate => candidate.id === openPersonId);
    // Hold on to the request until the list has loaded enough to answer it
    if (!person && loading) return;
    if (person) {
      setSegment(person.status);
      setSelectedId(person.id);
    }
    onOpenPersonHandled?.();
  }, [openPersonId, students, loading, onOpenPersonHandled]);

  const selected = selectedId ? students.find(person => person.id === selectedId) ?? null : null;

  // Whoever needs a call soonest first: overdue, due today, then by the date they
  // gave, and everyone with no date in name order after them
  const urgency = (person: Student): string => {
    const reason = getDueReason(person, today);
    if (reason === 'overdue') return `0${person.next_visit_date}`;
    if (reason) return '1';
    return person.next_visit_date && person.next_visit_date > today ? `2${person.next_visit_date}` : '3';
  };
  const query = search.trim().toLowerCase();
  const shown = (segment === 'study' ? studies : returnVisits)
    .filter(person =>
      !query ||
      [person.name, person.address, person.publication_left, person.place_stopped, person.last_study_notes]
        .some(field => field?.toLowerCase().includes(query))
    )
    .sort((a, b) => urgency(a).localeCompare(urgency(b)) || a.name.localeCompare(b.name));

  const confirmDelete = async () => {
    if (!toDelete) return;
    await deleteStudent(toDelete.id);
    if (selectedId === toDelete.id) setSelectedId(null);
    setToDelete(null);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading people...</p>
      </div>
    );
  }

  const lastLine = (person: Student) => {
    const since = timeSince(person.last_visit_date, today);
    if (since) return `Last ${person.status === 'study' ? 'study' : 'visit'} ${since}`;
    const met = timeSince(person.date_met, today);
    return met === 'today' ? 'Met today' : `Met ${met}`;
  };

  return (
    <div className="space-y-4">
      {selected ? (
        <PersonDetails
          person={selected}
          onBack={() => setSelectedId(null)}
          onEdit={() => setSheet({ person: selected })}
          onDelete={() => setToDelete(selected)}
          onRecordVisit={() => setVisitModal({ visit: null })}
          onEditVisit={visit => setVisitModal({ visit })}
        />
      ) : (
        <>
          <div className="pt-2 space-y-1">
            <h1 className="text-[28px] font-bold text-gray-800 font-libre-franklin tracking-tight">People</h1>
            <p className="text-[15px] text-gray-600">Return visits and Bible studies</p>
          </div>

          <div role="group" aria-label="Show" className="grid grid-cols-2 gap-1 bg-gray-200 p-1 rounded-2xl">
            {(['return_visit', 'study'] as PersonStatus[]).map(status => {
              const count = status === 'study' ? studies.length : returnVisits.length;
              const on = segment === status;
              return (
                <button
                  key={status}
                  aria-pressed={on}
                  onClick={() => setSegment(status)}
                  className={`h-11 rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2 ${
                    on ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  {status === 'study' ? 'Studies' : 'Return visits'}
                  {/* In its own pill, so the count never reads as part of the label */}
                  <span
                    className={`min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-bold inline-flex items-center justify-center tabular-nums ${
                      on ? 'bg-blue-100 text-blue-700' : 'bg-gray-300 text-gray-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search people"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, place or notes"
                className="w-full h-12 pl-10 pr-3 bg-white rounded-2xl border border-gray-300 text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setSheet({ person: null })}
              className="bg-blue-600 hover:bg-blue-700 text-white h-12 px-4 rounded-2xl font-semibold flex items-center gap-1.5"
            >
              <Plus size={20} />
              Add
            </button>
          </div>

          {shown.length > 0 ? (
            <ul className="space-y-3">
              {shown.map(person => {
                const status = getPersonStatus(person, today);
                const bookLine =
                  person.status === 'study' && person.place_stopped
                    ? [person.publication_left, person.place_stopped].filter(Boolean).join(' · ')
                    : person.publication_left;
                return (
                  <li key={person.id}>
                    <button
                      onClick={() => setSelectedId(person.id)}
                      className="w-full text-left bg-white rounded-2xl p-4 flex flex-col gap-3.5 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <span className="flex items-center gap-3 w-full">
                        <PersonAvatar name={person.name} status={person.status} />
                        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <span className="text-base font-semibold text-gray-800 truncate">{person.name}</span>
                          <span className={`text-sm truncate ${statusToneClass(status.tone)}`}>{status.text}</span>
                        </span>
                        <ChevronRight size={20} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
                      </span>
                      <span className="ml-[52px] pt-3 border-t border-gray-100 flex flex-col gap-2">
                        {person.address && (
                          <span className="flex items-start gap-2 text-sm leading-5 text-gray-700">
                            <MapPin size={16} className="text-gray-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
                            {person.address}
                          </span>
                        )}
                        {bookLine && (
                          <span className="flex items-start gap-2 text-sm leading-5 text-gray-700">
                            <BookOpen size={16} className="text-gray-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
                            {bookLine}
                          </span>
                        )}
                        <span className="text-[13px] text-gray-500">{lastLine(person)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
              <Users size={48} className="mx-auto mb-4 text-gray-400" aria-hidden="true" />
              {query ? (
                <>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Nobody matches “{search}”</h3>
                  <button onClick={() => setSearch('')} className="text-blue-700 font-semibold">Clear search</button>
                </>
              ) : segment === 'study' ? (
                <>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No Bible studies yet</h3>
                  <p className="text-gray-600">Add one here, or open a return visit and tap “Start a study”.</p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No return visits yet</h3>
                  <p className="text-gray-600 mb-4">Add people you meet in the ministry who you want to see again.</p>
                  <button onClick={() => setSheet({ person: null })} className="bg-blue-600 hover:bg-blue-700 text-white px-6 h-12 rounded-2xl font-semibold">
                    Add a return visit
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      <PersonSheet isOpen={sheet !== null} person={sheet?.person} defaultStatus={segment} onClose={() => setSheet(null)} />

      {selected && (
        <VisitModal isOpen={visitModal !== null} person={selected} visit={visitModal?.visit} onClose={() => setVisitModal(null)} />
      )}

      <DeleteConfirmModal person={toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete} />
    </div>
  );
};

export default PeopleTab;
