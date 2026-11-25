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

/**
 * A change to the usual week for one date.
 *
 * `off`: not going out that day - a wedding, a convention, a sick child - even if it
 * is one of the usual field service days. `out`: going out that day, for the hours
 * given: an extra day to make up for one taken off, or a usual day with more or less
 * time than usual.
 */
export type FieldDayOverride =
  | { date: string; kind: 'off'; note?: string }
  | { date: string; kind: 'out'; type: 'h2h' | 'cart'; potentialHours: number; note?: string };

export interface Settings {
  monthlyTarget: number;
  yearlyTarget: number;
  fieldServiceDays: FieldServiceDay[];
  // One-off changes to the week, by date. Optional: copies cached before these
  // existed have none.
  dayOverrides?: FieldDayOverride[];
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

/**
 * What someone is to the publisher right now. A return visit is someone met in the
 * ministry who is worth going back to; a study is someone they study the Bible with.
 * Return visits often become studies, which is why both are one kind of record.
 */
export type PersonStatus = 'return_visit' | 'study';

/** Someone the publisher calls back on - a return visit or a Bible study. */
export interface Student {
  id: string;
  user_id: string;
  name: string;
  // May be empty for a return visit added in a hurry at the door
  address: string;
  publication_left?: string;
  place_stopped?: string;
  date_met: string;
  last_visit_date?: string;
  last_study_notes?: string;
  status: PersonStatus;
  // Weekdays they are usually home, 0 = Sunday .. 6 = Saturday
  preferred_days: number[];
  // When on those days, e.g. "Evening" - free text
  preferred_time?: string;
  // A day they asked to be called on
  next_visit_date?: string;
  // A photo of where they live, as a path in the people-photos bucket
  photo_path?: string;
  created_at: string;
  updated_at: string;
}

/** The fields a person is created or edited with; the rest are set by the app. */
export type StudentInput = Omit<Student, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export interface StudentVisit {
  id: string;
  student_id: string;
  user_id: string;
  visit_date: string;
  place_stopped?: string;
  notes?: string;
  // Whether this call was a Bible study (counted on the report) or a return visit
  is_study: boolean;
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
  // Set for this date alone rather than one of the usual days
  isOneOff: boolean;
  note?: string;
}

export interface FieldServicePlan {
  days: FieldServicePlanDay[];
  hoursNeeded: number;
  // Everything the remaining field days could give at their set available time
  totalCapacity: number;
  shortfallHours: number;
  onPaceToMeetTarget: boolean;
}