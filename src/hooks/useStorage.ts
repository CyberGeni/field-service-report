import { useState, useEffect } from 'react';
import { ServiceRecord, Settings, FieldServiceDay } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

const DEFAULT_SETTINGS: Settings = {
  monthlyTarget: 10,
  yearlyTarget: 120,
  fieldServiceDays: [
    { day: 6, type: 'h2h_rv', potentialHours: 4, label: 'Saturday - House to House/Return Visits' },
    { day: 0, type: 'h2h_rv', potentialHours: 3, label: 'Sunday - House to House/Return Visits' }
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
        type: record.type as 'h2h' | 'rv' | 'cart',
        notes: record.notes || undefined
      }));

      setRecords(transformedRecords);

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
        // Parse field service days from database format
        let fieldServiceDays = DEFAULT_SETTINGS.fieldServiceDays;
        
        // Try to use the new field_service_days_config column first
        if (settingsData.field_service_days_config) {
          try {
            fieldServiceDays = Array.isArray(settingsData.field_service_days_config) 
              ? settingsData.field_service_days_config 
              : DEFAULT_SETTINGS.fieldServiceDays;
          } catch (e) {
            console.warn('Failed to parse field_service_days_config, using default');
            fieldServiceDays = DEFAULT_SETTINGS.fieldServiceDays;
          }
        }
        // Fallback to legacy field_service_days if config is not available
        else if (settingsData.field_service_days && Array.isArray(settingsData.field_service_days)) {
          // Convert legacy format to new format
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          fieldServiceDays = settingsData.field_service_days.map((day: number, index: number) => ({
            day,
            type: index % 2 === 0 ? 'h2h_rv' : 'cart',
            potentialHours: index % 2 === 0 ? 4 : 2,
            label: `${dayNames[day]} - ${index % 2 === 0 ? 'House to House/Return Visits' : 'Cart Witnessing'}`
          }));
        }

        setSettings({
          monthlyTarget: settingsData.monthly_target,
          yearlyTarget: settingsData.yearly_target,
          fieldServiceDays,
          serviceYearStart: settingsData.service_year_start,
          username: '', // We'll get this from profile
          password: '' // Not stored in database
        });
      } else {
        // Create default settings for new user
        await createDefaultSettings();
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    if (!user) return;

    try {
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
    } catch (err: any) {
      console.error('Error creating default settings:', err);
    }
  };

  const saveRecord = async (record: ServiceRecord) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    try {
      setError(null);

      // Check if record already exists (for updates)
      const existingRecord = records.find(r => r.id === record.id);

      if (existingRecord) {
        // Update existing record
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
      } else {
        // Insert new record
        const { error } = await supabase
          .from('service_records')
          .insert({
            id: record.id,
            user_id: user.id,
            date: record.date,
            hours: record.hours,
            minutes: record.minutes,
            type: record.type,
            notes: record.notes || null
          });

        if (error) throw error;
      }

      // Update local state
      const updatedRecords = [...records.filter(r => r.id !== record.id), record]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecords(updatedRecords);

    } catch (err: any) {
      console.error('Error saving record:', err);
      setError(err.message);
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

      // Prepare the update data
      const updateData: any = {
        user_id: user.id,
        monthly_target: updatedSettings.monthlyTarget,
        yearly_target: updatedSettings.yearlyTarget,
        field_service_days: updatedSettings.fieldServiceDays.map(fsd => fsd.day), // Legacy format for compatibility
        field_service_days_config: updatedSettings.fieldServiceDays, // New format with full structure
        service_year_start: updatedSettings.serviceYearStart
      };

      console.log('Updating settings with data:', updateData);

      const { error } = await supabase
        .from('user_settings')
        .upsert(updateData, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      // Update local state only after successful database update
      setSettings(updatedSettings);
      console.log('Settings updated successfully:', updatedSettings);

    } catch (err: any) {
      console.error('Error updating settings:', err);
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