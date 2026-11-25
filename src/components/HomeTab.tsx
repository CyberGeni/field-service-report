import React from 'react';
import { Calendar } from 'lucide-react';
import { ServiceRecord, Settings, Profile } from '../types';
import { calculateMonthlyStats, calculateYearlyStats, getProgressPercentage, getProgressBarColor, generateFieldServicePlan } from '../utils/calculations';
import { getCurrentMonth, getMonthName, formatHoursMinutes, formatHoursMinutesShort, getDateString } from '../utils/dateUtils';
import { getServiceTypeTargets, hasHourRequirement } from '../utils/serviceTypes';
import { ACTIVITY_META } from '../utils/activityTypes';
import CircularProgress from './CircularProgress';
import { usePlanClock } from '../hooks/usePlanClock';
import VisitTodayCard from './people/VisitTodayCard';

interface HomeTabProps {
  records: ServiceRecord[];
  settings: Settings;
  profile?: Profile | null;
  onOpenPerson?: (personId: string) => void;
}

const HomeTab: React.FC<HomeTabProps> = ({ records, settings, profile, onOpenPerson }) => {
  // Everything below is rebuilt from "now" on each render; this just makes sure a
  // render happens when the evening cutoff or midnight changes what "now" plans
  usePlanClock();

  const currentMonth = getCurrentMonth();
  const monthlyStats = calculateMonthlyStats(records, settings, currentMonth, profile);
  const yearlyStats = calculateYearlyStats(records, settings, profile);
  const plan = generateFieldServicePlan(records, settings, currentMonth, profile);
  
  const monthProgress = getProgressPercentage(monthlyStats.totalHours, monthlyStats.targetHours);
  const yearProgress = getProgressPercentage(yearlyStats.totalHours, yearlyStats.targetHours);

  // Get time of day greeting
  const getTimeOfDayGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  };

  // Get today's date formatted nicely
  const getTodaysDate = () => {
    const today = new Date();
    return today.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const timeOfDay = getTimeOfDayGreeting();
  const todaysDate = getTodaysDate();
  const displayName = profile?.name || settings.username || 'Friend';

  // The plan is chronological, so the first day left in it is the next one to go out on
  const nextPlannedDay = plan.days[0];
  const nextPlannedIsToday = nextPlannedDay?.date === getDateString(new Date());

  // Determine progress bar color based on progress
  const getProgressColor = (progress: number) => {
    if (progress >= 100) return '#10B981'; // green-500
    if (progress >= 75) return '#3B82F6'; // blue-500
    if (progress >= 50) return '#F59E0B'; // amber-500
    return '#EF4444'; // red-500
  };

  // Get target display with color-coded status
  const getTargetDisplay = () => {
    const monthName = getMonthName(currentMonth).split(' ')[0];
    const hasRequirements = profile?.service_type && hasHourRequirement(profile.service_type);
    const serviceTypeInfo = hasRequirements ? getServiceTypeTargets(profile.service_type) : null;
    const targetSource = serviceTypeInfo ? serviceTypeInfo.label : 'Personal Goal';
    
    const targetText = `Target for ${monthName}: ${Math.round(monthlyStats.targetHours)}h `;
    
    if (!monthlyStats.isOnTrack && monthlyStats.deficit > 0) {
      return (
        <div className="text-center">
          <span>
            {targetText}
            <span className="text-red-600 font-semibold">
              ({formatHoursMinutesShort(monthlyStats.deficit)} behind pace)
            </span>
          </span>
          <p className="text-xs text-gray-500 mt-1">
            {hasRequirements ? `${targetSource} requirement` : targetSource}
          </p>
        </div>
      );
    } else if (monthlyStats.isOnTrack && monthlyStats.surplus > 0) {
      return (
        <div className="text-center">
          <span>
            {targetText}
            <span className="text-green-600 font-semibold">
              ({formatHoursMinutesShort(monthlyStats.surplus)} ahead of pace)
            </span>
          </span>
          <p className="text-xs text-gray-500 mt-1">
            {hasRequirements ? `${targetSource} requirement` : targetSource}
          </p>
        </div>
      );
    }
    
    return (
      <div className="text-center">
        <span>
          {targetText}
          <span className="text-blue-600 font-semibold">
            (on track)
          </span>
        </span>
        <p className="text-xs text-gray-500 mt-1">
          {hasRequirements ? `${targetSource} requirement` : targetSource}
        </p>
      </div>
    );
  };

  // Format a planned date properly — parse as local time to avoid UTC day-shift
  const formatPlannedDate = (dateString: string) => {
    const [y, m, d] = dateString.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4 font-libre-franklin">
          Good {timeOfDay}, {displayName}!
        </h1>
        <p className="text-gray-600 text-lg tracking-tight">
          Today is <span className="font-semibold">{todaysDate}</span>
          {plan.hoursNeeded <= 0 ? (
            <> and you have met this month&apos;s target</>
          ) : nextPlannedDay ? (
            nextPlannedIsToday ? (
              <>
                {' '}and your plan for today is{' '}
                <span className="font-semibold">{formatHoursMinutesShort(nextPlannedDay.plannedHours)}</span>{' '}
                in the field
              </>
            ) : (
              <>
                {' '}and your next planned day is{' '}
                <span className="font-semibold">{formatPlannedDate(nextPlannedDay.date)}</span>, with{' '}
                <span className="font-semibold">{formatHoursMinutesShort(nextPlannedDay.plannedHours)}</span> to aim for
              </>
            )
          ) : (
            <> and there are no field days left to plan this month</>
          )}
        </p>
      </div>

      {/* Monthly Hours - Circular Progress */}
      <div className="text-center py-6">
        <CircularProgress
          progress={Math.min(100, monthProgress)}
          size={250}
          strokeWidth={16}
          color={getProgressColor(monthProgress)}
          backgroundColor="#F3F4F6"
        >
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-800 mb-1">
               {formatHoursMinutes(monthlyStats.totalHours)}
            </div>
            <p className="text-sm text-gray-600 font-medium">
              {Math.round(monthProgress)}%
            </p>
          </div>
        </CircularProgress>
        
        {/* What the month is made of. Credits count toward the total above, but a
            month carried by a 30-hour school credit is a different month from one
            spent in the field, and the ring alone cannot say which this was. */}
        {monthlyStats.creditHours > 0 && (
          <div className="mt-5 mx-auto max-w-xs space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-2 text-gray-600">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>Field service</span>
              </span>
              <span className="font-semibold text-gray-800 tabular-nums">
                {formatHoursMinutesShort(monthlyStats.preachingHours)}
              </span>
            </div>
            {monthlyStats.volunteerHours > 0 && (
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-2 text-gray-600">
                  <span className={`w-2.5 h-2.5 rounded-full ${ACTIVITY_META.volunteer.dotColor}`} />
                  <span>{ACTIVITY_META.volunteer.label}</span>
                </span>
                <span className="font-semibold text-gray-800 tabular-nums">
                  {formatHoursMinutesShort(monthlyStats.volunteerHours)}
                </span>
              </div>
            )}
            {monthlyStats.schoolHours > 0 && (
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-2 text-gray-600">
                  <span className={`w-2.5 h-2.5 rounded-full ${ACTIVITY_META.school.dotColor}`} />
                  <span>{ACTIVITY_META.school.label}</span>
                </span>
                <span className="font-semibold text-gray-800 tabular-nums">
                  {formatHoursMinutesShort(monthlyStats.schoolHours)}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="mt-6">
          <div className="text-gray-600 font-medium">
            {getTargetDisplay()}
          </div>
        </div>
      </div>

      {/* The month's plan: which days to go out on, and how long on each */}
      {plan.hoursNeeded > 0 && (
        <div className="bg-white rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Calendar size={24} className="text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-800">
              Your Plan for {getMonthName(currentMonth).split(' ')[0]}
            </h3>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            <span className="font-semibold">{formatHoursMinutesShort(plan.hoursNeeded)}</span> to go
            {plan.days.length > 0 && (
              <>
                {' '}&mdash; <span className="font-semibold">{plan.days.length}</span>{' '}
                {plan.days.length === 1 ? 'day' : 'days'} out to meet it
              </>
            )}
          </p>

          {/* Full days on every remaining field day still would not reach the target,
              which is a settings problem the user can only fix ahead of time. */}
          {!plan.onPaceToMeetTarget && (
            <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm">
              {plan.days.length === 0 ? (
                <>
                  No field days are left this month, so the target stays{' '}
                  <span className="font-semibold">{formatHoursMinutesShort(plan.shortfallHours)}</span> away. Set the
                  days you go out, and how long you have on each, in Settings.
                </>
              ) : (
                <>
                  Even with a full day every time, you would finish{' '}
                  <span className="font-semibold">{formatHoursMinutesShort(plan.shortfallHours)}</span> short. Add a
                  field day or more available time in Settings, or plan to go out on a day you had not set aside.
                </>
              )}
            </div>
          )}

          <div className="space-y-3">
            {plan.days.slice(0, 5).map((day) => (
              <div
                key={day.date}
                className={`p-3 rounded-lg border ${
                  day.isMaxed ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-gray-800">
                        {formatPlannedDate(day.date)}
                      </p>
                      {day.isPriority && (
                        <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                          Priority
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {day.type === 'h2h' ? 'House to House / Return Visits' : 'Cart Witnessing'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">
                      {formatHoursMinutesShort(day.plannedHours)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {day.isMaxed ? 'full day' : `of ${formatHoursMinutesShort(day.potentialHours)} set aside`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {plan.days.length > 5 && (
            <p className="text-sm text-gray-500 mt-3 text-center">
              +{plan.days.length - 5} more planned {plan.days.length - 5 === 1 ? 'day' : 'days'} this month
            </p>
          )}
        </div>
      )}

      {/* Return visits and studies due today - nothing at all on a day nobody is */}
      <VisitTodayCard onOpenPerson={onOpenPerson} />

      {/* Yearly Progress */}
      <div className="bg-white rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Service Year Progress</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Total Hours</span>
            <span className="font-semibold text-lg">
              {formatHoursMinutes(yearlyStats.totalHours)}
            </span>
          </div>
          
          <div className="bg-[#F3F4F6] rounded-full h-3">
            <div 
              className={`rounded-full h-3 transition-all duration-500 ${getProgressBarColor(yearlyStats.totalHours, yearlyStats.targetHours)}`}
              style={{ width: `${Math.min(100, yearProgress)}%` }}
            />
          </div>
          
          <div className="flex justify-between text-sm text-gray-600">
            <span>Target: {yearlyStats.targetHours}h</span>
            <span>{Math.round(yearProgress)}%</span>
          </div>
          
          {yearlyStats.monthsRemaining > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-600">
                <span className="font-medium">{formatHoursMinutesShort(yearlyStats.hoursPerMonthNeeded)}/month</span> needed 
                for remaining {yearlyStats.monthsRemaining} months
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomeTab;