import { useState, useEffect, useRef } from 'react';
import { ServiceRecord, Settings, FieldServiceDay } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useToast } from '../components/ui/toast';

const DEFAULT_SETTINGS: Settings = {
  monthlyTarget: 10,
  yearlyTarget: 120,
  fieldServiceDays: [
    { day: 6, type: 'h2h', potentialHours: 4, label: 'Saturday - House to House/Return Visits' },
    { day: 0, type: 'h2h', potentialHours: 3, label: 'Sunday - House to House/Return Visits' }
  ],
  username: '',
  password: '',
  serviceYearStart: '2024-09'
};

export const useStorage = () => {
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { addToast } = useToast();
  const loadingRef = useRef(false);
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
            const newSettings = parseSettingsFromDatabase(payload.new);
            console.log('🔄 Updating settings from real-time:', newSettings);
            setSettings(newSettings);
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

  const parseSettingsFromDatabase = (settingsData: any): Settings => {
    let fieldServiceDays = DEFAULT_SETTINGS.fieldServiceDays;
    let wasLegacyConverted = false;
    
    // Try to use the new field_service_days_config column first
    if (settingsData.field_service_days_config && Array.isArray(settingsData.field_service_days_config)) {
      try {
        fieldServiceDays = settingsData.field_service_days_config.map((fsd: any) => ({
          day: fsd.day,
          type: fsd.type === 'h2h_rv' ? 'h2h' : fsd.type, // Convert old format
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
      wasLegacyConverted = true;
      
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
      serviceYearStart: settingsData.service_year_start,
      username: '', // We'll get this from profile
      password: '' // Not stored in database
    };
  };

  const loadData = async () => {
    if (!user || loadingRef.current) {
      console.log('⏭️ Skipping load - no user or already loading');
      return;
    }

    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      console.log('📥 Loading data for user:', user.id);

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
        type: record.type === 'rv' ? 'h2h' : record.type as 'h2h' | 'cart',
        notes: record.notes || undefined
      }));

      setRecords(transformedRecords);
      console.log('✅ Loaded', transformedRecords.length, 'service records');

      // Load user settings - this is the critical part
      await loadUserSettings();

    } catch (err: any) {
      console.error('❌ Error loading data:', err);
      setError(err.message);
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
    } catch (err: any) {
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
          field_service_days_config: DEFAULT_SETTINGS.fieldServiceDays, // New format
          service_year_start: DEFAULT_SETTINGS.serviceYearStart
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
    } catch (err: any) {
      console.error('❌ Error creating default settings:', err);
      // If creation fails, just use default settings locally
      console.log('🔧 Using default settings locally due to creation error');
      setSettings(DEFAULT_SETTINGS);
      settingsLoadedRef.current = true;
    }
  };

  const mergeRecordsForDate = async (date: string, newRecord: ServiceRecord) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get all existing records for this date and service type
    const { data: existingRecords, error: fetchError } = await supabase
      .from('service_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .eq('type', newRecord.type);

    if (fetchError) throw fetchError;

    // Calculate total time including the new record
    let totalMinutes = newRecord.hours * 60 + newRecord.minutes;
    let combinedNotes = newRecord.notes ? [newRecord.notes] : [];

    // Add existing records' time and notes
    existingRecords?.forEach(record => {
      totalMinutes += record.hours * 60 + record.minutes;
      if (record.notes && record.notes.trim()) {
        combinedNotes.push(record.notes.trim());
      }
    });

    const finalHours = Math.floor(totalMinutes / 60);
    const finalMinutes = totalMinutes % 60;
    const finalNotes = combinedNotes.length > 0 ? combinedNotes.join('; ') : undefined;

    // Delete all existing records for this date and type
    if (existingRecords && existingRecords.length > 0) {
      const { error: deleteError } = await supabase
        .from('service_records')
        .delete()
        .eq('user_id', user.id)
        .eq('date', date)
        .eq('type', newRecord.type);

      if (deleteError) throw deleteError;
    }

    // Insert the merged record
    const mergedRecord = {
      id: newRecord.id,
      user_id: user.id,
      date: date,
      hours: finalHours,
      minutes: finalMinutes,
      type: newRecord.type,
      notes: finalNotes || null
    };

    const { error: insertError } = await supabase
      .from('service_records')
      .insert(mergedRecord);

    if (insertError) throw insertError;

    return {
      id: newRecord.id,
      date: date,
      hours: finalHours,
      minutes: finalMinutes,
      type: newRecord.type,
      notes: finalNotes
    };
  };

  const saveRecord = async (record: ServiceRecord) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    try {
      setError(null);

      // Check if this is an update to an existing record
      const existingRecord = records.find(r => r.id === record.id);
      
      if (existingRecord) {
        // This is an edit - replace the existing record
        const { error } = await supabase
          .from('service_records')
          .update({
            date: record.date,
            hours: record.hours,
            minutes: record.minutes,
            type: record.type,
            notes: record.notes || null
          })
          .eq('id', record.id)
          .eq('user_id', user.id);

        if (error) throw error;

        // Update local state
        const updatedRecords = records.map(r => r.id === record.id ? record : r)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setRecords(updatedRecords);
      } else {
        // This is a new record - merge with existing records for the same date and type
        const mergedRecord = await mergeRecordsForDate(record.date, record);

        // Update local state - remove any existing records for this date/type and add the merged one
        const updatedRecords = [
          ...records.filter(r => !(r.date === record.date && r.type === record.type)),
          mergedRecord
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        setRecords(updatedRecords);
      }

    } catch (err: any) {
      console.error('❌ Error saving record:', err);
      setError(err.message);
      throw err; // Re-throw to allow UI to handle the error
    }
  };

  const deleteRecord = async (id: string) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    try {
      setError(null);

      const { error } = await supabase
        .from('service_records')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      const updatedRecords = records.filter(r => r.id !== id);
      setRecords(updatedRecords);

    } catch (err: any) {
      console.error('❌ Error deleting record:', err);
      setError(err.message);
      throw err; // Re-throw to allow UI to handle the error
    }
  };

  const updateSettings = async (newSettings: Partial<Settings>) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    try {
      setError(null);

      const updatedSettings = { ...settings, ...newSettings };

      // Prepare the update data - ensure field service days are properly formatted
      const updateData: any = {
        user_id: user.id,
        monthly_target: updatedSettings.monthlyTarget,
        yearly_target: updatedSettings.yearlyTarget,
        field_service_days: updatedSettings.fieldServiceDays.map(fsd => fsd.day), // Legacy format for compatibility
        field_service_days_config: updatedSettings.fieldServiceDays, // New format with full structure
        service_year_start: updatedSettings.serviceYearStart
      };

      console.log('💾 Updating settings with data:', updateData);

      // Use upsert to handle both insert and update cases
      const { data, error } = await supabase
        .from('user_settings')
        .upsert(updateData, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log('✅ Settings updated successfully in database:', data);

      // Update local state only after successful database update
      setSettings(updatedSettings);
      settingsLoadedRef.current = true;
      console.log('🎯 Local settings updated:', updatedSettings);

    } catch (err: any) {
      console.error('❌ Error updating settings:', err);
      setError(err.message);
      throw err; // Re-throw to allow UI to handle the error
    }
  };

  // Force refresh function for manual sync
  const forceRefresh = async () => {
    if (!user) return;
    
    console.log('🔄 Force refreshing data...');
    // Reset the loaded flag to force a fresh load
    settingsLoadedRef.current = false;
    initialLoadCompleteRef.current = false;
    await loadData();
  };

  return {
    records,
    settings,
    loading,
    error,
    saveRecord,
    deleteRecord,
    updateSettings,
    refetch: loadData,
    forceRefresh
  };
};