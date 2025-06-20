import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Car, ShoppingCart } from 'lucide-react';
import { ServiceRecord, Settings } from '../types';
import { getDaysInMonth, getFirstDayOfMonth, isFieldServiceDay, formatHoursMinutes } from '../utils/dateUtils';

interface CalendarTabProps {
  records: ServiceRecord[];
  settings: Settings;
}

const CalendarTab: React.FC<CalendarTabProps> = ({ records, settings }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const daysInMonth = getDaysInMonth(year, month + 1);
  const firstDay = getFirstDayOfMonth(year, month + 1);
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getRecordForDate = (day: number): ServiceRecord | undefined => {
    const dateString = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return records.find(record => record.date === dateString);
  };

  const getServiceTypeIcon = (type: string, size = 16) => {
    const props = { size, className: "text-white" };
    switch (type) {
      case 'h2h': return <MapPin {...props} />;
      case 'rv': return <Car {...props} />;
      case 'cart': return <ShoppingCart {...props} />;
      default: return null;
    }
  };

  const getServiceTypeColor = (type: string): string => {
    switch (type) {
      case 'h2h': return 'bg-blue-500';
      case 'rv': return 'bg-green-500';
      case 'cart': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const renderCalendarDay = (day: number) => {
    const date = new Date(year, month, day);
    const isFieldDay = isFieldServiceDay(date, settings.fieldServiceDays);
    const record = getRecordForDate(day);
    const isToday = new Date().toDateString() === date.toDateString();

    return (
      <div
        key={day}
        className={`relative h-20 p-1 ${
          isToday ? 'bg-blue-50' : 'bg-white'
        }`}
      >
        <div className={`text-sm font-medium ${
          isToday ? 'text-blue-600' : 
          isFieldDay ? 'text-gray-800' : 'text-gray-400'
        }`}>
          {day}
        </div>
        
        {isFieldDay && !record && (
          <div className="absolute top-6 left-1 w-2 h-2 bg-gray-300 rounded-full" />
        )}
        
        {record && (
          <div className="absolute top-6 left-1 right-1 bottom-1">
            <div className={`${getServiceTypeColor(record.type)} rounded p-1 text-white text-xs h-full flex flex-col justify-between`}>
              <div className="flex items-center justify-between">
                {getServiceTypeIcon(record.type, 12)}
                <span className="text-xs font-medium">
                  {record.hours}:{record.minutes.toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderEmptyDay = (index: number) => (
    <div key={`empty-${index}`} className="h-20 bg-gray-50" />
  );

  const monthlyTotal = records
    .filter(record => record.date.startsWith(`${year}-${(month + 1).toString().padStart(2, '0')}`))
    .reduce((total, record) => total + record.hours + record.minutes / 60, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl p-6">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800">{monthName}</h2>
          <p className="text-sm text-gray-600">
            Total: {formatHoursMinutes(monthlyTotal)}
          </p>
        </div>
        
        <button
          onClick={() => navigateMonth('next')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Service Types</h3>
        <div className="flex justify-between text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>House to House</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Return Visit</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-purple-500 rounded"></div>
            <span>Cart/Metro</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-gray-300 rounded"></div>
            <span>Field Service Day</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl overflow-hidden">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 bg-gray-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-600">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar Days */}
        <div className="grid grid-cols-7 divide-x divide-y divide-gray-200">
          {/* Empty cells for days before month starts */}
          {Array.from({ length: firstDay }, (_, i) => renderEmptyDay(i))}
          
          {/* Days of the month */}
          {Array.from({ length: daysInMonth }, (_, i) => renderCalendarDay(i + 1))}
          
          {/* Empty cells to complete the grid */}
          {Array.from({ length: (7 - ((firstDay + daysInMonth) % 7)) % 7 }, (_, i) => 
            renderEmptyDay(firstDay + daysInMonth + i)
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarTab;