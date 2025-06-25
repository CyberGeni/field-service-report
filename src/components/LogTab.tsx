import React, { useState } from 'react';
import { Clock, Plus, Briefcase, BaggageClaim, User, X } from 'lucide-react';
import { ServiceRecord, TimerState } from '../types';
import { isFieldServiceDay, getDateString } from '../utils/dateUtils';
import { useToast } from './ui/toast';
import { useStudents } from '../hooks/useStudents';
import Timer from './Timer';

interface LogTabProps {
  records: ServiceRecord[];
  settings: any;
  onSaveRecord: (record: ServiceRecord) => void;
  timerState: TimerState;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onStopTimer: () => number;
}

const LogTab: React.FC<LogTabProps> = ({ 
  records, 
  settings, 
  onSaveRecord, 
  timerState, 
  onStartTimer, 
  onPauseTimer, 
  onStopTimer 
}) => {
  const [selectedType, setSelectedType] = useState<'h2h' | 'cart'>('h2h');
  const [manualHours, setManualHours] = useState(0);
  const [manualMinutes, setManualMinutes] = useState(0);
  const [selectedDate, setSelectedDate] = useState(getDateString(new Date()));
  const [notes, setNotes] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentAddress, setNewStudentAddress] = useState('');
  const { addToast } = useToast();
  const { students, saveStudent } = useStudents();

  const today = new Date();
  const isToday = selectedDate === getDateString(today);
  const isFieldDay = isFieldServiceDay(new Date(selectedDate), settings.fieldServiceDays);
  
  // Check if last field service day has been logged
  const lastFieldServiceDay = new Date();
  let daysBack = 1;
  while (daysBack <= 7) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - daysBack);
    if (isFieldServiceDay(checkDate, settings.fieldServiceDays)) {
      lastFieldServiceDay.setTime(checkDate.getTime());
      break;
    }
    daysBack++;
  }
  
  const lastFieldServiceDateString = getDateString(lastFieldServiceDay);
  const hasLoggedLastFieldDay = records.some(r => r.date === lastFieldServiceDateString);

  const handleAddNewStudent = async () => {
    if (!newStudentName.trim() || !newStudentAddress.trim()) {
      addToast({
        type: 'error',
        title: 'Missing Information',
        description: 'Please enter both name and address for the new student'
      });
      return;
    }

    try {
      const newStudent = await saveStudent({
        name: newStudentName.trim(),
        address: newStudentAddress.trim(),
        date_met: selectedDate,
        publication_left: '',
        place_stopped: '',
        last_visit_date: '',
        last_study_notes: ''
      });

      setSelectedStudentId(newStudent.id);
      setShowAddStudent(false);
      setNewStudentName('');
      setNewStudentAddress('');
      
      addToast({
        type: 'success',
        title: 'Student Added',
        description: `${newStudent.name} has been added to your students list`
      });
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleTimerStop = () => {
    const totalMs = onStopTimer();
    const totalMinutes = Math.floor(totalMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (totalMinutes > 0) {
      // Use today's date for timer entries
      const timerRecord: ServiceRecord = {
        id: crypto.randomUUID(),
        date: getDateString(new Date()),
        hours,
        minutes,
        type: selectedType,
        notes: notes.trim() || undefined,
        student_id: selectedStudentId || undefined
      };
      
      onSaveRecord(timerRecord);
      setNotes('');
      setSelectedStudentId('');
      
      addToast({
        type: 'success',
        title: 'Time Logged',
        description: `${hours}h ${minutes}m recorded for ${getDateString(new Date())}`
      });
    } else {
      addToast({
        type: 'info',
        title: 'Timer Stopped',
        description: 'No time was recorded (timer was too short)'
      });
    }
  };

  const saveRecord = (hours: number, minutes: number) => {
    const record: ServiceRecord = {
      id: crypto.randomUUID(),
      date: selectedDate,
      hours,
      minutes,
      type: selectedType,
      notes: notes.trim() || undefined,
      student_id: selectedStudentId || undefined
    };
    
    onSaveRecord(record);
    setNotes('');
    setSelectedStudentId('');
    
    addToast({
      type: 'success',
      title: 'Entry Added',
      description: `${hours}h ${minutes}m logged for ${new Date(selectedDate).toLocaleDateString()}`
    });
  };

  const handleManualSave = () => {
    if (manualHours > 0 || manualMinutes > 0) {
      saveRecord(manualHours, manualMinutes);
      setManualHours(0);
      setManualMinutes(0);
    } else {
      addToast({
        type: 'error',
        title: 'Invalid Entry',
        description: 'Please enter at least some time before saving'
      });
    }
  };

  const getServiceTypeIcon = (type: string) => {
    switch (type) {
      case 'h2h': return <Briefcase size={20} />;
      case 'cart': return <BaggageClaim size={20} />;
      default: return <Clock size={20} />;
    }
  };

  const getStatusMessage = () => {
    if (isToday && isFieldDay) {
      return { message: "It's a field service day! Ready to log your time.", type: 'active' };
    } else if (!hasLoggedLastFieldDay && daysBack <= 7) {
      return { 
        message: `Don't forget to log your hours from ${lastFieldServiceDay.toLocaleDateString()}`, 
        type: 'reminder' 
      };
    } else {
      return { message: "Your records are up to date!", type: 'complete' };
    }
  };

  const status = getStatusMessage();

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={`p-4 rounded-xl ${
        status.type === 'active' ? 'bg-green-50 text-green-800' :
        status.type === 'reminder' ? 'bg-yellow-50 text-yellow-800' :
        'bg-blue-50 text-blue-800'
      }`}>
        <p className="font-medium">{status.message}</p>
      </div>

      {/* Service Type Selection */}
      <div className="bg-white rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Service Type</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'h2h', label: 'House to House', subtitle: 'Door-to-door & return visits', icon: Briefcase },
            { id: 'cart', label: 'Cart Witnessing', subtitle: 'Public witnessing', icon: BaggageClaim }
          ].map(({ id, label, subtitle, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSelectedType(id as 'h2h' | 'cart')}
              className={`p-4 rounded-xl transition-all duration-200 border-2 text-left ${
                selectedType === id
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className={`p-2 rounded-lg ${
                  selectedType === id
                    ? 'bg-blue-100'
                    : 'bg-white'
                }`}>
                  <Icon size={24} />
                </div>
                <div>
                  <div className="font-semibold text-sm">{label}</div>
                  <div className="text-xs opacity-75 mt-1">{subtitle}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Timer */}
      <Timer
        timerState={timerState}
        onStart={onStartTimer}
        onPause={onPauseTimer}
        onStop={handleTimerStop}
      />

      {/* Manual Entry */}
      <div className="bg-white rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Manual Entry</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full p-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hours</label>
              <input
                type="number"
                min="0"
                max="24"
                value={manualHours}
                onChange={(e) => setManualHours(parseInt(e.target.value) || 0)}
                className="w-full p-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Minutes</label>
              <input
                type="number"
                min="0"
                max="59"
                value={manualMinutes}
                onChange={(e) => setManualMinutes(parseInt(e.target.value) || 0)}
                className="w-full p-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Student Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Student Visited (optional)</label>
            {!showAddStudent ? (
              <div className="space-y-3">
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a student...</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} - {student.address}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddStudent(true)}
                  className="w-full bg-green-50 hover:bg-green-100 text-green-700 py-2 px-4 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <Plus size={16} />
                  <span>Add New Student</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 p-4 bg-green-50 rounded-xl border border-green-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-green-800">Add New Student</h4>
                  <button
                    onClick={() => setShowAddStudent(false)}
                    className="text-green-600 hover:text-green-800"
                  >
                    <X size={16} />
                  </button>
                </div>
                <input
                  type="text"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="Student's name"
                  className="w-full p-3 bg-white rounded-xl border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <textarea
                  value={newStudentAddress}
                  onChange={(e) => setNewStudentAddress(e.target.value)}
                  placeholder="Student's address"
                  rows={2}
                  className="w-full p-3 bg-white rounded-xl border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
                <button
                  onClick={handleAddNewStudent}
                  disabled={!newStudentName.trim() || !newStudentAddress.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-2 px-4 rounded-xl font-medium transition-colors"
                >
                  Add Student
                </button>
              </div>
            )}
          </div>

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

          <button
            onClick={handleManualSave}
            disabled={manualHours === 0 && manualMinutes === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-3 px-4 rounded-xl font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            <Plus size={20} />
            <span>Add Entry</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogTab;