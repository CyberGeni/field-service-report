import { ServiceRecord, MonthlyStats, YearlyStats, Settings, Profile, FieldServicePlan, FieldServicePlanDay } from '../types';
import { getCurrentServiceYearStart, getDaysElapsedInMonth, getTotalMinutes, isPriorityFieldDay } from './dateUtils';
import { getServiceTypeTargets, hasHourRequirement } from './serviceTypes';
import { isPreachingActivity } from './activityTypes';

/**
 * Minutes in a set of records, split by where the hours came from.
 *
 * Credits count toward the month exactly like preached time does - they are hours on
 * the report either way - but the split is kept so a screen can show what the month
 * was actually made of instead of one opaque figure.
 */
const splitMinutes = (records: ServiceRecord[]) => {
  let preaching = 0;
  let volunteer = 0;
  let school = 0;

  records.forEach(record => {
    const minutes = getTotalMinutes(record.hours, record.minutes);
    if (record.type === 'volunteer') volunteer += minutes;
    else if (record.type === 'school') school += minutes;
    else preaching += minutes;
  });

  return { preaching, volunteer, school, credit: volunteer + school, total: preaching + volunteer + school };
};

export const calculateMonthlyStats = (
  records: ServiceRecord[],
  settings: Settings,
  month: string,
  profile?: Profile | null
): MonthlyStats => {
  const monthRecords = records.filter(record => record.date.startsWith(month));

  const minutes = splitMinutes(monthRecords);
  const totalHours = minutes.total / 60;
  
  // Use service type targets only if the service type has requirements
  // Otherwise, use custom settings
  const targetHours = (profile?.service_type && hasHourRequirement(profile.service_type))
    ? getServiceTypeTargets(profile.service_type).monthlyTarget
    : settings.monthlyTarget;
  
  // Calculate expected hours by now (dynamic tracking)
  const currentDate = new Date();
  const [year, monthNum] = month.split('-').map(Number);
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
    preachingHours: minutes.preaching / 60,
    volunteerHours: minutes.volunteer / 60,
    schoolHours: minutes.school / 60,
    creditHours: minutes.credit / 60,
    targetHours,
    deficit,
    surplus,
    recordsCount: monthRecords.length,
    isOnTrack,
    expectedHoursByNow
  };
};

export const calculateYearlyStats = (
  records: ServiceRecord[],
  settings: Settings,
  profile?: Profile | null
): YearlyStats => {
  const currentDate = new Date();
  const serviceYearStart = new Date(getCurrentServiceYearStart() + '-01');
  const serviceYearEnd = new Date(serviceYearStart.getFullYear() + 1, serviceYearStart.getMonth(), 0);
  
  const yearRecords = records.filter(record => {
    const recordDate = new Date(record.date);
    return recordDate >= serviceYearStart && recordDate <= serviceYearEnd;
  });
  
  const minutes = splitMinutes(yearRecords);
  const totalHours = minutes.total / 60;
  
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
    preachingHours: minutes.preaching / 60,
    creditHours: minutes.credit / 60,
    targetHours,
    monthsRemaining,
    hoursPerMonthNeeded,
    isOnTrack
  };
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Hours are only ever planned down to the minute, so anything finer is rounding noise
const HOUR_EPSILON = 1e-6;

/**
 * Share `hours` out over days that each have their own ceiling.
 *
 * An even split alone would ask a two-hour Tuesday for four hours and quietly leave
 * the month short. So days that an even share would overrun are pinned to what they
 * actually have, and the hours they cannot take are re-spread over the days that
 * still have room - repeatedly, until either every hour has a home or every day is
 * full (classic water-filling).
 */
const allocateHours = (hoursNeeded: number, caps: number[]): number[] => {
  const allocations = new Array(caps.length).fill(0);
  if (hoursNeeded <= 0) return allocations;

  let open = caps.map((_, index) => index);
  let remaining = hoursNeeded;

  while (remaining > HOUR_EPSILON && open.length > 0) {
    const share = remaining / open.length;
    const stillOpen: number[] = [];

    open.forEach(index => {
      if (caps[index] <= share + HOUR_EPSILON) {
        allocations[index] = caps[index];
        remaining -= caps[index];
      } else {
        stillOpen.push(index);
      }
    });

    if (stillOpen.length === open.length) {
      // No day overran its ceiling at this share, so the rest can absorb it evenly
      stillOpen.forEach(index => { allocations[index] = share; });
      remaining = 0;
    }

    open = stillOpen;
  }

  return allocations;
};

type PlanCandidate = Omit<FieldServicePlanDay, 'plannedHours' | 'isMaxed'>;

