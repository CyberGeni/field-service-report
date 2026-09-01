import React, { useState } from 'react';
import { ServiceRecord, ServiceActivity, Settings, TimerState, Profile } from '../types';
import { isFieldServiceDay, getDateString } from '../utils/dateUtils';
import { getAvailableActivities, getActivityMeta } from '../utils/activityTypes';
import { useToast } from './ui/toast';
import Timer from './Timer';
import CreditEntryForm from './CreditEntryForm';

interface LogTabProps {
  records: ServiceRecord[];
  settings: Settings;
  profile?: Profile | null;
  onSaveRecord: (record: ServiceRecord) => void;
  timerState: TimerState;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onStopTimer: () => { totalTime: number; serviceType: 'h2h' | 'cart' };
  onSetServiceType: (type: 'h2h' | 'cart') => void;
}

const LogTab: React.FC<LogTabProps> = ({
  records,
  settings,
  profile,
  onSaveRecord,
  timerState,
  onStartTimer,
  onPauseTimer,
  onStopTimer,
  onSetServiceType
}) => {
  const { addToast } = useToast();
  const activities = getAvailableActivities(profile);

  // Preaching lives on the timer, which owns its type across tabs and reloads; a
  // credit has no session to survive, so the choice of it is only this screen's.
  const [creditActivity, setCreditActivity] = useState<ServiceActivity | null>(null);
  const selectedType: ServiceActivity = creditActivity ?? timerState.serviceType;

  // Turning volunteer status off while it was selected must not strand the tab on a
  // form the user is no longer meant to see.
  if (creditActivity && !activities.some(activity => activity.id === creditActivity)) {
    setCreditActivity(null);
  }

  const handleSelectActivity = (activity: ServiceActivity) => {
    if (getActivityMeta(activity).timed) {
      setCreditActivity(null);
      onSetServiceType(activity as 'h2h' | 'cart');
      return;
    }
    setCreditActivity(activity);
  };

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
    // Read the type back from the stopped session rather than from a render-time
    // value, so the record always matches what was selected for that session.
    const { totalTime, serviceType } = onStopTimer();
    const totalMinutes = Math.floor(totalTime / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (totalMinutes > 0) {
      const timerRecord: ServiceRecord = {
        id: crypto.randomUUID(),
        date: getDateString(new Date()),
        hours,
        minutes,
        type: serviceType,
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
          {activities.map(({ id, label, subtitle, icon: Icon, selectedCard, selectedIconBg }) => (
            <button
              key={id}
              onClick={() => handleSelectActivity(id)}
              className={`p-4 rounded-xl transition-all duration-200 border-2 text-left ${
                selectedType === id
                  ? selectedCard
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className={`p-2 rounded-lg ${selectedType === id ? selectedIconBg : 'bg-white'}`}>
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

      {/* Time is timed; credited hours are entered as the figure they were given as */}
      {creditActivity ? (
        <CreditEntryForm activity={creditActivity} onSaveRecord={onSaveRecord} />
      ) : (
        <Timer
          timerState={timerState}
          onStart={onStartTimer}
          onPause={onPauseTimer}
          onStop={handleTimerStop}
        />
      )}
    </div>
  );
};

export default LogTab;
