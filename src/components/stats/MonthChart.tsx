import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { MonthlyStatPoint } from '../../hooks/useStatsData';
import { formatHoursMinutesShort, getMonthName, parseMonthKey } from '../../utils/dateUtils';
import { ease } from '../../lib/motion';

interface MonthChartProps {
  data: MonthlyStatPoint[];
  // The month open in the report: drawn in full colour, the rest held back
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
  monthlyTarget: number;
  // Volunteers see their hours split by kind; everyone else sees one total
  splitCredits: boolean;
}

const PLOT = 160;
// Room above the tallest column for its value and tooltip - the plot scrolls sideways,
// and a scrolling box clips anything that pokes out of its top
const HEADROOM = 56;
const MIN_SLOT = 26;

// One series per kind of hours, always in this order and colour (validated together
// for colour-blind separation; the gap between segments and the legend carry identity
// as well, so colour is never the only cue)
const SERIES = [
  { key: 'preachingHours', label: 'Field service', strong: '#2563eb', soft: '#bfdbfe' },
  { key: 'volunteerHours', label: 'Volunteer', strong: '#059669', soft: '#a7f3d0' },
  { key: 'schoolHours', label: 'School', strong: '#d97706', soft: '#fde68a' }
] as const;
type SeriesKey = (typeof SERIES)[number]['key'];

// A total with nothing to split is drawn as one bar: the month in focus in blue,
// the rest a quiet grey, so the eye goes to the month the report is showing
const SINGLE = { strong: '#2563eb', soft: '#cbd5e1' };

/** A round top for the y-axis, and a tidy step that gives four or five lines. */
const niceScale = (max: number) => {
  const top = Math.max(max, 1) * 1.08;
  const step = [5, 10, 20, 25, 50, 100, 200].find(candidate => top / candidate <= 5) ?? 500;
  return { top: Math.ceil(top / step) * step, step };
};

const shortLabel = (monthKey: string, compact: boolean) => {
  const name = getMonthName(monthKey);
  return compact ? name[0] : name.slice(0, 3);
};

/**
 * Hours for each month of the period, as columns against the monthly target.
 * Tapping a column opens that month's report; hovering or focusing one shows its figures.
 */
