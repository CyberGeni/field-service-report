import { useState, useEffect } from 'react';
import { ServiceRecord, Settings, FieldServiceDay } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

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

  // Load data when user changes
  useEffect(() => {
    if (user) {
      console.log('🔄 User changed, loading data for:', user.id);
      loadData();
    } else {
      // Clear data when user logs out
      console.log('🚪 User logged out, clearing data');
      setRecords([]);
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
    }
  }, [user]);

  const parseSettingsFromDatabase = (settingsData: any): Settings => {
    console.log('📊 Raw database settings:', JSON.stringify(settingsData, null, 2));
    
    // Parse field service days from database format
    let fieldServiceDays = DEFAULT_SETTINGS.fieldServiceDays;
    
    // PRIORITY 1: Try to use the new field_service_days_config column first
    if (settingsData.field_service_days_config) {
      console.log('🔍 Found field_service_days_config:', settingsData.field_service_days_config);
      
      if (Array.isArray(settingsData.field_service_days_config) && settingsData.field_service_days_config.length > 0) {
        try {
          fieldServiceDays = settingsData.field_service_days_config.map((fsd: any) => ({
            day: fsd.day,
            type: fsd.type === 'h2h_rv' ? 'h2h' : fsd.type, // Convert old format
            potentialHours: fsd.potentialHours || fsd.potential_hours || 2, // Handle different naming
            label: fsd.label || `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][fsd.day]} - ${fsd.type === 'h2h' ? 'House to House/Return Visits' : 'Cart Witnessing'}`
          }));
          console.log('✅ Successfully parsed field_service_days_config:', fieldServiceDays);
        } catch (e) {
          console.warn('⚠️ Failed to parse field_service_days_config:', e);
          console.warn('Raw field_service_days_config data:', settingsData.field_service_days_config);
          // Don't fall back to defaults - keep trying other methods
        }
      } else {
        console.warn('⚠️ field_service_days_config is empty or not an array:', settingsData.field_service_days_config);
      }
    }
    
    // PRIORITY 2: If config parsing failed or is empty, try legacy field_service_days
    if (fieldServiceDays === DEFAULT_SETTINGS.fieldServiceDays && settingsData.field_service_days && Array.isArray(settingsData.field_service_days) && settingsData.field_service_days.length > 0) {
      console.log('🔄 Converting legacy field_service_days:', settingsData.field_service_days);
      // Convert legacy format to new format
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      fieldServiceDays = settingsData.field_service_days.map((day: number, index: number) => ({
        day,
        type: index % 2 === 0 ? 'h2h' : 'cart',
        potentialHours: index % 2 === 0 ? 4 : 2,
        label: `${dayNames[day]} - ${index % 2 === 0 ? 'House to House/Return Visits' : 'Cart Witnessing'}`
      }));
      console.log('✅ Converted legacy field service days:', fieldServiceDays);
    }
    
    // PRIORITY 3: Only use defaults if absolutely nothing was found
    if (fieldServiceDays === DEFAULT_SETTINGS.fieldServiceDays) {
      console.log('⚠️ No field service days found in database, using defaults');
    }

    const parsedSettings = {
      monthlyTarget: settingsData.monthly_target || DEFAULT_SETTINGS.monthlyTarget,
      yearlyTarget: settingsData.yearly_target || DEFAULT_SETTINGS.yearlyTarget,
      fieldServiceDays,
      serviceYearStart: settingsData.service_year_start || DEFAULT_SETTINGS.serviceYearStart,
      username: '', // We'll get this from profile
      password: '' // Not stored in database
    };

    console.log('📋 Final parsed settings:', JSON.stringify(parsedSettings, null, 2));
    return parsedSettings;
  };

  const loadData = async () => {
    if (!user) {
      console.log('❌ No user, cannot load data');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Loading fresh data for user:', user.id);

      // Load service records
      const { data: recordsData, error: recordsError } = await supabase
        .from('service_records')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (recordsError) {
        console.error('❌ Error loading records:', recordsError);
        throw recordsError;
      }

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
      console.log('✅ Loaded service records:', transformedRecords.length, 'records');

      // Load user settings - FORCE a fresh database query every time
      console.log('🔍 Querying user_settings table with fresh query...');
      
      // Use a timestamp to ensure we get fresh data
      const timestamp = Date.now();
      console.log('🕐 Query timestamp:', timestamp);
      
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);

      console.log('📊 Settings query result:', { settingsData, settingsError, timestamp });

      if (settingsError) {
        console.error('❌ Error loading settings:', settingsError);
        if (settingsError.code === 'PGRST116') {
          // No settings found - this is a new user
          console.log('📝 No settings found for user, creating default settings');
          await createDefaultSettings();
        } else {
          throw settingsError;
        }
      } else if (settingsData && settingsData.length > 0) {
        console.log('📊 Found settings in database, parsing...');
        const loadedSettings = parseSettingsFromDatabase(settingsData[0]);
        console.log('✅ Settings loaded and parsed successfully');
        setSettings(loadedSettings);
      } else {
        console.log('📝 No settings data returned, creating defaults');
        await createDefaultSettings();
      }
    } catch (err: any) {
      console.error('❌ Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    if (!user) {
      console.log('❌ No user, cannot create default settings');
      return;
    }

    try {
      console.log('📝 Creating default settings for user:', user.id);
      console.log('📝 Default field service days:', DEFAULT_SETTINGS.fieldServiceDays);
      
      const insertData = {
        user_id: user.id,
        monthly_target: DEFAULT_SETTINGS.monthlyTarget,
        yearly_target: DEFAULT_SETTINGS.yearlyTarget,
        field_service_days: DEFAULT_SETTINGS.fieldServiceDays.map(fsd => fsd.day), // Legacy format
        field_service_days_config: DEFAULT_SETTINGS.fieldServiceDays, // New format
        service_year_start: DEFAULT_SETTINGS.serviceYearStart
      };

      console.log('📝 Inserting default settings:', JSON.stringify(insertData, null, 2));

      const { data, error } = await supabase
        .from('user_settings')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating default settings:', error);
        throw error;
      }
      
      console.log('✅ Default settings created successfully:', data);
      setSettings(DEFAULT_SETTINGS);
    } catch (err: any) {
      console.error('❌ Error creating default settings:', err);
      // Don't throw here - just use defaults in memory
      setSettings(DEFAULT_SETTINGS);
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
      console.error('Error saving record:', err);
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
      console.error('Error deleting record:', err);
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

      console.log('💾 Updating settings...');
      console.log('💾 Current settings:', JSON.stringify(settings, null, 2));
      console.log('💾 New settings:', JSON.stringify(newSettings, null, 2));
      console.log('💾 Updated settings:', JSON.stringify(updatedSettings, null, 2));
      console.log('💾 Field service days to save:', updatedSettings.fieldServiceDays);

      // Prepare the update data - ALWAYS include both formats
      const updateData: any = {
        user_id: user.id,
        monthly_target: updatedSettings.monthlyTarget,
        yearly_target: updatedSettings.yearlyTarget,
        field_service_days: updatedSettings.fieldServiceDays.map(fsd => fsd.day), // Legacy format
        field_service_days_config: updatedSettings.fieldServiceDays, // New format - THIS IS THE IMPORTANT ONE
        service_year_start: updatedSettings.serviceYearStart
      };

      console.log('💾 Saving to database:', JSON.stringify(updateData, null, 2));

      // Save to database using upsert to handle both insert and update
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

      console.log('✅ Settings saved to database successfully:', data);

      // Update local state ONLY after successful database save
      setSettings(updatedSettings);
      console.log('✅ Local settings updated');

      // Verify the save worked by reading back from database after a short delay
      setTimeout(async () => {
        console.log('🔍 Verifying save...');
        const { data: verifyData, error: verifyError } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (verifyError) {
          console.error('❌ Verification failed:', verifyError);
        } else {
          console.log('🔍 Verification successful - complete settings in DB:', JSON.stringify(verifyData, null, 2));
          console.log('🔍 Field service days config in DB:', verifyData.field_service_days_config);
          
          // If the verification shows different data, force a reload
          const verifiedSettings = parseSettingsFromDatabase(verifyData);
          const currentFieldServiceDaysStr = JSON.stringify(updatedSettings.fieldServiceDays);
          const verifiedFieldServiceDaysStr = JSON.stringify(verifiedSettings.fieldServiceDays);
          
          if (currentFieldServiceDaysStr !== verifiedFieldServiceDaysStr) {
            console.warn('⚠️ Verification shows different field service days! Forcing reload...');
            console.warn('Expected:', currentFieldServiceDaysStr);
            console.warn('Actual:', verifiedFieldServiceDaysStr);
            // Force reload from database
            loadData();
          } else {
            console.log('✅ Verification passed - data matches');
          }
        }
      }, 1000);

    } catch (err: any) {
      console.error('❌ Error updating settings:', err);
      setError(err.message);
      throw err;
    }
  };

  return {
    records,
    settings,
    loading,
    error,
    saveRecord,
    deleteRecord,
    updateSettings,
    refetch: loadData
  };
};