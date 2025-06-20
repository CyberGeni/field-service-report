import { useState, useEffect } from 'react';
import { ServiceRecord, Settings } from '../types';

const DEFAULT_SETTINGS: Settings = {
  monthlyTarget: 50,
  yearlyTarget: 600,
  fieldServiceDays: [0, 6], // Sunday and Saturday
  username: '',
  password: '',
  serviceYearStart: '2024-09'
};

export const useStorage = () => {
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    // Load data from localStorage
    const savedRecords = localStorage.getItem('fieldService_records');
    const savedSettings = localStorage.getItem('fieldService_settings');

    if (savedRecords) {
      try {
        setRecords(JSON.parse(savedRecords));
      } catch (error) {
        console.error('Error loading records:', error);
      }
    }

    if (savedSettings) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
  }, []);

  const saveRecord = (record: ServiceRecord) => {
    const updatedRecords = [...records.filter(r => r.id !== record.id), record];
    setRecords(updatedRecords);
    localStorage.setItem('fieldService_records', JSON.stringify(updatedRecords));
  };

  const deleteRecord = (id: string) => {
    const updatedRecords = records.filter(r => r.id !== id);
    setRecords(updatedRecords);
    localStorage.setItem('fieldService_records', JSON.stringify(updatedRecords));
  };

  const updateSettings = (newSettings: Partial<Settings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    localStorage.setItem('fieldService_settings', JSON.stringify(updatedSettings));
  };

  return {
    records,
    settings,
    saveRecord,
    deleteRecord,
    updateSettings
  };
};