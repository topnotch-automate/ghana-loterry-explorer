// Core domain types for Ghana Lottery Explorer

export interface Draw {
  id: string;
  drawDate: string; // ISO date string
  lottoType: string;
  winningNumbers: number[]; // Array of 5 numbers (1-90)
  machineNumbers: number[]; // Array of 5 numbers (1-90)
  source?: string;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateDrawInput {
  drawDate: string;
  lottoType: string;
  winningNumbers: number[];
  machineNumbers: number[];
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchQuery {
  numbers?: number[];
  drawDate?: string;
  startDate?: string;
  endDate?: string;
  lottoType?: string;
  mode?: 'exact' | 'partial' | 'winning-only' | 'machine-only' | 'group';
  minMatches?: number;
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

export interface PatternMatch {
  patternType: 'exact' | 'partial' | 'group' | 'sequence';
  patternData: number[];
  drawIds: string[];
  occurrenceCount: number;
  firstSeen?: string;
  lastSeen?: string;
}

export interface AnalyticsTimeframe {
  daily?: boolean;
  weekly?: boolean;
  monthly?: boolean;
  yearly?: boolean;
  days?: number; // Custom rolling window
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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

