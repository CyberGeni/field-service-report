import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { Student, StudentInput, StudentVisit } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useOnlineStatus } from './useOnlineStatus';
import { useToast } from '../components/ui/toast';
import { readCache, writeCache } from '../utils/offlineCache';
import { enqueueOperation, flushOutbox, readOutbox } from '../utils/offlineSync';
import { getErrorMessage } from '../utils/errors';
import { compressPhoto, forgetPhotoUrl, primePhotoUrl, removeLocalPhoto, savePhotoLocally } from '../utils/photoStore';

/**
 * Everyone the user calls back on - return visits and Bible studies - and every call.
 *
 * Return visits are added in doorways and stairwells, so this works like the hours
 * log: a change lands on the device first and is queued for Supabase, and the screen
 * never waits on (or fails for want of) a signal. Ids are made on the device so a
 * queued row can be replayed as an upsert, as often as it takes, without duplicating.
 *
 * The data lives in one store shared by every screen that shows it. The tab, its
 * detail screen, the calendar and the log all show the same people; with a copy each,
 * a call recorded on one would not show on the others until they each refetched.
 */

const STUDENTS_CACHE = 'students';
const VISITS_CACHE = 'studentVisits';
const PEOPLE_OUTBOX = 'peopleOutbox';
const PHOTO_OUTBOX = 'photoOutbox';

// Supabase caps a select at 1,000 rows; years of weekly calls pass that
const PAGE_SIZE = 1000;

interface PeopleSnapshot {
  userId: string | null;
  students: Student[];
  visits: StudentVisit[];
  loading: boolean;
  error: string | null;
}

let snapshot: PeopleSnapshot = { userId: null, students: [], visits: [], loading: true, error: null };
const listeners = new Set<() => void>();

