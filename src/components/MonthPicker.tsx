import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getCurrentMonth, parseMonthKey } from '../utils/dateUtils';

interface MonthPickerProps {
  isOpen: boolean;
  onClose: () => void;
  // The month currently on screen, so the grid opens on its year and highlights it
  monthKey: string;
  // Inclusive lower bound, YYYY-MM - the upper bound is always the current month
  earliestMonth: string;
  onSelect: (month: number, year: number) => void;
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * A year-at-a-time grid for jumping straight to a month, instead of stepping the
 * report there one arrow press at a time.
 *
 * There is no calendar library reach for here: the report only ever wants a month,
 * never a day, so a 12-cell grid is both the simplest control and the one that can't
 * be misread as picking a date.
 */
const MonthPicker: React.FC<MonthPickerProps> = ({
  isOpen,
  onClose,
  monthKey,
  earliestMonth,
  onSelect
}) => {
  const selected = parseMonthKey(monthKey);
  const currentMonth = getCurrentMonth();
  const earliestYear = parseMonthKey(earliestMonth).year;
  const latestYear = parseMonthKey(currentMonth).year;

  const [viewYear, setViewYear] = useState(selected.year);

  // Reopening should land on the month already showing, not wherever a previous
  // visit to the picker last scrolled to.
  useEffect(() => {
    if (isOpen) setViewYear(selected.year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, monthKey]);

  if (!isOpen) return null;

  const canGoPreviousYear = viewYear > earliestYear;
  const canGoNextYear = viewYear < latestYear;

  const isSelectable = (month: number): boolean => {
    const key = `${viewYear}-${month.toString().padStart(2, '0')}`;
    return key >= earliestMonth && key <= currentMonth;
  };

  const handleSelect = (month: number) => {
    if (!isSelectable(month)) return;
    onSelect(month, viewYear);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="month-picker-title"
    >
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 id="month-picker-title" className="text-lg font-semibold text-gray-800">
            Select Month
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 -mr-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setViewYear(y => y - 1)}
            disabled={!canGoPreviousYear}
            aria-label="Previous year"
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronLeft size={20} />
          </button>

          <p className="text-base font-semibold text-gray-800 tabular-nums">{viewYear}</p>

          <button
            type="button"
            onClick={() => setViewYear(y => y + 1)}
            disabled={!canGoNextYear}
            aria-label="Next year"
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {MONTH_LABELS.map((label, index) => {
            const month = index + 1;
            const enabled = isSelectable(month);
            const isSelected = viewYear === selected.year && month === selected.month;

            return (
              <button
                key={label}
                type="button"
                onClick={() => handleSelect(month)}
                disabled={!enabled}
                aria-current={isSelected ? 'true' : undefined}
                className={`py-3 rounded-xl text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : enabled
                      ? 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MonthPicker;
