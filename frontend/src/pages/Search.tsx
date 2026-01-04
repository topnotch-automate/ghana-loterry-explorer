import React, { useState } from 'react';
import { SearchBar } from '../components/SearchBar';
import { DrawCard } from '../components/DrawCard';
import { DrawModal } from '../components/DrawModal';
import { ResponsiveVirtualList } from '../components/VirtualGrid';
import { drawsApi } from '../api/client';
import { handleApiError } from '../utils/errors';
import { LOTTERY, UI } from '../utils/constants';
import { useSearch, useAllDraws } from '../hooks/useSearch';
import type { SearchResult, SearchMode } from '../types';

export const Search: React.FC = () => {
  const [selectedDraw, setSelectedDraw] = useState<SearchResult | null>(null);
  const [queryNumbers, setQueryNumbers] = useState<number[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>('partial');

  // React Query hooks
  const { 
    data: searchResults = [], 
    isLoading: loadingSearch,
    error: searchError 
  } = useSearch(
    { numbers: queryNumbers, mode: searchMode },
    { enabled: queryNumbers.length > 0 && hasSearched }
  );

  const { 
    data: allDraws = [], 
    isLoading: loadingAll,
    error: allDrawsError 
  } = useAllDraws(
    UI.ITEMS_PER_PAGE,
    { enabled: hasSearched && queryNumbers.length === 0 }
  );

  const loading = loadingSearch || loadingAll;
  const error = searchError || allDrawsError;
  const results = queryNumbers.length > 0 ? searchResults : allDraws;

  const handleSearch = (query: string, mode: SearchMode) => {
    setSearchMode(mode);
    
    if (!query.trim()) {
      // If empty query, show all draws
      setQueryNumbers([]);
      setHasSearched(true);
      return;
    }

    const numbers = query
      .split(/[,\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= LOTTERY.MIN_NUMBER && n <= LOTTERY.MAX_NUMBER)
      .slice(0, UI.MAX_SEARCH_NUMBERS);

    if (numbers.length === 0) {
      // Error will be handled by the component
      return;
    }

    setQueryNumbers(numbers);
    setHasSearched(true);
  };

  const handleExportCSV = async () => {
    try {
      const blob = await drawsApi.export('csv', {
        limit: results.length,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `draws-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Export error:', err);
      // Error handling - could show a toast notification
    }
  };

  const handleExportJSON = async () => {
    try {
      const blob = await drawsApi.export('json', {
        limit: results.length,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `draws-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Export error:', err);
      // Error handling - could show a toast notification
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-accent-500 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center text-2xl backdrop-blur-sm">
            🔍
          </div>
          <div>
            <h1 className="text-3xl font-bold">Search Draws</h1>
            <p className="text-white/90 text-sm mt-1">
              Find draws by numbers. Each draw contains 5 winning numbers and 5 machine numbers (all from 1-90).
            </p>
          </div>
        </div>
      </div>

      <SearchBar onSearch={handleSearch} isLoading={loading} />

      {error && (
        <div className="card bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-300 animate-pulse-once">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-red-800 font-semibold mb-1">Error</div>
              <div className="text-red-700 text-sm">{handleApiError(error)}</div>
            </div>
          </div>
        </div>
      )}

      {hasSearched && (
        <div className="card border-2 border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-800">Search Results</h2>
            </div>
            <div className="flex items-center gap-3">
              {results.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="px-4 py-2 text-sm font-medium bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-primary-300 transition-all flex items-center gap-2"
                    disabled={loading}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    CSV
                  </button>
                  <button
                    onClick={handleExportJSON}
                    className="px-4 py-2 text-sm font-medium bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-primary-300 transition-all flex items-center gap-2"
                    disabled={loading}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    JSON
                  </button>
                </div>
              )}
              <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                {results.length} found
              </span>
            </div>
          </div>

          {results.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium mb-2">No draws found</p>
              <p className="text-sm text-gray-500">Try adjusting your search numbers or mode</p>
            </div>
          ) : (
            <ResponsiveVirtualList
              items={results}
              renderItem={(draw) => (
                <DrawCard
                  draw={draw}
                  queryNumbers={queryNumbers}
                  onClick={() => setSelectedDraw(draw)}
                />
              )}
              threshold={30}
            />
          )}
        </div>
      )}

      <DrawModal
        draw={selectedDraw}
        onClose={() => setSelectedDraw(null)}
      />
    </div>
  );
};

