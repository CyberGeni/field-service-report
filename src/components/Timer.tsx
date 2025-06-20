import React from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { TimerState } from '../types';
import { getTimerDisplay } from '../utils/dateUtils';

interface TimerProps {
  timerState: TimerState;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
}

const Timer: React.FC<TimerProps> = ({ timerState, onStart, onPause, onStop }) => {
  return (
    <div className="bg-white rounded-xl p-6">
      <div className="text-center">
        <div className={`text-4xl font-bold text-gray-800 mb-6 font-mono ${
          timerState.isRunning && !timerState.isPaused ? 'timer-running' : ''
        }`}>
          {getTimerDisplay(timerState.totalTime)}
        </div>
        
        <div className="flex justify-center space-x-4">
          {!timerState.isRunning || timerState.isPaused ? (
            <>
              <button
                onClick={onStart}
                className="flex items-center justify-center w-16 h-16 bg-green-500 hover:bg-green-600 text-white rounded-full transition-all duration-200 transform hover:scale-105"
              >
                <Play size={24} className="ml-1" />
              </button>
              {timerState.isPaused && (
                <button
                  onClick={onStop}
                  className="flex items-center justify-center w-16 h-16 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all duration-200 transform hover:scale-105"
                >
                  <Square size={24} />
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={onPause}
                className="flex items-center justify-center w-16 h-16 bg-yellow-500 hover:bg-yellow-600 text-white rounded-full transition-all duration-200 transform hover:scale-105"
              >
                <Pause size={24} />
              </button>
              <button
                onClick={onStop}
                className="flex items-center justify-center w-16 h-16 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all duration-200 transform hover:scale-105"
              >
                <Square size={24} />
              </button>
            </>
          )}
        </div>
        
        {timerState.isPaused && (
          <p className="text-sm text-yellow-600 mt-3 font-medium">Timer Paused</p>
        )}
        
        {timerState.isRunning && !timerState.isPaused && (
          <p className="text-sm text-green-600 mt-3 font-medium">Recording...</p>
        )}
      </div>
    </div>
  );
};

export default Timer;