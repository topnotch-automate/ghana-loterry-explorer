import React from 'react';
import type { CoOccurrencePair } from '../types';

interface CoOccurrenceMatrixProps {
  data: CoOccurrencePair[];
  title?: string;
  maxItems?: number;
  showMatrix?: boolean;
}

export const CoOccurrenceMatrix: React.FC<CoOccurrenceMatrixProps> = ({
  data,
  title = 'Number Co-Occurrence',
  maxItems = 50,
  showMatrix = false,
}) => {
  const sortedData = [...data]
    .sort((a, b) => b.count - a.count)
    .slice(0, maxItems);

  if (sortedData.length === 0) {
    return (
      <div className="card">
        <div className="text-center text-gray-500 py-8">No co-occurrence data available</div>
      </div>
    );
  }

  const maxCount = Math.max(...sortedData.map((d) => d.count), 1);

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="text-sm text-gray-600 mb-4">
        Shows pairs of numbers that frequently appear together in the same draw
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
          <div className="grid grid-cols-6 gap-2 text-xs font-medium text-gray-600 pb-2 border-b">
            <div>Number 1</div>
            <div>Number 2</div>
            <div className="text-center">Total</div>
            <div className="text-center">Winning</div>
            <div className="text-center">Machine</div>
            <div className="text-right">Last Seen</div>
          </div>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {sortedData.map((pair, index) => (
              <div
                key={`${pair.number1}-${pair.number2}`}
                className="grid grid-cols-6 gap-2 items-center py-2 px-2 rounded hover:bg-gray-50 transition-colors"
              >
                <div className="font-semibold text-primary-600">{pair.number1}</div>
                <div className="font-semibold text-primary-600">{pair.number2}</div>
                <div className="text-center">
                  <div className="inline-flex items-center gap-2">
                    <div className="font-bold">{pair.count}</div>
                    <div
                      className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden"
                      title={`${pair.count} occurrences`}
                    >
                      <div
                        className="h-full bg-gradient-to-r from-purple-600 to-cyan-400"
                        style={{ width: `${(pair.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="text-center text-sm text-gray-600">{pair.winningCount}</div>
                <div className="text-center text-sm text-gray-600">{pair.machineCount}</div>
                <div className="text-right text-xs text-gray-500">
                  {pair.lastSeen ? new Date(pair.lastSeen).toLocaleDateString() : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

