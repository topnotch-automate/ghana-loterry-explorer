// Frontend types matching backend API

export interface Draw {
  id: string;
  drawDate: string;
  lottoType: string;
  winningNumbers: number[];
  machineNumbers: number[];
  source?: string;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchResult extends Draw {
  matchCount?: number;
  matchCountWinning?: number;
  matchCountMachine?: number;
  similarityScore?: number;
}

export interface FrequencyStats {
  number: number;
  totalCount: number;
  winningCount: number;
  machineCount: number;
  lastSeen?: string;
}

export interface CoOccurrenceTriplet {
  number1: number;
  number2: number;
  number3: number;
  count: number;
  winningCount: number;
  machineCount: number;
  lastSeen?: string;
}

export interface CoOccurrencePair {
  number1: number;
  number2: number;
  count: number;
  winningCount: number;
  machineCount: number;
  lastSeen?: string;
}

// Union type for co-occurrence data (can be triplet or pair)
export type CoOccurrenceData = 
  | (CoOccurrenceTriplet & { type: 'triplet' })
  | (CoOccurrencePair & { type: 'pair' });

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type SearchMode = 'exact' | 'partial' | 'winning-only' | 'machine-only' | 'group';

export interface PredictionSet {
  numbers: number[];
  sum: number;
  evens: number;
  highs: number;
}

export interface TwoSureThreeDirect {
  numbers: number[];
  count: number;
  type: 'two_sure' | 'three_direct';
}

export interface PredictionResponse {
  success: boolean;
  predictions: {
    ml?: PredictionSet[];
    genetic?: PredictionSet[];
    pattern?: PredictionSet[];
    ensemble?: PredictionSet[];
    intelligence?: PredictionSet[]; // Added for intelligence strategy
    yearly?: PredictionSet[]; // Added for yearly pattern strategy
    transfer?: PredictionSet[]; // Added for transfer pattern strategy
    two_sure?: TwoSureThreeDirect; // Two Sure feature - 2 most likely numbers
    three_direct?: TwoSureThreeDirect; // Three Direct feature - 3 most likely numbers
  };
  strategy: string;
  regime_change?: {
    detected: boolean;
    confidence: number;
    details?: Record<string, string>;
  };
  data_points_used: number;
}

export interface SubscriptionStatus {
  authenticated: boolean;
  tier: 'free' | 'pro';
  isPro: boolean;
  email?: string;
}

export type PredictionStrategy = 'ensemble' | 'ml' | 'genetic' | 'pattern' | 'intelligence' | 'yearly' | 'transfer';

export interface SavedPrediction {
  id: string;
  strategy: string;
  predictionData?: any;
  lottoType?: string;
  predictedNumbers: number[];
  targetDrawDate?: string;
  matches: number;
  isChecked: boolean;
  checkedAt?: string;
  createdAt: string;
  actualDraw?: {
    id: string;
    drawDate: string;
    winningNumbers: number[];
  };
  status: 'win' | 'partial' | 'loss' | 'pending';
}

export interface StrategyPeriodPerformance {
  bestStrategy: string | null;
  totalMatches: number;
  totalPredictions: number;
  averageMatches: number;
  daysWithMatches: number;
  dailyMatches: Record<string, number>; // date (YYYY-MM-DD) -> total matches on that day
  strategyBreakdown: Record<string, {
    totalMatches: number;
    totalPredictions: number;
    averageMatches: number;
    dailyMatches: Record<string, number>; // date -> matches for this strategy
  }>;
}

export interface StrategyPerformance {
  week: StrategyPeriodPerformance;
  month: StrategyPeriodPerformance;
  year: StrategyPeriodPerformance;
}

