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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type SearchMode = 'exact' | 'partial' | 'winning-only' | 'machine-only' | 'group';

