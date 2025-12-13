import React, { useState } from 'react';
import api from '../api/client';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { handleApiError } from '../utils/errors';

interface ImportResult {
  inserted: number;
  skipped: number;
  errors: number;
  parseErrors?: string[];
}

export const Import: React.FC = () => {
  const [csvContent, setCsvContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvContent.trim()) {
      setError('Please provide CSV content or upload a file');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      // Use the API client
      const response = await api.post('/draws/import', { csvContent });
      
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Import failed');
      }

      setResult(response.data.data);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setCsvContent('');
    setError(null);
    setResult(null);
  };

  const csvExample = `Draw Date,Lotto Type,Winning Numbers,Machine Numbers,Source
2024-01-01,5/90,"1,2,3,4,5","6,7,8,9,10",theb2b.com
2024-01-02,5/90,"11,12,13,14,15","16,17,18,19,20",theb2b.com`;

  return (
    <main className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-accent-500 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center text-2xl backdrop-blur-sm">
            📥
          </div>
          <div>
            <h1 className="text-3xl font-bold">Import Draws</h1>
            <p className="text-white/90 text-sm mt-1">
              Import lottery draws from a CSV file. Duplicate draws (same date and type) will be skipped.
            </p>
          </div>
        </div>
      </div>

      {/* CSV Format Info */}
      <div className="card border-2 border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-800">CSV Format</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          The CSV file should have the following columns:
        </p>
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg mb-4 border border-gray-200">
          <code className="text-sm font-mono text-gray-800">
            Draw Date, Lotto Type, Winning Numbers, Machine Numbers, Source
          </code>
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            View Example CSV
          </summary>
          <pre className="mt-3 p-4 bg-gray-50 rounded-lg text-xs overflow-x-auto border border-gray-200 font-mono">
            {csvExample}
          </pre>
        </details>
      </div>

      {/* File Upload */}
      <div className="card border-2 border-gray-100">
        <div className="flex items-center gap-2 mb-6">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-800">Upload CSV File</h2>
        </div>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select CSV File
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-primary-600 file:to-accent-500 file:text-white hover:file:opacity-90 file:transition-all file:cursor-pointer"
              />
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 font-medium">OR</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Paste CSV Content
            </label>
            <textarea
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="Paste CSV content here..."
              rows={10}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm transition-all"
            />
            {csvContent && (
              <p className="mt-2 text-xs text-gray-500">
                {csvContent.split('\n').length} line{csvContent.split('\n').length !== 1 ? 's' : ''} detected
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleImport}
              disabled={loading || !csvContent.trim()}
              className="px-6 py-3 bg-gradient-to-r from-primary-600 to-accent-500 text-white rounded-lg font-semibold hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Importing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Import Draws
                </>
              )}
            </button>
            <button
              onClick={handleClear}
              disabled={loading}
              className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 hover:border-primary-300 transition-all disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <ErrorDisplay
          error={error}
          onRetry={() => setError(null)}
          title="Import Error"
        />
      )}

      {/* Loading */}
      {loading && <LoadingSpinner message="Importing draws..." />}

      {/* Result Display */}
      {result && (
        <div className="card border-2 border-gray-100 bg-gradient-to-br from-green-50 to-emerald-50 animate-fade-in">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-800">Import Results</h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl text-white shadow-lg">
                <div className="text-3xl font-bold mb-1">{result.inserted}</div>
                <div className="text-sm opacity-90">Inserted</div>
              </div>
              <div className="text-center p-5 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-xl text-white shadow-lg">
                <div className="text-3xl font-bold mb-1">{result.skipped}</div>
                <div className="text-sm opacity-90">Skipped</div>
                <div className="text-xs opacity-75 mt-1">(Duplicates)</div>
              </div>
              <div className="text-center p-5 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl text-white shadow-lg">
                <div className="text-3xl font-bold mb-1">{result.errors}</div>
                <div className="text-sm opacity-90">Errors</div>
              </div>
            </div>

            {result.parseErrors && result.parseErrors.length > 0 && (
              <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-red-800">Parse Errors ({result.parseErrors.length}):</h3>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <ul className="list-disc list-inside space-y-1 text-xs text-red-700">
                    {result.parseErrors.map((err, idx) => (
                      <li key={idx} className="py-1">{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
};

