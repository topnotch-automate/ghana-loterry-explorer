import React, { useState } from 'react';
import { drawsApi } from '../api/client';
import { FrequencyChart } from '../components/FrequencyChart';
import { CoOccurrenceMatrix } from '../components/CoOccurrenceMatrix';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { 
  useFrequencyStats, 
  useHotNumbers, 
  useColdNumbers, 
  useSleepingNumbers,
  useCoOccurrence 
} from '../hooks/useAnalytics';

export const Analytics: React.FC = () => {
  const [timeframe, setTimeframe] = useState<'30' | '365'>('30');

  // React Query hooks
  const { data: frequency30 = [], isLoading: loading30 } = useFrequencyStats(30);
  const { data: frequency365 = [], isLoading: loading365 } = useFrequencyStats(365);
  const { data: hotNumbers = [], isLoading: loadingHot } = useHotNumbers(30);
  const { data: coldNumbers = [], isLoading: loadingCold } = useColdNumbers(30);
  const { data: sleepingNumbers = [], isLoading: loadingSleeping } = useSleepingNumbers(30);
  const coOccurrenceParams = {
    limit: 50,
    minCount: 2,
    days: timeframe === '30' ? 30 : 365,
  };
  
  const { 
    data: coOccurrenceData = [], 
    isLoading: loadingCoOccurrence,
    refetch: refetchCoOccurrence
  } = useCoOccurrence(coOccurrenceParams);

  const loading = loading30 || loading365 || loadingHot || loadingCold || loadingSleeping;
  
  if (loading) {
    return <LoadingSpinner message="Loading analytics..." fullScreen />;
  }

  const currentFrequency = timeframe === '30' ? frequency30 : frequency365;

  const handleExportCSV = async () => {
    try {
      const blob = await drawsApi.export('csv', {
        limit: 1000, // Export up to 1000 draws
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const handleExportJSON = async () => {
    try {
      const blob = await drawsApi.export('json', {
        limit: 1000, // Export up to 1000 draws
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-accent-500 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center text-2xl backdrop-blur-sm">
              📈
            </div>
            <div>
              <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
              <p className="text-white/90 text-sm mt-1">
                Analyze number frequency, patterns, and trends across different timeframes.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleExportCSV} 
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-all backdrop-blur-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CSV
            </button>
            <button 
              onClick={handleExportJSON} 
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-all backdrop-blur-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* Timeframe Selector */}
      <div className="card border-2 border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-800">Timeframe</h2>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setTimeframe('30')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${
              timeframe === '30'
                ? 'bg-gradient-to-r from-primary-600 to-accent-500 text-white shadow-lg transform scale-105'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md'
            }`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setTimeframe('365')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${
              timeframe === '365'
                ? 'bg-gradient-to-r from-primary-600 to-accent-500 text-white shadow-lg transform scale-105'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md'
            }`}
          >
            Last 365 Days
          </button>
        </div>
      </div>

      {/* Frequency Chart */}
      {currentFrequency.length > 0 ? (
        <FrequencyChart
          data={currentFrequency}
          title={`Number Frequency (Last ${timeframe} Days)`}
          maxItems={30}
        />
      ) : (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">
            Number Frequency (Last {timeframe} Days)
          </h3>
          <div className="text-center text-gray-500 py-8">
            No data available for the last {timeframe} days. Try selecting a different timeframe.
          </div>
        </div>
      )}

      {/* Hot & Cold Numbers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center text-xl">
              🔥
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Hot Numbers</h3>
              <p className="text-xs text-gray-600">Last 30 Days</p>
            </div>
          </div>
          {hotNumbers.length === 0 ? (
            <div className="text-gray-500 py-4">No data available</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {hotNumbers.map((stat) => (
                <div
                  key={stat.number}
                  className="px-3 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full font-bold shadow-md hover:shadow-lg transform hover:scale-110 transition-all"
                >
                  {stat.number} <span className="text-xs opacity-90">({stat.totalCount})</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-xl">
              ❄️
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Cold Numbers</h3>
              <p className="text-xs text-gray-600">Last 30 Days</p>
            </div>
          </div>
          {coldNumbers.length === 0 ? (
            <div className="text-gray-500 py-4">No data available</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {coldNumbers.map((stat) => (
                <div
                  key={stat.number}
                  className="px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full font-bold shadow-md hover:shadow-lg transform hover:scale-110 transition-all"
                >
                  {stat.number} <span className="text-xs opacity-90">({stat.totalCount})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sleeping Numbers */}
      <div className="card bg-gradient-to-br from-gray-50 to-slate-50 border-2 border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 bg-gray-500 rounded-lg flex items-center justify-center text-xl">
            😴
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Sleeping Numbers</h3>
            <p className="text-xs text-gray-600">Never appeared in winning numbers</p>
          </div>
        </div>
        {sleepingNumbers.length === 0 ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium">✨ All numbers 1-90 have appeared in winning numbers!</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sleepingNumbers.map((num) => (
              <div
                key={num}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-full font-medium hover:bg-gray-300 transition-colors"
              >
                {num}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Co-Occurrence Matrix */}
      <div className="card border-2 border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-800">Co-Occurrence Analysis</h2>
          </div>
          <button
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                await refetchCoOccurrence();
              } catch (error) {
                console.error('Error refreshing co-occurrence data:', error);
              }
            }}
            disabled={loadingCoOccurrence}
            className="px-4 py-2 text-sm font-medium bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-primary-300 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingCoOccurrence ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </>
            )}
          </button>
        </div>
        {loadingCoOccurrence ? (
          <div className="card">
            <div className="text-center py-8">
              <LoadingSpinner message="Loading co-occurrence data..." />
            </div>
          </div>
        ) : (
          <CoOccurrenceMatrix
            data={coOccurrenceData}
            title={`Top Co-Occurring Numbers (Last ${timeframe} Days)`}
            maxItems={50}
            days={parseInt(timeframe)}
            lottoType={undefined}
          />
        )}
      </div>
    </div>
  );
};