const setSnapshot = (patch: Partial<PeopleSnapshot>) => {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => snapshot;

// Bumped on every local change, so a fetch that set off before one cannot land on
// top of it and quietly undo it
let localVersion = 0;

// ── Shaping rows ──────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

/** A row as Supabase (or an older cache) returns it, made safe to read. */
const toStudent = (row: Row): Student => ({
  id: String(row.id),
  user_id: String(row.user_id ?? ''),
  name: String(row.name ?? ''),
  address: typeof row.address === 'string' ? row.address : '',
  publication_left: optionalText(row.publication_left),
  place_stopped: optionalText(row.place_stopped),
  date_met: String(row.date_met ?? ''),
  last_visit_date: optionalText(row.last_visit_date),
  last_study_notes: optionalText(row.last_study_notes),
  // Rows from before return visits existed are all studies
  status: row.status === 'return_visit' ? 'return_visit' : 'study',
  preferred_days: Array.isArray(row.preferred_days)
    ? (row.preferred_days as unknown[]).map(Number).filter(day => day >= 0 && day <= 6)
    : [],
  preferred_time: optionalText(row.preferred_time),
  next_visit_date: optionalText(row.next_visit_date),
  photo_path: optionalText(row.photo_path),
  created_at: String(row.created_at ?? ''),
  updated_at: String(row.updated_at ?? '')
});

const toVisit = (row: Row): StudentVisit => ({
  id: String(row.id),
  student_id: String(row.student_id),
  user_id: String(row.user_id ?? ''),
  visit_date: String(row.visit_date),
  place_stopped: optionalText(row.place_stopped),
  notes: optionalText(row.notes),
  // Visits from before return visits existed were all studies
  is_study: row.is_study !== false,
  created_at: String(row.created_at ?? ''),
  updated_at: String(row.updated_at ?? '')
});

const studentRow = (student: Student): Row => ({
  id: student.id,
  name: student.name,
  address: student.address,
  publication_left: student.publication_left ?? null,
  place_stopped: student.place_stopped ?? null,
  date_met: student.date_met,
  last_visit_date: student.last_visit_date ?? null,
  last_study_notes: student.last_study_notes ?? null,
  status: student.status,
  preferred_days: student.preferred_days,
  preferred_time: student.preferred_time ?? null,
  next_visit_date: student.next_visit_date ?? null,
  photo_path: student.photo_path ?? null
});

const visitRow = (visit: StudentVisit): Row => ({
  id: visit.id,
  student_id: visit.student_id,
  visit_date: visit.visit_date,
  place_stopped: visit.place_stopped ?? null,
  notes: visit.notes ?? null,
  is_study: visit.is_study
});

/** Trim the free-text fields and turn blanks into "not set". */
const cleanInput = <T extends Partial<StudentInput>>(input: T): T => {
  const cleaned: Partial<StudentInput> = { ...input };
  if (input.name !== undefined) cleaned.name = input.name.trim();
  if (input.address !== undefined) cleaned.address = input.address.trim();
  (['publication_left', 'place_stopped', 'last_study_notes', 'preferred_time', 'last_visit_date', 'next_visit_date'] as const)
    .forEach(field => {
      if (field in input) cleaned[field] = optionalText(input[field]?.trim());
    });
  if (input.preferred_days !== undefined) {
    cleaned.preferred_days = [...new Set(input.preferred_days)].filter(day => day >= 0 && day <= 6).sort();
  }
  return cleaned as T;
};

const byName = (a: Student, b: Student) => a.name.localeCompare(b.name);

// Newest call first; two on one day in the order they were made
const byVisitNewestFirst = (a: StudentVisit, b: StudentVisit) =>
  b.visit_date.localeCompare(a.visit_date) || b.created_at.localeCompare(a.created_at);

// ── Committing changes ───────────────────────────────────────────────────────

const commit = (userId: string, students: Student[], visits: StudentVisit[]) => {
  localVersion += 1;
  const sorted = [...students].sort(byName);
  setSnapshot({ students: sorted, visits });
  writeCache(STUDENTS_CACHE, userId, sorted);
  writeCache(VISITS_CACHE, userId, visits);
};

const queueAndSync = (userId: string, operations: Parameters<typeof enqueueOperation>[1][]) => {
  operations.forEach(operation => enqueueOperation(userId, operation, PEOPLE_OUTBOX));
  // Best effort: with no signal it simply waits in the queue for the next sync
  void flushOutbox(userId, PEOPLE_OUTBOX);
};

const queuePhotoAndSync = (userId: string, operation: Parameters<typeof enqueueOperation>[1]) => {
  enqueueOperation(userId, operation, PHOTO_OUTBOX);
  void flushOutbox(userId, PHOTO_OUTBOX);
};

type VisitChange =
  | { kind: 'saved'; visit: StudentVisit } // added or edited
  | { kind: 'removed'; visit: StudentVisit };

/**
 * Carry a change to one call through to the person's "last visit" fields.
 *
 * Only the newest call speaks for where things stand, and only about what it says:
 * a call with no place or notes - a quick "visited" at the door - leaves the person's
 * own place and notes alone, and backfilling an older call changes nothing current.
 * The person's fields can be edited by hand too, so they are never rebuilt from the
 * history wholesale; that would roll a hand-entered "Lesson 12" back to whatever an
 * older call said.
 */
const withVisitChange = (student: Student, visits: StudentVisit[], change: VisitChange): Student => {
  const latest = visits.filter(visit => visit.student_id === student.id).sort(byVisitNewestFirst)[0];
  const { visit } = change;

  if (change.kind === 'saved') {
    const isNewest = latest?.id === visit.id;
    const lastVisit =
      !student.last_visit_date || visit.visit_date > student.last_visit_date ? visit.visit_date : student.last_visit_date;
    return {
      ...student,
      last_visit_date: lastVisit,
      last_study_notes: isNewest && visit.notes ? visit.notes : student.last_study_notes,
      place_stopped: isNewest && visit.place_stopped ? visit.place_stopped : student.place_stopped
    };
  }

  // Taking back the call that set the last visit date hands it to the call before -
  // or clears it when there is none, so an undone "visited" puts them back on today's
  // list. A date set by hand, which no call matches, stays.
  if (student.last_visit_date !== visit.visit_date) return student;
  if (latest?.visit_date === visit.visit_date) return student; // another call that day
  return { ...student, last_visit_date: latest?.visit_date };
};

const sameLastVisit = (a: Student, b: Student) =>
  a.last_visit_date === b.last_visit_date &&
  a.last_study_notes === b.last_study_notes &&
  a.place_stopped === b.place_stopped;

// ── Loading ──────────────────────────────────────────────────────────────────

const fetchAll = async (table: 'students' | 'student_visits', userId: string): Promise<Row[]> => {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data || []) as Row[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
};

/** Start from the device's copy, so the list is there with no signal before any fetch. */
const hydrate = (userId: string) => {
  if (snapshot.userId === userId) return;

  const cachedStudents = readCache<Row[]>(STUDENTS_CACHE, userId);
  const cachedVisits = readCache<Row[]>(VISITS_CACHE, userId);
  snapshot = {
    userId,
    students: (cachedStudents || []).map(toStudent).sort(byName),
    visits: (cachedVisits || []).map(toVisit),
    loading: !cachedStudents,
    error: null
  };
  // No notify: this runs during render, and telling other components to update in
  // the middle of it is an error in React. They read the new snapshot on their own
  // next render - useSyncExternalStore checks it before committing.
};

// Every screen showing people mounts this at once; one load serves them all
let inFlight: { userId: string; request: Promise<string | null> } | null = null;

/** Sync, then refresh from Supabase. Resolves to an error message worth showing, if any. */
const load = (userId: string): Promise<string | null> => {
  if (inFlight?.userId === userId) return inFlight.request;

  const request = (async (): Promise<string | null> => {
    const versionAtStart = localVersion;

    // Unsent changes go up before anything comes down: pulling the server's copy over
    // them would undo what the user did without a signal
    // Photos go on their own; one stuck upload must not stop the list refreshing
    void flushOutbox(userId, PHOTO_OUTBOX);
    const flush = await flushOutbox(userId, PEOPLE_OUTBOX);
    if (flush.failed) {
      setSnapshot({ loading: false });
      return null;
    }

    try {
      const [studentRows, visitRows] = await Promise.all([
        fetchAll('students', userId),
        fetchAll('student_visits', userId)
      ]);

      // Something changed on the device while this was fetching, or the user changed:
      // the device's copy is the newer one, and the next sync will bring them level
      const stale =
        localVersion !== versionAtStart ||
        readOutbox(userId, PEOPLE_OUTBOX).length > 0 ||
        snapshot.userId !== userId;
      if (stale) {
        setSnapshot({ loading: false });
        return null;
      }

      const students = studentRows.map(toStudent).sort(byName);
      const visits = visitRows.map(toVisit);
      setSnapshot({ students, visits, loading: false, error: null });
      writeCache(STUDENTS_CACHE, userId, students);
      writeCache(VISITS_CACHE, userId, visits);
      return null;
    } catch (err: unknown) {
      console.error('Error loading people:', err);

      // Offline is a state, not a failure: what is on screen is the last copy synced
      const haveCopy = readCache(STUDENTS_CACHE, userId) !== null;
      if (haveCopy || !navigator.onLine) {
        setSnapshot({ loading: false, error: null });
        return null;
      }

      const message = getErrorMessage(err);
      setSnapshot({ loading: false, error: message });
      return message;
    }
  })().finally(() => {
    if (inFlight?.request === request) inFlight = null;
  });

  inFlight = { userId, request };
  return request;
};

// ── The hook ─────────────────────────────────────────────────────────────────

type VisitInput = Omit<StudentVisit, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_study'> & {
  // Left out, it follows what the person is: a call on a study is a study
  is_study?: boolean;
};

