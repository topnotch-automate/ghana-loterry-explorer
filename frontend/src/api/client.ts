import axios, { AxiosError } from 'axios';
import type { ApiResponse, Draw, SearchResult, FrequencyStats, CoOccurrenceData } from '../types';
import { API_CONFIG } from '../utils/constants';
import { ApiError, handleApiError } from '../utils/errors';

const api = axios.create({
  baseURL: API_CONFIG.BASE_URL + '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: API_CONFIG.TIMEOUT,
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse>) => {
    if (error.response?.data) {
      const { error: errorMessage, code, details } = error.response.data;
      throw new ApiError(
        errorMessage || 'An error occurred',
        error.response.status,
        code,
        details
      );
    }
    throw new ApiError(
      error.message || 'Network error',
      error.response?.status
    );
  }
);

// Draws API
export const drawsApi = {
  getAll: async (params?: {
    startDate?: string;
    endDate?: string;
    lottoType?: string;
    limit?: number;
    offset?: number;
  }): Promise<Draw[]> => {
    const response = await api.get<ApiResponse<Draw[]>>('/draws', { params });
    if (!response.data.success || !response.data.data) {
      throw new ApiError(response.data.error || 'Failed to fetch draws');
    }
    return response.data.data;
  },

  getById: async (id: string): Promise<Draw> => {
    const response = await api.get<ApiResponse<Draw>>(`/draws/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new ApiError(response.data.error || 'Failed to fetch draw');
    }
    return response.data.data;
  },

  getLatest: async (lottoType?: string): Promise<Draw | null> => {
    try {
      const response = await api.get<ApiResponse<Draw>>('/draws/latest', {
        params: { lottoType },
      });
      if (!response.data.success || !response.data.data) {
        return null;
      }
      return response.data.data;
    } catch (error) {
      // Return null if no draws found instead of throwing
      if (error instanceof ApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  },

  search: async (params: {
    numbers?: number[];
    mode?: string;
    startDate?: string;
    endDate?: string;
    lottoType?: string;
    minMatches?: number;
  }): Promise<SearchResult[]> => {
    const searchParams: Record<string, string> = {};
    if (params.numbers) {
      searchParams.numbers = params.numbers.join(',');
    }
    if (params.mode) searchParams.mode = params.mode;
    if (params.startDate) searchParams.startDate = params.startDate;
    if (params.endDate) searchParams.endDate = params.endDate;
    if (params.lottoType) searchParams.lottoType = params.lottoType;
    if (params.minMatches) searchParams.minMatches = params.minMatches.toString();

    const response = await api.get<ApiResponse<SearchResult[]>>('/draws/search', {
      params: searchParams,
    });
    if (!response.data.success || !response.data.data) {
      throw new ApiError(response.data.error || 'Failed to search draws');
    }
    return response.data.data;
  },

  create: async (draw: {
    drawDate: string;
    lottoType: string;
    winningNumbers: number[];
    machineNumbers: number[];
    source?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Draw> => {
    const response = await api.post<ApiResponse<Draw>>('/draws', draw);
    if (!response.data.success || !response.data.data) {
      throw new ApiError(response.data.error || 'Failed to create draw');
    }
    return response.data.data;
  },

  getSimilar: async (id: string, minMatches?: number, limit?: number): Promise<SearchResult[]> => {
    const params: Record<string, string> = {};
    if (minMatches) params.minMatches = minMatches.toString();
    if (limit) params.limit = limit.toString();

    const response = await api.get<ApiResponse<SearchResult[]>>(`/draws/${id}/similar`, {
      params,
    });
    if (!response.data.success || !response.data.data) {
      throw new ApiError(response.data.error || 'Failed to fetch similar draws');
    }
    return response.data.data;
  },

  export: async (
    format: 'csv' | 'json',
    params?: {
      startDate?: string;
      endDate?: string;
      lottoType?: string;
      limit?: number;
    }
  ): Promise<Blob> => {
    const searchParams = new URLSearchParams({ format });
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.lottoType) searchParams.append('lottoType', params.lottoType);
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const response = await api.get(`/draws/export?${searchParams.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

// Analytics API
export const analyticsApi = {
  getFrequency: async (params?: {
    daily?: boolean;
    weekly?: boolean;
    monthly?: boolean;
    yearly?: boolean;
    days?: number;
    lottoType?: string;
  }): Promise<FrequencyStats[]> => {
    const response = await api.get<ApiResponse<FrequencyStats[]>>('/analytics/frequency', {
      params,
    });
    if (!response.data.success || !response.data.data) {
      throw new ApiError(response.data.error || 'Failed to fetch frequency stats');
    }
    return response.data.data;
  },

  getHot: async (days: number = 30, lottoType?: string): Promise<FrequencyStats[]> => {
    const response = await api.get<ApiResponse<FrequencyStats[]>>('/analytics/hot', {
      params: { days, lottoType },
    });
    if (!response.data.success || !response.data.data) {
      throw new ApiError(response.data.error || 'Failed to fetch hot numbers');
    }
    return response.data.data;
  },

  getCold: async (days: number = 30, lottoType?: string): Promise<FrequencyStats[]> => {
    const response = await api.get<ApiResponse<FrequencyStats[]>>('/analytics/cold', {
      params: { days, lottoType },
    });
    if (!response.data.success || !response.data.data) {
      throw new ApiError(response.data.error || 'Failed to fetch cold numbers');
    }
    return response.data.data;
  },

  getSleeping: async (days: number = 30): Promise<number[]> => {
    const response = await api.get<ApiResponse<number[]>>('/analytics/sleeping', {
      params: { days },
    });
    if (!response.data.success || !response.data.data) {
      throw new ApiError(response.data.error || 'Failed to fetch sleeping numbers');
    }
    return response.data.data;
  },

  getStats: async (lottoType?: string): Promise<{
    totalDraws: number;
    dateRange: { minDate: string; maxDate: string } | null;
  }> => {
    const response = await api.get<ApiResponse<{
      totalDraws: number;
      dateRange: { minDate: string; maxDate: string } | null;
    }>>('/analytics/stats', { params: { lottoType } });
    if (!response.data.success || !response.data.data) {
      throw new ApiError(response.data.error || 'Failed to fetch stats');
    }
    return response.data.data;
  },

  getCoOccurrence: async (params?: {
    limit?: number;
    minCount?: number;
    days?: number;
    lottoType?: string;
    number?: number;
  }): Promise<CoOccurrenceData[]> => {
    const response = await api.get<ApiResponse<CoOccurrenceData[]>>('/analytics/cooccurrence', {
      params,
    });
    if (!response.data.success || !response.data.data) {
      throw new ApiError(response.data.error || 'Failed to fetch co-occurrence data');
    }
    return response.data.data;
  },

  updateCoOccurrence: async (params?: {
    days?: number;
    lottoType?: string;
  }): Promise<void> => {
    const response = await api.post<ApiResponse<void>>('/analytics/cooccurrence/update', params);
    if (!response.data.success) {
      throw new ApiError(response.data.error || 'Failed to update co-occurrence triplets');
    }
  },
  getCoOccurrenceDates: async (params: {
    number1: number;
    number2: number;
    number3?: number;
    days?: number;
    lottoType?: string;
  }): Promise<string[]> => {
    const searchParams = new URLSearchParams();
    searchParams.append('number1', params.number1.toString());
    searchParams.append('number2', params.number2.toString());
    if (params.number3 !== undefined) {
      searchParams.append('number3', params.number3.toString());
    }
    if (params.days) {
      searchParams.append('days', params.days.toString());
    }
    if (params.lottoType) {
      searchParams.append('lottoType', params.lottoType);
    }
    
    const response = await api.get<ApiResponse<string[]>>(`/analytics/cooccurrence/dates?${searchParams.toString()}`);
    if (!response.data.success) {
      throw new ApiError(response.data.error || 'Failed to fetch co-occurrence dates');
    }
    return response.data.data || [];
  },
};

export default api;

