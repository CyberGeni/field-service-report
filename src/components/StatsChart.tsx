import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { ChevronDown, TrendingUp } from 'lucide-react';
import {
  MonthlyStatPoint,
  StatsPeriod,
  StatsYearOption,
  STATS_PERIOD_OPTIONS
} from '../hooks/useStatsData';
import { formatHoursMinutesShort, getMonthName } from '../utils/dateUtils';

// Single series, so no legend: the card heading says what is plotted.
const SERIES_COLOR = '#2a78d6';
const GRID_COLOR = '#E5E7EB';
const AXIS_TEXT_COLOR = '#6B7280';
const SURFACE_COLOR = '#FFFFFF';

interface StatsChartProps {
  data: MonthlyStatPoint[];
  period: StatsPeriod;
  onPeriodChange: (period: StatsPeriod) => void;
  // Empty for periods that cover a rolling window rather than a named year
  yearOptions: StatsYearOption[];
  year: number;
  onYearChange: (year: number) => void;
  loading?: boolean;
}

interface FilterSelectProps {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  options: { value: string | number; label: string }[];
}

/**
 * A labelled dropdown for the chart filters.
 *
 * The native caret is hidden and redrawn as an overlaid icon: browsers pin their own
 * caret to the control's edge no matter how much right padding it is given, which on
 * a rounded control leaves it crowding the border.
 */
const FilterSelect: React.FC<FilterSelectProps> = ({ id, label, value, onChange, options }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
      {label}
    </label>
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none pl-3 pr-11 py-3 bg-gray-50 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={18}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
      />
    </div>
  </div>
);

interface TooltipProps {
  active?: boolean;
  payload?: { payload: MonthlyStatPoint }[];
}

const ChartTooltip: React.FC<TooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0].payload;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-lg px-3 py-2">
      <div className="flex items-center space-x-2">
        <span
          className="block w-3 h-0.5 rounded-full"
          style={{ backgroundColor: SERIES_COLOR }}
        />
        <span className="text-sm font-semibold text-gray-900">
          {formatHoursMinutesShort(point.hours)}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {getMonthName(point.month)} · {point.studies} {point.studies === 1 ? 'study' : 'studies'}
      </p>
    </div>
  );
};

const StatsChart: React.FC<StatsChartProps> = ({
  data,
  period,
  onPeriodChange,
  yearOptions,
  year,
  onYearChange,
  loading = false
}) => {
  const hasData = data.length > 0;
  const hasHours = data.some(point => point.hours > 0);

  return (
    <div className="bg-white rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-4">
        <TrendingUp size={24} className="text-blue-500" />
        <h3 className="text-lg font-semibold text-gray-800">Hours by Month</h3>
      </div>

      {/* Filters sit in one row above the content they scope */}
      <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FilterSelect
          id="stats-period"
          label="Period"
          value={period}
          onChange={value => onPeriodChange(value as StatsPeriod)}
          options={STATS_PERIOD_OPTIONS}
        />

        {/* Only a period that names a year has a year to choose */}
        {yearOptions.length > 0 && (
          <FilterSelect
            id="stats-year"
            label="Year"
            value={year}
            onChange={value => onYearChange(Number(value))}
            options={yearOptions}
          />
        )}
      </div>

      {!hasData && !loading && (
        <p className="text-sm text-gray-500 text-center py-10">
          No service recorded in this period yet.
        </p>
      )}

      {hasData && (
        // While a new period loads, hold the previous render rather than flashing a
        // skeleton and jumping the layout.
        <div className={`transition-opacity duration-200 ${loading ? 'opacity-50' : 'opacity-100'}`}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={GRID_COLOR} strokeWidth={1} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: AXIS_TEXT_COLOR, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: GRID_COLOR }}
                minTickGap={12}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: AXIS_TEXT_COLOR, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={44}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: '#D1D5DB', strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="hours"
                stroke={SERIES_COLOR}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                // Redrawing the path on every period change is more distracting than
                // it is polished, and mid-animation re-renders can drop the line.
                isAnimationActive={false}
                dot={
                  data.length <= 14
                    ? { r: 4, fill: SERIES_COLOR, stroke: SURFACE_COLOR, strokeWidth: 2 }
                    : false
                }
                activeDot={{ r: 6, fill: SERIES_COLOR, stroke: SURFACE_COLOR, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>

          {!hasHours && (
            <p className="text-sm text-gray-500 text-center mt-2">
              No hours recorded in this period yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default StatsChart;
