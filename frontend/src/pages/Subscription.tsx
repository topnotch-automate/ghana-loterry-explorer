import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionsApi, SubscriptionStatusData } from '../api/client';
import { handleApiError } from '../utils/errors';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';

export const Subscription: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatusData | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadSubscriptionStatus();
  }, [user, navigate]);

  const loadSubscriptionStatus = async () => {
    try {
      const status = await subscriptionsApi.getStatus();
      setSubscriptionStatus(status);
    } catch (err) {
      console.error('Failed to load subscription status:', err);
    }
  };

  const handleUpgrade = async () => {
    setError(null);
    setLoading(true);

    try {
      // In production, this would integrate with a payment provider (Stripe, PayPal, etc.)
      // For now, we'll simulate a successful payment
      const paymentReference = `PAY-${Date.now()}`;
      
      await subscriptionsApi.upgrade(paymentReference);
      await refreshUser();
      await loadSubscriptionStatus();
      
      // Show success message
      alert('🎉 Successfully upgraded to Pro! You now have access to advanced predictions.');
    } catch (err: any) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  const isPro = user.isPro || subscriptionStatus?.isPro;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-accent-500 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center text-2xl backdrop-blur-sm">
            ⭐
          </div>
          <div>
            <h1 className="text-3xl font-bold">Subscription</h1>
            <p className="text-white/90 text-sm mt-1">
              Manage your subscription and unlock Pro features
            </p>
          </div>
        </div>
      </div>

      {/* Current Status */}
      <div className="card border-2 border-gray-100">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Current Plan
        </h2>
        <div className="p-6 bg-gradient-to-br from-primary-50 to-accent-50 rounded-lg border-2 border-primary-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  isPro 
                    ? 'bg-gradient-to-r from-primary-600 to-accent-500 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}>
                  {isPro ? 'PRO' : 'FREE'}
                </span>
              </div>
              <p className="text-gray-700 font-medium">
                {isPro ? 'Pro Subscription Active' : 'Free Plan'}
              </p>
              {subscriptionStatus?.expiresAt && (
                <p className="text-sm text-gray-600 mt-1">
                  Expires: {new Date(subscriptionStatus.expiresAt).toLocaleDateString()}
                </p>
              )}
            </div>
            {isPro && (
              <div className="text-4xl">🎉</div>
            )}
          </div>
        </div>
      </div>

      {/* Pricing Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free Plan */}
        <div className={`card border-2 ${!isPro ? 'border-primary-300 bg-primary-50' : 'border-gray-200'}`}>
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Free Plan</h3>
            <div className="text-4xl font-bold text-gray-900 mb-1">$0</div>
            <p className="text-sm text-gray-600">Forever free</p>
          </div>
          <ul className="space-y-3 mb-6">
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-gray-700">Search lottery draws</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-gray-700">Basic analytics</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-gray-700">Number frequency charts</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-gray-700">Hot/Cold numbers</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-gray-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-gray-500">AI Predictions</span>
            </li>
          </ul>
          {!isPro && (
            <button
              disabled
              className="w-full px-4 py-2 bg-gray-200 text-gray-500 rounded-lg font-medium cursor-not-allowed"
            >
              Current Plan
            </button>
          )}
        </div>

        {/* Pro Plan */}
        <div className={`card border-2 ${isPro ? 'border-primary-300 bg-primary-50' : 'border-primary-500'} relative`}>
          {!isPro && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="px-3 py-1 bg-gradient-to-r from-primary-600 to-accent-500 text-white rounded-full text-xs font-bold shadow-lg">
                RECOMMENDED
              </span>
            </div>
          )}
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Pro Plan</h3>
            <div className="text-4xl font-bold text-gray-900 mb-1">$9.99</div>
            <p className="text-sm text-gray-600">per month</p>
          </div>
          <ul className="space-y-3 mb-6">
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-gray-700">Everything in Free</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-gray-700 font-semibold">AI-Powered Predictions</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-gray-700">Machine Learning Models</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-gray-700">Genetic Algorithm Optimization</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-gray-700">Advanced Pattern Analysis</span>
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-gray-700">Priority Support</span>
            </li>
          </ul>
          {isPro ? (
            <button
              disabled
              className="w-full px-4 py-2 bg-gradient-to-r from-primary-600 to-accent-500 text-white rounded-lg font-medium cursor-not-allowed"
            >
              Current Plan
            </button>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full btn-primary py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Upgrade to Pro'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="card bg-red-50 border-2 border-red-200">
          <ErrorDisplay error={error} onRetry={() => setError(null)} title="Upgrade Error" />
        </div>
      )}

      {/* Payment Note */}
      {!isPro && (
        <div className="card bg-blue-50 border-2 border-blue-200">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-blue-800 font-medium mb-1">Payment Information</p>
              <p className="text-blue-700 text-sm">
                For demonstration purposes, clicking "Upgrade to Pro" will immediately activate your Pro subscription. 
                In production, this would integrate with a payment provider like Stripe or PayPal.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