/**
 * Take `hours` out of a run of days, using as few of them as it takes.
 *
 * Thinning the same hours across every day left in the month is the wrong answer to
 * being ahead: it has the user going out exactly as often as someone still chasing
 * the target, for an hour at a time. So only the earliest days needed to cover the
 * hours are called on - the month gets its time back as whole free days rather than
 * as a shorter afternoon everywhere - and the load is levelled across just those,
 * which beats maxing the first day and leaving a twenty-minute stub on the next.
 *
 * Days that go unused are left out of the plan entirely.
 */
const fillDays = (candidates: PlanCandidate[], hours: number): { days: FieldServicePlanDay[]; hoursPlaced: number } => {
  if (hours <= HOUR_EPSILON || candidates.length === 0) return { days: [], hoursPlaced: 0 };

  let capacityUsed = 0;
  let dayCount = 0;
  while (dayCount < candidates.length && capacityUsed < hours - HOUR_EPSILON) {
    capacityUsed += candidates[dayCount].potentialHours;
    dayCount++;
  }

  const chosen = candidates.slice(0, dayCount);
  const hoursPlaced = Math.min(hours, capacityUsed);
  const allocations = allocateHours(hoursPlaced, chosen.map(candidate => candidate.potentialHours));

  return {
    days: chosen.map((candidate, index) => ({
      ...candidate,
      plannedHours: allocations[index],
      isMaxed: allocations[index] >= candidate.potentialHours - HOUR_EPSILON
    })),
    hoursPlaced
  };
};

/**
 * What a month still in the future should carry of what the service year needs.
 *
 * Its own monthly target is the wrong figure to plan against: a year run ahead or
 * behind has to be made up somewhere, and spreading the remaining need over the
 * months left is what keeps the year reachable.
 */
