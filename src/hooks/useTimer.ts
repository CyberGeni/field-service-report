import { useState, useEffect, useRef } from 'react';
import { TimerState } from '../types';

const TIMER_STORAGE_KEY = 'fieldService_timer';

export const useTimer = () => {
  const [timerState, setTimerState] = useState<TimerState>(() => {
    // Load timer state from localStorage on initialization
    const savedTimer = localStorage.getItem(TIMER_STORAGE_KEY);
    if (savedTimer) {
      try {
        const parsed = JSON.parse(savedTimer);
        // If timer was running, calculate current total time
        if (parsed.isRunning && !parsed.isPaused && parsed.startTime) {
          const now = Date.now();
          const elapsed = now - parsed.startTime + parsed.pausedTime;
          return {
            ...parsed,
            totalTime: elapsed
          };
        }
        return parsed;
      } catch (error) {
        console.error('Error loading timer state:', error);
      }
    }
    
    return {
      isRunning: false,
      isPaused: false,
      startTime: null,
      pausedTime: 0,
      totalTime: 0
    };
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
          isRunning: true,
          isPaused: false,
          startTime: now,
          pausedTime: 0,
          totalTime: 0
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

  const stopTimer = () => {
    const finalTime = timerState.totalTime;
    const newState = {
      isRunning: false,
      isPaused: false,
      startTime: null,
      pausedTime: 0,
      totalTime: 0
    };
    setTimerState(newState);
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(newState));
    return finalTime;
  };

  const resetTimer = () => {
    const newState = {
      isRunning: false,
      isPaused: false,
      startTime: null,
      pausedTime: 0,
      totalTime: 0
    };
    setTimerState(newState);
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(newState));
  };

  return {
    timerState,
    startTimer,
    pauseTimer,
    stopTimer,
    resetTimer
  };
};