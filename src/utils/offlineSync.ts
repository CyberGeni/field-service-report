import { supabase } from '../lib/supabase';
import { ServiceRecord } from '../types';
import { readCache, writeCache } from './offlineCache';

/**
 * A change made on the device that Supabase has not accepted yet.
 *
 * Each one is written the moment the user acts, so a record logged in a basement is
 * safe on the phone before it is safe in the database, and replayed in order once the
 * connection comes back.
 */
export type PendingOperation =
  | { id: string; kind: 'replaceDay'; record: ServiceRecord } // a new entry, merged into its day
  | { id: string; kind: 'upsertRecord'; record: ServiceRecord } // an edit to one record
  | { id: string; kind: 'deleteRecord'; recordId: string }
  | { id: string; kind: 'saveSettings'; row: Record<string, unknown> }
  | { id: string; kind: 'saveReportSubmission'; row: Record<string, unknown> }
  | { id: string; kind: 'deleteReportSubmission'; month: string }
  // People (return visits and studies) and their calls. Every row carries an id made
  // on the device, so replaying one is an idempotent upsert.
  | { id: string; kind: 'upsertStudent'; row: Record<string, unknown> }
  | { id: string; kind: 'deleteStudent'; studentId: string }
  | { id: string; kind: 'upsertStudentVisit'; row: Record<string, unknown> }
  | { id: string; kind: 'deleteStudentVisit'; visitId: string };

/**
 * Two queues, each replayed in order on its own.
 *
 * A queue stops at its first failure so a day's changes never land out of order. That
 * is right within one kind of data, but it means one stuck change holds up everything
 * behind it - and the hours on a report must never wait on a return visit's notes. So
 * people and their calls queue separately from hours, settings and reports.
 */
export type OutboxName = 'outbox' | 'peopleOutbox';

const OUTBOX_NAMES: OutboxName[] = ['outbox', 'peopleOutbox'];

export const readOutbox = (userId: string, name: OutboxName = 'outbox'): PendingOperation[] =>
  readCache<PendingOperation[]>(name, userId) || [];

// Told whenever either queue changes, so a count of unsent changes stays true no
// matter which screen queued them
const outboxListeners = new Set<() => void>();

export const subscribeOutbox = (listener: () => void): (() => void) => {
  outboxListeners.add(listener);
  return () => {
    outboxListeners.delete(listener);
  };
};

const writeOutbox = (userId: string, operations: PendingOperation[], name: OutboxName) => {
  writeCache(name, userId, operations);
  outboxListeners.forEach(listener => listener());
};

/** Everything not yet accepted by Supabase, across both queues. */
export const countPendingChanges = (userId: string): number =>
  OUTBOX_NAMES.reduce((sum, name) => sum + readOutbox(userId, name).length, 0);

