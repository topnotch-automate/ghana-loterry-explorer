import React, { useMemo, useState, useEffect } from 'react';
import { drawsApi, analyticsApi } from '../api/client';
import { DrawCard } from '../components/DrawCard';
import { FrequencyChart } from '../components/FrequencyChart';
import { DrawModal } from '../components/DrawModal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { handleApiError } from '../utils/errors';
import { formatDate } from '../utils/format';
import type { Draw, SearchResult, FrequencyStats } from '../types';

// Utility: normalize input like "3,12,19" -> [3,12,19]
function parseNumbers(input: string): number[] {
  if (!input) return [];
  return input
    .split(/[,\s]+/) // commas or whitespace
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n) && n > 0)
    .slice(0, 10);
}

export const HomePage: React.FC = () => {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [query, setQuery] = useState('');
  const [matchMode, setMatchMode] = useState<'exact' | 'partial'>('partial');
  const [selectedDraw, setSelectedDraw] = useState<Draw | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [latestDraw, setLatestDraw] = useState<Draw | null>(null);
  const [frequencyStats, setFrequencyStats] = useState<FrequencyStats[]>([]);

  const parsedQuery = useMemo(() => parseNumbers(query), [query]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [allDraws, latest, frequency] = await Promise.all([
          drawsApi.getAll({ limit: 50 }).catch(() => []),
          drawsApi.getLatest().catch(() => null),
          analyticsApi.getFrequency({ days: 30 }).catch(() => []),
        ]);

        setDraws(allDraws);
        if (latest) setLatestDraw(latest);
        setFrequencyStats(frequency);
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // Search when query changes
  useEffect(() => {
    const performSearch = async () => {
      if (parsedQuery.length === 0) {
        setSearchResults([]);
        return;
      }

      try {
        setIsSearching(true);
        const results = await drawsApi.search({
          numbers: parsedQuery,
          mode: matchMode === 'exact' ? 'exact' : 'partial',
        });
        setSearchResults(results);
      } catch (err) {
        console.error('Search error:', err);
        // Fallback to client-side search if API fails
        const clientResults = draws
          .map((d) => {
            const allNumbers = [...d.winningNumbers, ...d.machineNumbers];
            const matchCount = parsedQuery.filter((q) => allNumbers.includes(q)).length;
            const exact =
              matchCount === allNumbers.length && parsedQuery.length === allNumbers.length;
            return {
              ...d,
              matchCount,
              exact,
            } as SearchResult;
          })
          .filter((d) => (matchMode === 'exact' ? d.exact : d.matchCount > 0))
          .sort((a, b) => (b.matchCount || 0) - (a.matchCount || 0));
        setSearchResults(clientResults);
      } finally {
        setIsSearching(false);
      }
    };
    performSearch();
  }, [parsedQuery, matchMode, draws]);

  // Results to display
  const results = useMemo(() => {
    if (parsedQuery.length === 0) {
      return draws.slice().sort((a, b) => (a.drawDate < b.drawDate ? 1 : -1));
    }
    return searchResults.length > 0
      ? searchResults
      : draws
          .map((d) => {
            const allNumbers = [...d.winningNumbers, ...d.machineNumbers];
            const matchCount = parsedQuery.filter((q) => allNumbers.includes(q)).length;
            const exact =
              matchCount === allNumbers.length && parsedQuery.length === allNumbers.length;
            return { ...d, matchCount, exact } as SearchResult;
          })
          .filter((d) => (matchMode === 'exact' ? d.exact : d.matchCount > 0))
          .sort((a, b) => (b.matchCount || 0) - (a.matchCount || 0));
  }, [parsedQuery, draws, matchMode, searchResults]);

  // Pagination for homepage search results
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  const totalPages = Math.ceil(results.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedResults = results.slice(startIndex, endIndex);

  // Reset to page 1 when results change
  useEffect(() => {
    setCurrentPage(1);
  }, [results.length]);

  if (loading && draws.length === 0) {
    return <LoadingSpinner message="Loading lottery data..." fullScreen />;
  }

  if (error && draws.length === 0) {
    return (
      <ErrorDisplay
        error={error}
        onRetry={() => window.location.reload()}
        title="Error loading data"
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ghana Lottery Explorer</h1>
          <p className="text-sm text-gray-600 mt-1">
            Search draws, spot repeats, and explore analytics
          </p>
        </div>
      </div>

      {/* Search Section */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center md:gap-4">
          <div className="flex-1">
            <label className="text-sm text-gray-600 mb-2 block">
              Search numbers (comma or space separated)
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. 3,12,19"
              className="input-field"
            />
          </div>
          <div className="mt-3 md:mt-0 flex items-center gap-3">
            <div className="text-sm text-gray-600">Mode</div>
            <select
              value={matchMode}
              onChange={(e) => setMatchMode(e.target.value as 'exact' | 'partial')}
              className="input-field w-auto"
            >
              <option value="partial">Partial match</option>
              <option value="exact">Exact match</option>
            </select>
            <div className="text-sm text-gray-500">
              Results: <span className="font-medium">{results.length}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-500">
          Tip: leave search empty to show recent draws. Use exact mode to find draws with the exact
          set.
        </div>
      </div>

      {/* Results list */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Search Results</h2>
        {isSearching ? (
          <div className="text-center py-8">
            <LoadingSpinner message="Searching..." />
          </div>
        ) : results.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No results. Try adjusting your numbers or mode.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedResults.map((d) => (
                <DrawCard
                  key={d.id}
                  draw={d}
                  queryNumbers={parsedQuery}
                  onClick={() => setSelectedDraw(d)}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1}-{Math.min(endIndex, results.length)} of {results.length} results
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Most Recent Draw */}
      {latestDraw && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Most Recent Draw</h2>
          <div className="flex justify-center">
            <div className="w-full max-w-md">
              <DrawCard
                draw={latestDraw}
                onClick={() => setSelectedDraw(latestDraw)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Frequency Analytics */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Analytics (Last 30 Days)</h2>
        <FrequencyChart data={frequencyStats} maxItems={20} />
      </div>

      {/* Draw Modal */}
      <DrawModal draw={selectedDraw} onClose={() => setSelectedDraw(null)} />
    </div>
  );
};
