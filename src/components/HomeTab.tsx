import React from 'react';
import { Clock, Target, TrendingUp, TrendingDown, User, Calendar, Briefcase, BaggageClaim } from 'lucide-react';
import { ServiceRecord, Settings, Profile } from '../types';
import { calculateMonthlyStats, calculateYearlyStats, getProgressPercentage, getStatusColor, getProgressBarColor, generateFieldServiceSuggestions } from '../utils/calculations';
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
  const suggestions = generateFieldServiceSuggestions(records, settings, currentMonth);
  
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

  const getServiceTypeIcon = (type: string) => {
    switch (type) {
      case 'h2h': return <Briefcase size={16} className="text-blue-600" />;
      case 'cart': return <BaggageClaim size={16} className="text-purple-600" />;
      default: return <Calendar size={16} className="text-gray-600" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-50 border-red-200 text-red-800';
      case 'medium': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'low': return 'bg-green-50 border-green-200 text-green-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-4 font-libre-franklin">
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

      {/* Field Service Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-white rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Calendar size={24} className="text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-800">Suggested Field Service Days</h3>
          </div>
          
          <div className="space-y-3">
            {suggestions.slice(0, 5).map((suggestion, index) => (
              <div
                key={suggestion.date}
                className={`p-3 rounded-lg border ${getPriorityColor(suggestion.priority)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div>
                      <p className="font-medium">
                        {suggestion.dayName} - {new Date(suggestion.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-sm opacity-75">
                        {suggestion.type === 'h2h' ? 'House to House / Return Visits' : 'Cart Witnessing'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{suggestion.potentialHours}h</p>
                    <p className="text-xs opacity-75 capitalize">{suggestion.priority} priority</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {suggestions.length > 5 && (
            <p className="text-sm text-gray-500 mt-3 text-center">
              +{suggestions.length - 5} more suggestions available
            </p>
          )}
        </div>
      )}

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