// Plain Omit collapses a discriminated union to its shared keys (id, kind) - this
// distributes it over each member first, so every variant keeps its own extra field.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export const enqueueOperation = (
  userId: string,
  operation: DistributiveOmit<PendingOperation, 'id'>,
  name: OutboxName = 'outbox'
): PendingOperation[] => {
  const queued = [
    ...readOutbox(userId, name),
    { ...operation, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` } as PendingOperation
  ];
  writeOutbox(userId, queued, name);
  return queued;
};

const toRecordRow = (userId: string, record: ServiceRecord) => ({
  id: record.id,
  user_id: userId,
  date: record.date,
  hours: record.hours,
  minutes: record.minutes,
  type: record.type,
  notes: record.notes || null
});

const applyOperation = async (userId: string, operation: PendingOperation): Promise<void> => {
  switch (operation.kind) {
    case 'replaceDay': {
      // The device already merged everything logged for this day and type, so the row
      // it holds is the whole truth for that slot - anything else there is stale.
      const { record } = operation;
      const { error: deleteError } = await supabase
        .from('service_records')
        .delete()
        .eq('user_id', userId)
        .eq('date', record.date)
        .eq('type', record.type);

      if (deleteError) throw deleteError;

      const { error } = await supabase.from('service_records').insert(toRecordRow(userId, record));
      if (error) throw error;
      return;
    }
    case 'upsertRecord': {
      const { error } = await supabase
        .from('service_records')
        .upsert(toRecordRow(userId, operation.record), { onConflict: 'id' });
      if (error) throw error;
      return;
    }
    case 'deleteRecord': {
      const { error } = await supabase
        .from('service_records')
        .delete()
        .eq('id', operation.recordId)
        .eq('user_id', userId);
      if (error) throw error;
      return;
    }
    case 'saveSettings': {
      const { error } = await supabase
        .from('user_settings')
        .upsert({ ...operation.row, user_id: userId }, { onConflict: 'user_id' });
      if (error) throw error;
      return;
    }
    case 'saveReportSubmission': {
      const { error } = await supabase
        .from('report_submissions')
        .upsert({ ...operation.row, user_id: userId }, { onConflict: 'user_id,month' });
      if (error) throw error;
      return;
    }
    case 'deleteReportSubmission': {
      const { error } = await supabase
        .from('report_submissions')
        .delete()
        .eq('user_id', userId)
        .eq('month', operation.month);
      if (error) throw error;
      return;
    }
    case 'upsertStudent': {
      const { error } = await supabase
        .from('students')
        .upsert({ ...operation.row, user_id: userId }, { onConflict: 'id' });
      if (error) throw error;
      return;
    }
    case 'deleteStudent': {
      // Their calls go with them: student_visits cascades on delete
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', operation.studentId)
        .eq('user_id', userId);
      if (error) throw error;
      return;
    }
    case 'upsertStudentVisit': {
      const { error } = await supabase
        .from('student_visits')
        .upsert({ ...operation.row, user_id: userId }, { onConflict: 'id' });
      if (error) throw error;
      return;
    }
    case 'deleteStudentVisit': {
      const { error } = await supabase
        .from('student_visits')
        .delete()
        .eq('id', operation.visitId)
        .eq('user_id', userId);
      if (error) throw error;
      return;
    }
  }
};

export interface FlushResult {
  flushed: number;
  pending: number;
  failed: boolean;
}

/**
 * Replay everything waiting, oldest first.
 *
 * The queue stops at the first failure rather than skipping past it: the operations
 * for a single day build on each other, and replaying them out of order would leave
 * the database holding a version of the day the user never had.
 */
const runFlush = async (userId: string, name: OutboxName): Promise<FlushResult> => {
  let flushed = 0;

  // Re-read the queue every round rather than working through a copy: a change the
  // user makes while this is running is appended to the stored queue, and writing a
  // stale copy back would silently drop it.
  for (let next = readOutbox(userId, name)[0]; next; next = readOutbox(userId, name)[0]) {
    try {
      await applyOperation(userId, next);
    } catch (err) {
      console.error('Could not sync pending change:', err);
      return { flushed, pending: readOutbox(userId, name).length, failed: true };
    }

    writeOutbox(userId, readOutbox(userId, name).filter(operation => operation.id !== next.id), name);
    flushed += 1;
  }

  return { flushed, pending: 0, failed: false };
};

// One flush per queue at a time. Several screens ask for a sync at once (coming back
// online, a save, a refresh), and two runs over one queue would send its head twice.
const flushesInFlight = new Map<string, Promise<FlushResult>>();

export const flushOutbox = (userId: string, name: OutboxName = 'outbox'): Promise<FlushResult> => {
  const key = `${name}:${userId}`;
  const running = flushesInFlight.get(key);

  // Join the run already going. It re-reads the queue each round, so it picks up most
  // of what was queued since - and anything that slipped in after its last read gets
  // a run of its own once it finishes (unless it stopped on a failure: retrying at
  // once would only fail again).
  if (running) {
    return running.then(result =>
      !result.failed && readOutbox(userId, name).length > 0 ? flushOutbox(userId, name) : result
    );
  }

  const run = runFlush(userId, name).finally(() => {
    flushesInFlight.delete(key);
  });
  flushesInFlight.set(key, run);
  return run;
};
