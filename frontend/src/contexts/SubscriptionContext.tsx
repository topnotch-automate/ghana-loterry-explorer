import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { predictionsApi } from '../api/client';
import { useAuth } from './AuthContext';
import { handleApiError } from '../utils/errors';
import type { SubscriptionStatus } from '../types';

interface SubscriptionContextType {
  subscription: SubscriptionStatus | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      setLoading(true);
      if (isAuthenticated && user) {
        const status = await predictionsApi.getSubscriptionStatus();
        setSubscription(status);
      } else {
        setSubscription({
          authenticated: false,
          tier: 'free',
          isPro: false,
        });
      }
    } catch (error) {
      // If not authenticated, set default free status
      setSubscription({
        authenticated: false,
        tier: 'free',
        isPro: false,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [user, isAuthenticated]);

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

