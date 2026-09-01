import React from 'react';
import { TableProperties } from 'lucide-react';
import { MonthlyStatPoint } from '../hooks/useStatsData';
import { formatHoursMinutesShort, getShortMonthLabel } from '../utils/dateUtils';

interface StatsTableProps {
  data: MonthlyStatPoint[];
  // A volunteer's hours come from two places, so the total alone hides half of it
  splitVolunteer?: boolean;
}

// Newest month first - the one the reader is most likely looking for
const StatsTable: React.FC<StatsTableProps> = ({ data, splitVolunteer = false }) => {
  const rows = [...data].sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div className="bg-white rounded-xl p-6">
      <div className="flex items-center space-x-3 mb-4">
        <TableProperties size={24} className="text-blue-500" />
        <h3 className="text-lg font-semibold text-gray-800">Monthly Breakdown</h3>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">Nothing to show for this period.</p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="text-left font-medium py-2 px-2">Month</th>
                {splitVolunteer && (
                  <>
                    <th className="text-right font-medium py-2 px-2">Field</th>
                    <th className="text-right font-medium py-2 px-2">Volunteer</th>
                  </>
                )}
                <th className="text-right font-medium py-2 px-2">
                  {splitVolunteer ? 'Total' : 'Hours'}
                </th>
                <th className="text-right font-medium py-2 px-2">Studies</th>
                <th className="text-right font-medium py-2 px-2 whitespace-nowrap">Avg/week</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map(row => (
                <tr key={row.month} className="border-b border-gray-100 last:border-b-0">
                  <td className="py-2.5 px-2 text-gray-800 whitespace-nowrap">
                    {getShortMonthLabel(row.month)}
                  </td>
                  {splitVolunteer && (
                    <>
                      <td className="py-2.5 px-2 text-right text-gray-600 whitespace-nowrap">
                        {formatHoursMinutesShort(row.preachingHours)}
                      </td>
                      <td className="py-2.5 px-2 text-right text-gray-600 whitespace-nowrap">
                        {formatHoursMinutesShort(row.volunteerHours)}
                      </td>
                    </>
                  )}
                  <td className="py-2.5 px-2 text-right font-medium text-gray-900 whitespace-nowrap">
                    {formatHoursMinutesShort(row.hours)}
                  </td>
                  <td className="py-2.5 px-2 text-right text-gray-800">{row.studies}</td>
                  <td className="py-2.5 px-2 text-right text-gray-600 whitespace-nowrap">
                    {formatHoursMinutesShort(row.weeklyAverage)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StatsTable;
