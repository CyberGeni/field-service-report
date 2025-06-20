import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Edit, Trash2, X, Briefcase, BaggageClaim } from 'lucide-react';
import { ServiceRecord, Settings } from '../types';
import { getDaysInMonth, getFirstDayOfMonth, isFieldServiceDay, formatHoursMinutes, getDateString } from '../utils/dateUtils';
import { useToast } from './ui/toast';

interface CalendarTabProps {
  records: ServiceRecord[];
  settings: Settings;
  onSaveRecord: (record: ServiceRecord) => void;
  onDeleteRecord?: (id: string) => void;
}

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: ServiceRecord) => void;
  onDelete?: (id: string) => void;
  selectedDate: string;
  existingRecords: ServiceRecord[];
}

const EntryModal: React.FC<EntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  selectedDate,
  existingRecords
}) => {
  // State for both service types
  const [h2hHours, setH2hHours] = useState('');
  const [h2hMinutes, setH2hMinutes] = useState('');
  const [h2hNotes, setH2hNotes] = useState('');
  
  const [cartHours, setCartHours] = useState('');
  const [cartMinutes, setCartMinutes] = useState('');
  const [cartNotes, setCartNotes] = useState('');

  const { addToast } = useToast();

  React.useEffect(() => {
    if (isOpen) {
      // Load existing records for both types
      const h2hRecord = existingRecords.find(r => r.type === 'h2h');
      const cartRecord = existingRecords.find(r => r.type === 'cart');
      
      // Set H2H values
      if (h2hRecord) {
        setH2hHours(h2hRecord.hours.toString());
        setH2hMinutes(h2hRecord.minutes.toString());
        setH2hNotes(h2hRecord.notes || '');
      } else {
        setH2hHours('');
        setH2hMinutes('');
        setH2hNotes('');
      }
      
      // Set Cart values
      if (cartRecord) {
        setCartHours(cartRecord.hours.toString());
        setCartMinutes(cartRecord.minutes.toString());
        setCartNotes(cartRecord.notes || '');
      } else {
        setCartHours('');
        setCartMinutes('');
        setCartNotes('');
      }
    }
  }, [isOpen, existingRecords]);

  const handleSave = async () => {
    const h2hHoursNum = parseInt(h2hHours) || 0;
    const h2hMinutesNum = parseInt(h2hMinutes) || 0;
    const cartHoursNum = parseInt(cartHours) || 0;
    const cartMinutesNum = parseInt(cartMinutes) || 0;

    const h2hRecord = existingRecords.find(r => r.type === 'h2h');
    const cartRecord = existingRecords.find(r => r.type === 'cart');

    let savedCount = 0;
    let deletedCount = 0;

    try {
      // Handle H2H record
      if (h2hHoursNum === 0 && h2hMinutesNum === 0) {
        // Delete H2H record if it exists
        if (h2hRecord && onDelete) {
          await onDelete(h2hRecord.id);
          deletedCount++;
        }
      } else {
        // Save/update H2H record
        const record: ServiceRecord = {
          id: h2hRecord?.id || crypto.randomUUID(),
          date: selectedDate,
          hours: h2hHoursNum,
          minutes: h2hMinutesNum,
          type: 'h2h',
          notes: h2hNotes.trim() || undefined
        };
        await onSave(record);
        savedCount++;
      }

      // Handle Cart record
      if (cartHoursNum === 0 && cartMinutesNum === 0) {
        // Delete Cart record if it exists
        if (cartRecord && onDelete) {
          await onDelete(cartRecord.id);
          deletedCount++;
        }
      } else {
        // Save/update Cart record
        const record: ServiceRecord = {
          id: cartRecord?.id || crypto.randomUUID(),
          date: selectedDate,
          hours: cartHoursNum,
          minutes: cartMinutesNum,
          type: 'cart',
          notes: cartNotes.trim() || undefined
        };
        await onSave(record);
        savedCount++;
      }

      // Show appropriate toast message
      if (savedCount > 0 && deletedCount > 0) {
        addToast({
          type: 'success',
          title: 'Entries Updated',
          description: `${savedCount} record(s) saved, ${deletedCount} record(s) deleted for ${new Date(selectedDate).toLocaleDateString()}`
        });
      } else if (savedCount > 0) {
        addToast({
          type: 'success',
          title: 'Entries Saved',
          description: `${savedCount} record(s) saved for ${new Date(selectedDate).toLocaleDateString()}`
        });
      } else if (deletedCount > 0) {
        addToast({
          type: 'success',
          title: 'Entries Deleted',
          description: `${deletedCount} record(s) deleted for ${new Date(selectedDate).toLocaleDateString()}`
        });
      } else {
        addToast({
          type: 'info',
          title: 'No Changes',
          description: 'No time was entered for either service type'
        });
      }

      onClose();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Save Failed',
        description: 'Failed to save service records'
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                Service Time Entry
              </h3>
              <p className="text-sm text-gray-600">{formatDate(selectedDate)}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="space-y-6">
            {/* House to House Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-4">
                <Briefcase size={20} className="text-blue-600" />
                <h4 className="font-semibold text-blue-800">House to House / Return Visits</h4>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">Hours</label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={h2hHours}
                    onChange={(e) => setH2hHours(e.target.value)}
                    className="w-full p-2 bg-white rounded-lg border border-blue-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">Minutes</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={h2hMinutes}
                    onChange={(e) => setH2hMinutes(e.target.value)}
                    className="w-full p-2 bg-white rounded-lg border border-blue-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="0"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1">Notes (optional)</label>
                <textarea
                  value={h2hNotes}
                  onChange={(e) => setH2hNotes(e.target.value)}
                  placeholder="Add notes about house to house service..."
                  className="w-full p-2 bg-white rounded-lg border border-blue-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                  rows={2}
                />
              </div>
            </div>

            {/* Cart Witnessing Section */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-4">
                <BaggageClaim size={20} className="text-purple-600" />
                <h4 className="font-semibold text-purple-800">Cart Witnessing</h4>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium text-purple-700 mb-1">Hours</label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={cartHours}
                    onChange={(e) => setCartHours(e.target.value)}
                    className="w-full p-2 bg-white rounded-lg border border-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-purple-700 mb-1">Minutes</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={cartMinutes}
                    onChange={(e) => setCartMinutes(e.target.value)}
                    className="w-full p-2 bg-white rounded-lg border border-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                    placeholder="0"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-purple-700 mb-1">Notes (optional)</label>
                <textarea
                  value={cartNotes}
                  onChange={(e) => setCartNotes(e.target.value)}
                  placeholder="Add notes about cart witnessing..."
                  className="w-full p-2 bg-white rounded-lg border border-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors resize-none"
                  rows={2}
                />
              </div>
            </div>

            {/* Info about zero values */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <p className="text-yellow-800 text-sm">
                💡 <strong>Tip:</strong> Enter 0 hours and 0 minutes to delete an existing record for that service type.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-4 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <Edit size={16} />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CalendarTab: React.FC<CalendarTabProps> = ({ records, settings, onSaveRecord, onDeleteRecord }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
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

  const getRecordsForDate = (day: number): ServiceRecord[] => {
    const dateString = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return records.filter(record => record.date === dateString);
  };

  const getTotalTimeForDate = (day: number): { hours: number; minutes: number } => {
    const dayRecords = getRecordsForDate(day);
    const totalMinutes = dayRecords.reduce((total, record) => {
      return total + (record.hours * 60) + record.minutes;
    }, 0);
    
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60
    };
  };

  const getServiceTypeColor = (records: ServiceRecord[]): string => {
    // Determine color based on service types present
    const hasH2H = records.some(r => r.type === 'h2h');
    const hasCart = records.some(r => r.type === 'cart');
    
    if (hasH2H && hasCart) return 'bg-gradient-to-r from-blue-500 to-purple-500';
    if (hasH2H) return 'bg-blue-500';
    if (hasCart) return 'bg-purple-500';
    return 'bg-gray-500';
  };

  const isFutureDate = (day: number): boolean => {
    const today = new Date();
    const dayDate = new Date(year, month, day);
    return dayDate > today;
  };

  const handleDayClick = (day: number) => {
    // Prevent clicking on future dates
    if (isFutureDate(day)) {
      return;
    }

    const dateString = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    setSelectedDate(dateString);
    setShowEntryModal(true);
  };

  const renderCalendarDay = (day: number) => {
    const date = new Date(year, month, day);
    const isFieldDay = isFieldServiceDay(date, settings.fieldServiceDays);
    const dayRecords = getRecordsForDate(day);
    const totalTime = getTotalTimeForDate(day);
    const hasRecords = dayRecords.length > 0;
    const isToday = new Date().toDateString() === date.toDateString();
    const isFuture = isFutureDate(day);

    return (
      <button
        key={day}
        onClick={() => handleDayClick(day)}
        disabled={isFuture}
        className={`relative h-20 p-1 w-full text-left transition-colors flex flex-col ${
          isFuture 
            ? 'bg-gray-100 cursor-not-allowed opacity-50' 
            : isToday 
              ? 'bg-blue-50 hover:bg-blue-100' 
              : 'bg-white hover:bg-gray-100'
        }`}
      >
        {/* Date number at the top */}
        <div className={`text-sm font-medium mb-1 ${
          isFuture ? 'text-gray-400' :
          isToday ? 'text-blue-600' : 
          isFieldDay ? 'text-gray-800' : 'text-gray-400'
        }`}>
          {day}
        </div>
        
        {/* Field service day indicator */}
        {isFieldDay && !hasRecords && !isFuture && (
          <div className="w-2 h-2 bg-gray-300 rounded-full mb-1" />
        )}
        
        {/* Service record entry */}
        {hasRecords && (
          <div className="flex-1 min-h-0">
            <div className={`${getServiceTypeColor(dayRecords)} rounded p-1 text-white text-xs h-full flex items-center justify-center`}>
              <div className="text-center">
                <div className="font-semibold text-sm">
                  {totalTime.hours}:{totalTime.minutes.toString().padStart(2, '0')}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Add icon for clickable indication - only for non-future dates */}
        {!isFuture && (
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {hasRecords ? (
              <Edit size={12} className="text-gray-400" />
            ) : (
              <Plus size={12} className="text-gray-400" />
            )}
          </div>
        )}
      </button>
    );
  };

  const renderEmptyDay = (index: number) => (
    <div key={`empty-${index}`} className="h-20 bg-gray-50" />
  );

  const monthlyTotal = records
    .filter(record => record.date.startsWith(`${year}-${(month + 1).toString().padStart(2, '0')}`))
    .reduce((total, record) => total + record.hours + record.minutes / 60, 0);

  const selectedDateRecords = selectedDate ? records.filter(r => r.date === selectedDate) : [];

  return (
    <div className="space-y-6 pb-6">
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

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-blue-800 text-sm font-medium">
          💡 Click on any past or current day to record time for both service types. Enter 0 hours and 0 minutes to delete a record. Future dates are disabled.
        </p>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Color codes</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>House to House</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-purple-500 rounded"></div>
            <span>Cart Witnessing</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded"></div>
            <span>Both Types</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
            <span>Field service day</span>
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
        <div className="grid grid-cols-7 divide-x divide-y divide-gray-200 group">
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

      {/* Entry Modal */}
      <EntryModal
        isOpen={showEntryModal}
        onClose={() => setShowEntryModal(false)}
        onSave={onSaveRecord}
        onDelete={onDeleteRecord}
        selectedDate={selectedDate}
        existingRecords={selectedDateRecords}
      />
    </div>
  );
};

export default CalendarTab;