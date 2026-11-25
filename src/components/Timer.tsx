import React from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { TimerState } from '../types';
import { formatHoursMinutesShort, getTimerDisplay } from '../utils/dateUtils';

interface TimerProps {
  timerState: TimerState;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onSetServiceType: (type: 'h2h' | 'cart') => void;
  // Hours the plan asks of today; null when it asks none
  targetHours: number | null;
  // Opens the credit sheet; left out when this user has no credits to log
  onLogCredit?: () => void;
}

const RADIUS = 110;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const HOUR_MS = 3600000;

/**
 * The session in progress: what kind of service, how long so far, and how that
 * stands against what the plan asks of today.
 *
 * The ring fills toward today's planned hours. On a day the plan asks nothing of, it
 * fills once an hour instead, so it still shows time passing rather than sitting empty.
 */
const Timer: React.FC<TimerProps> = ({ timerState, onStart, onPause, onStop, onSetServiceType, targetHours, onLogCredit }) => {
  const running = timerState.isRunning && !timerState.isPaused;
  const paused = timerState.isPaused;
  const idle = !running && !paused;
  const elapsed = timerState.totalTime;
  const isCart = timerState.serviceType === 'cart';

  const targetMs = targetHours && targetHours > 0 ? targetHours * HOUR_MS : null;
  const progress = targetMs ? Math.min(1, elapsed / targetMs) : (elapsed % HOUR_MS) / HOUR_MS;
  const leftHours = targetMs ? Math.max(0, targetMs - elapsed) / HOUR_MS : 0;

  const caption = targetMs
    ? idle
      ? `${formatHoursMinutesShort(targetHours!)} planned for today`
      : leftHours > 0
        ? `${formatHoursMinutesShort(leftHours)} to today’s plan`
        : 'Today’s plan reached'
    : 'Nothing planned for today';

  const segment = (on: boolean) =>
    `h-11 rounded-[10px] text-[15px] font-semibold transition-colors ${
      on ? 'bg-white shadow-sm ' + (isCart ? 'text-purple-700' : 'text-blue-700') : 'text-gray-600'
    }`;

  return (
    <section aria-label="Timer" className="bg-white rounded-[20px] p-5 flex flex-col items-center gap-[18px] shadow-sm">
      <div role="group" aria-label="Service type" className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-[14px] w-full">
        <button type="button" aria-pressed={!isCart} onClick={() => onSetServiceType('h2h')} className={segment(!isCart)}>
          House to house
        </button>
        <button type="button" aria-pressed={isCart} onClick={() => onSetServiceType('cart')} className={segment(isCart)}>
          Cart witnessing
        </button>
      </div>

      <div className="relative w-[248px] h-[248px]">
        <svg width="248" height="248" viewBox="0 0 248 248" aria-hidden="true" className="-rotate-90">
          <circle cx="124" cy="124" r={RADIUS} fill="none" stroke="#eef2f7" strokeWidth="14" />
          <circle
            cx="124"
            cy="124"
            r={RADIUS}
            fill="none"
            stroke={isCart ? '#9333ea' : '#2563eb'}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" aria-live="polite">
          {running && (
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-red-700">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" aria-hidden="true" />
              Recording
            </span>
          )}
          {paused && <span className="text-[13px] font-semibold text-amber-700">Paused</span>}
          {idle && <span className="text-[13px] font-semibold text-gray-600">Ready when you are</span>}
          <span className="font-libre-franklin text-[44px] font-semibold tracking-tight tabular-nums text-gray-800" aria-label={`Time ${getTimerDisplay(elapsed)}`}>
            {getTimerDisplay(elapsed)}
          </span>
          <span className="text-sm text-gray-600 px-6 text-center">{caption}</span>
        </div>
      </div>

      {idle ? (
        <button
          type="button"
          onClick={onStart}
          className="w-full h-14 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-[17px] font-semibold flex items-center justify-center gap-2.5"
        >
          <Play size={20} fill="currentColor" aria-hidden="true" />
          Start field service
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 w-full">
          <button
            type="button"
            onClick={running ? onPause : onStart}
            className="h-14 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 text-base font-semibold flex items-center justify-center gap-2"
          >
            {running ? <Pause size={18} fill="currentColor" aria-hidden="true" /> : <Play size={18} fill="currentColor" aria-hidden="true" />}
            {running ? 'Pause' : 'Resume'}
          </button>
          <button
            type="button"
            onClick={onStop}
            className="h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-base font-semibold flex items-center justify-center gap-2"
          >
            <Square size={16} fill="currentColor" aria-hidden="true" />
            Stop &amp; save
          </button>
        </div>
      )}

      {onLogCredit && (
        <button
          type="button"
          onClick={onLogCredit}
          className="min-h-[44px] px-2 text-sm font-medium text-gray-600 underline underline-offset-[3px] hover:text-gray-800"
        >
          Log school or volunteer credit instead
        </button>
      )}
    </section>
  );
};

export default Timer;
