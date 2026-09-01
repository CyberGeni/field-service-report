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
  | { id: string; kind: 'deleteReportSubmission'; month: string };

const OUTBOX = 'outbox';

export const readOutbox = (userId: string): PendingOperation[] =>
  readCache<PendingOperation[]>(OUTBOX, userId) || [];

const writeOutbox = (userId: string, operations: PendingOperation[]) =>
  writeCache(OUTBOX, userId, operations);

// Plain Omit collapses a discriminated union to its shared keys (id, kind) - this
// distributes it over each member first, so every variant keeps its own extra field.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export const enqueueOperation = (
  userId: string,
  operation: DistributiveOmit<PendingOperation, 'id'>
): PendingOperation[] => {
  const queued = [
    ...readOutbox(userId),
    { ...operation, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` } as PendingOperation
  ];
  writeOutbox(userId, queued);
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
export const flushOutbox = async (userId: string): Promise<FlushResult> => {
  let queue = readOutbox(userId);
  let flushed = 0;

  while (queue.length > 0) {
    try {
      await applyOperation(userId, queue[0]);
    } catch (err) {
      console.error('Could not sync pending change:', err);
      return { flushed, pending: queue.length, failed: true };
    }

    queue = queue.slice(1);
    writeOutbox(userId, queue);
    flushed += 1;
  }

  return { flushed, pending: 0, failed: false };
};
