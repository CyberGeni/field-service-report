import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CalendarClock,
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
import { formatPreferredDays, formatShortDate, getDueReason, parseLocalDate } from '../utils/people';
import PersonSheet from './people/PersonSheet';
import { useToast } from './ui/toast';

// ── Dates ────────────────────────────────────────────────────────────────────

// Parsed as local calendar days: `new Date('2026-11-26')` is UTC midnight, which west
// of UTC is still the 25th and would print as the day before.
const formatLongDate = (date?: string) =>
  date
    ? parseLocalDate(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Never visited';

const timeSince = (date?: string): string | null => {
  if (!date) return null;
  const days = Math.round((parseLocalDate(getDateString(new Date())).getTime() - parseLocalDate(date).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return '1 month ago';
  return `${Math.floor(days / 30)} months ago`;
};

const statusLabel = (status: PersonStatus) => (status === 'study' ? 'Study' : 'Return visit');

const StatusChip: React.FC<{ status: PersonStatus }> = ({ status }) => (
  <span
    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
      status === 'study' ? 'text-purple-700 bg-purple-100' : 'text-blue-700 bg-blue-100'
    }`}
  >
    {statusLabel(status)}
  </span>
);

/** "Wed & Sat · evening", or null when they gave no days or time. */
const describeAvailability = (person: Student): string | null => {
  const days = formatPreferredDays(person.preferred_days);
  const time = person.preferred_time?.toLowerCase();
  if (days && time) return `${days} · ${time}`;
  return days ?? (time ? `Best in the ${time}` : null);
};

/** When they are next due, worded for the list. */
const describeNext = (person: Student, today: string): { text: string; overdue: boolean } | null => {
  const reason = getDueReason(person, today);
  if (reason === 'overdue') return { text: `Overdue · was due ${formatShortDate(person.next_visit_date!)}`, overdue: true };
  if (reason === 'promised' || reason === 'usualDay') return { text: 'Due today', overdue: false };
  if (person.next_visit_date && person.next_visit_date > today) {
    return { text: `Next visit ${formatShortDate(person.next_visit_date)}`, overdue: false };
  }
  return null;
};

// ── Record or edit a call ────────────────────────────────────────────────────

interface VisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: Student;
  visit?: StudentVisit | null;
}

const VisitModal: React.FC<VisitModalProps> = ({ isOpen, onClose, person, visit }) => {
  const { saveStudentVisit, updateStudentVisit, updateStudent } = useStudents();
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

  const inputClass =
    'w-full p-3 bg-gray-50 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div role="dialog" aria-modal="true" aria-labelledby="visit-modal-title" className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 id="visit-modal-title" className="text-lg font-semibold text-gray-800">
                {visit ? 'Edit visit' : 'Record visit'}
              </h3>
              <p className="text-sm text-gray-600">
                {person.name} · {isStudy ? 'counts as a Bible study' : 'return visit'}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="p-2 hover:bg-gray-100 rounded-lg">
              <X size={20} className="text-gray-600" />
            </button>
          </div>

          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="visit-date" className="block text-sm font-medium text-gray-700 mb-2">Visit date</label>
              <input id="visit-date" type="date" value={visitDate} max={today} onChange={e => setVisitDate(e.target.value)} className={inputClass} required />
            </div>

            <div>
              <label htmlFor="visit-place" className="block text-sm font-medium text-gray-700 mb-2">
                {isStudy ? 'Where we stopped' : 'What you covered'}
              </label>
              <input
                id="visit-place"
                value={placeStopped}
                onChange={e => setPlaceStopped(e.target.value)}
                className={inputClass}
                placeholder={isStudy ? 'e.g. Lesson 12, point 3' : 'e.g. Read Psalm 37:29'}
              />
            </div>

            <div>
              <label htmlFor="visit-notes" className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                id="visit-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className={`${inputClass} resize-none`}
                rows={4}
                placeholder="What you discussed, what to bring next time"
              />
            </div>

            <div>
              <label htmlFor="visit-next" className="block text-sm font-medium text-gray-700 mb-2">Next visit (optional)</label>
              <input id="visit-next" type="date" value={nextVisit} min={today} onChange={e => setNextVisit(e.target.value)} className={inputClass} />
            </div>

            <div className="flex space-x-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-4 rounded-xl font-medium">
                Cancel
              </button>
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-medium">
                {visit ? 'Save visit' : 'Record visit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ── Delete ───────────────────────────────────────────────────────────────────

interface DeleteConfirmModalProps {
  person: Student | null;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ person, onClose, onConfirm }) => {
  if (!person) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div role="alertdialog" aria-modal="true" aria-labelledby="delete-title" className="bg-white rounded-xl max-w-sm w-full p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-red-100 p-2 rounded-lg">
            <Trash2 size={20} className="text-red-600" />
          </div>
          <h3 id="delete-title" className="text-lg font-semibold text-gray-800">Delete {statusLabel(person.status).toLowerCase()}</h3>
        </div>
        <p className="text-gray-600 mb-6">
          Delete <strong>{person.name}</strong> and every visit recorded with them? This cannot be undone.
        </p>
        <div className="flex space-x-3">
          <button onClick={onClose} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-4 rounded-xl font-medium">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-xl font-medium">
            Delete
          </button>
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

const PersonDetails: React.FC<PersonDetailsProps> = ({ person, onBack, onEdit, onDelete, onRecordVisit, onEditVisit }) => {
  const { visits, updateStudent, deleteStudentVisit } = useStudents();
  const { addToast } = useToast();
  const today = getDateString(new Date());
  const theirVisits = useMemo(
    () =>
      visits
        .filter(visit => visit.student_id === person.id)
        .sort((a, b) => b.visit_date.localeCompare(a.visit_date) || b.created_at.localeCompare(a.created_at)),
    [visits, person.id]
  );
  const availability = describeAvailability(person);
  const next = describeNext(person, today);
  const since = timeSince(person.last_visit_date);
  const isStudy = person.status === 'study';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button onClick={onBack} aria-label="Back to people" className="p-2 -ml-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-800 truncate font-libre-franklin">{person.name}</h1>
              <StatusChip status={person.status} />
            </div>
          </div>
          <div className="flex">
            <button onClick={onEdit} aria-label={`Edit ${person.name}`} className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg">
              <Edit size={18} />
            </button>
            <button onClick={onDelete} aria-label={`Delete ${person.name}`} className="p-2.5 text-red-600 hover:bg-red-50 rounded-lg">
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        <div className={`grid gap-2 ${isStudy ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <button
            onClick={onRecordVisit}
            className="bg-green-600 hover:bg-green-700 text-white h-12 px-4 rounded-xl font-semibold flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Record visit
          </button>
          {/* The step this whole feature exists for: a return visit who starts studying
              keeps their history rather than being re-entered */}
          {!isStudy && (
            <button
              onClick={async () => {
                await updateStudent(person.id, { status: 'study' }, { silent: true });
                addToast({ type: 'success', title: 'Study started', description: `${person.name} is now one of your Bible studies` });
              }}
              className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 h-12 px-4 rounded-xl font-semibold flex items-center justify-center gap-2"
            >
              <GraduationCap size={20} />
              Start a study
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 space-y-4">
        {next && (
          <div className="flex items-start gap-3">
            <CalendarClock size={16} className={`mt-0.5 flex-shrink-0 ${next.overdue ? 'text-amber-600' : 'text-gray-500'}`} />
            <p className={`text-sm font-semibold ${next.overdue ? 'text-amber-700' : 'text-gray-800'}`}>{next.text}</p>
          </div>
        )}
        <div className="flex items-start gap-3">
          <MapPin size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-700">Where</p>
            <p className="text-sm text-gray-600">{person.address || 'No address yet'}</p>
          </div>
        </div>
        {availability && (
          <div className="flex items-start gap-3">
            <Clock size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-700">Usually home</p>
              <p className="text-sm text-gray-600">{availability}</p>
            </div>
          </div>
        )}
        {person.publication_left && (
          <div className="flex items-start gap-3">
            <BookOpen size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-700">{isStudy ? 'Studying' : 'Publication left with them'}</p>
              <p className="text-sm text-gray-600">{person.publication_left}</p>
            </div>
          </div>
        )}
        {person.place_stopped && (
          <div className="flex items-start gap-3">
            <BookOpen size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-700">{isStudy ? 'Up to' : 'Last covered'}</p>
              <p className="text-sm text-gray-600">{person.place_stopped}</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <Calendar size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-700">Met</p>
              <p className="text-sm text-gray-600">{formatLongDate(person.date_met)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-700">Last visit</p>
              <p className="text-sm text-gray-600">
                {formatLongDate(person.last_visit_date)}
                {since && <span className="block text-gray-500">{since}</span>}
              </p>
            </div>
          </div>
        </div>
        {person.last_study_notes && (
          <div className="pt-4 border-t border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-1">Latest notes</p>
            <p className="text-sm text-gray-600 whitespace-pre-line">{person.last_study_notes}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Visits</h2>
        {theirVisits.length > 0 ? (
          <ul className="space-y-3">
            {theirVisits.map(visit => (
              <li key={visit.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-800">
                      {parseLocalDate(visit.visit_date).toLocaleDateString('en-GB', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                    <p className="text-xs font-semibold text-gray-500 mt-0.5">
                      {visit.is_study ? 'Bible study' : 'Return visit'}
                    </p>
                    {visit.place_stopped && <p className="text-sm text-gray-600 mt-1">{visit.place_stopped}</p>}
                  </div>
                  <div className="flex flex-shrink-0">
                    <button onClick={() => onEditVisit(visit)} aria-label="Edit visit" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Delete this visit?')) deleteStudentVisit(visit.id);
                      }}
                      aria-label="Delete visit"
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {visit.notes && <p className="mt-3 p-3 bg-white rounded-lg text-sm text-gray-700 whitespace-pre-line">{visit.notes}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Calendar size={40} className="mx-auto mb-3 opacity-50" />
            <p className="font-medium">No visits recorded yet</p>
          </div>
        )}
      </div>
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
  const [segment, setSegment] = useState<PersonStatus>(() => (returnVisits.length > 0 || studies.length === 0 ? 'return_visit' : 'study'));
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

  const query = search.trim().toLowerCase();
  // Whoever needs a call soonest first: overdue, due today, then by the date they
  // gave, and everyone with no date in name order after them
  const urgency = (person: Student): string => {
    const reason = getDueReason(person, today);
    if (reason === 'overdue') return `0${person.next_visit_date}`;
    if (reason) return '1';
    return person.next_visit_date && person.next_visit_date > today ? `2${person.next_visit_date}` : '3';
  };
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
          <div className="pt-2 pb-1">
            <h1 className="text-3xl font-bold text-gray-800 font-libre-franklin">People</h1>
            <p className="text-gray-600">Return visits and Bible studies</p>
          </div>

          <div role="group" aria-label="Show" className="grid grid-cols-2 gap-1 bg-gray-200/70 p-1 rounded-xl">
            {(['return_visit', 'study'] as PersonStatus[]).map(status => {
              const count = status === 'study' ? studies.length : returnVisits.length;
              const on = segment === status;
              return (
                <button
                  key={status}
                  aria-pressed={on}
                  onClick={() => setSegment(status)}
                  className={`h-11 rounded-lg text-[15px] font-semibold ${on ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}`}
                >
                  {status === 'study' ? 'Studies' : 'Return visits'} <span className="text-gray-500 font-medium">{count}</span>
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
                className="w-full h-12 pl-10 pr-3 bg-white rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setSheet({ person: null })}
              className="bg-blue-600 hover:bg-blue-700 text-white h-12 px-4 rounded-xl font-semibold flex items-center gap-1.5"
            >
              <Plus size={20} />
              Add
            </button>
          </div>

          {shown.length > 0 ? (
            <ul className="space-y-3">
              {shown.map(person => {
                const availability = describeAvailability(person);
                const next = describeNext(person, today);
                const since = timeSince(person.last_visit_date);
                return (
                  <li key={person.id}>
                    <button
                      onClick={() => setSelectedId(person.id)}
                      className="w-full text-left bg-white rounded-xl p-4 hover:shadow-md transition-shadow space-y-1.5"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-lg font-semibold text-gray-800 truncate">{person.name}</span>
                        {next && (
                          <span
                            className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                              next.overdue ? 'text-amber-800 bg-amber-100' : 'text-gray-700 bg-gray-100'
                            }`}
                          >
                            {next.text}
                          </span>
                        )}
                      </span>
                      {person.address && (
                        <span className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin size={14} className="flex-shrink-0" aria-hidden="true" />
                          <span className="truncate">{person.address}</span>
                        </span>
                      )}
                      {availability && (
                        <span className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock size={14} className="flex-shrink-0" aria-hidden="true" />
                          {availability}
                        </span>
                      )}
                      {(person.place_stopped || person.publication_left) && (
                        <span className="flex items-center gap-2 text-sm text-gray-600">
                          <BookOpen size={14} className="flex-shrink-0" aria-hidden="true" />
                          <span className="truncate">
                            {person.status === 'study' && person.place_stopped ? `Up to ${person.place_stopped}` : person.publication_left}
                          </span>
                        </span>
                      )}
                      <span className="block text-sm text-gray-500">
                        {since ? `Last visit ${since}` : `Met ${formatShortDate(person.date_met)}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="bg-white rounded-xl p-8 text-center">
              <Users size={56} className="mx-auto mb-4 text-gray-400 opacity-60" />
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
                  <button onClick={() => setSheet({ person: null })} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold">
                    Add a return visit
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      <PersonSheet
        isOpen={sheet !== null}
        person={sheet?.person}
        defaultStatus={segment}
        onClose={() => setSheet(null)}
      />

      {selected && (
        <VisitModal
          isOpen={visitModal !== null}
          person={selected}
          visit={visitModal?.visit}
          onClose={() => setVisitModal(null)}
        />
      )}

      <DeleteConfirmModal person={toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete} />
    </div>
  );
};

export default PeopleTab;
