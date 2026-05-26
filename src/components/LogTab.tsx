import React, { useState } from 'react';
import { Briefcase, BaggageClaim } from 'lucide-react';
import { ServiceRecord, TimerState } from '../types';
import { isFieldServiceDay, getDateString } from '../utils/dateUtils';
import { useToast } from './ui/toast';
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
  const { addToast } = useToast();

  const today = new Date();
  const isFieldDay = isFieldServiceDay(today, settings.fieldServiceDays);

  // Find the most recent field service day (within the past 7 days)
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

  const handleTimerStop = () => {
    const totalMs = onStopTimer();
    const totalMinutes = Math.floor(totalMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (totalMinutes > 0) {
      const timerRecord: ServiceRecord = {
        id: crypto.randomUUID(),
        date: getDateString(new Date()),
        hours,
        minutes,
        type: selectedType,
      };

      onSaveRecord(timerRecord);

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

  const getStatusMessage = () => {
    if (isFieldDay) {
      return { message: "It's a field service day! Ready to log your time.", type: 'active' };
    } else if (!hasLoggedLastFieldDay && daysBack <= 7) {
      return {
        message: `Don't forget to log your hours from ${lastFieldServiceDay.toLocaleDateString()}`,
        type: 'reminder'
      };
    } else {
      return { message: 'Your records are up to date!', type: 'complete' };
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
                <div className={`p-2 rounded-lg ${selectedType === id ? 'bg-blue-100' : 'bg-white'}`}>
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
    </div>
  );
};

export default LogTab;
