/**
 * What a logged entry represents: time spent preaching, or hours credited.
 *
 * `school` is a one-off credit for attending a theocratic school; `volunteer` is
 * credit for a volunteer assignment and is only offered to users who have said they
 * do that work. Both are logged as service records so they count toward the month
 * without a second ledger to keep in step.
 */
export type ServiceActivity = 'h2h' | 'cart' | 'volunteer' | 'school';

export interface ServiceRecord {
  id: string;
  date: string;
  hours: number;
  minutes: number;
  type: ServiceActivity;
  notes?: string;
  student_id?: string;
}

export interface FieldServiceDay {
  day: number; // 0-6 (Sunday-Saturday)
  type: 'h2h' | 'cart';
  potentialHours: number;
  label: string;
  /**
   * Days to fill first when planning the month. Left unset it follows the type -
   * house to house is the work, cart days are what a month falls back on - but a
   * user whose week runs the other way can say so per day.
   */
  isPriority?: boolean;
}

export interface Settings {
  monthlyTarget: number;
  yearlyTarget: number;
  fieldServiceDays: FieldServiceDay[];
  username: string;
  password: string;
}

export interface Profile {
  id: string;
  name: string;
  avatar_url?: string;
  service_type: 'publisher' | 'auxiliary_pioneer' | 'regular_pioneer';
  // Whether volunteer hour credits are offered to this user at all
  is_volunteer?: boolean;
  // Absent on a profile that has only just been assembled locally
  created_at?: string;
  updated_at?: string;
}

export interface Student {
  id: string;
  user_id: string;
  name: string;
  address: string;
  publication_left?: string;
  place_stopped?: string;
  date_met: string;
  last_visit_date?: string;
  last_study_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface StudentVisit {
  id: string;
  student_id: string;
  user_id: string;
  visit_date: string;
  place_stopped?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  startTime: number | null;
  pausedTime: number;
  totalTime: number;
  serviceType: 'h2h' | 'cart';
}

export interface MonthlyStats {
  totalHours: number;
  // The same total split by where the hours came from
  preachingHours: number;
  volunteerHours: number;
  schoolHours: number;
  creditHours: number;
  targetHours: number;
  deficit: number;
  surplus: number;
  recordsCount: number;
  isOnTrack: boolean;
  expectedHoursByNow: number;
}

export interface YearlyStats {
  totalHours: number;
  preachingHours: number;
  creditHours: number;
  targetHours: number;
  monthsRemaining: number;
  hoursPerMonthNeeded: number;
  isOnTrack: boolean;
}

/** One field day in the plan: when to go out, and how long to aim for on it. */
export interface FieldServicePlanDay {
  date: string;
  dayName: string;
  type: 'h2h' | 'cart';
  // The time set aside for this weekday in settings - the day's ceiling
  potentialHours: number;
  // What the day has to deliver for the month to land on target
  plannedHours: number;
  // The day is being asked for everything it has, so nothing can slip onto it
  isMaxed: boolean;
  isPriority: boolean;
}

export interface FieldServicePlan {
  days: FieldServicePlanDay[];
  hoursNeeded: number;
  // Everything the remaining field days could give at their set available time
  totalCapacity: number;
  shortfallHours: number;
  onPaceToMeetTarget: boolean;
}