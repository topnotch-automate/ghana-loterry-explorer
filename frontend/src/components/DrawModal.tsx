import React, { useState, useEffect } from 'react';
import { drawsApi } from '../api/client';
import { formatDate } from '../utils/format';
import { DrawCard } from './DrawCard';
import { LoadingSpinner } from './LoadingSpinner';
import type { Draw, SearchResult } from '../types';

interface DrawModalProps {
  draw: Draw | null;
  onClose: () => void;
}

export const DrawModal: React.FC<DrawModalProps> = ({ draw, onClose }) => {
  const [similarDraws, setSimilarDraws] = useState<SearchResult[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  useEffect(() => {
    if (draw) {
      loadSimilarDraws();
    } else {
      setSimilarDraws([]);
    }
  }, [draw]);

  const loadSimilarDraws = async () => {
    if (!draw) return;
    try {
      setLoadingSimilar(true);
      const similar = await drawsApi.getSimilar(draw.id, 3, 5);
      setSimilarDraws(similar);
    } catch (error) {
      console.error('Error loading similar draws:', error);
      setSimilarDraws([]);
    } finally {
      setLoadingSimilar(false);
    }
  };

  if (!draw) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-sm text-gray-500 mb-1">Draw Date</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatDate(draw.drawDate)}
            </div>
            <div className="text-lg text-gray-600 mt-1">{draw.lottoType}</div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <div className="text-sm font-medium text-gray-700 mb-3">
              Winning Numbers (Positions 1–5)
            </div>
            <div className="flex flex-wrap gap-2">
              {draw.winningNumbers.map((num, i) => (
                <div
                  key={`w-${i}`}
                  className="number-chip number-chip-winning text-lg px-4 py-2"
                >
                  {num}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 mb-3">
              Machine Numbers (Positions 6–10)
            </div>
            <div className="flex flex-wrap gap-2">
              {draw.machineNumbers.map((num, i) => (
                <div
                  key={`m-${i}`}
                  className="number-chip number-chip-machine text-lg px-4 py-2"
                >
                  {num}
                </div>
              ))}
            </div>
          </div>
        </div>

        {draw.source && (
          <div className="mb-4">
            <div className="text-sm text-gray-500">Source</div>
            <div className="text-sm font-medium">{draw.source}</div>
          </div>
        )}

        <div className="border-t pt-4">
          <div className="text-sm font-medium text-gray-700 mb-3">
            Previous Occurrences (Similar Draws)
          </div>
          {loadingSimilar ? (
            <div className="text-center py-4">
              <LoadingSpinner message="Loading similar draws..." />
            </div>
          ) : similarDraws.length > 0 ? (
            <div className="space-y-3">
              {similarDraws.map((similarDraw) => {
                const winningMatches = similarDraw.matchCountWinning || 0;
                const machineMatches = similarDraw.matchCountMachine || 0;
                const hasWinningMatches = winningMatches > 0;
                const hasMachineMatches = machineMatches > 0;
                
                return (
                  <div
                    key={similarDraw.id}
                    className="p-3 border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-sm text-gray-500">{formatDate(similarDraw.drawDate)}</div>
                        <div className="text-xs text-gray-400">{similarDraw.lottoType}</div>
                      </div>
                      <div className="text-right">
                        {hasWinningMatches && (
                          <div className="mb-1">
                            <div className="text-xs text-gray-500">Winning Matches</div>
                            <div className="text-lg font-bold text-green-600">
                              {winningMatches}
                            </div>
                          </div>
                        )}
                        {hasMachineMatches && (
                          <div>
                            <div className="text-xs text-gray-500">Machine Matches</div>
                            <div className="text-lg font-bold text-blue-600">
                              {machineMatches}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {hasWinningMatches && (
                      <div className="mb-2">
                        <div className="text-xs text-gray-500 mb-1">Winning Numbers:</div>
                        <div className="flex flex-wrap gap-1">
                          {similarDraw.winningNumbers.map((num, i) => (
                            <div
                              key={`win-${i}`}
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                draw.winningNumbers.includes(num) || draw.machineNumbers.includes(num)
                                  ? 'bg-yellow-200 text-yellow-900'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {num}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {hasMachineMatches && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Machine Numbers:</div>
                        <div className="flex flex-wrap gap-1">
                          {similarDraw.machineNumbers.map((num, i) => (
                            <div
                              key={`mac-${i}`}
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                draw.winningNumbers.includes(num) || draw.machineNumbers.includes(num)
                                  ? 'bg-yellow-200 text-yellow-900'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {num}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-400">
              No similar draws found (minimum 3 matching numbers).
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

