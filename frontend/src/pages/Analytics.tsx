import React, { useState, useEffect } from 'react';
import { analyticsApi, drawsApi } from '../api/client';
import { FrequencyChart } from '../components/FrequencyChart';
import { CoOccurrenceMatrix } from '../components/CoOccurrenceMatrix';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { handleApiError } from '../utils/errors';
import type { FrequencyStats, CoOccurrenceData } from '../types';

export const Analytics: React.FC = () => {
  const [frequency30, setFrequency30] = useState<FrequencyStats[]>([]);
  const [frequency365, setFrequency365] = useState<FrequencyStats[]>([]);
  const [hotNumbers, setHotNumbers] = useState<FrequencyStats[]>([]);
  const [coldNumbers, setColdNumbers] = useState<FrequencyStats[]>([]);
  const [sleepingNumbers, setSleepingNumbers] = useState<number[]>([]);
  const [coOccurrenceData, setCoOccurrenceData] = useState<CoOccurrenceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'30' | '365'>('30');
  const [loadingCoOccurrence, setLoadingCoOccurrence] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [freq30, freq365, hot, cold, sleeping] = await Promise.all([
        analyticsApi.getFrequency({ days: 30 }).catch(() => []),
        analyticsApi.getFrequency({ days: 365 }).catch(() => []),
        analyticsApi.getHot(30).catch(() => []),
        analyticsApi.getCold(30).catch(() => []),
        analyticsApi.getSleeping(30).catch(() => []),
      ]);

      setFrequency30(freq30);
      setFrequency365(freq365);
      setHotNumbers(hot);
      setColdNumbers(cold);
      setSleepingNumbers(sleeping);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadCoOccurrence = async () => {
    try {
      setLoadingCoOccurrence(true);
      const data = await analyticsApi.getCoOccurrence({
        limit: 50,
        minCount: 2,
        days: timeframe === '30' ? 30 : 365,
      });
      setCoOccurrenceData(data);
    } catch (err) {
      console.error('Error loading co-occurrence:', err);
      // Don't show error to user, just log it
    } finally {
      setLoadingCoOccurrence(false);
    }
  };

  useEffect(() => {
    loadCoOccurrence();
  }, [timeframe]);

  if (loading) {
    return <LoadingSpinner message="Loading analytics..." fullScreen />;
  }

  if (error) {
    return (
      <ErrorDisplay
        error={error}
        onRetry={loadAnalytics}
        title="Error loading analytics"
      />
    );
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
          <p className="text-gray-600">
            Analyze number frequency, patterns, and trends across different timeframes.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="btn-secondary text-sm">
            Export CSV
          </button>
          <button onClick={handleExportJSON} className="btn-secondary text-sm">
            Export JSON
          </button>
        </div>
      </div>

      {/* Timeframe Selector */}
      <div className="card">
        <div className="flex gap-4">
          <button
            onClick={() => setTimeframe('30')}
            className={`px-4 py-2 rounded-md ${
              timeframe === '30'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setTimeframe('365')}
            className={`px-4 py-2 rounded-md ${
              timeframe === '365'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">🔥 Hot Numbers (Last 30 Days)</h3>
          {hotNumbers.length === 0 ? (
            <div className="text-gray-500">No data available</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {hotNumbers.map((stat) => (
                <div
                  key={stat.number}
                  className="px-3 py-2 bg-red-100 text-red-700 rounded-full font-semibold"
                >
                  {stat.number} ({stat.totalCount})
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">❄️ Cold Numbers (Last 30 Days)</h3>
          {coldNumbers.length === 0 ? (
            <div className="text-gray-500">No data available</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {coldNumbers.map((stat) => (
                <div
                  key={stat.number}
                  className="px-3 py-2 bg-blue-100 text-blue-700 rounded-full font-semibold"
                >
                  {stat.number} ({stat.totalCount})
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sleeping Numbers */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">😴 Sleeping Numbers (Not seen in 30 days)</h3>
        {sleepingNumbers.length === 0 ? (
          <div className="text-gray-500">All numbers have appeared in the last 30 days</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sleepingNumbers.map((num) => (
              <div
                key={num}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-full"
              >
                {num}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Co-Occurrence Matrix */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Co-Occurrence Analysis</h2>
          <button
            onClick={loadCoOccurrence}
            disabled={loadingCoOccurrence}
            className="btn-secondary text-sm"
          >
            {loadingCoOccurrence ? 'Loading...' : 'Refresh'}
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
          />
        )}
      </div>
    </div>
  );
};

