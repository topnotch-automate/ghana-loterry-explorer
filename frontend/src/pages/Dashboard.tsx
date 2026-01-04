import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { drawsApi, analyticsApi, predictionsApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { DrawCard } from '../components/DrawCard';
import { FrequencyChart } from '../components/FrequencyChart';
import { DrawModal } from '../components/DrawModal';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import { handleApiError } from '../utils/errors';
import { useSavedPredictions, useStrategyPerformance, useCheckPredictions } from '../hooks/usePredictions';
import type { Draw, FrequencyStats, TwoSureThreeDirect } from '../types';

// Interface for special predictions (Two Sure and Three Direct)
interface SpecialPredictions {
  twoSure: TwoSureThreeDirect | null;
  threeDirect: TwoSureThreeDirect | null;
  generatedAt: string | null;
  dataPointsUsed: number;
  lottoType?: string;
}

// Interface for saved special predictions
interface SavedSpecialPrediction {
  id: string;
  type: 'two_sure' | 'three_direct';
  numbers: number[];
  lottoType?: string;
  createdAt: string;
}

export const Dashboard: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { subscription } = useSubscription();
  const [latestDraw, setLatestDraw] = useState<Draw | null>(null);
  const [recentDraws, setRecentDraws] = useState<Draw[]>([]);
  const [frequencyStats, setFrequencyStats] = useState<FrequencyStats[]>([]);
  const [selectedDraw, setSelectedDraw] = useState<Draw | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use React Query hooks for saved predictions and strategy performance
  const { 
    data: savedPredictions = [], 
    isLoading: loadingPredictions,
    refetch: refetchPredictions 
  } = useSavedPredictions({ enabled: isAuthenticated });
  
  const { 
    data: strategyPerformance = null
  } = useStrategyPerformance({ enabled: isAuthenticated });
  
  const { 
    mutate: checkPredictions, 
    isPending: checkingPredictions 
  } = useCheckPredictions();
  
  // State for Two Sure and Three Direct
  const [specialPredictions, setSpecialPredictions] = useState<SpecialPredictions>({
    twoSure: null,
    threeDirect: null,
    generatedAt: null,
    dataPointsUsed: 0,
  });
  const [loadingSpecialPredictions, setLoadingSpecialPredictions] = useState(false);
  const [specialPredictionError, setSpecialPredictionError] = useState<string | null>(null);
  
  // Lotto type selection for special predictions
  const [lottoTypes, setLottoTypes] = useState<string[]>([]);
  const [selectedLottoType, setSelectedLottoType] = useState<string>('');
  const [loadingTypes, setLoadingTypes] = useState(false);
  
  // Saved special predictions (Two Sure / Three Direct from dashboard or advanced predictions)
  const [savedSpecialPredictions, setSavedSpecialPredictions] = useState<SavedSpecialPrediction[]>([]);
  
  // Save states
  const [savingTwoSure, setSavingTwoSure] = useState(false);
  const [savingThreeDirect, setSavingThreeDirect] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  
  // Check predictions result state
  const [checkResult, setCheckResult] = useState<{ message: string; totalChecked: number } | null>(null);
  
  // Pagination state for saved predictions
  const [currentPredictionPage, setCurrentPredictionPage] = useState(0);
  const predictionsPerPage = 5; // Show 5 predictions per page
  
  // Strategy performance expand/collapse state
  const [expandedPeriods, setExpandedPeriods] = useState<{
    week: boolean;
    month: boolean;
    year: boolean;
  }>({
    week: false,
    month: false,
    year: false,
  });

  useEffect(() => {
    loadDashboardData();
    if (isAuthenticated && subscription?.isPro) {
      loadLottoTypes();
      loadSavedSpecialPredictions();
    }
  }, [isAuthenticated, subscription?.isPro]);

  // Adjust page if out of bounds when predictions change
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(savedPredictions.length / predictionsPerPage) - 1);
    if (currentPredictionPage > maxPage) {
      setCurrentPredictionPage(maxPage);
    }
  }, [savedPredictions.length]); // Only depend on length, not currentPredictionPage

  // Load available lotto types
  const loadLottoTypes = async () => {
    try {
      setLoadingTypes(true);
      const types = await drawsApi.getLottoTypes();
      setLottoTypes(types);
    } catch (err) {
      console.error('Failed to load lotto types:', err);
    } finally {
      setLoadingTypes(false);
    }
  };

  // Load saved special predictions from localStorage
  const loadSavedSpecialPredictions = () => {
    try {
      const saved = localStorage.getItem('savedSpecialPredictions');
      if (saved) {
        const parsed = JSON.parse(saved) as SavedSpecialPrediction[];
        // Only keep predictions from last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recent = parsed.filter(p => new Date(p.createdAt) > sevenDaysAgo);
        setSavedSpecialPredictions(recent);
        localStorage.setItem('savedSpecialPredictions', JSON.stringify(recent));
      }
    } catch (err) {
      console.error('Failed to load saved special predictions:', err);
    }
  };

  // Save special prediction to both API and localStorage
  const saveSpecialPrediction = async (type: 'two_sure' | 'three_direct', numbers: number[], lottoType?: string) => {
    try {
      // Save to backend API (like regular predictions)
      await predictionsApi.savePrediction({
        numbers,
        strategy: type,
        lottoType: lottoType || undefined,
        targetDrawDate: new Date().toISOString().split('T')[0],
      });
      
      // Also save to localStorage for Dashboard display
      const newPrediction: SavedSpecialPrediction = {
        id: `${type}-${Date.now()}`,
        type,
        numbers,
        lottoType,
        createdAt: new Date().toISOString(),
      };
      
      const updated = [newPrediction, ...savedSpecialPredictions].slice(0, 20); // Keep max 20
      setSavedSpecialPredictions(updated);
      localStorage.setItem('savedSpecialPredictions', JSON.stringify(updated));
      setSaveSuccess(type === 'two_sure' ? 'Two Sure saved!' : 'Three Direct saved!');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      console.error(`Failed to save ${type}:`, err);
      setSaveSuccess(null);
    }
  };

  // Delete saved special prediction
  const deleteSpecialPrediction = (id: string) => {
    const updated = savedSpecialPredictions.filter(p => p.id !== id);
    setSavedSpecialPredictions(updated);
    localStorage.setItem('savedSpecialPredictions', JSON.stringify(updated));
  };

  // Load Two Sure and Three Direct predictions for Pro users
  const loadSpecialPredictions = async () => {
    if (!subscription?.isPro) return;
    
    try {
      setLoadingSpecialPredictions(true);
      setSpecialPredictionError(null);
      
      const result = await predictionsApi.generate({ 
        strategy: 'ensemble',
        lottoType: selectedLottoType || undefined,
        useTypeSpecificTable: selectedLottoType ? true : undefined,
      });
      
      setSpecialPredictions({
        twoSure: result.predictions.two_sure || null,
        threeDirect: result.predictions.three_direct || null,
        generatedAt: new Date().toISOString(),
        dataPointsUsed: result.data_points_used,
        lottoType: selectedLottoType || undefined,
      });
    } catch (err) {
      console.error('Failed to load special predictions:', err);
      setSpecialPredictionError(handleApiError(err));
    } finally {
      setLoadingSpecialPredictions(false);
    }
  };

  // Handle saving Two Sure
  const handleSaveTwoSure = async () => {
    if (!specialPredictions.twoSure) return;
    setSavingTwoSure(true);
    try {
      await saveSpecialPrediction('two_sure', specialPredictions.twoSure.numbers, specialPredictions.lottoType);
    } finally {
      setSavingTwoSure(false);
    }
  };

  // Handle saving Three Direct
  const handleSaveThreeDirect = async () => {
    if (!specialPredictions.threeDirect) return;
    setSavingThreeDirect(true);
    try {
      await saveSpecialPrediction('three_direct', specialPredictions.threeDirect.numbers, specialPredictions.lottoType);
    } finally {
      setSavingThreeDirect(false);
    }
  };

  // Handle checking all UNCHECKED predictions against draws
  // Does NOT reset already checked predictions - only checks pending ones
  // Uses React Query mutation for automatic cache invalidation
  const handleCheckPredictions = async () => {
    if (!subscription?.isPro) {
      setCheckResult({ message: 'Pro subscription required', totalChecked: 0 });
      setTimeout(() => setCheckResult(null), 5000);
      return;
    }

    checkPredictions(undefined, {
      onSuccess: (result) => {
        // React Query will automatically refetch saved predictions and strategy performance
        if (result.totalChecked > 0) {
          setCheckResult({
            message: `Checked ${result.totalChecked} prediction(s)`,
            totalChecked: result.totalChecked,
          });
        } else {
          setCheckResult({
            message: 'All predictions are already checked',
            totalChecked: 0,
          });
        }
        setTimeout(() => setCheckResult(null), 5000);
      },
      onError: (err) => {
        console.error('Failed to check predictions:', err);
        setCheckResult({ message: 'Failed to check predictions', totalChecked: 0 });
        setTimeout(() => setCheckResult(null), 5000);
      },
    });
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const promises: Promise<any>[] = [
        drawsApi.getLatest().catch(() => null),
        drawsApi.getAll({ limit: 5 }).catch(() => []),
        analyticsApi.getFrequency({ days: 30 }).catch(() => []),
      ];

      const results = await Promise.all(promises);
      if (results[0]) setLatestDraw(results[0]);
      setRecentDraws(results[1]);
      setFrequencyStats(results[2]);
      // Saved predictions and strategy performance are now handled by React Query hooks
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Show loading skeleton if initial data is loading
  if (loading || (isAuthenticated && loadingPredictions)) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <ErrorDisplay
        error={error}
        onRetry={loadDashboardData}
        title="Error loading dashboard"
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-accent-500 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center text-2xl backdrop-blur-sm">
            📊
          </div>
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-white/90 text-sm mt-1">
              Overview of latest draws and analytics
            </p>
          </div>
        </div>
      </div>

      {/* Latest Draw */}
      {latestDraw && (
        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Latest Draw</h2>
              <p className="text-sm text-gray-600">Most recent lottery results</p>
            </div>
          </div>
          <DrawCard
            draw={latestDraw}
            onClick={() => setSelectedDraw(latestDraw)}
          />
        </div>
      )}

      {/* Two Sure and Three Direct - Featured Section */}
      {isAuthenticated && subscription?.isPro && (
        <div className="card bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-300 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">⭐</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Today's Lucky Numbers</h2>
                <p className="text-sm text-gray-600">AI-powered Two Sure & Three Direct predictions</p>
              </div>
            </div>
          </div>

          {/* Lotto Type Selector */}
          <div className="mb-4 p-4 bg-white rounded-lg border border-amber-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Lotto Type for Predictions
            </label>
            <div className="flex gap-3 items-center">
              <div className="relative flex-1">
                <select
                  value={selectedLottoType}
                  onChange={(e) => setSelectedLottoType(e.target.value)}
                  disabled={loadingTypes || loadingSpecialPredictions}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-100 disabled:cursor-not-allowed appearance-none bg-white cursor-pointer hover:border-gray-400 transition-all"
                >
                  <option value="">All Types (Mixed Analysis)</option>
                  {lottoTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <button
                onClick={loadSpecialPredictions}
                disabled={loadingSpecialPredictions}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium hover:from-amber-600 hover:to-orange-600 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
              >
                {loadingSpecialPredictions ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate
                  </>
                )}
              </button>
            </div>
            {selectedLottoType && (
              <p className="mt-2 text-xs text-amber-700">
                Predictions will be based on <span className="font-semibold">{selectedLottoType}</span> historical data
              </p>
            )}
          </div>

          {/* Success message */}
          {saveSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {saveSuccess}
            </div>
          )}

          {specialPredictionError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {specialPredictionError}
            </div>
          )}

          {/* Predictions Display */}
          {(specialPredictions.twoSure || specialPredictions.threeDirect) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Two Sure Card */}
              <div className="bg-white rounded-xl p-6 border-2 border-emerald-200 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                      2
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">Two Sure</h3>
                      <p className="text-sm text-emerald-600 font-medium">2 Most Likely Numbers</p>
                    </div>
                  </div>
                  {specialPredictions.twoSure && (
                    <button
                      onClick={handleSaveTwoSure}
                      disabled={savingTwoSure}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Save to Dashboard"
                    >
                      {savingTwoSure ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
                {specialPredictions.twoSure ? (
                  <>
                    {specialPredictions.lottoType && (
                      <div className="mb-3 text-center">
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                          {specialPredictions.lottoType}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-4 justify-center py-4">
                      {specialPredictions.twoSure.numbers.map((num, index) => (
                        <div
                          key={num}
                          className="relative group"
                          style={{ animationDelay: `${index * 150}ms` }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full blur-md opacity-50 group-hover:opacity-75 transition-opacity"></div>
                          <div className="relative w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-xl transform group-hover:scale-110 transition-transform">
                            {num}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 text-center">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 rounded-full">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        <span className="text-xs text-emerald-700 font-medium">High Confidence</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>Click "Generate" to get predictions</p>
                  </div>
                )}
              </div>

              {/* Three Direct Card */}
              <div className="bg-white rounded-xl p-6 border-2 border-blue-200 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                      3
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">Three Direct</h3>
                      <p className="text-sm text-blue-600 font-medium">3 Most Likely Numbers</p>
                    </div>
                  </div>
                  {specialPredictions.threeDirect && (
                    <button
                      onClick={handleSaveThreeDirect}
                      disabled={savingThreeDirect}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Save to Dashboard"
                    >
                      {savingThreeDirect ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
                {specialPredictions.threeDirect ? (
                  <>
                    {specialPredictions.lottoType && (
                      <div className="mb-3 text-center">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {specialPredictions.lottoType}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3 justify-center py-4">
                      {specialPredictions.threeDirect.numbers.map((num, index) => (
                        <div
                          key={num}
                          className="relative group"
                          style={{ animationDelay: `${index * 150}ms` }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full blur-md opacity-50 group-hover:opacity-75 transition-opacity"></div>
                          <div className="relative w-18 h-18 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-xl transform group-hover:scale-110 transition-transform" style={{ width: '4.5rem', height: '4.5rem' }}>
                            {num}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 text-center">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 rounded-full">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                        <span className="text-xs text-blue-700 font-medium">High Confidence</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>Click "Generate" to get predictions</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🎯</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Get Your Lucky Numbers</h3>
              <p className="text-gray-600 mb-4">Select a lotto type above and generate AI-powered Two Sure and Three Direct predictions.</p>
            </div>
          )}

          {/* Generation info */}
          {specialPredictions.generatedAt && (
            <div className="mt-6 pt-4 border-t border-amber-200 flex items-center justify-between text-xs text-gray-500">
              <span>
                Based on {specialPredictions.dataPointsUsed.toLocaleString()} historical draws
                {specialPredictions.lottoType && ` • ${specialPredictions.lottoType}`}
              </span>
              <span>
                Generated: {new Date(specialPredictions.generatedAt).toLocaleString()}
              </span>
            </div>
          )}

          {/* Saved Special Predictions History */}
          {savedSpecialPredictions.length > 0 && (
            <div className="mt-6 pt-4 border-t border-amber-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                Saved Predictions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {savedSpecialPredictions.map((saved) => (
                  <div
                    key={saved.id}
                    className={`p-3 rounded-lg border-2 ${
                      saved.type === 'two_sure'
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-semibold ${
                        saved.type === 'two_sure' ? 'text-emerald-700' : 'text-blue-700'
                      }`}>
                        {saved.type === 'two_sure' ? '2 Sure' : '3 Direct'}
                      </span>
                      <button
                        onClick={() => deleteSpecialPrediction(saved.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex gap-2 justify-center mb-2">
                      {saved.numbers.map((num) => (
                        <span
                          key={num}
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                            saved.type === 'two_sure'
                              ? 'bg-gradient-to-br from-emerald-400 to-green-500'
                              : 'bg-gradient-to-br from-blue-400 to-cyan-500'
                          }`}
                        >
                          {num}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 text-center">
                      {saved.lottoType && <span className="block">{saved.lottoType}</span>}
                      {new Date(saved.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upgrade Prompt for Non-Pro Users */}
      {isAuthenticated && !subscription?.isPro && (
        <div className="card bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">🔐</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Unlock Two Sure & Three Direct</h2>
              <p className="text-sm text-gray-600">Get AI-powered lucky numbers with Pro subscription</p>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-purple-100">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-3 bg-emerald-50 rounded-lg">
                <div className="text-2xl mb-1">2️⃣</div>
                <div className="font-semibold text-emerald-700">Two Sure</div>
                <div className="text-xs text-gray-500">2 highest probability numbers</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl mb-1">3️⃣</div>
                <div className="font-semibold text-blue-700">Three Direct</div>
                <div className="text-xs text-gray-500">3 highest probability numbers</div>
              </div>
            </div>
            <Link
              to="/subscription"
              className="block w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-center rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      )}

      {/* Recent Draws */}
      <div className="card border-2 border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-800">Recent Draws</h2>
          </div>
          <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
            {recentDraws.length} draws
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recentDraws.map((draw, index) => (
            <div key={draw.id} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
              <DrawCard
                draw={draw}
                onClick={() => setSelectedDraw(draw)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Strategy Performance (if authenticated) */}
      {isAuthenticated && strategyPerformance && (
        <div className="card border-2 border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-800">Strategy Performance</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Week Performance */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border-2 border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">This Week</h3>
                <span className="text-xs text-gray-500">7 days</span>
              </div>
              {strategyPerformance.week.bestStrategy ? (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg font-bold text-blue-600">
                      Best: <span className="capitalize">{strategyPerformance.week.bestStrategy}</span>
                    </span>
                    <span className="px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full text-xs font-semibold">
                      🏆
                    </span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(strategyPerformance.week.strategyBreakdown)
                      .sort((a, b) => b[1].totalMatches - a[1].totalMatches)
                      .filter(([strategy]) => 
                        expandedPeriods.week || strategy === strategyPerformance.week.bestStrategy
                      )
                      .map(([strategy, stats]) => (
                        <div
                          key={strategy}
                          className={`p-2 rounded-lg border ${
                            strategy === strategyPerformance.week.bestStrategy
                              ? 'bg-blue-100 border-blue-300'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-800 capitalize">{strategy}</span>
                            {strategy === strategyPerformance.week.bestStrategy && (
                              <span className="text-xs text-blue-600 font-semibold">🏆</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 space-y-0.5">
                            <div>Matches: <span className="font-semibold">{stats.totalMatches}</span></div>
                            <div>Predictions: <span className="font-semibold">{stats.totalPredictions}</span></div>
                            <div>Avg: <span className="font-semibold">{stats.averageMatches.toFixed(1)}</span></div>
                          </div>
                        </div>
                      ))}
                  </div>
                  
                  {/* Show More/Less Button */}
                  {Object.keys(strategyPerformance.week.strategyBreakdown).length > 1 && (
                    <button
                      onClick={() => setExpandedPeriods(prev => ({ ...prev, week: !prev.week }))}
                      className="mt-3 w-full py-3 sm:py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 active:bg-blue-100 active:scale-95 rounded-lg transition-all flex items-center justify-center gap-1 min-h-[44px]"
                    >
                      {expandedPeriods.week ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          Show Less
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          Show {Object.keys(strategyPerformance.week.strategyBreakdown).length - 1} More
                        </>
                      )}
                    </button>
                  )}
                  
                  <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                    <div>Total Days: <span className="font-semibold">{strategyPerformance.week.daysWithMatches}</span></div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No predictions this week</div>
              )}
            </div>

            {/* Month Performance */}
            <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border-2 border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">This Month</h3>
                <span className="text-xs text-gray-500">30 days</span>
              </div>
              {strategyPerformance.month.bestStrategy ? (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg font-bold text-purple-600">
                      Best: <span className="capitalize">{strategyPerformance.month.bestStrategy}</span>
                    </span>
                    <span className="px-2 py-0.5 bg-purple-200 text-purple-800 rounded-full text-xs font-semibold">
                      🏆
                    </span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(strategyPerformance.month.strategyBreakdown)
                      .sort((a, b) => b[1].totalMatches - a[1].totalMatches)
                      .filter(([strategy]) => 
                        expandedPeriods.month || strategy === strategyPerformance.month.bestStrategy
                      )
                      .map(([strategy, stats]) => (
                        <div
                          key={strategy}
                          className={`p-2 rounded-lg border ${
                            strategy === strategyPerformance.month.bestStrategy
                              ? 'bg-purple-100 border-purple-300'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-800 capitalize">{strategy}</span>
                            {strategy === strategyPerformance.month.bestStrategy && (
                              <span className="text-xs text-purple-600 font-semibold">🏆</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 space-y-0.5">
                            <div>Matches: <span className="font-semibold">{stats.totalMatches}</span></div>
                            <div>Predictions: <span className="font-semibold">{stats.totalPredictions}</span></div>
                            <div>Avg: <span className="font-semibold">{stats.averageMatches.toFixed(1)}</span></div>
                          </div>
                        </div>
                      ))}
                  </div>
                  
                  {/* Show More/Less Button */}
                  {Object.keys(strategyPerformance.month.strategyBreakdown).length > 1 && (
                    <button
                      onClick={() => setExpandedPeriods(prev => ({ ...prev, month: !prev.month }))}
                      className="mt-3 w-full py-3 sm:py-2 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 active:bg-purple-100 active:scale-95 rounded-lg transition-all flex items-center justify-center gap-1 min-h-[44px]"
                    >
                      {expandedPeriods.month ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          Show Less
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          Show {Object.keys(strategyPerformance.month.strategyBreakdown).length - 1} More
                        </>
                      )}
                    </button>
                  )}
                  
                  <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                    <div>Total Days: <span className="font-semibold">{strategyPerformance.month.daysWithMatches}</span></div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No predictions this month</div>
              )}
            </div>

            {/* Year Performance */}
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">This Year</h3>
                <span className="text-xs text-gray-500">365 days</span>
              </div>
              {strategyPerformance.year.bestStrategy ? (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg font-bold text-green-600">
                      Best: <span className="capitalize">{strategyPerformance.year.bestStrategy}</span>
                    </span>
                    <span className="px-2 py-0.5 bg-green-200 text-green-800 rounded-full text-xs font-semibold">
                      🏆
                    </span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(strategyPerformance.year.strategyBreakdown)
                      .sort((a, b) => b[1].totalMatches - a[1].totalMatches)
                      .filter(([strategy]) => 
                        expandedPeriods.year || strategy === strategyPerformance.year.bestStrategy
                      )
                      .map(([strategy, stats]) => (
                        <div
                          key={strategy}
                          className={`p-2 rounded-lg border ${
                            strategy === strategyPerformance.year.bestStrategy
                              ? 'bg-green-100 border-green-300'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-800 capitalize">{strategy}</span>
                            {strategy === strategyPerformance.year.bestStrategy && (
                              <span className="text-xs text-green-600 font-semibold">🏆</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 space-y-0.5">
                            <div>Matches: <span className="font-semibold">{stats.totalMatches}</span></div>
                            <div>Predictions: <span className="font-semibold">{stats.totalPredictions}</span></div>
                            <div>Avg: <span className="font-semibold">{stats.averageMatches.toFixed(1)}</span></div>
                          </div>
                        </div>
                      ))}
                  </div>
                  
                  {/* Show More/Less Button */}
                  {Object.keys(strategyPerformance.year.strategyBreakdown).length > 1 && (
                    <button
                      onClick={() => setExpandedPeriods(prev => ({ ...prev, year: !prev.year }))}
                      className="mt-3 w-full py-3 sm:py-2 text-sm font-medium text-green-600 hover:text-green-700 hover:bg-green-50 active:bg-green-100 active:scale-95 rounded-lg transition-all flex items-center justify-center gap-1 min-h-[44px]"
                    >
                      {expandedPeriods.year ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          Show Less
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          Show {Object.keys(strategyPerformance.year.strategyBreakdown).length - 1} More
                        </>
                      )}
                    </button>
                  )}
                  
                  <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                    <div>Total Days: <span className="font-semibold">{strategyPerformance.year.daysWithMatches}</span></div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No predictions this year</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Saved Predictions (if authenticated) */}
      {isAuthenticated && savedPredictions.length > 0 && (
        <div className="card border-2 border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-2xl font-bold text-gray-800">My Predictions</h2>
            </div>
            <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
              {savedPredictions.length} saved
            </span>
              {subscription?.isPro && (
                <button
                  onClick={handleCheckPredictions}
                  disabled={checkingPredictions}
                  className="px-4 py-2.5 sm:px-3 sm:py-1.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg text-sm font-medium hover:from-green-600 hover:to-emerald-600 active:from-green-700 active:to-emerald-700 active:scale-95 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 min-h-[44px] min-w-[44px]"
                  title="Check all pending predictions against today's draws"
                >
                  {checkingPredictions ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Checking...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Check Now
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          
          {/* Check result message */}
          {checkResult && (
            <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
              checkResult.totalChecked > 0 
                ? 'bg-green-50 border border-green-200 text-green-700' 
                : 'bg-gray-50 border border-gray-200 text-gray-600'
            }`}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {checkResult.message || (checkResult.totalChecked > 0 
                ? `${checkResult.totalChecked} prediction(s) checked by lotto type!`
                : 'No pending predictions to check or no matching draws found.')}
          </div>
          )}
          
          {/* Pagination Controls */}
          {savedPredictions.length > predictionsPerPage && (
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {currentPredictionPage * predictionsPerPage + 1} to{' '}
                {Math.min((currentPredictionPage + 1) * predictionsPerPage, savedPredictions.length)} of{' '}
                {savedPredictions.length} predictions
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPredictionPage(prev => Math.max(0, prev - 1))}
                  disabled={currentPredictionPage === 0}
                  className="px-4 py-2.5 sm:px-3 sm:py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium min-h-[44px]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-600 font-medium">
                  Page {currentPredictionPage + 1} of {Math.ceil(savedPredictions.length / predictionsPerPage)}
                </span>
                <button
                  onClick={() => setCurrentPredictionPage(prev => 
                    Math.min(Math.ceil(savedPredictions.length / predictionsPerPage) - 1, prev + 1)
                  )}
                  disabled={currentPredictionPage >= Math.ceil(savedPredictions.length / predictionsPerPage) - 1}
                  className="px-4 py-2.5 sm:px-3 sm:py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm font-medium min-h-[44px]"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            {savedPredictions
              .slice(
                currentPredictionPage * predictionsPerPage,
                (currentPredictionPage + 1) * predictionsPerPage
              )
              .map((prediction, index) => (
              <div
                key={prediction.id}
                className={`p-4 rounded-lg border-2 transition-all animate-slide-up ${
                  prediction.status === 'win'
                    ? 'bg-green-50 border-green-300'
                    : prediction.status === 'partial'
                    ? 'bg-yellow-50 border-yellow-300'
                    : prediction.status === 'loss'
                    ? 'bg-red-50 border-red-300'
                    : 'bg-gray-50 border-gray-200'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex gap-1">
                        {prediction.predictedNumbers.map((num) => {
                          // Check if this number matches the actual winning numbers
                          const isMatch = prediction.isChecked && 
                            prediction.actualDraw?.winningNumbers?.includes(num);
                          return (
                            <span
                              key={num}
                              className={`relative w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                                isMatch
                                  ? 'bg-green-500 text-white ring-2 ring-green-300 ring-offset-2 scale-110 shadow-lg'
                                  : 'bg-primary-600 text-white'
                              }`}
                              title={isMatch ? 'Match!' : undefined}
                            >
                              {num}
                              {isMatch && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white"></span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          prediction.status === 'win'
                            ? 'bg-green-500 text-white'
                            : prediction.status === 'partial'
                            ? 'bg-yellow-500 text-white'
                            : prediction.status === 'loss'
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-400 text-white'
                        }`}
                      >
                        {prediction.status === 'win'
                          ? '✓ WIN'
                          : prediction.status === 'partial'
                          ? '~ PARTIAL'
                          : prediction.status === 'loss'
                          ? '✗ LOSS'
                          : '⏳ PENDING'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Strategy:</span>
                        <span className="px-2 py-0.5 bg-gray-200 rounded">{prediction.strategy}</span>
                        {prediction.lottoType && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="px-2 py-0.5 bg-gray-200 rounded">{prediction.lottoType}</span>
                          </>
                        )}
                      </div>
                      {prediction.isChecked && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Matches:</span>
                          <span className="font-bold text-primary-600">{prediction.matches}/5</span>
                          {prediction.actualDraw && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span className="text-gray-600">
                                Actual: {prediction.actualDraw.winningNumbers.join(', ')}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        Created: {new Date(prediction.createdAt).toLocaleDateString()}
                        {prediction.checkedAt && (
                          <> • Checked: {new Date(prediction.checkedAt).toLocaleDateString()}</>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (window.confirm('Are you sure you want to delete this prediction?')) {
                        try {
                          await predictionsApi.deletePrediction(prediction.id);
                          // React Query will automatically refetch saved predictions after deletion
                          refetchPredictions();
                        } catch (err) {
                          setError(handleApiError(err));
                        }
                      }
                    }}
                    className="ml-4 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                    title="Delete prediction"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics */}
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
      <DrawModal
        draw={selectedDraw}
        onClose={() => setSelectedDraw(null)}
      />
    </div>
  );
};

