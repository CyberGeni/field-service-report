import { ServiceRecord, MonthlyStats, YearlyStats, Settings, Profile, FieldServiceSuggestion } from '../types';
import { getCurrentMonth, getDaysElapsedInMonth, getTotalMinutes } from './dateUtils';
import { getServiceTypeTargets, hasHourRequirement } from './serviceTypes';

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
  
  // Use service type targets only if the service type has requirements
  // Otherwise, use custom settings
  const targetHours = (profile?.service_type && hasHourRequirement(profile.service_type))
    ? getServiceTypeTargets(profile.service_type).monthlyTarget
    : settings.monthlyTarget;
  
  // Calculate expected hours by now (dynamic tracking)
  const currentDate = new Date();
  const [year, monthNum] = month.split('-').map(Number);
  const monthStart = new Date(year, monthNum - 1, 1);
  const monthEnd = new Date(year, monthNum, 0);
  const daysInMonth = monthEnd.getDate();
  const currentDay = currentDate.getMonth() === monthNum - 1 && currentDate.getFullYear() === year 
    ? Math.min(currentDate.getDate(), daysInMonth)
    : daysInMonth;
  
  const progressThroughMonth = currentDay / daysInMonth;
  const expectedHoursByNow = targetHours * progressThroughMonth;
  
  const isOnTrack = totalHours >= expectedHoursByNow;
  const deficit = Math.max(0, expectedHoursByNow - totalHours);
  const surplus = Math.max(0, totalHours - expectedHoursByNow);
  
  return {
    totalHours,
    targetHours,
    deficit,
    surplus,
    recordsCount: monthRecords.length,
    isOnTrack,
    expectedHoursByNow
  };
};

const getDefaultServiceYearStart = (): string => {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed: 8 = September
  const year = now.getFullYear();
  return `${month >= 8 ? year : year - 1}-09`;
};