const getFutureMonthShare = (
  records: ServiceRecord[],
  settings: Settings,
  month: string,
  profile?: Profile | null
): number => {
  const [year, monthNum] = month.split('-').map(Number);
  const usesServiceTypeTargets = profile?.service_type && hasHourRequirement(profile.service_type);
  const monthlyTarget = usesServiceTypeTargets
    ? getServiceTypeTargets(profile!.service_type).monthlyTarget
    : settings.monthlyTarget;
  const yearlyTarget = usesServiceTypeTargets
    ? getServiceTypeTargets(profile!.service_type).yearlyTarget
    : settings.yearlyTarget;

  const [serviceYear, serviceMonth] = getCurrentServiceYearStart().split('-').map(Number);
  const serviceYearStart = new Date(serviceYear, serviceMonth - 1, 1);
  const serviceYearEndExclusive = new Date(serviceYear + 1, serviceMonth - 1, 1);
  const plannedMonthStart = new Date(year, monthNum - 1, 1);

  // A month outside the running service year has no year-end to be pulled toward
  if (plannedMonthStart < serviceYearStart || plannedMonthStart >= serviceYearEndExclusive) {
    return monthlyTarget;
  }

  const serviceYearEnd = new Date(serviceYear + 1, serviceMonth - 1, 0);
  const loggedThisServiceYear = records
    .filter(record => {
      const date = new Date(record.date);
      return date >= serviceYearStart && date <= serviceYearEnd;
    })
    .reduce((sum, record) => sum + getTotalMinutes(record.hours, record.minutes) / 60, 0);

  const yearlyHoursNeeded = Math.max(0, yearlyTarget - loggedThisServiceYear);
  if (yearlyHoursNeeded === 0) return 0;

  const today = new Date();
  let monthsRemaining = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  while (cursor < serviceYearEndExclusive) {
    monthsRemaining++;
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return monthsRemaining > 0 ? yearlyHoursNeeded / monthsRemaining : 0;
};

/**
 * The plan for a month: which of the set field days to go out on, and how long to
 * spend on each so the month lands on target.
 *
 * Nothing about this is stored, and that is the point - it is rebuilt from the
 * records as they stand, so a day worked long enough to get ahead eases the days
 * after it, and a planned day that came and went unlogged pushes its hours onto the
 * days that are left. The plan a user sees is always the plan from here.
 */
export const generateFieldServicePlan = (
  records: ServiceRecord[],
  settings: Settings,
  month: string,
  profile?: Profile | null
): FieldServicePlan => {
  const [year, monthNum] = month.split('-').map(Number);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === monthNum;
  const isPastMonth =
    !isCurrentMonth && new Date(year, monthNum - 1, 1) < new Date(today.getFullYear(), today.getMonth(), 1);

  let hoursNeeded: number;
  if (isCurrentMonth || isPastMonth) {
    const monthlyStats = calculateMonthlyStats(records, settings, month, profile);
    hoursNeeded = Math.max(0, monthlyStats.targetHours - monthlyStats.totalHours);
  } else {
    hoursNeeded = getFutureMonthShare(records, settings, month, profile);
  }

  const emptyPlan: FieldServicePlan = {
    days: [],
    hoursNeeded: 0,
    totalCapacity: 0,
    shortfallHours: 0,
    onPaceToMeetTarget: true
  };

  if (hoursNeeded <= 0) return emptyPlan;

  const daysInMonth = new Date(year, monthNum, 0).getDate();

  let startDay: number;
  if (isCurrentMonth) {
    // Past 6pm today is effectively spent, so the plan picks up tomorrow
    startDay = today.getHours() >= 18 ? today.getDate() + 1 : today.getDate();
  } else if (isPastMonth) {
    return emptyPlan; // nothing left to plan in a month already over
  } else {
    startDay = 1;
  }

  // A credit logged on a date says nothing about whether that day was worked, so it
  // must not take the day out of the plan.
  const workedDates = new Set(
    records.filter(r => r.date.startsWith(month) && isPreachingActivity(r.type)).map(r => r.date)
  );

  const monthPad = String(monthNum).padStart(2, '0');
  const candidates: PlanCandidate[] = [];

  for (let day = startDay; day <= daysInMonth; day++) {
    // Built from the parts rather than a Date so the day cannot shift timezone
    const dateString = `${year}-${monthPad}-${String(day).padStart(2, '0')}`;
    if (workedDates.has(dateString)) continue;

    const weekday = new Date(year, monthNum - 1, day).getDay();
    const fieldServiceDay = settings.fieldServiceDays.find(fsd => fsd.day === weekday);
    if (!fieldServiceDay) continue;

    candidates.push({
      date: dateString,
      dayName: DAY_NAMES[weekday],
      type: fieldServiceDay.type,
      potentialHours: fieldServiceDay.potentialHours,
      isPriority: isPriorityFieldDay(fieldServiceDay)
    });
  }

  const totalCapacity = candidates.reduce((sum, candidate) => sum + candidate.potentialHours, 0);

  // Priority days carry the month; the rest are only called on for what is left over
  const priorityFirst = fillDays(candidates.filter(candidate => candidate.isPriority), hoursNeeded);
  const fallback = fillDays(
    candidates.filter(candidate => !candidate.isPriority),
    hoursNeeded - priorityFirst.hoursPlaced
  );

  const days = [...priorityFirst.days, ...fallback.days].sort((a, b) => a.date.localeCompare(b.date));

  return {
    days,
    hoursNeeded,
    totalCapacity,
    shortfallHours: Math.max(0, hoursNeeded - totalCapacity),
    onPaceToMeetTarget: totalCapacity >= hoursNeeded - HOUR_EPSILON
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
export interface MonthlyTotals {
  hours: number; // everything that counts toward the month, credits included
  preachingHours: number;
  volunteerHours: number;
  schoolHours: number;
  creditHours: number; // volunteer + school
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
  const recordsByMonth = new Map<string, ServiceRecord[]>();
  const studentsByMonth = new Map<string, Set<string>>();

  records.forEach(record => {
    const monthKey = record.date.slice(0, 7);
    const forMonth = recordsByMonth.get(monthKey) || [];
    forMonth.push(record);
    recordsByMonth.set(monthKey, forMonth);
  });

  visits.forEach(visit => {
    const monthKey = visit.visit_date.slice(0, 7);
    const students = studentsByMonth.get(monthKey) || new Set<string>();
    students.add(visit.student_id);
    studentsByMonth.set(monthKey, students);
  });

  const totals: Record<string, MonthlyTotals> = {};

  months.forEach(monthKey => {
    const minutes = splitMinutes(recordsByMonth.get(monthKey) || []);
    const hours = minutes.total / 60;
    const daysElapsed = getDaysElapsedInMonth(monthKey);
    // A credit is awarded once, not earned a little at a time, so it has no daily
    // rate to report - dividing a lump sum by "days elapsed so far" would only
    // balloon into a nonsense projection the earlier in the month it lands (a
    // 30-hour school credit logged on day one would read as 210 hours a week).
    // The pace stats track preaching alone; Total Hours above still counts credits.
    const preachingHours = minutes.preaching / 60;
    const dailyAverage = daysElapsed > 0 ? preachingHours / daysElapsed : 0;

    totals[monthKey] = {
      hours,
      preachingHours,
      volunteerHours: minutes.volunteer / 60,
      schoolHours: minutes.school / 60,
      creditHours: minutes.credit / 60,
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