type VisitUpdates = Partial<Omit<StudentVisit, 'id' | 'user_id' | 'student_id' | 'created_at' | 'updated_at'>>;

interface WriteOptions {
  silent?: boolean;
}

export const useStudents = () => {
  const { user } = useAuth();
  const online = useOnlineStatus();
  const { addToast } = useToast();

  if (user) hydrate(user.id);
  const state = useSyncExternalStore(subscribe, getSnapshot);
  // Until hydrate has run for this user the store may hold someone else's people
  const current = user && state.userId === user.id ? state : null;

  const refetch = useCallback(async () => {
    if (!user) return;
    const isFirstCaller = inFlight?.userId !== user.id;
    const message = await load(user.id);
    // One toast however many screens asked at once
    if (message && isFirstCaller) {
      addToast({ type: 'error', title: 'Load Failed', description: 'Failed to load your people' });
    }
  }, [user, addToast]);

  // Load on sign-in, and again on coming back online to send what was saved without
  // it. Offline it still runs: it settles quickly on the device's copy, so the screen
  // never sits on a spinner waiting for a network that is not there.
  useEffect(() => {
    if (user) refetch();
  }, [user, online, refetch]);

  const requireUser = () => {
    if (!user) throw new Error('User not authenticated');
    hydrate(user.id);
    return user.id;
  };

  const saveStudent = async (input: StudentInput, options: WriteOptions = {}): Promise<Student> => {
    const userId = requireUser();
    const now = new Date().toISOString();
    const cleaned = cleanInput(input);
    const student: Student = {
      ...cleaned,
      preferred_days: cleaned.preferred_days ?? [],
      status: cleaned.status ?? 'study',
      id: crypto.randomUUID(),
      user_id: userId,
      created_at: now,
      updated_at: now
    };

    commit(userId, [...snapshot.students, student], snapshot.visits);
    queueAndSync(userId, [{ kind: 'upsertStudent', row: studentRow(student) }]);

    if (!options.silent) {
      addToast({
        type: 'success',
        title: student.status === 'return_visit' ? 'Return Visit Added' : 'Student Added',
        description: `${student.name} has been added to your people`
      });
    }
    return student;
  };

  const updateStudent = async (
    id: string,
    updates: Partial<StudentInput>,
    options: WriteOptions = {}
  ): Promise<Student> => {
    const userId = requireUser();
    const existing = snapshot.students.find(student => student.id === id);
    if (!existing) throw new Error('Person not found');

    const updated: Student = { ...existing, ...cleanInput(updates), updated_at: new Date().toISOString() };
    commit(userId, snapshot.students.map(student => (student.id === id ? updated : student)), snapshot.visits);
    queueAndSync(userId, [{ kind: 'upsertStudent', row: studentRow(updated) }]);

    if (!options.silent) {
      addToast({ type: 'success', title: 'Saved', description: `${updated.name}'s details have been updated` });
    }
    return updated;
  };

  const deleteStudent = async (id: string) => {
    const userId = requireUser();
    const existing = snapshot.students.find(student => student.id === id);
    if (!existing) throw new Error('Person not found');

    commit(
      userId,
      snapshot.students.filter(student => student.id !== id),
      snapshot.visits.filter(visit => visit.student_id !== id)
    );
    queueAndSync(userId, [{ kind: 'deleteStudent', studentId: id }]);
    if (existing.photo_path) {
      void removeLocalPhoto(existing.photo_path);
      forgetPhotoUrl(existing.photo_path);
      queuePhotoAndSync(userId, { kind: 'deletePhoto', path: existing.photo_path });
    }

    addToast({
      type: 'success',
      title: 'Deleted',
      description: `${existing.name} has been removed from your people`
    });
  };

  /**
   * Take a photo of where someone lives (or replace theirs). Shrunk and saved on the
   * phone at once, so it shows straight away with or without a signal; the upload
   * follows through the photo queue.
   */
  const setPhoto = async (personId: string, file: File) => {
    const userId = requireUser();
    const person = snapshot.students.find(student => student.id === personId);
    if (!person) throw new Error('Person not found');

    const photo = await compressPhoto(file);
    const path = `${userId}/${personId}/${crypto.randomUUID()}.jpg`;
    await savePhotoLocally(path, photo);
    primePhotoUrl(path, photo);

    queuePhotoAndSync(userId, { kind: 'uploadPhoto', path });
    await updateStudent(personId, { photo_path: path }, { silent: true });

    if (person.photo_path) {
      void removeLocalPhoto(person.photo_path);
      forgetPhotoUrl(person.photo_path);
      queuePhotoAndSync(userId, { kind: 'deletePhoto', path: person.photo_path });
    }
  };

  const removePhoto = async (personId: string) => {
    const userId = requireUser();
    const person = snapshot.students.find(student => student.id === personId);
    if (!person?.photo_path) return;

    const path = person.photo_path;
    await updateStudent(personId, { photo_path: undefined }, { silent: true });
    void removeLocalPhoto(path);
    forgetPhotoUrl(path);
    queuePhotoAndSync(userId, { kind: 'deletePhoto', path });
  };

  const loadStudentVisits = async (studentId: string): Promise<StudentVisit[]> =>
    snapshot.visits.filter(visit => visit.student_id === studentId).sort(byVisitNewestFirst);

  const loadVisitsByDate = async (date: string): Promise<StudentVisit[]> =>
    snapshot.visits
      .filter(visit => visit.visit_date === date)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

  /** Write the calls, and the person whose last visit they move, in one change. */
  const commitVisits = (userId: string, visits: StudentVisit[], studentId: string, changes: VisitChange[]) => {
    const operations: Parameters<typeof enqueueOperation>[1][] = [];
    const students = snapshot.students.map(student => {
      if (student.id !== studentId) return student;

      const changed = changes.reduce((current, change) => withVisitChange(current, visits, change), student);
      if (sameLastVisit(changed, student)) return student;

      const updated = { ...changed, updated_at: new Date().toISOString() };
      operations.push({ kind: 'upsertStudent', row: studentRow(updated) });
      return updated;
    });

    commit(userId, students, visits);
    return operations;
  };

  const saveStudentVisit = async (input: VisitInput, options: WriteOptions = {}): Promise<StudentVisit> => {
    const userId = requireUser();
    const student = snapshot.students.find(candidate => candidate.id === input.student_id);
    if (!student) throw new Error('Person not found');

    const now = new Date().toISOString();
    const visit: StudentVisit = {
      id: crypto.randomUUID(),
      user_id: userId,
      student_id: input.student_id,
      visit_date: input.visit_date,
      place_stopped: optionalText(input.place_stopped?.trim()),
      notes: optionalText(input.notes?.trim()),
      is_study: input.is_study ?? student.status === 'study',
      created_at: now,
      updated_at: now
    };

    const studentOperations = commitVisits(userId, [...snapshot.visits, visit], student.id, [{ kind: 'saved', visit }]);
    // The call is sent before the person it updates, so a failure in between never
    // leaves a last-visit date pointing at a call the server does not have
    queueAndSync(userId, [{ kind: 'upsertStudentVisit', row: visitRow(visit) }, ...studentOperations]);

    if (!options.silent) {
      addToast({
        type: 'success',
        title: 'Visit Recorded',
        description: `Your visit to ${student.name} has been recorded`
      });
    }
    return visit;
  };

  const updateStudentVisit = async (id: string, updates: VisitUpdates, options: WriteOptions = {}) => {
    const userId = requireUser();
    const existing = snapshot.visits.find(visit => visit.id === id);
    if (!existing) throw new Error('Visit not found');

    const updated: StudentVisit = {
      ...existing,
      ...updates,
      place_stopped: 'place_stopped' in updates ? optionalText(updates.place_stopped?.trim()) : existing.place_stopped,
      notes: 'notes' in updates ? optionalText(updates.notes?.trim()) : existing.notes,
      updated_at: new Date().toISOString()
    };

    // Read as the old call taken back and the new one saved, so moving the newest
    // call to an earlier date moves the last visit date back with it
    const studentOperations = commitVisits(
      userId,
      snapshot.visits.map(visit => (visit.id === id ? updated : visit)),
      existing.student_id,
      [{ kind: 'removed', visit: existing }, { kind: 'saved', visit: updated }]
    );
    queueAndSync(userId, [{ kind: 'upsertStudentVisit', row: visitRow(updated) }, ...studentOperations]);

    if (!options.silent) {
      addToast({ type: 'success', title: 'Visit Updated', description: 'The visit has been updated' });
    }
    return updated;
  };

  const deleteStudentVisit = async (id: string, options: WriteOptions = {}) => {
    const userId = requireUser();
    const existing = snapshot.visits.find(visit => visit.id === id);
    if (!existing) return;

    const studentOperations = commitVisits(
      userId,
      snapshot.visits.filter(visit => visit.id !== id),
      existing.student_id,
      [{ kind: 'removed', visit: existing }]
    );
    queueAndSync(userId, [{ kind: 'deleteStudentVisit', visitId: id }, ...studentOperations]);

    if (!options.silent) {
      addToast({ type: 'success', title: 'Visit Deleted', description: 'The visit has been deleted' });
    }
  };

  return {
    students: current?.students ?? [],
    visits: current?.visits ?? [],
    loading: user ? current?.loading ?? true : false,
    error: current?.error ?? null,
    saveStudent,
    updateStudent,
    deleteStudent,
    loadStudentVisits,
    loadVisitsByDate,
    saveStudentVisit,
    updateStudentVisit,
    deleteStudentVisit,
    setPhoto,
    removePhoto,
    refetch
  };
};
