import { useState, useEffect, useRef } from 'react';
import { ServiceRecord, ServiceActivity, Settings, FieldServiceDay } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useToast } from '../components/ui/toast';
import { useOnlineStatus } from './useOnlineStatus';
import { readCache, writeCache } from '../utils/offlineCache';
import { enqueueOperation, flushOutbox, readOutbox } from '../utils/offlineSync';
import { getErrorMessage } from '../utils/errors';

const RECORDS_CACHE = 'records';
const SETTINGS_CACHE = 'settings';

const sortByDateDescending = (records: ServiceRecord[]): ServiceRecord[] =>
  [...records].sort((a, b) => b.date.localeCompare(a.date));

// The row shape saved to user_settings - loosely typed since it carries both the
// current and legacy field-service-days formats side by side.
interface FieldServiceDayRow {
  day: number;
  type: string; // 'h2h' | 'cart', or the legacy 'h2h_rv'
  potentialHours?: number;
  potential_hours?: number;
  label?: string;
}

interface SettingsRow {
  monthly_target: number;
  yearly_target: number;
  field_service_days_config?: FieldServiceDayRow[];
  field_service_days?: number[];
}

const DEFAULT_SETTINGS: Settings = {
  monthlyTarget: 10,
  yearlyTarget: 120,
  fieldServiceDays: [
    { day: 6, type: 'h2h', potentialHours: 4, label: 'Saturday - House to House/Return Visits' },
    { day: 0, type: 'h2h', potentialHours: 3, label: 'Sunday - House to House/Return Visits' }
  ],
  username: '',
  password: ''
};

