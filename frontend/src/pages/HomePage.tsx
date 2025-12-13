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
          drawsApi.getAll({ limit: 50 }).catch((err) => {
            console.error('Failed to load draws:', err);
            return [];
          }),
          drawsApi.getLatest().catch((err) => {
            console.error('Failed to load latest draw:', err);
            return null;
          }),
          analyticsApi.getFrequency({ days: 30 }).catch((err) => {
            console.error('Failed to load frequency:', err);
            return [];
          }),
        ]);

        setDraws(allDraws);
        if (latest) setLatestDraw(latest);
        setFrequencyStats(frequency);
        
        // Check if all requests failed (likely backend not running)
        if (allDraws.length === 0 && !latest && frequency.length === 0) {
          setError('Cannot connect to the server. Please make sure the backend is running on http://localhost:5000');
        }
      } catch (err: any) {
        const errorMessage = handleApiError(err);
        // Check if it's a connection error
        if (err?.message?.includes('Network Error') || err?.code === 'ERR_NETWORK' || err?.code === 'ECONNREFUSED') {
          setError('Cannot connect to the server. Please make sure the backend is running on http://localhost:5000');
        } else {
          setError(errorMessage);
        }
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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary-600 to-accent-500 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center text-2xl backdrop-blur-sm">
            🎲
          </div>
          <div>
            <h1 className="text-3xl font-bold">Ghana Lottery Explorer</h1>
            <p className="text-white/90 text-sm mt-1">
              Search draws, spot repeats, and explore analytics
            </p>
          </div>
        </div>
      </header>

      {/* Search Section */}
      <div className="card border-2 border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-800">Search Draws</h2>
        </div>
        <div className="flex flex-col md:flex-row md:items-end md:gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search numbers (comma or space separated)
            </label>
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. 3, 12, 19"
                className="input-field pl-10"
              />
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 md:mt-0 flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Mode</label>
            <select
              value={matchMode}
              onChange={(e) => setMatchMode(e.target.value as 'exact' | 'partial')}
              className="input-field w-auto min-w-[140px]"
            >
              <option value="partial">Partial match</option>
              <option value="exact">Exact match</option>
            </select>
            <div className="px-3 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-semibold">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        {parsedQuery.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {parsedQuery.map((num) => (
              <span key={num} className="px-2.5 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                {num}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            💡 <strong>Tip:</strong> Leave search empty to show recent draws. Use exact mode to find draws with the exact number set.
          </p>
        </div>
      </div>

      {/* Results list */}
      <div className="card border-2 border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-800">Search Results</h2>
          </div>
          {results.length > 0 && (
            <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
              {results.length} found
            </span>
          )}
        </div>
        {isSearching ? (
          <div className="text-center py-12">
            <LoadingSpinner message="Searching draws..." />
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium mb-2">No results found</p>
            <p className="text-sm text-gray-500">Try adjusting your search numbers or match mode</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedResults.map((d, index) => (
                <div key={d.id} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                  <DrawCard
                    draw={d}
                    queryNumbers={parsedQuery}
                    onClick={() => setSelectedDraw(d)}
                  />
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, results.length)}</span> of <span className="font-medium">{results.length}</span> results
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-primary-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    ← Previous
                  </button>
                  <span className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-primary-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Most Recent Draw */}
      {latestDraw && (
        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Most Recent Draw</h2>
              <p className="text-sm text-gray-600">Latest lottery results</p>
            </div>
          </div>
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
      <div className="card border-2 border-gray-100">
        <div className="flex items-center gap-2 mb-6">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-800">Analytics (Last 30 Days)</h2>
        </div>
        <FrequencyChart data={frequencyStats} maxItems={20} />
      </div>

      {/* Draw Modal */}
      <DrawModal draw={selectedDraw} onClose={() => setSelectedDraw(null)} />
    </main>
  );
};