const MonthChart: React.FC<MonthChartProps> = ({ data, selectedMonth, onSelectMonth, monthlyTarget, splitCredits }) => {
  const [hovered, setHovered] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // Split only when some month in view actually has a credit to split out
  const series = useMemo(
    () =>
      splitCredits || data.some(point => point.schoolHours > 0)
        ? SERIES.filter(line => data.some(point => point[line.key] > 0))
        : [],
    [data, splitCredits]
  );
  const stacked = series.length > 1;

  const { top, step } = niceScale(Math.max(monthlyTarget, ...data.map(point => point.hours)));
  const ticks = Array.from({ length: top / step + 1 }, (_, index) => index * step);
  const toPx = (hours: number) => (hours / top) * PLOT;

  const compact = data.length > 6;
  const spansYears = new Set(data.map(point => parseMonthKey(point.month).year)).size > 1;

  // A long history scrolls sideways; start on the month the report is showing
  useEffect(() => {
    const box = scroller.current;
    const selected = box?.querySelector<HTMLElement>('[data-selected="true"]');
    if (box && selected) box.scrollLeft = selected.offsetLeft - box.clientWidth / 2;
  }, [data.length, selectedMonth]);

  if (data.length === 0) {
    return <p className="text-sm text-gray-600 text-center py-10">Nothing logged in this period yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {stacked && (
        <div className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legend">
          {series.map(line => (
            <span key={line.key} className="flex items-center gap-1.5 text-xs text-gray-700">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: line.strong }} aria-hidden="true" />
              {line.label}
            </span>
          ))}
        </div>
      )}

      <div className="relative flex">
        {/* Y-axis */}
        <div className="relative w-8 flex-shrink-0" style={{ height: HEADROOM + PLOT + 34 }} aria-hidden="true">
          {ticks.map(value => (
            <span key={value} className="absolute right-1.5 text-[11px] text-gray-500 tabular-nums -translate-y-1/2" style={{ top: HEADROOM + PLOT - toPx(value) }}>
              {value}
            </span>
          ))}
        </div>

        <div ref={scroller} className="relative flex-1 overflow-x-auto overflow-y-visible" style={{ scrollbarWidth: 'none' }}>
          <div className="relative" style={{ minWidth: data.length * MIN_SLOT, height: HEADROOM + PLOT + 34 }}>
            {/* Grid, then the target as a darker reference line with its label */}
            {ticks.map(value => (
              <span key={value} className={`absolute left-0 right-0 h-px pointer-events-none ${value === 0 ? 'bg-gray-300' : 'bg-gray-100'}`} style={{ top: HEADROOM + PLOT - toPx(value) }} aria-hidden="true" />
            ))}
            {monthlyTarget > 0 && (
              <span className="absolute left-0 right-0 h-px bg-gray-500 z-[1] pointer-events-none" style={{ top: HEADROOM + PLOT - toPx(monthlyTarget) }} aria-hidden="true">
                <span className="absolute right-0 -top-[17px] px-0.5 bg-white text-[11px] font-semibold text-gray-700">{monthlyTarget}h target</span>
              </span>
            )}

            <div className="absolute inset-x-0 flex" style={{ top: HEADROOM, height: PLOT }}>
              {data.map(point => {
                const selected = point.month === selectedMonth;
                const isHovered = hovered === point.month && !selected;
                const name = getMonthName(point.month);
                const parts = stacked
                  ? series.map(line => ({ key: line.key as SeriesKey, label: line.label, hours: point[line.key], color: selected || isHovered ? line.strong : line.soft }))
                  : [{ key: 'hours' as const, label: 'Hours', hours: point.hours, color: selected ? SINGLE.strong : isHovered ? '#94a3b8' : SINGLE.soft }];
                const visible = parts.filter(part => part.hours > 0);

                return (
                  <button
                    key={point.month}
                    type="button"
                    data-selected={selected}
                    onClick={() => onSelectMonth(point.month)}
                    onMouseEnter={() => setHovered(point.month)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(point.month)}
                    onBlur={() => setHovered(null)}
                    aria-pressed={selected}
                    aria-label={`${name}: ${formatHoursMinutesShort(point.hours)}, ${point.studies} ${point.studies === 1 ? 'study' : 'studies'}`}
                    className="relative flex-1 h-full flex flex-col items-center justify-end active:!scale-100"
                    style={{ minWidth: MIN_SLOT }}
                  >
                    {/* Rounded when columns are narrow, so it never spills over its
                        neighbours; the exact figure is in the report and the tooltip */}
                    {selected && point.hours > 0 && (
                      <span className="mb-1 text-[11px] font-bold text-gray-800 whitespace-nowrap pointer-events-none">
                        {compact ? `${Math.round(point.hours)}h` : formatHoursMinutesShort(point.hours)}
                      </span>
                    )}

                    {/* The figures for a column under the pointer or keyboard focus */}
                    {isHovered && (
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 shadow-lg whitespace-nowrap flex flex-col items-start gap-0.5 pointer-events-none">
                        <span className="text-[13px] font-bold text-gray-900">{formatHoursMinutesShort(point.hours)}</span>
                        {stacked && visible.length > 1 && visible.map(part => (
                          <span key={part.key} className="flex items-center gap-1.5 text-[11px] text-gray-700">
                            <span className="w-2.5 h-0.5 rounded-full" style={{ background: SERIES.find(line => line.key === part.key)!.strong }} />
                            {part.label} {formatHoursMinutesShort(part.hours)}
                          </span>
                        ))}
                        <span className="text-[11px] text-gray-600">{name} · {point.studies} {point.studies === 1 ? 'study' : 'studies'}</span>
                      </span>
                    )}

                    {/* The bar grows from the baseline when the period changes */}
                    <motion.span
                      key={`${point.month}-${data.length}`}
                      className="flex flex-col-reverse w-5 gap-[2px]"
                      style={{ originY: 1 }}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ duration: 0.45, ease }}
                      aria-hidden="true"
                    >
                      {visible.map((part, index) => (
                        <span
                          key={part.key}
                          className="block w-full transition-colors duration-200"
                          style={{
                            height: Math.max(2, toPx(part.hours) - (index > 0 ? 2 : 0)),
                            background: part.color,
                            borderRadius: index === visible.length - 1 ? '4px 4px 0 0' : 0
                          }}
                        />
                      ))}
                    </motion.span>
                  </button>
                );
              })}
            </div>

            {/* Month labels, with the year under each January when the view spans years */}
            <div className="absolute inset-x-0 flex" style={{ top: HEADROOM + PLOT + 6 }} aria-hidden="true">
              {data.map(point => {
                const selected = point.month === selectedMonth;
                const { month, year } = parseMonthKey(point.month);
                return (
                  <span key={point.month} className="flex-1 flex flex-col items-center" style={{ minWidth: MIN_SLOT }}>
                    <span className={`text-[11px] ${selected ? 'font-bold text-gray-800' : 'text-gray-500'}`}>{shortLabel(point.month, compact)}</span>
                    {spansYears && month === 1 && <span className="text-[10px] text-gray-500">{String(year).slice(-2)}</span>}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthChart;
