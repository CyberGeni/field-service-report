import React from 'react';
import { Clock, Target, TrendingUp, TrendingDown, User } from 'lucide-react';
import { ServiceRecord, Settings, Profile } from '../types';
import { calculateMonthlyStats, calculateYearlyStats, getProgressPercentage, getStatusColor, getProgressBarColor } from '../utils/calculations';
import { getCurrentMonth, getMonthName, formatHoursMinutes, formatHoursMinutesShort } from '../utils/dateUtils';
import { getServiceTypeTargets, getServiceTypeLabel, hasHourRequirement } from '../utils/serviceTypes';
import CircularProgress from './CircularProgress';

interface HomeTabProps {
  records: ServiceRecord[];
  settings: Settings;
  profile?: Profile | null;
}

const HomeTab: React.FC<HomeTabProps> = ({ records, settings, profile }) => {
  const currentMonth = getCurrentMonth();
  const monthlyStats = calculateMonthlyStats(records, settings, currentMonth, profile);
  const yearlyStats = calculateYearlyStats(records, settings, profile);
  
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

  // Calculate daily target based on actual monthly target needed
  const getDailyTarget = () => {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentDay = today.getDate();
    const daysRemaining = Math.max(1, daysInMonth - currentDay + 1);
    
    // Calculate how many hours are needed for the rest of the month
    const hoursRemaining = Math.max(0, monthlyStats.targetHours - monthlyStats.totalHours);
    const dailyHours = hoursRemaining / daysRemaining;
    
    return formatHoursMinutesShort(dailyHours);
  };

  const timeOfDay = getTimeOfDayGreeting();
  const todaysDate = getTodaysDate();
  const dailyTarget = getDailyTarget();
  const displayName = profile?.name || settings.username || 'Friend';

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
    
    if (monthlyStats.deficit > 0) {
      return (
        <div className="text-center">
          <span>
            {targetText}
            <span className="text-red-600 font-semibold">
              ({formatHoursMinutesShort(monthlyStats.deficit)} behind)
            </span>
          </span>
          <p className="text-xs text-gray-500 mt-1">
            {hasRequirements ? `${targetSource} requirement` : targetSource}
          </p>
        </div>
      );
    } else if (monthlyStats.surplus > 0) {
      return (
        <div className="text-center">
          <span>
            {targetText}
            <span className="text-green-600 font-semibold">
              ({formatHoursMinutesShort(monthlyStats.surplus)} ahead)
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
          <span className="text-gray-600 font-semibold">
            (on target)
          </span>
        </span>
        <p className="text-xs text-gray-500 mt-1">
          {hasRequirements ? `${targetSource} requirement` : targetSource}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <div className="text-center py-6">
        {/* Avatar and Service Type */}
        {profile && (
          <div className="flex flex-col items-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mb-2">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={24} className="text-gray-400" />
              )}
            </div>
            <p className="text-sm text-blue-600 font-medium">
              {getServiceTypeLabel(profile.service_type)}
            </p>
          </div>
        )}
        
        <h1 className="text-3xl font-bold text-gray-800 mb-4 font-playfair">
          Good {timeOfDay}, {displayName}!
        </h1>
        <p className="text-gray-600 text-lg tracking-tight">
          Today is <span className="font-semibold">{todaysDate}</span> and you have a target of <span className="font-semibold">{dailyTarget}</span>
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
        
        <div className="mt-6">
          <div className="text-gray-600 font-medium">
            {getTargetDisplay()}
          </div>
        </div>
      </div>

      {/* Yearly Progress */}
      <div className="bg-white rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Service Year Progress</h3>
          {profile?.service_type && (
            <span className="text-xs text-blue-600 font-medium">
              {hasHourRequirement(profile.service_type) 
                ? `${getServiceTypeLabel(profile.service_type)} Requirement`
                : 'Personal Goal'
              }
            </span>
          )}
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Total Hours</span>
            <span className="font-semibold text-lg">
              {formatHoursMinutes(yearlyStats.totalHours)}
            </span>
          </div>
          
          <div className="bg-gray-200 rounded-full h-3">
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