export const useStorage = () => {
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Changes made on this device that Supabase has not accepted yet
  const [pendingChanges, setPendingChanges] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const online = useOnlineStatus();
  const { user } = useAuth();
  const { addToast } = useToast();
  const loadingRef = useRef(false);
  // updateSettings can be called from an effect that captured an older render, and a
  // partial update must never fold the user's saved days back into the defaults.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const settingsLoadedRef = useRef(false);
  const initialLoadCompleteRef = useRef(false);

  // Set up real-time subscription for settings changes
  useEffect(() => {
    if (!user) return;

    console.log('🔄 Setting up real-time subscription for user:', user.id);

    const subscription = supabase
      .channel('user_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('📡 Real-time settings change detected:', payload);
          if (payload.new && payload.eventType !== 'DELETE') {
            // The subscription is scoped to user_settings, so this row is a SettingsRow
            // even though the realtime payload types it as a generic string-keyed record.
            const newSettings = parseSettingsFromDatabase(payload.new as SettingsRow);
            console.log('🔄 Updating settings from real-time:', newSettings);
            // JSONB columns sometimes come back null in real-time payloads.
            // If field_service_days_config is missing, preserve the current
            // fieldServiceDays instead of reverting to defaults.
            if (!payload.new.field_service_days_config) {
              setSettings(prev => ({
                ...newSettings,
                fieldServiceDays: prev.fieldServiceDays
              }));
            } else {
              setSettings(newSettings);
            }
            settingsLoadedRef.current = true;
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🧹 Cleaning up real-time subscription');
      subscription.unsubscribe();
    };
  }, [user]);

  // Load data when user changes
  useEffect(() => {
    if (user) {
      console.log('👤 User changed, loading data for:', user.id);
      // Reset refs when user changes
      settingsLoadedRef.current = false;
      initialLoadCompleteRef.current = false;
      loadData();
    } else {
      // Clear data when user logs out
      console.log('🚪 User logged out, clearing data');
      setRecords([]);
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      settingsLoadedRef.current = false;
      initialLoadCompleteRef.current = false;
    }
  }, [user]);

  const parseSettingsFromDatabase = (settingsData: SettingsRow): Settings => {
    let fieldServiceDays = DEFAULT_SETTINGS.fieldServiceDays;

    // Try to use the new field_service_days_config column first
    if (settingsData.field_service_days_config && Array.isArray(settingsData.field_service_days_config)) {
      try {
        fieldServiceDays = settingsData.field_service_days_config.map((fsd: FieldServiceDayRow) => ({
          day: fsd.day,
          type: fsd.type === 'h2h_rv' ? 'h2h' : fsd.type as FieldServiceDay['type'], // Convert old format
          potentialHours: fsd.potentialHours || fsd.potential_hours || 2, // Handle different naming
          label: fsd.label || `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][fsd.day]} - ${fsd.type === 'h2h' ? 'House to House/Return Visits' : 'Cart Witnessing'}`
        }));
        console.log('✅ Using field_service_days_config:', fieldServiceDays);
      } catch (e) {
        console.warn('⚠️ Failed to parse field_service_days_config:', e);
        fieldServiceDays = DEFAULT_SETTINGS.fieldServiceDays;
      }
    }
    // Fallback to legacy field_service_days if config is not available
    else if (settingsData.field_service_days && Array.isArray(settingsData.field_service_days)) {
      console.log('🔄 Converting legacy field_service_days:', settingsData.field_service_days);

      // Convert legacy format to new format with consistent defaults
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      fieldServiceDays = settingsData.field_service_days.map((day: number) => ({
        day,
        type: 'h2h' as const, // Set all to h2h for consistency
        potentialHours: 3, // Set consistent default hours
        label: `${dayNames[day]} - House to House/Return Visits`
      }));

      // Notify user about the conversion
      if (addToast) {
        addToast({
          type: 'info',
          title: 'Settings Updated',
          description: 'Your field service days have been updated to the new format. Please review and save your settings in the Settings tab to complete the update.',
          duration: 8000
        });
      }
    }

    return {
      monthlyTarget: settingsData.monthly_target,
      yearlyTarget: settingsData.yearly_target,
      fieldServiceDays,
      username: '', // We'll get this from profile
      password: '' // Not stored in database
    };
  };

  /** Keep the device's copy in step with what the user is looking at. */
  const cacheRecords = (userId: string, next: ServiceRecord[]) => {
    writeCache(RECORDS_CACHE, userId, next);
  };

  /**
   * Send anything logged offline, then say how much is still waiting.
   *
   * Called before every read: pulling the server's version over the top of unsent
   * work would quietly undo whatever the user did without a signal.
   */
  const syncPendingChanges = async (userId: string): Promise<boolean> => {
    if (readOutbox(userId).length === 0) return true;

    setSyncing(true);
    try {
      const result = await flushOutbox(userId);
      setPendingChanges(result.pending);
      return !result.failed;
    } finally {
      setSyncing(false);
    }
  };

  const loadData = async () => {
    if (!user || loadingRef.current) {
      console.log('⏭️ Skipping load - no user or already loading');
      return;
    }

    // Show the device's copy straight away: the app has to be usable before - and
    // whether or not - the network answers.
    const cachedRecords = readCache<ServiceRecord[]>(RECORDS_CACHE, user.id);
    if (cachedRecords) {
      setRecords(sortByDateDescending(cachedRecords));
      setLoading(false);
    }

    const cachedSettings = readCache<Settings>(SETTINGS_CACHE, user.id);
    if (cachedSettings) {
      setSettings(cachedSettings);
      settingsLoadedRef.current = true;
    }

    setPendingChanges(readOutbox(user.id).length);

    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      console.log('📥 Loading data for user:', user.id);

      // Unsent work goes up before anything comes down
      const synced = await syncPendingChanges(user.id);
      if (!synced) {
        console.log('📴 Still offline - keeping the local copy');
        return;
      }

      // Load service records
      const { data: recordsData, error: recordsError } = await supabase
        .from('service_records')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (recordsError) throw recordsError;

      // Transform database records to match our ServiceRecord type
      const transformedRecords: ServiceRecord[] = (recordsData || []).map(record => ({
        id: record.id,
        date: record.date,
        hours: record.hours,
        minutes: record.minutes,
        // 'rv' predates the merge of return visits into house-to-house
        type: record.type === 'rv' ? 'h2h' : (record.type as ServiceActivity),
        notes: record.notes || undefined
      }));

      setRecords(transformedRecords);
      cacheRecords(user.id, transformedRecords);
      console.log('✅ Loaded', transformedRecords.length, 'service records');

      // Load user settings - this is the critical part
      await loadUserSettings();

    } catch (err: unknown) {
      console.error('❌ Error loading data:', err);
      // A failed refresh is only an error when there is nothing to fall back on
      if (!cachedRecords) setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      loadingRef.current = false;
      initialLoadCompleteRef.current = true;
    }
  };

  const loadUserSettings = async (retryCount = 0) => {
    if (!user) return;

    try {
      console.log('⚙️ Loading user settings, attempt:', retryCount + 1);

      // First, check if settings exist in the database
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (settingsError && settingsError.code !== 'PGRST116') {
        throw settingsError;
      }

      if (settingsData) {
        console.log('✅ Found existing settings in database:', settingsData);
        const loadedSettings = parseSettingsFromDatabase(settingsData);
        console.log('🎯 Parsed settings:', loadedSettings);
        setSettings(loadedSettings);
        writeCache(SETTINGS_CACHE, user.id, loadedSettings);
        settingsLoadedRef.current = true;
      } else {
        console.log('❌ No settings found in database');
        
        // CRITICAL: Only create default settings if this is truly a new user
        // Check if we've already loaded settings before (to prevent overwriting on device switch)
        if (!settingsLoadedRef.current && !initialLoadCompleteRef.current) {
          console.log('🆕 Creating default settings for new user');
          await createDefaultSettings();
        } else {
          console.log('⚠️ Settings not found but user has loaded before - keeping current settings');
          // Don't overwrite existing settings, just mark as loaded
          settingsLoadedRef.current = true;
        }
      }
    } catch (err: unknown) {
      console.error('❌ Error loading settings:', err);
      
      // Retry up to 3 times with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`🔄 Retrying settings load in ${delay}ms...`);
        setTimeout(() => loadUserSettings(retryCount + 1), delay);
      } else {
        console.error('💥 Failed to load settings after 3 retries');
        if (!settingsLoadedRef.current) {
          console.log('🔧 Using default settings as fallback');
          setSettings(DEFAULT_SETTINGS);
          settingsLoadedRef.current = true;
        }
      }
    }
  };

  const createDefaultSettings = async () => {
    if (!user) return;

    try {
      console.log('🆕 Creating default settings for user:', user.id);
      
      // Double-check that settings don't already exist
      const { data: existingSettings } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingSettings) {
        console.log('⚠️ Settings already exist, loading them instead');
        await loadUserSettings();
        return;
      }

      const { data, error } = await supabase
        .from('user_settings')
        .insert({
          user_id: user.id,
          monthly_target: DEFAULT_SETTINGS.monthlyTarget,
          yearly_target: DEFAULT_SETTINGS.yearlyTarget,
          field_service_days: DEFAULT_SETTINGS.fieldServiceDays.map(fsd => fsd.day), // Legacy format
          field_service_days_config: DEFAULT_SETTINGS.fieldServiceDays // New format
        })
        .select()
        .single();

      if (error) {
        // If the error is due to a unique constraint violation, settings already exist
        if (error.code === '23505') {
          console.log('⚠️ Settings already exist (constraint violation), loading them instead');
          await loadUserSettings();
          return;
        }
        throw error;
      }
      
      console.log('✅ Default settings created successfully:', data);
      setSettings(DEFAULT_SETTINGS);
      settingsLoadedRef.current = true;
    } catch (err: unknown) {
      console.error('❌ Error creating default settings:', err);
      // If creation fails, just use default settings locally
      console.log('🔧 Using default settings locally due to creation error');
      setSettings(DEFAULT_SETTINGS);
      settingsLoadedRef.current = true;
    }
  };

  /**
   * Fold a new entry into whatever is already logged for that day and service type.
   *
   * The device's own copy is the input, not a fresh query: it is the same data, it is
   * there when the network is not, and it keeps one day's total in one row.
   */
  const mergeRecordsForDate = (newRecord: ServiceRecord): ServiceRecord => {
    const sameSlot = records.filter(
      record => record.date === newRecord.date && record.type === newRecord.type
    );

    const totalMinutes = sameSlot.reduce(
      (total, record) => total + record.hours * 60 + record.minutes,
      newRecord.hours * 60 + newRecord.minutes
    );

    const notes = [newRecord.notes, ...sameSlot.map(record => record.notes)]
      .map(note => note?.trim())
      .filter((note): note is string => Boolean(note));

    return {
      id: newRecord.id,
      date: newRecord.date,
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
      type: newRecord.type,
      notes: notes.length > 0 ? notes.join('; ') : undefined
    };
  };

  /**
   * Save a record on the device first, then send it.
   *
   * The user is standing in a doorway when they log this - it has to land instantly
   * and survive a dead connection, so the local copy is the commit and the upload is
   * a queued consequence of it.
   */
  const saveRecord = async (record: ServiceRecord) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setError(null);

    const isEdit = records.some(existing => existing.id === record.id);
    const merged = isEdit ? record : mergeRecordsForDate(record);

    const nextRecords = sortByDateDescending(
      isEdit
        ? records.map(existing => (existing.id === record.id ? merged : existing))
        : [
            ...records.filter(
              existing => !(existing.date === record.date && existing.type === record.type)
            ),
            merged
          ]
    );

    setRecords(nextRecords);
    cacheRecords(user.id, nextRecords);

    const queued = enqueueOperation(user.id, {
      kind: isEdit ? 'upsertRecord' : 'replaceDay',
      record: merged
    });
    setPendingChanges(queued.length);

    // Best effort: a failure here is not the user's problem, it just waits in the queue
    await syncPendingChanges(user.id);
  };

  const deleteRecord = async (id: string) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setError(null);

    const nextRecords = records.filter(record => record.id !== id);
    setRecords(nextRecords);
    cacheRecords(user.id, nextRecords);

    const queued = enqueueOperation(user.id, { kind: 'deleteRecord', recordId: id });
    setPendingChanges(queued.length);

    await syncPendingChanges(user.id);
  };

  const updateSettings = async (newSettings: Partial<Settings>) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setError(null);

    const updatedSettings = { ...settingsRef.current, ...newSettings };

    // Prepare the update data - ensure field service days are properly formatted
    const updateData: Record<string, unknown> = {
      user_id: user.id,
      monthly_target: updatedSettings.monthlyTarget,
      yearly_target: updatedSettings.yearlyTarget,
      field_service_days: updatedSettings.fieldServiceDays.map(fsd => fsd.day), // Legacy format for compatibility
      field_service_days_config: updatedSettings.fieldServiceDays // New format with full structure
    };

    // Settings apply on the device immediately and upload behind the user, so the
    // targets and service days still hold on a screen opened with no signal.
    setSettings(updatedSettings);
    writeCache(SETTINGS_CACHE, user.id, updatedSettings);
    settingsLoadedRef.current = true;

    const queued = enqueueOperation(user.id, { kind: 'saveSettings', row: updateData });
    setPendingChanges(queued.length);

    await syncPendingChanges(user.id);
  };

  // Coming back online is the moment to hand over whatever was logged without it
  useEffect(() => {
    if (!user || !online) return;

    const catchUp = async () => {
      if (await syncPendingChanges(user.id)) {
        loadData();
      }
    };

    catchUp();
  }, [online, user]);

  return {
    records,
    settings,
    loading,
    error,
    online,
    syncing,
    pendingChanges,
    saveRecord,
    deleteRecord,
    updateSettings,
    refetch: loadData
  };
};