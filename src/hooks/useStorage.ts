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
      loadData();
    } else {
      // Clear data when user logs out
      setRecords([]);
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Loading data for user:', user.id);

      // Load service records
      const { data: recordsData, error: recordsError } = await supabase
        .from('service_records')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (recordsError) throw recordsError;

      // Transform database records to match our ServiceRecord type
      // Convert 'rv' type to 'h2h' since we merged them
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

      // Load user settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (settingsError && settingsError.code !== 'PGRST116') {
        throw settingsError;
      }

      if (settingsData) {
        console.log('📊 Raw settings data from database:', settingsData);
        
        // Parse field service days from database format
        let fieldServiceDays = DEFAULT_SETTINGS.fieldServiceDays;
        
        // Try to use the new field_service_days_config column first
        if (settingsData.field_service_days_config && Array.isArray(settingsData.field_service_days_config)) {
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
            fieldServiceDays = DEFAULT_SETTINGS.fieldServiceDays;
          }
        }
        // Fallback to legacy field_service_days if config is not available
        else if (settingsData.field_service_days && Array.isArray(settingsData.field_service_days)) {
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
        } else {
          console.log('⚠️ No field service days found in database, using defaults');
        }

        const loadedSettings = {
          monthlyTarget: settingsData.monthly_target,
          yearlyTarget: settingsData.yearly_target,
          fieldServiceDays,
          serviceYearStart: settingsData.service_year_start,
          username: '', // We'll get this from profile
          password: '' // Not stored in database
        };

        console.log('✅ Final loaded settings:', loadedSettings);
        console.log('🎯 Field service days loaded:', loadedSettings.fieldServiceDays);
        setSettings(loadedSettings);
      } else {
        console.log('📝 No settings found, creating default settings');
        // Create default settings for new user
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
    if (!user) return;

    try {
      console.log('📝 Creating default settings for user:', user.id);
      console.log('📝 Default field service days:', DEFAULT_SETTINGS.fieldServiceDays);
      
      const { error } = await supabase
        .from('user_settings')
        .insert({
          user_id: user.id,
          monthly_target: DEFAULT_SETTINGS.monthlyTarget,
          yearly_target: DEFAULT_SETTINGS.yearlyTarget,
          field_service_days: DEFAULT_SETTINGS.fieldServiceDays.map(fsd => fsd.day), // Legacy format
          field_service_days_config: DEFAULT_SETTINGS.fieldServiceDays, // New format
          service_year_start: DEFAULT_SETTINGS.serviceYearStart
        });

      if (error) throw error;
      
      console.log('✅ Default settings created successfully');
      setSettings(DEFAULT_SETTINGS);
    } catch (err: any) {
      console.error('❌ Error creating default settings:', err);
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

      console.log('💾 Starting settings update...');
      console.log('💾 Current settings:', settings);
      console.log('💾 New settings partial:', newSettings);
      console.log('💾 Updated settings (merged):', updatedSettings);
      console.log('🎯 Field service days to save:', updatedSettings.fieldServiceDays);

      // Prepare the update data - ensure field service days are properly formatted
      const updateData: any = {
        user_id: user.id,
        monthly_target: updatedSettings.monthlyTarget,
        yearly_target: updatedSettings.yearlyTarget,
        field_service_days: updatedSettings.fieldServiceDays.map(fsd => fsd.day), // Legacy format for compatibility
        field_service_days_config: updatedSettings.fieldServiceDays, // New format with full structure
        service_year_start: updatedSettings.serviceYearStart
      };

      console.log('💾 Prepared update data for database:', updateData);
      console.log('💾 field_service_days (legacy):', updateData.field_service_days);
      console.log('💾 field_service_days_config (new):', updateData.field_service_days_config);

      // Use upsert to handle both insert and update cases
      const { data, error } = await supabase
        .from('user_settings')
        .upsert(updateData, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Database error during settings update:', error);
        console.error('❌ Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('✅ Settings updated successfully in database');
      console.log('✅ Database response:', data);

      // Verify what was actually saved
      if (data) {
        console.log('🔍 Verification - what was saved to database:');
        console.log('🔍 monthly_target:', data.monthly_target);
        console.log('🔍 yearly_target:', data.yearly_target);
        console.log('🔍 field_service_days (legacy):', data.field_service_days);
        console.log('🔍 field_service_days_config (new):', data.field_service_days_config);
        console.log('🔍 service_year_start:', data.service_year_start);
      }

      // Update local state only after successful database update
      setSettings(updatedSettings);
      console.log('✅ Local settings updated successfully');
      console.log('✅ New local field service days:', updatedSettings.fieldServiceDays);

      // Immediately verify by reading back from database
      console.log('🔍 Performing immediate verification read...');
      const { data: verificationData, error: verificationError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (verificationError) {
        console.error('❌ Verification read failed:', verificationError);
      } else {
        console.log('🔍 Verification read successful:');
        console.log('🔍 field_service_days_config from DB:', verificationData.field_service_days_config);
        console.log('🔍 Does it match what we tried to save?', 
          JSON.stringify(verificationData.field_service_days_config) === JSON.stringify(updatedSettings.fieldServiceDays)
        );
      }

    } catch (err: any) {
      console.error('❌ Error updating settings:', err);
      setError(err.message);
      throw err; // Re-throw to allow UI to handle the error
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