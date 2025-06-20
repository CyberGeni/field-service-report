import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Edit, Trash2, X } from 'lucide-react';
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
  const [selectedType, setSelectedType] = useState<'h2h' | 'cart'>('h2h');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [notes, setNotes] = useState('');
  const [editingRecord, setEditingRecord] = useState<ServiceRecord | null>(null);
  const { addToast } = useToast();

  React.useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      if (existingRecords.length > 0) {
        // If there are existing records, we need to show the combined total for the selected type
        // For editing, we'll show the total time for all records of the selected type on this date
        const recordsOfType = existingRecords.filter(r => r.type === selectedType);
        if (recordsOfType.length > 0) {
          // Calculate total time for this service type
          const totalMinutes = recordsOfType.reduce((total, record) => {
            return total + (record.hours * 60) + record.minutes;
          }, 0);
          
          const totalHours = Math.floor(totalMinutes / 60);
          const remainingMinutes = totalMinutes % 60;
          
          // Use the first record as the base for editing (they'll all be merged anyway)
          setEditingRecord(recordsOfType[0]);
          setHours(totalHours.toString());
          setMinutes(remainingMinutes.toString());
          
          // Combine notes from all records of this type
          const allNotes = recordsOfType
            .map(r => r.notes)
            .filter(note => note && note.trim())
            .join('; ');
          setNotes(allNotes);
        } else {
          // No records of the selected type exist
          setEditingRecord(null);
          setHours('');
          setMinutes('');
          setNotes('');
        }
      } else {
        // New entry
        setEditingRecord(null);
        setHours('');
        setMinutes('');
        setNotes('');
      }
    }
  }, [isOpen, existingRecords, selectedType]);

  const handleSave = () => {
    const hoursNum = parseInt(hours) || 0;
    const minutesNum = parseInt(minutes) || 0;
    
    if (hoursNum === 0 && minutesNum === 0) {
      addToast({
        type: 'error',
        title: 'Invalid Entry',
        description: 'Please enter at least some time before saving'
      });
      return;
    }

    const record: ServiceRecord = {
      id: editingRecord?.id || crypto.randomUUID(),
      date: selectedDate,
      hours: hoursNum,
      minutes: minutesNum,
      type: selectedType,
      notes: notes.trim() || undefined
    };

    onSave(record);
    
    addToast({
      type: 'success',
      title: editingRecord ? 'Entry Updated' : 'Entry Added',
      description: `${hoursNum}h ${minutesNum}m logged for ${new Date(selectedDate).toLocaleDateString()}`
    });
    
    onClose();
  };

  const handleDelete = () => {
    if (editingRecord && onDelete) {
      // Delete all records for this date and type
      const recordsToDelete = existingRecords.filter(r => r.type === selectedType);
      recordsToDelete.forEach(record => {
        onDelete(record.id);
      });
      
      addToast({
        type: 'success',
        title: 'Entry Deleted',
        description: 'Service record has been removed'
      });
      onClose();
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
                {editingRecord ? 'Edit Entry' : 'Add Entry'}
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

          <div className="space-y-4">
            {/* Service Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Service Type</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'h2h', label: 'House to House', subtitle: 'Door-to-door & return visits' },
                  { id: 'cart', label: 'Cart Witnessing', subtitle: 'Public witnessing' }
                ].map(({ id, label, subtitle }) => (
                  <button
                    key={id}
                    onClick={() => setSelectedType(id as 'h2h' | 'cart')}
                    className={`p-3 rounded-xl transition-all duration-200 border-2 text-left ${
                      selectedType === id
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-semibold text-sm">{label}</div>
                      <div className="text-xs opacity-75 mt-1">{subtitle}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Input */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hours</label>
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="w-full p-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Minutes</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  className="w-full p-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about your service..."
                className="w-full p-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors resize-none"
                rows={3}
              />
            </div>

            {/* Info about merging */}
            {existingRecords.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-blue-800 text-sm">
                  💡 This will replace all existing {selectedType === 'h2h' ? 'House to House' : 'Cart Witnessing'} entries for this date with the time you enter above.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-3 mt-6">
            {editingRecord && onDelete && (
              <button
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-xl font-medium transition-colors flex items-center space-x-2"
              >
                <Trash2 size={16} />
                <span>Delete</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-4 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={(!hours || parseInt(hours) === 0) && (!minutes || parseInt(minutes) === 0)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
            >
              {editingRecord ? <Edit size={16} /> : <Plus size={16} />}
              <span>{editingRecord ? 'Update' : 'Add'}</span>
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

  const handleDayClick = (day: number) => {
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

    return (
      <button
        key={day}
        onClick={() => handleDayClick(day)}
        className={`relative h-20 p-1 w-full text-left transition-colors hover:bg-gray-100 flex flex-col ${
          isToday ? 'bg-blue-50' : 'bg-white'
        }`}
      >
        {/* Date number at the top */}
        <div className={`text-sm font-medium mb-1 ${
          isToday ? 'text-blue-600' : 
          isFieldDay ? 'text-gray-800' : 'text-gray-400'
        }`}>
          {day}
        </div>
        
        {/* Field service day indicator */}
        {isFieldDay && !hasRecords && (
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
        
        {/* Add icon for clickable indication */}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {hasRecords ? (
            <Edit size={12} className="text-gray-400" />
          ) : (
            <Plus size={12} className="text-gray-400" />
          )}
        </div>
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
          💡 Click on any day to add or edit your service time. Multiple entries for the same day and service type will be automatically merged.
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
            <span>Mixed Types</span>
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