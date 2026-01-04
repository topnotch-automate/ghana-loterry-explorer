import React from 'react';
import type { PredictionSet, PredictionConfidence } from '../types';

interface PredictionCardProps {
  title: string;
  prediction: PredictionSet;
  strategy: string;
  confidence?: PredictionConfidence; // Optional confidence data
}

const PredictionCardComponent: React.FC<PredictionCardProps> = ({ title, prediction, strategy, confidence }) => {
  const strategyColors: Record<string, string> = {
    ensemble: 'from-purple-500 to-pink-500',
    ml: 'from-blue-500 to-cyan-500',
    genetic: 'from-green-500 to-emerald-500',
    pattern: 'from-orange-500 to-red-500',
    intelligence: 'from-indigo-500 to-purple-500',
    yearly: 'from-teal-500 to-cyan-500',
    transfer: 'from-emerald-500 to-teal-500',
    check_balance: 'from-indigo-500 to-purple-500',
  };

  // Get confidence level color and badge
  const getConfidenceDisplay = () => {
    if (!confidence) return null;
    
    const confValue = confidence.confidence;
    const level = confidence.level;
    
    let bgColor = 'bg-gray-200';
    let textColor = 'text-gray-700';
    let levelText = level.charAt(0).toUpperCase() + level.slice(1);
    
    if (level === 'high') {
      bgColor = 'bg-green-100';
      textColor = 'text-green-700';
    } else if (level === 'medium') {
      bgColor = 'bg-yellow-100';
      textColor = 'text-yellow-700';
    } else if (level === 'low') {
      bgColor = 'bg-orange-100';
      textColor = 'text-orange-700';
    }
    
    return { confValue, levelText, bgColor, textColor };
  };

  const confDisplay = getConfidenceDisplay();

  return (
    <div className="card hover:shadow-xl transition-all duration-300 border-2 border-gray-100 hover:border-primary-200 group">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        <span className={`px-3 py-1 text-xs font-semibold bg-gradient-to-r ${strategyColors[strategy] || 'from-gray-500 to-gray-600'} text-white rounded-full shadow-sm`}>
          {strategy.toUpperCase()}
        </span>
      </div>

      {/* Confidence Display */}
      {confDisplay && (
        <div className="mb-5 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700">Confidence</span>
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${confDisplay.bgColor} ${confDisplay.textColor}`}>
              {confDisplay.levelText}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div
              className={`h-2.5 rounded-full transition-all ${
                confDisplay.levelText === 'High' 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                  : confDisplay.levelText === 'Medium'
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                  : 'bg-gradient-to-r from-orange-500 to-red-500'
              }`}
              style={{ width: `${Math.min(confDisplay.confValue * 100, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">{(confDisplay.confValue * 100).toFixed(1)}%</span>
          </div>
          {confidence?.recommendation && (
            <div className="mt-2 pt-2 border-t border-blue-200">
              <p className="text-xs text-gray-600 leading-relaxed">{confidence.recommendation}</p>
            </div>
          )}
        </div>
      )}

      <div className="mb-5">
        <div className="flex flex-wrap gap-2.5 justify-center">
          {prediction.numbers.map((num, index) => (
            <div
              key={num}
              className={`number-chip number-chip-winning text-xl font-bold w-12 h-12 flex items-center justify-center shadow-md hover:shadow-lg transform hover:scale-110 transition-all`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {num}
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Sum</div>
            <div className="text-lg font-bold text-gray-800">{prediction.sum}</div>
          </div>
          <div className="p-2 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Evens</div>
            <div className="text-lg font-bold text-gray-800">{prediction.evens}</div>
          </div>
          <div className="p-2 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Highs</div>
            <div className="text-lg font-bold text-gray-800">{prediction.highs}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Memoize to prevent unnecessary re-renders
export const PredictionCard = React.memo(PredictionCardComponent, (prevProps, nextProps) => {
  // Only re-render if prediction numbers, strategy, or confidence change
  const confidenceEqual = prevProps.confidence === nextProps.confidence || (
    prevProps.confidence &&
    nextProps.confidence &&
    prevProps.confidence.confidence === nextProps.confidence.confidence &&
    prevProps.confidence.level === nextProps.confidence.level
  );
  
  return Boolean(
    prevProps.title === nextProps.title &&
    prevProps.strategy === nextProps.strategy &&
    JSON.stringify(prevProps.prediction.numbers) === JSON.stringify(nextProps.prediction.numbers) &&
    prevProps.prediction.sum === nextProps.prediction.sum &&
    confidenceEqual
  );
});

