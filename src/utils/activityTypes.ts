import type { ElementType } from 'react';
import { Briefcase, BaggageClaim, GraduationCap, HardHat } from 'lucide-react';
import { ServiceActivity, Profile } from '../types';

/**
 * What can be logged against a day, and how each kind is worded and coloured.
 *
 * Preaching is time the publisher spent; a credit is time they were awarded. Both go
 * on the report as hours, so both are service records - the distinction lives here
 * rather than in a second table, which keeps one day's totals in one place.
 */
export interface ActivityMeta {
  id: ServiceActivity;
  label: string;
  subtitle: string;
  icon: ElementType;
  // Whether the hours were worked (preaching) or granted (a credit)
  group: 'preaching' | 'credit';
  // Credits are awarded as a figure, so there is nothing to run a timer against
  timed: boolean;
  // Tailwind classes, kept together so the calendar, log and lists agree on colour
  accentText: string;
  dotColor: string;
  // Written out in full rather than interpolated - Tailwind only keeps classes it
  // can see as literal strings in the source
  selectedCard: string;
  selectedIconBg: string;
  // Gradient halves for a day that holds more than one kind of entry
  gradientFrom: string;
  gradientTo: string;
  // Shown under the entry form to say what the figure is for
  hint?: string;
}

export const ACTIVITY_META: Record<ServiceActivity, ActivityMeta> = {
  h2h: {
    id: 'h2h',
    label: 'House to House',
    subtitle: 'Door-to-door & return visits',
    icon: Briefcase,
    group: 'preaching',
    timed: true,
    accentText: 'text-blue-600',
    dotColor: 'bg-blue-500',
    selectedCard: 'bg-blue-50 text-blue-700 border-blue-200',
    selectedIconBg: 'bg-blue-100',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-blue-500'
  },
  cart: {
    id: 'cart',
    label: 'Cart Witnessing',
    subtitle: 'Public witnessing',
    icon: BaggageClaim,
    group: 'preaching',
    timed: true,
    accentText: 'text-purple-600',
    dotColor: 'bg-purple-500',
    selectedCard: 'bg-purple-50 text-purple-700 border-purple-200',
    selectedIconBg: 'bg-purple-100',
    gradientFrom: 'from-purple-500',
    gradientTo: 'to-purple-500'
  },
  school: {
    id: 'school',
    label: 'School Credit',
    subtitle: 'Theocratic school hours',
    icon: GraduationCap,
    group: 'credit',
    timed: false,
    accentText: 'text-amber-600',
    dotColor: 'bg-amber-500',
    selectedCard: 'bg-amber-50 text-amber-700 border-amber-200',
    selectedIconBg: 'bg-amber-100',
    gradientFrom: 'from-amber-500',
    gradientTo: 'to-amber-500',
    hint: 'A one-off credit for attending a school - a pioneer school is 30 hours.'
  },
  volunteer: {
    id: 'volunteer',
    label: 'Volunteer Credit',
    subtitle: 'LDC & other assignments',
    icon: HardHat,
    group: 'credit',
    timed: false,
    accentText: 'text-emerald-600',
    dotColor: 'bg-emerald-500',
    selectedCard: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    selectedIconBg: 'bg-emerald-100',
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-emerald-500',
    hint: 'Hours credited for a volunteer assignment.'
  }
};

export const PREACHING_ACTIVITIES: ServiceActivity[] = ['h2h', 'cart'];

export const isPreachingActivity = (type: string): boolean =>
  ACTIVITY_META[type as ServiceActivity]?.group === 'preaching';

export const isCreditActivity = (type: string): boolean =>
  ACTIVITY_META[type as ServiceActivity]?.group === 'credit';

export const getActivityMeta = (type: string): ActivityMeta =>
  ACTIVITY_META[type as ServiceActivity] ?? ACTIVITY_META.h2h;

export const getActivityLabel = (type: string): string => getActivityMeta(type).label;

/** Volunteer work is hidden until the user says they do it - most publishers don't. */
export const canLogVolunteerHours = (profile?: Profile | null): boolean =>
  Boolean(profile?.is_volunteer);

/**
 * Theocratic school credit (a pioneer school, say) is only issued to regular
 * pioneers, so it stays out of everyone else's service type list.
 */
export const canLogSchoolCredit = (profile?: Profile | null): boolean =>
  profile?.service_type === 'regular_pioneer';

/** The activities to offer this user, in the order they should appear. */
export const getAvailableActivities = (profile?: Profile | null): ActivityMeta[] =>
  (['h2h', 'cart', 'school', 'volunteer'] as ServiceActivity[])
    .filter(id => id !== 'school' || canLogSchoolCredit(profile))
    .filter(id => id !== 'volunteer' || canLogVolunteerHours(profile))
    .map(id => ACTIVITY_META[id]);
