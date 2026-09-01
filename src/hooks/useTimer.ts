import { useState, useEffect, useRef } from 'react';
import { TimerState } from '../types';

const TIMER_STORAGE_KEY = 'fieldService_timer';

const DEFAULT_SERVICE_TYPE: TimerState['serviceType'] = 'h2h';

// A stopped timer keeps the service type so the last choice stays selected
// for the next session instead of snapping back to the default.
const clearedState = (serviceType: TimerState['serviceType']): TimerState => ({
  isRunning: false,
  isPaused: false,
  startTime: null,
  pausedTime: 0,
  totalTime: 0,
  serviceType
});

export const useTimer = () => {
  const [timerState, setTimerState] = useState<TimerState>(() => {
    // Load timer state from localStorage on initialization
    const savedTimer = localStorage.getItem(TIMER_STORAGE_KEY);
    if (savedTimer) {
      try {
        const parsed = JSON.parse(savedTimer);
        // State saved before serviceType existed has no type to restore
        const serviceType: TimerState['serviceType'] =
          parsed.serviceType === 'cart' ? 'cart' : DEFAULT_SERVICE_TYPE;
        // If timer was running, calculate current total time
        if (parsed.isRunning && !parsed.isPaused && parsed.startTime) {
          const now = Date.now();
          const elapsed = now - parsed.startTime + parsed.pausedTime;
          return {
            ...parsed,
            serviceType,
            totalTime: elapsed
          };
        }
        return { ...parsed, serviceType };
      } catch (error) {
        console.error('Error loading timer state:', error);
      }
    }

    return clearedState(DEFAULT_SERVICE_TYPE);
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Save timer state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timerState));
  }, [timerState]);

  useEffect(() => {
    if (timerState.isRunning && !timerState.isPaused && timerState.startTime) {
      intervalRef.current = setInterval(() => {
        setTimerState(prev => ({
          ...prev,
          totalTime: Date.now() - prev.startTime! + prev.pausedTime
        }));
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerState.isRunning, timerState.isPaused, timerState.startTime]);

  const startTimer = () => {
    const now = Date.now();
    setTimerState(prev => {
      if (prev.isPaused) {
        // Resuming from pause
        return {
          ...prev,
          isRunning: true,
          isPaused: false,
          startTime: now,
          pausedTime: prev.totalTime
        };
      } else {
        // Starting fresh
        return {
          ...clearedState(prev.serviceType),
          isRunning: true,
          startTime: now
        };
      }
    });
  };

  const pauseTimer = () => {
    setTimerState(prev => ({
      ...prev,
      isPaused: true,
      totalTime: prev.startTime ? Date.now() - prev.startTime + prev.pausedTime : prev.totalTime
    }));
  };

  // The service type belongs to the session, not to the Log tab, so it survives
  // navigating away and back (which unmounts the tab) and a reload mid-session.
  const setServiceType = (serviceType: TimerState['serviceType']) => {
    setTimerState(prev => ({ ...prev, serviceType }));
  };

  const stopTimer = () => {
    const finalTime = timerState.totalTime;
    const serviceType = timerState.serviceType;
    const newState = clearedState(serviceType);
    setTimerState(newState);
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(newState));
    return { totalTime: finalTime, serviceType };
  };

  const resetTimer = () => {
    const newState = clearedState(timerState.serviceType);
    setTimerState(newState);
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(newState));
  };

  return {
    timerState,
    startTimer,
    pauseTimer,
    stopTimer,
    resetTimer,
    setServiceType
  };
};
