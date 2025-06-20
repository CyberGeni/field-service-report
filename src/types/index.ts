export interface ServiceRecord {
  id: string;
  date: string;
  hours: number;
  minutes: number;
  type: 'h2h' | 'cart';
  notes?: string;
}

export interface FieldServiceDay {
  day: number; // 0-6 (Sunday-Saturday)
  type: 'h2h' | 'cart';
  potentialHours: number;
  label: string;
}

export interface Settings {
  monthlyTarget: number;
  yearlyTarget: number;
  fieldServiceDays: FieldServiceDay[];
  username: string;
  password: string;
  serviceYearStart: string; // YYYY-MM format
}

export interface Profile {
  id: string;
  name: string;
  avatar_url?: string;
  service_type: 'publisher' | 'auxiliary_pioneer' | 'regular_pioneer';
  created_at: string;
  updated_at: string;
}

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  startTime: number | null;
  pausedTime: number;
  totalTime: number;
}

export interface MonthlyStats {
  totalHours: number;
  targetHours: number;
  deficit: number;
  surplus: number;
  recordsCount: number;
  isOnTrack: boolean;
  expectedHoursByNow: number;
}

export interface YearlyStats {
  totalHours: number;
  targetHours: number;
  monthsRemaining: number;
  hoursPerMonthNeeded: number;
  isOnTrack: boolean;
}

export interface FieldServiceSuggestion {
  date: string;
  dayName: string;
  type: 'h2h' | 'cart';
  potentialHours: number;
  priority: 'high' | 'medium' | 'low';
}