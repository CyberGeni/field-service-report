import { ServiceRecord, MonthlyStats, YearlyStats, Settings, Profile } from '../types';
import { getCurrentMonth, getTotalMinutes } from './dateUtils';
import { getServiceTypeTargets } from './serviceTypes';

export const calculateMonthlyStats = (
  records: ServiceRecord[],
  settings: Settings,
  month: string,
  profile?: Profile | null
): MonthlyStats => {
  const monthRecords = records.filter(record => record.date.startsWith(month));
  
  const totalMinutes = monthRecords.reduce((total, record) => {
    return total + getTotalMinutes(record.hours, record.minutes);
  }, 0);
  
  const totalHours = totalMinutes / 60;
  
  // Use service type targets if profile exists, otherwise fall back to settings
  const targetHours = profile?.service_type 
    ? getServiceTypeTargets(profile.service_type).monthlyTarget
    : settings.monthlyTarget;
  
  const deficit = Math.max(0, targetHours - totalHours);
  const surplus = Math.max(0, totalHours - targetHours);
  
  return {
    totalHours,
    targetHours,
    deficit,
    surplus,
    recordsCount: monthRecords.length
  };
};

export const calculateYearlyStats = (
  records: ServiceRecord[],
  settings: Settings,
  profile?: Profile | null
): YearlyStats => {
  const currentDate = new Date();
  const serviceYearStart = new Date(settings.serviceYearStart + '-01');
  const serviceYearEnd = new Date(serviceYearStart.getFullYear() + 1, serviceYearStart.getMonth(), 0);
  
  const yearRecords = records.filter(record => {
    const recordDate = new Date(record.date);
    return recordDate >= serviceYearStart && recordDate <= serviceYearEnd;
  });
  
  const totalMinutes = yearRecords.reduce((total, record) => {
    return total + getTotalMinutes(record.hours, record.minutes);
  }, 0);
  
  const totalHours = totalMinutes / 60;
  
  // Use service type targets if profile exists, otherwise fall back to settings
  const targetHours = profile?.service_type 
    ? getServiceTypeTargets(profile.service_type).yearlyTarget
    : settings.yearlyTarget;
  
  const monthsElapsed = Math.floor((currentDate.getTime() - serviceYearStart.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  const monthsRemaining = Math.max(0, 12 - monthsElapsed);
  
  const hoursNeeded = Math.max(0, targetHours - totalHours);
  const hoursPerMonthNeeded = monthsRemaining > 0 ? hoursNeeded / monthsRemaining : 0;
  
  const expectedHoursByNow = (targetHours / 12) * monthsElapsed;
  const isOnTrack = totalHours >= expectedHoursByNow;
  
  return {
    totalHours,
    targetHours,
    monthsRemaining,
    hoursPerMonthNeeded,
    isOnTrack
  };
};

export const getProgressPercentage = (current: number, target: number): number => {
  return Math.min(100, (current / target) * 100);
};

export const getStatusColor = (current: number, target: number): string => {
  const percentage = getProgressPercentage(current, target);
  if (percentage >= 100) return 'text-green-600';
  if (percentage >= 75) return 'text-blue-600';
  if (percentage >= 50) return 'text-yellow-600';
  return 'text-red-600';
};

export const getProgressBarColor = (current: number, target: number): string => {
  const percentage = getProgressPercentage(current, target);
  if (percentage >= 100) return 'bg-green-500';
  if (percentage >= 75) return 'bg-blue-500';
  if (percentage >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
};