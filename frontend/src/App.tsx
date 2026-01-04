import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { SEO } from './components/SEO';
import { useAuth } from './contexts/AuthContext';
import { predictionsApi } from './api/client';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BottomNavigation } from './components/BottomNavigation';
import type { SavedPrediction } from './types';

// Lazy load pages for code splitting
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Search = lazy(() => import('./pages/Search').then(m => ({ default: m.Search })));
const Analytics = lazy(() => import('./pages/Analytics').then(m => ({ default: m.Analytics })));
const Import = lazy(() => import('./pages/Import').then(m => ({ default: m.Import })));
const Predictions = lazy(() => import('./pages/Predictions').then(m => ({ default: m.Predictions })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then(m => ({ default: m.Register })));
const Subscription = lazy(() => import('./pages/Subscription').then(m => ({ default: m.Subscription })));

const Navigation: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [recentWin, setRecentWin] = useState<SavedPrediction | null>(null);
  const [allWinsAndPartials, setAllWinsAndPartials] = useState<SavedPrediction[]>([]);
  const [isWinsDropdownOpen, setIsWinsDropdownOpen] = useState(false);
  const winsDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path;
  const isAnyDropdownItemActive = () => {
    return isActive('/search') || isActive('/analytics') || isActive('/import') || isActive('/predictions');
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (winsDropdownRef.current && !winsDropdownRef.current.contains(event.target as Node)) {
        setIsWinsDropdownOpen(false);
      }
    };

    if (isDropdownOpen || isUserMenuOpen || isWinsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, isUserMenuOpen, isWinsDropdownOpen]);

  // Close dropdowns when route changes
  useEffect(() => {
    setIsDropdownOpen(false);
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Load most recent win/partial predictions (prioritize wins over partials)
  useEffect(() => {
    const loadRecentWins = async () => {
      if (!isAuthenticated) {
        setRecentWin(null);
        setAllWinsAndPartials([]);
        return;
      }
      
      try {
        const predictions = await predictionsApi.getHistory(100); // Get recent predictions
        // Get all wins and partials, sorted by creation date (newest first)
        const winsAndPartials = predictions
          .filter(p => (p.status === 'win' || p.status === 'partial') && p.isChecked)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        setAllWinsAndPartials(winsAndPartials);
        
        // Prioritize wins over partials - find the most recent win first
        const mostRecentWin = winsAndPartials.find(p => p.status === 'win');
        const mostRecentPartial = winsAndPartials.find(p => p.status === 'partial');
        
        // Show win if available, otherwise show partial
        setRecentWin(mostRecentWin || mostRecentPartial || null);
      } catch (error) {
        // Silently fail - don't show error in navigation
        console.error('Failed to load recent wins:', error);
        setRecentWin(null);
        setAllWinsAndPartials([]);
      }
    };

    loadRecentWins();
    // Refresh every 30 seconds to catch new wins
    const interval = setInterval(loadRecentWins, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, location.pathname]); // Refresh when route changes

  const menuItems = [
    { path: '/search', label: 'Search' },
    { path: '/analytics', label: 'Analytics' },
    { path: '/predictions', label: 'Predictions', pro: true },
    { path: '/import', label: 'Import' },
  ];

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/" className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-600 to-accent-400 flex items-center justify-center text-white font-bold mr-3">
                GL
              </div>
              <span className="text-xl font-bold text-gray-900">Ghana Lottery Explorer</span>
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                to="/"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive('/')
                    ? 'border-primary-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Home
              </Link>
              <Link
                to="/dashboard"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive('/dashboard')
                    ? 'border-primary-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Dashboard
              </Link>
              
              {/* More Dropdown */}
              <div className="relative h-full" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`h-full inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium bg-transparent border-0 ${
                    isAnyDropdownItemActive()
                      ? 'border-primary-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="true"
                >
                  More
                  <svg
                    className={`ml-1 h-4 w-4 transition-transform ${
                      isDropdownOpen ? 'transform rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {isDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1" role="menu" aria-orientation="vertical">
                      {menuItems.map((item) => (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`block px-4 py-2 text-sm ${
                            isActive(item.path)
                              ? 'bg-primary-50 text-primary-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                          role="menuitem"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          <div className="flex items-center justify-between">
                            <span>{item.label}</span>
                            {item.pro && (
                              <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-accent-500 text-white rounded">
                                Pro
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* User Menu (Desktop) */}
          <div className="hidden sm:flex sm:items-center sm:ml-6 sm:gap-3">
            {/* Most Recent Win/Partial Badge with Dropdown */}
            {isAuthenticated && recentWin && (
              <div className="hidden md:flex items-center gap-1 relative" ref={winsDropdownRef}>
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:shadow-md active:scale-95 min-h-[44px]"
                  style={{
                    backgroundColor: recentWin.status === 'win' 
                      ? 'rgba(34, 197, 94, 0.1)' 
                      : 'rgba(234, 179, 8, 0.1)',
                    border: `1px solid ${recentWin.status === 'win' ? '#22c55e' : '#eab308'}`,
                  }}
                  title={`Recent ${recentWin.status === 'win' ? 'Win' : 'Partial'}: ${recentWin.predictedNumbers.join(', ')}`}
                >
                  <div className={`w-2 h-2 rounded-full ${
                    recentWin.status === 'win' ? 'bg-green-500' : 'bg-yellow-500'
                  }`} />
                  <div className="flex flex-col">
                    <span className={`text-xs font-semibold ${
                      recentWin.status === 'win' ? 'text-green-700' : 'text-yellow-700'
                    }`}>
                      {recentWin.status === 'win' ? 'WIN' : 'PARTIAL'}
                    </span>
                    <span className="text-xs text-gray-600">
                      {recentWin.matches}/5 matches
                    </span>
                  </div>
                  <div className="flex gap-0.5">
                    {recentWin.predictedNumbers.slice(0, 3).map((num, idx) => (
                      <span
                        key={idx}
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          recentWin.actualDraw?.winningNumbers?.includes(num)
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-300 text-gray-700'
                        }`}
                      >
                        {num}
                      </span>
                    ))}
                    {recentWin.predictedNumbers.length > 3 && (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-gray-300 text-gray-700">
                        +{recentWin.predictedNumbers.length - 3}
                      </span>
                    )}
                  </div>
                </Link>
                
                {/* Dropdown button (only show if there are multiple wins/partials) */}
                {allWinsAndPartials.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsWinsDropdownOpen(!isWinsDropdownOpen);
                    }}
                    className="px-2 py-1.5 rounded-r-lg transition-all hover:shadow-md active:scale-95 min-h-[44px] flex items-center"
                    style={{
                      backgroundColor: recentWin.status === 'win' 
                        ? 'rgba(34, 197, 94, 0.1)' 
                        : 'rgba(234, 179, 8, 0.1)',
                      border: `1px solid ${recentWin.status === 'win' ? '#22c55e' : '#eab308'}`,
                      borderLeft: 'none',
                    }}
                    title={`View all ${allWinsAndPartials.length} wins and partials`}
                  >
                    <span className="px-1.5 py-0.5 bg-white/50 rounded-full text-xs font-bold text-gray-700 mr-1">
                      +{allWinsAndPartials.length - 1}
                    </span>
                    <svg
                      className={`w-3 h-3 text-gray-500 transition-transform ${
                        isWinsDropdownOpen ? 'transform rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}

                {/* Dropdown with all wins and partials */}
                {isWinsDropdownOpen && allWinsAndPartials.length > 0 && (
                  <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-2">
                      <div className="px-4 py-2 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900">
                          Recent Wins & Partials ({allWinsAndPartials.length})
                        </h3>
                      </div>
                      {allWinsAndPartials.map((prediction, index) => (
                        <Link
                          key={prediction.id}
                          to="/dashboard"
                          onClick={() => setIsWinsDropdownOpen(false)}
                          className={`block px-4 py-3 hover:bg-gray-50 transition-colors ${
                            index === 0 ? 'bg-gray-50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                prediction.status === 'win' ? 'bg-green-500' : 'bg-yellow-500'
                              }`} />
                              <span className={`text-xs font-semibold ${
                                prediction.status === 'win' ? 'text-green-700' : 'text-yellow-700'
                              }`}>
                                {prediction.status === 'win' ? 'WIN' : 'PARTIAL'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {prediction.matches}/5 matches
                              </span>
                            </div>
                            {prediction.lottoType && (
                              <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-100 rounded">
                                {prediction.lottoType}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {prediction.predictedNumbers.map((num, idx) => (
                              <span
                                key={idx}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  prediction.actualDraw?.winningNumbers?.includes(num)
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-300 text-gray-700'
                                }`}
                              >
                                {num}
                              </span>
                            ))}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(prediction.createdAt).toLocaleDateString()}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {isAuthenticated ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-accent-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {user?.name ? user.name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm font-medium text-gray-700 hidden md:block">
                    {user?.name || user?.email}
                  </span>
                  {user?.isPro && (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-primary-600 to-accent-500 text-white rounded-full text-xs font-bold">
                      PRO
                    </span>
                  )}
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1" role="menu">
                      <Link
                        to="/dashboard"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        role="menuitem"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        Dashboard
                      </Link>
                      <Link
                        to="/subscription"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        role="menuitem"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        Subscription
                      </Link>
                      <div className="border-t border-gray-100"></div>
                      <button
                        onClick={() => {
                          logout();
                          setIsUserMenuOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        role="menuitem"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-primary-600 to-accent-500 text-white rounded-lg hover:opacity-90"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="sm:hidden flex items-center">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <svg
                  className="block h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="block h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="sm:hidden">
            <div className="pt-2 pb-3 space-y-1">
              <Link
                to="/"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  isActive('/')
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                to="/dashboard"
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  isActive('/dashboard')
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    isActive(item.path)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className="flex items-center justify-between">
                    <span>{item.label}</span>
                    {item.pro && (
                      <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-accent-500 text-white rounded">
                        Pro
                      </span>
                    )}
                  </div>
                </Link>
              ))}
              
              {/* Mobile Auth Section */}
              <div className="border-t border-gray-200 pt-2 mt-2">
                {isAuthenticated ? (
                  <>
                    {/* Most Recent Win/Partial in Mobile Menu */}
                    {recentWin && (
                      <div className="mb-2">
                        <div className="flex items-stretch rounded-md overflow-hidden" style={{
                          backgroundColor: recentWin.status === 'win' 
                            ? 'rgba(34, 197, 94, 0.1)' 
                            : 'rgba(234, 179, 8, 0.1)',
                          border: `1px solid ${recentWin.status === 'win' ? '#22c55e' : '#eab308'}`,
                        }}>
                          <Link
                            to="/dashboard"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex-1 px-3 py-2 text-base font-medium transition-all"
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                recentWin.status === 'win' ? 'bg-green-500' : 'bg-yellow-500'
                              }`} />
                              <span className={`text-sm font-semibold ${
                                recentWin.status === 'win' ? 'text-green-700' : 'text-yellow-700'
                              }`}>
                                Recent {recentWin.status === 'win' ? 'WIN' : 'PARTIAL'}: {recentWin.matches}/5
                              </span>
                            </div>
                            <div className="flex gap-1 mt-1">
                              {recentWin.predictedNumbers.map((num, idx) => (
                                <span
                                  key={idx}
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                    recentWin.actualDraw?.winningNumbers?.includes(num)
                                      ? 'bg-green-500 text-white'
                                      : 'bg-gray-300 text-gray-700'
                                  }`}
                                >
                                  {num}
                                </span>
                              ))}
                            </div>
                          </Link>
                          
                          {/* Dropdown button (only show if there are multiple wins/partials) */}
                          {allWinsAndPartials.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsWinsDropdownOpen(!isWinsDropdownOpen);
                              }}
                              className="px-2 flex items-center justify-center border-l"
                              style={{
                                borderColor: recentWin.status === 'win' ? '#22c55e' : '#eab308',
                              }}
                            >
                              <span className="px-1.5 py-0.5 bg-white/50 rounded-full text-xs font-bold text-gray-700 mr-1">
                                +{allWinsAndPartials.length - 1}
                              </span>
                              <svg
                                className={`w-4 h-4 text-gray-500 transition-transform ${
                                  isWinsDropdownOpen ? 'transform rotate-180' : ''
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}
                        </div>

                        {/* Dropdown with all wins and partials (Mobile) */}
                        {isWinsDropdownOpen && allWinsAndPartials.length > 0 && (
                          <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                            {allWinsAndPartials.map((prediction) => (
                              <Link
                                key={prediction.id}
                                to="/dashboard"
                                onClick={() => {
                                  setIsWinsDropdownOpen(false);
                                  setIsMobileMenuOpen(false);
                                }}
                                className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                                  prediction.status === 'win'
                                    ? 'bg-green-50 border border-green-200'
                                    : 'bg-yellow-50 border border-yellow-200'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                      prediction.status === 'win' ? 'bg-green-500' : 'bg-yellow-500'
                                    }`} />
                                    <span className={`text-xs font-semibold ${
                                      prediction.status === 'win' ? 'text-green-700' : 'text-yellow-700'
                                    }`}>
                                      {prediction.status === 'win' ? 'WIN' : 'PARTIAL'}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {prediction.matches}/5 matches
                                    </span>
                                  </div>
                                  {prediction.lottoType && (
                                    <span className="text-xs text-gray-500 px-2 py-0.5 bg-white rounded">
                                      {prediction.lottoType}
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-1 flex-wrap mb-1">
                                  {prediction.predictedNumbers.map((num, idx) => (
                                    <span
                                      key={idx}
                                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                        prediction.actualDraw?.winningNumbers?.includes(num)
                                          ? 'bg-green-500 text-white'
                                          : 'bg-gray-300 text-gray-700'
                                      }`}
                                    >
                                      {num}
                                    </span>
                                  ))}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {new Date(prediction.createdAt).toLocaleDateString()}
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <Link
                      to="/subscription"
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Subscription
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      className="block px-3 py-2 rounded-md text-base font-medium bg-gradient-to-r from-primary-600 to-accent-500 text-white hover:opacity-90"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

const ConditionalLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  
  if (isHomePage) {
    return (
      <>
        <Navigation />
        <div className="pb-16 sm:pb-0">
          {children}
        </div>
        <BottomNavigation />
      </>
    );
  }
  
  return (
    <>
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 sm:pb-8">
        {children}
      </main>
      <BottomNavigation />
    </>
  );
};

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SubscriptionProvider>
          <Router>
            <div className="min-h-screen bg-gray-50">
              <SEO />
              <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center">
                  <LoadingSpinner message="Loading page..." fullScreen />
                </div>
              }>
                <ErrorBoundary>
                  <Routes>
                    <Route
                      path="/"
                      element={
                        <ConditionalLayout>
                          <HomePage />
                        </ConditionalLayout>
                      }
                    />
                    <Route
                      path="/login"
                      element={<Login />}
                    />
                    <Route
                      path="/register"
                      element={<Register />}
                    />
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <ConditionalLayout>
                            <Dashboard />
                          </ConditionalLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/search"
                      element={
                        <ConditionalLayout>
                          <Search />
                        </ConditionalLayout>
                      }
                    />
                    <Route
                      path="/analytics"
                      element={
                        <ConditionalLayout>
                          <Analytics />
                        </ConditionalLayout>
                      }
                    />
                    <Route
                      path="/import"
                      element={
                        <ConditionalLayout>
                          <Import />
                        </ConditionalLayout>
                      }
                    />
                    <Route
                      path="/predictions"
                      element={
                        <ProtectedRoute>
                          <ConditionalLayout>
                            <Predictions />
                          </ConditionalLayout>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/subscription"
                      element={
                        <ProtectedRoute>
                          <ConditionalLayout>
                            <Subscription />
                          </ConditionalLayout>
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                </ErrorBoundary>
              </Suspense>
            </div>
          </Router>
        </SubscriptionProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

