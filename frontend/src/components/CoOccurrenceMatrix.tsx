import React, { useState } from 'react';
import { analyticsApi } from '../api/client';
import { formatDate } from '../utils/format';
import { LoadingSpinner } from './LoadingSpinner';
import type { CoOccurrenceData } from '../types';

interface CoOccurrenceMatrixProps {
  data: CoOccurrenceData[];
  title?: string;
  maxItems?: number;
  showMatrix?: boolean;
  days?: number;
  lottoType?: string;
}

export const CoOccurrenceMatrix: React.FC<CoOccurrenceMatrixProps> = ({
  data,
  title = 'Number Co-Occurrence',
  maxItems = 50,
  showMatrix = false,
  days,
  lottoType,
}) => {
  const [selectedItem, setSelectedItem] = useState<CoOccurrenceData | null>(null);
  const [drawDates, setDrawDates] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const handleItemClick = async (item: CoOccurrenceData) => {
    if (selectedItem === item && drawDates.length > 0) {
      // If already selected, close it
      setSelectedItem(null);
      setDrawDates([]);
      return;
    }

    setSelectedItem(item);
    setLoadingDates(true);
    try {
      const dates = await analyticsApi.getCoOccurrenceDates({
        number1: item.number1,
        number2: item.number2,
        number3: item.type === 'triplet' ? item.number3 : undefined,
        days,
        lottoType,
      });
      setDrawDates(dates);
    } catch (error) {
      console.error('Error fetching draw dates:', error);
      setDrawDates([]);
    } finally {
      setLoadingDates(false);
    }
  };

  // Sort data: prioritize winning-only, then by count
  const sortedData = [...data]
    .sort((a, b) => {
      // Prioritize winning-only (winningCount > 0 and machineCount === 0)
      const aIsWinningOnly = a.winningCount > 0 && a.machineCount === 0;
      const bIsWinningOnly = b.winningCount > 0 && b.machineCount === 0;
      
      if (aIsWinningOnly && !bIsWinningOnly) return -1;
      if (!aIsWinningOnly && bIsWinningOnly) return 1;
      
      // Then sort by count (descending)
      if (b.count !== a.count) return b.count - a.count;
      
      // If counts are equal, prioritize by winning count
      return b.winningCount - a.winningCount;
    })
    .slice(0, maxItems);

  if (sortedData.length === 0) {
    return (
      <div className="card">
        <div className="text-center text-gray-500 py-8">No co-occurrence data available</div>
      </div>
    );
  }

  const maxCount = Math.max(...sortedData.map((d) => d.count), 1);
  const hasTriplets = sortedData.some(d => d.type === 'triplet');

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="text-sm text-gray-600 mb-4">
        Shows triplets (3 numbers) or pairs (2 numbers) that frequently appear together in the same draw.
        Pairs are shown when there aren't enough triplets available for the selected period.
      </div>

      {showMatrix ? (
        <div className="overflow-x-auto">
          <div className="text-sm text-gray-500 mb-2">Matrix view (coming soon)</div>
          <div className="text-xs text-gray-400">
            Matrix visualization will show a heatmap of number pairs
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-7 gap-2 text-xs font-medium text-gray-600 pb-2 border-b">
            <div className="text-center">No-1</div>
            <div className="text-center">No-2</div>
            {hasTriplets && <div className="text-center">No-3</div>}
            {!hasTriplets && <div></div>}
            <div className="text-center">Type</div>
            <div className="text-center">Total</div>
            <div className="text-center">Win</div>
            <div className="text-center">Mac</div>
            <div className="text-right">Last Seen</div>
          </div>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {sortedData.map((item) => {
              const isTriplet = item.type === 'triplet';
              const key = isTriplet 
                ? `${item.number1}-${item.number2}-${item.number3}` 
                : `${item.number1}-${item.number2}`;
              
              const isWinningOnly = item.winningCount > 0 && item.machineCount === 0;
              const isSelected = selectedItem === item;
              
              return (
                <React.Fragment key={key}>
                  <div
                    onClick={() => handleItemClick(item)}
                    className={`grid grid-cols-7 gap-2 items-center py-2 px-2 rounded transition-colors cursor-pointer ${
                      isSelected 
                        ? 'bg-primary-50 border-2 border-primary-300' 
                        : isWinningOnly
                        ? 'bg-green-50 hover:bg-green-100'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-center font-semibold text-primary-600">{item.number1}</div>
                    <div className="text-center font-semibold text-primary-600">{item.number2}</div>
                    {isTriplet ? (
                      <div className="text-center font-semibold text-primary-600">{item.number3}</div>
                    ) : (
                      <div></div>
                    )}
                    <div className="text-center">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        isTriplet 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {isTriplet ? '3' : '2'}
                      </span>
                    </div>
                    <div className="text-center">
                      <div className="inline-flex items-center gap-2">
                        <div className="font-bold">{item.count}</div>
                        <div
                          className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden"
                          title={`${item.count} occurrences`}
                        >
                          <div
                            className={`h-full ${
                              isWinningOnly 
                                ? 'bg-gradient-to-r from-green-600 to-green-400' 
                                : 'bg-gradient-to-r from-purple-600 to-cyan-400'
                            }`}
                            style={{ width: `${(item.count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-center text-sm text-gray-600">{item.winningCount}</div>
                    <div className="text-center text-sm text-gray-600">{item.machineCount}</div>
                    <div className="text-right text-xs text-gray-500">
                      {item.lastSeen ? formatDate(item.lastSeen) : '—'}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg mt-1">
                      <div className="text-sm font-semibold text-gray-700 mb-2">
                        All Draw Dates ({drawDates.length} total):
                      </div>
                      {loadingDates ? (
                        <LoadingSpinner message="Loading dates..." />
                      ) : drawDates.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {drawDates.map((date, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-white border border-gray-300 rounded text-xs"
                            >
                              {formatDate(date)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">No dates found</div>
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