export const calculateYearlyStats = (
  records: ServiceRecord[],
  settings: Settings,
  profile?: Profile | null
): YearlyStats => {
  const currentDate = new Date();
  const serviceYearStartStr = settings.serviceYearStart || getDefaultServiceYearStart();
  const serviceYearStart = new Date(serviceYearStartStr + '-01');
  const serviceYearEnd = new Date(serviceYearStart.getFullYear() + 1, serviceYearStart.getMonth(), 0);
  
  const yearRecords = records.filter(record => {
    const recordDate = new Date(record.date);
    return recordDate >= serviceYearStart && recordDate <= serviceYearEnd;
  });
  
  const totalMinutes = yearRecords.reduce((total, record) => {
    return total + getTotalMinutes(record.hours, record.minutes);
  }, 0);
  
  const totalHours = totalMinutes / 60;
  
  // Use service type targets only if the service type has requirements
  // Otherwise, use custom settings
  const targetHours = (profile?.service_type && hasHourRequirement(profile.service_type))
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

export const generateFieldServiceSuggestions = (
  records: ServiceRecord[],
  settings: Settings,
  month: string
): FieldServiceSuggestion[] => {
  const monthlyStats = calculateMonthlyStats(records, settings, month);
  const hoursNeeded = Math.max(0, monthlyStats.targetHours - monthlyStats.totalHours);
  
  if (hoursNeeded <= 0) {
    return []; // Already met target
  }
  
  const currentDate = new Date();
  const currentHour = currentDate.getHours();
  const [year, monthNum] = month.split('-').map(Number);

  // Only suggest dates from today onwards within the current month
  const isCurrentMonth = currentDate.getFullYear() === year && (currentDate.getMonth() + 1) === monthNum;

  // If this is the current month, determine start day based on time
  let startDay: number;
  if (isCurrentMonth) {
    // If it's late in the day (after 6 PM), start suggestions from tomorrow
    if (currentHour >= 18) {
      startDay = currentDate.getDate() + 1;
    } else {
      startDay = currentDate.getDate();
    }
  } else {
    startDay = 1; // Start from the 1st for other months
  }

  const monthEnd = new Date(year, monthNum, 0);
  const daysInMonth = monthEnd.getDate();

  const suggestions: FieldServiceSuggestion[] = [];
  const recordedDates = new Set(records.filter(r => r.date.startsWith(month)).map(r => r.date));

  // Generate suggestions for remaining days in the month (starting from appropriate day)
  for (let day = startDay; day <= daysInMonth; day++) {
    const date = new Date(year, monthNum - 1, day);
    // Build date string directly from parts to avoid UTC timezone shifting
    const dateString = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Skip if already recorded
    if (recordedDates.has(dateString)) {
      continue;
    }
    
    // Check if this day matches any of the configured field service days
    const fieldServiceDay = settings.fieldServiceDays.find(fsd => fsd.day === date.getDay());
    if (!fieldServiceDay) {
      continue;
    }
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Determine priority based on hours needed and potential hours
    let priority: 'high' | 'medium' | 'low' = 'low';
    if (hoursNeeded >= fieldServiceDay.potentialHours * 0.8) {
      priority = 'high';
    } else if (hoursNeeded >= fieldServiceDay.potentialHours * 0.4) {
      priority = 'medium';
    }
    
    const suggestion = {
      date: dateString,
      dayName: dayNames[date.getDay()],
      type: fieldServiceDay.type,
      potentialHours: fieldServiceDay.potentialHours,
      priority
    };
    
    suggestions.push(suggestion);
  }
  
  // Sort chronologically
  return suggestions.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10);
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
export interface MonthlyTotals {
  hours: number;
  studies: number;
  dailyAverage: number;
  weeklyAverage: number;
}

const DAYS_PER_WEEK = 7;

// Only the two columns the stats views actually aggregate over
export interface VisitSummary {
  visit_date: string;
  student_id: string;
}

/**
 * Hours and unique bible studies for each of the given months, in one pass.
 *
 * Records and visits are already in memory by the time the stats screen renders, so
 * this stays synchronous: changing month or period must never wait on the network.
 */
export const calculateMonthlyTotals = (
  records: ServiceRecord[],
  visits: VisitSummary[],
  months: string[]
): Record<string, MonthlyTotals> => {
  const minutesByMonth = new Map<string, number>();
  const studentsByMonth = new Map<string, Set<string>>();

  records.forEach(record => {
    const monthKey = record.date.slice(0, 7);
    const minutes = getTotalMinutes(record.hours, record.minutes);
    minutesByMonth.set(monthKey, (minutesByMonth.get(monthKey) || 0) + minutes);
  });

  visits.forEach(visit => {
    const monthKey = visit.visit_date.slice(0, 7);
    const students = studentsByMonth.get(monthKey) || new Set<string>();
    students.add(visit.student_id);
    studentsByMonth.set(monthKey, students);
  });

  const totals: Record<string, MonthlyTotals> = {};

  months.forEach(monthKey => {
    const hours = (minutesByMonth.get(monthKey) || 0) / 60;
    const daysElapsed = getDaysElapsedInMonth(monthKey);
    const dailyAverage = daysElapsed > 0 ? hours / daysElapsed : 0;

    totals[monthKey] = {
      hours,
      studies: studentsByMonth.get(monthKey)?.size || 0,
      dailyAverage,
      // Averaged over the days lived so far, so a month in progress reads as the pace
      // it is actually being worked at rather than being diluted by days to come.
      weeklyAverage: dailyAverage * DAYS_PER_WEEK
    };
  });

  return totals;
};

/** Earliest and latest month holding any data, or null when there is none. */
export const getDataMonthBounds = (
  records: ServiceRecord[],
  visits: VisitSummary[]
): { first: string; last: string } | null => {
  let first: string | null = null;
  let last: string | null = null;

  const consider = (monthKey: string) => {
    if (!first || monthKey < first) first = monthKey;
    if (!last || monthKey > last) last = monthKey;
  };

  records.forEach(record => consider(record.date.slice(0, 7)));
  visits.forEach(visit => consider(visit.visit_date.slice(0, 7)));

  return first && last ? { first, last } : null;
};
