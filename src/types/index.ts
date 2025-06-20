export interface ServiceRecord {
  id: string;
  date: string;
  hours: number;
  minutes: number;
  type: 'h2h' | 'rv' | 'cart';
  notes?: string;
}

export interface Settings {
  monthlyTarget: number;
  yearlyTarget: number;
  fieldServiceDays: number[]; // 0-6 (Sunday-Saturday)
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
}

export interface YearlyStats {
  totalHours: number;
  targetHours: number;
  monthsRemaining: number;
  hoursPerMonthNeeded: number;
  isOnTrack: boolean;
}