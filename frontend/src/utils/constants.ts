// API Configuration
// In development, use relative URLs to leverage Vite proxy
// In production, use the configured API URL
const getBaseUrl = () => {
  if (import.meta.env.DEV) {
    // Development: Use relative URL to leverage Vite proxy
    return '';
  }
  // Production: Use configured API URL or default
  return import.meta.env.VITE_API_URL || 'http://localhost:5000';
};

export const API_CONFIG = {
  BASE_URL: getBaseUrl(),
  TIMEOUT: 30000,
} as const;

// App Configuration
export const APP_CONFIG = {
  NAME: import.meta.env.VITE_APP_NAME || 'Ghana Lottery Explorer',
} as const;

// Domain Constants
export const LOTTERY = {
  MIN_NUMBER: 1,
  MAX_NUMBER: 90,
  WINNING_NUMBERS_COUNT: 5,
  MACHINE_NUMBERS_COUNT: 5,
  TOTAL_NUMBERS_PER_DRAW: 10,
} as const;

// UI Constants
export const UI = {
  DEBOUNCE_DELAY: 300,
  ITEMS_PER_PAGE: 20,
  MAX_SEARCH_NUMBERS: 10,
} as const;

