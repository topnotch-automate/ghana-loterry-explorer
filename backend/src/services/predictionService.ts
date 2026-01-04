import axios from 'axios';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import type { Draw } from '../types/index.js';
import pool from '../database/db.js';

interface PredictionRequest {
  draws: number[][];
  machine_draws?: number[][]; // Machine numbers for intelligence engine
  draw_dates?: string[]; // Draw dates for yearly and transfer pattern analysis
  lotto_types?: string[]; // Lotto types for yearly and transfer pattern analysis (matches draw_dates)
  strategy: 'ensemble' | 'ml' | 'genetic' | 'pattern' | 'intelligence' | 'yearly' | 'transfer' | 'check_balance';
  n_predictions?: number;
  winning_predictions?: Array<{
    strategy: string;
    matches: number;
    predicted_numbers: number[];
    lotto_type: string;
    created_at: string;
  }>;
  current_lotto_type?: string;
}

// Special prediction types for "two sure" and "three direct" features
interface SpecialPrediction {
  numbers: number[];
  count: number;
  type: 'two_sure' | 'three_direct';
}

interface StandardPrediction {
  numbers: number[];
  sum: number;
  evens: number;
  highs: number;
}

// Confidence scoring for predictions
interface ConfidenceScore {
  confidence: number;
  level: 'high' | 'medium' | 'low' | 'very_low' | 'invalid';
  factors: {
    zone_diversity: number;
    gap_pattern: number;
    pattern_validity: number;
    position_alignment: number;
    strategy_agreement: number;
    historical_frequency: number;
  };
  recommendation: string;
}

// Trend analysis data
interface TrendAnalysis {
  rising: number[];      // Numbers with rising trend
  falling: number[];     // Numbers with falling trend
  accelerating: number[]; // Numbers with accelerating momentum
}

interface PredictionResponse {
  success: boolean;
  predictions: {
    [key: string]: Array<StandardPrediction> | SpecialPrediction | undefined;
  } & {
    // Explicitly include intelligence for type safety
    intelligence?: Array<StandardPrediction>;
    // Special features: two_sure and three_direct are stored as objects, not arrays
    two_sure?: SpecialPrediction;
    three_direct?: SpecialPrediction;
  };
  strategy: string;
  regime_change?: {
    detected: boolean;
    confidence: number;
    details?: Record<string, string>;
  };
  // New enhanced fields
  confidence?: Record<string, ConfidenceScore>;
  trend_analysis?: TrendAnalysis;
  data_points_used: number;
}

export class PredictionService {
  private readonly pythonServiceUrl: string;

  constructor() {
    // Get Python service URL from config
    this.pythonServiceUrl = config.pythonService.url;
    logger.info(`Python service URL: ${this.pythonServiceUrl}`);
  }

  /**
   * Convert database draws to Python format (winning and machine numbers)
   * For intelligence strategy, filters to only include draws with valid machine numbers
   */
  private convertDrawsToPythonFormat(
    draws: Draw[], 
    strategy?: 'ensemble' | 'ml' | 'genetic' | 'pattern' | 'intelligence' | 'yearly' | 'transfer'
  ): { 
    winning: number[][]; 
    machine: number[][];
    lotto_types?: string[];
    filteredCount?: number;
  } {
    // For intelligence strategy, filter to only include draws with valid machine numbers
    if (strategy === 'intelligence') {
      const filtered = draws.filter(draw => 
        draw.machineNumbers && 
        Array.isArray(draw.machineNumbers) && 
        draw.machineNumbers.length === 5 &&
        draw.machineNumbers.every(n => typeof n === 'number' && n >= 1 && n <= 90)
      );
      
      if (filtered.length < 50) {
        logger.warn(
          `Only ${filtered.length} draws have valid machine numbers (need at least 50 for intelligence strategy). ` +
          `Original draw count: ${draws.length}`
        );
      } else {
        logger.info(
          `Filtered to ${filtered.length} draws with valid machine numbers (from ${draws.length} total)`
        );
      }
      
      // Map and filter in pairs to keep arrays aligned
      const winning: number[][] = [];
      const machine: number[][] = [];
      const lotto_types: string[] = [];
      
      for (const draw of filtered) {
        if (!draw.winningNumbers || !Array.isArray(draw.winningNumbers) || draw.winningNumbers.length === 0) {
          logger.warn(`Draw ${draw.id || 'unknown'} has invalid winningNumbers, skipping`);
          continue;
        }
        if (!draw.machineNumbers || !Array.isArray(draw.machineNumbers) || draw.machineNumbers.length === 0) {
          logger.warn(`Draw ${draw.id || 'unknown'} has invalid machineNumbers, skipping`);
          continue;
        }
        winning.push([...draw.winningNumbers].sort((a, b) => a - b));
        machine.push([...draw.machineNumbers].sort((a, b) => a - b));
        lotto_types.push(draw.lottoType || '');
      }
      
      return {
        winning,
        machine,
        lotto_types,
        filteredCount: winning.length,
      };
    }
    
    // For other strategies, include all draws (machine numbers optional)
    const winning: number[][] = [];
    const machine: number[][] = [];
    const lotto_types: string[] = [];
    
    for (const draw of draws) {
      if (!draw.winningNumbers || !Array.isArray(draw.winningNumbers) || draw.winningNumbers.length === 0) {
        logger.warn(`Draw ${draw.id || 'unknown'} has invalid winningNumbers, skipping`);
        continue;
      }
      winning.push([...draw.winningNumbers].sort((a, b) => a - b));
      
      // Machine numbers: use zeros if missing or invalid
      if (!draw.machineNumbers || !Array.isArray(draw.machineNumbers) || draw.machineNumbers.length !== 5) {
        machine.push([0, 0, 0, 0, 0]);
      } else {
        machine.push([...draw.machineNumbers].sort((a, b) => a - b));
      }
      
      lotto_types.push(draw.lottoType || '');
    }
    
    return { winning, machine, lotto_types };
  }

  /**
   * Calculate adaptive timeout based on number of draws and strategy
   * More draws = more processing time needed
   * Ensemble strategy takes longer than single strategies
   */
  private calculateTimeout(drawCount: number, strategy: string): number {
    // Base timeout: 30 seconds for minimum 60 draws
    const baseTimeout = 30000; // 30 seconds
    
    // Additional time per draw above 60
    // Roughly 0.5 seconds per additional draw
    const additionalTimePerDraw = 500; // 0.5 seconds
    const drawsAboveMinimum = Math.max(0, drawCount - 60);
    const additionalTime = drawsAboveMinimum * additionalTimePerDraw;
    
    // Strategy multiplier
    // Ensemble uses multiple methods, so it takes longer
    const strategyMultiplier = strategy === 'ensemble' ? 1.5 : 1.0;
    
    // Calculate total timeout
    const calculatedTimeout = (baseTimeout + additionalTime) * strategyMultiplier;
    
    // Cap at maximum 5 minutes (300 seconds) to prevent extremely long waits
    const maxTimeout = 300000; // 5 minutes
    const minTimeout = 30000; // Minimum 30 seconds
    
    const timeout = Math.min(Math.max(calculatedTimeout, minTimeout), maxTimeout);
    
    logger.info(`Calculated timeout: ${timeout}ms for ${drawCount} draws with strategy: ${strategy}`);
    
    return timeout;
  }

  /**
   * Check if Python service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.pythonServiceUrl}/health`, {
        timeout: 5000,
      });
      const isHealthy = response.data.status === 'healthy';
      if (!isHealthy) {
        logger.warn(`Python service health check returned unhealthy status: ${JSON.stringify(response.data)}`);
      }
      return isHealthy;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          logger.error(`Python service connection refused at ${this.pythonServiceUrl}. Is the service running?`);
        } else if (error.code === 'ETIMEDOUT') {
          logger.error(`Python service timeout at ${this.pythonServiceUrl}. Service may be slow or unreachable.`);
        } else {
          logger.error(`Python service health check failed: ${error.message}`, {
            url: this.pythonServiceUrl,
            code: error.code,
            status: error.response?.status,
          });
        }
      } else {
        logger.error('Python service health check failed', error);
      }
      return false;
    }
  }

  /**
   * Generate predictions using the Python oracle service
   */
  async generatePredictions(
    draws: Draw[],
    strategy: 'ensemble' | 'ml' | 'genetic' | 'pattern' | 'intelligence' | 'yearly' | 'transfer' = 'ensemble',
    n_predictions: number = 3
  ): Promise<PredictionResponse> {
    try {
      // Check minimum data requirement
      if (draws.length < 60) {
        throw new Error(
          `Insufficient data: Need at least 60 draws for predictions. Got ${draws.length}`
        );
      }

      // Convert to Python format (filters for intelligence strategy)
      const converted = this.convertDrawsToPythonFormat(draws, strategy);
      let winning = converted.winning;
      let machine = converted.machine;
      let lotto_types = converted.lotto_types || [];
      const filteredCount = converted.filteredCount;

      // Validate that we have valid data after conversion
      if (!winning || !Array.isArray(winning) || winning.length === 0) {
        throw new Error(
          `No valid winning numbers found after conversion. ` +
          `Original draw count: ${draws.length}`
        );
      }

      // Check minimum data requirement after filtering (for intelligence strategy)
      if (strategy === 'intelligence' && filteredCount !== undefined && filteredCount < 50) {
        throw new Error(
          `Insufficient data with machine numbers: Need at least 50 draws with valid machine numbers. ` +
          `Found ${filteredCount} draws with machine numbers out of ${draws.length} total draws.`
        );
      }

      // Ensure machine array exists and matches winning array length (pad with zeros if needed)
      if (!machine || !Array.isArray(machine)) {
        logger.warn('Machine numbers array is missing or invalid, creating array of zeros');
        machine = Array(winning.length).fill(null).map(() => [0, 0, 0, 0, 0]);
      }
      
      if (machine.length !== winning.length) {
        logger.warn(
          `Machine numbers array length (${machine.length}) doesn't match winning numbers array length (${winning.length}). ` +
          `Padding with zeros.`
        );
        while (machine.length < winning.length) {
          machine.push([0, 0, 0, 0, 0]);
        }
        machine.splice(winning.length); // Truncate if longer
      }
      
      // Validate that all winning arrays have 5 numbers
      // Track original indices to maintain alignment with dates and lotto types
      const validWinning: number[][] = [];
      const validMachine: number[][] = [];
      const validLottoTypes: string[] = [];
      const validIndices: number[] = []; // Track which original indices were kept
      
      for (let i = 0; i < winning.length; i++) {
        // Safely check if winning[i] exists and is valid
        const winDraw = winning[i];
        if (winDraw && Array.isArray(winDraw) && winDraw.length === 5) {
          // Validate all numbers are in range
          if (winDraw.every(n => typeof n === 'number' && n >= 1 && n <= 90)) {
            validWinning.push(winDraw);
            // Ensure corresponding machine entry is valid - safely check bounds
            const machDraw = (i < machine.length && machine[i] !== undefined) ? machine[i] : undefined;
            if (machDraw && Array.isArray(machDraw) && machDraw.length === 5 && 
                machDraw.every(n => typeof n === 'number' && n >= 0 && n <= 90)) {
              validMachine.push(machDraw);
            } else {
              validMachine.push([0, 0, 0, 0, 0]);
            }
            // Track this index for date/lotto type extraction
            validIndices.push(i);
            // Add corresponding lotto type
            validLottoTypes.push(lotto_types[i] || '');
          } else {
            logger.warn(`Skipping winning draw at index ${i}: contains invalid numbers`);
          }
        } else {
          logger.warn(`Skipping invalid winning draw at index ${i}: ${winDraw ? `length=${winDraw.length || 0}` : 'missing'}`);
        }
      }
      
      winning = validWinning;
      machine = validMachine;
      lotto_types = validLottoTypes;
      
      // Final validation after cleanup
      if (winning.length === 0) {
        throw new Error(
          `No valid winning numbers found after validation. ` +
          `Original draw count: ${draws.length}`
        );
      }

      // Extract draw dates aligned with validated winning array
      // Since lotto_types is already aligned with winning (from conversion), 
      // extract dates in the same order from original draws
      const drawDates: string[] = [];
      
      // Extract dates from original draws in the order they were processed
      // Only include draws that have valid winning numbers (same filter as conversion)
      let processedCount = 0;
      for (const draw of draws) {
        if (processedCount >= winning.length) break;
        
        // Same validation as in convertDrawsToPythonFormat
        if (draw.winningNumbers && Array.isArray(draw.winningNumbers) && draw.winningNumbers.length === 5) {
          // Check if this draw's numbers match the current valid winning entry
          const drawNumbers = [...draw.winningNumbers].sort((a, b) => a - b);
          const currentWinning = winning[processedCount];
          
          // Match by comparing sorted arrays
          if (JSON.stringify(drawNumbers) === JSON.stringify(currentWinning)) {
            const date = typeof draw.drawDate === 'string' 
              ? draw.drawDate.split('T')[0]
              : String(draw.drawDate).split('T')[0];
            drawDates.push(date);
            processedCount++;
          }
        }
      }
      
      // Fallback: if alignment failed, extract in simple order
      if (drawDates.length !== winning.length) {
        drawDates.length = 0;
        let drawIndex = 0;
        for (const draw of draws) {
          if (draw.winningNumbers && Array.isArray(draw.winningNumbers) && draw.winningNumbers.length === 5) {
            if (drawIndex < winning.length) {
              const date = typeof draw.drawDate === 'string' 
                ? draw.drawDate.split('T')[0]
                : String(draw.drawDate).split('T')[0];
              drawDates.push(date);
              drawIndex++;
            }
          }
        }
      }

      // Call Python service
      const request: PredictionRequest = {
        draws: winning,
        machine_draws: machine, // Include machine numbers for intelligence engine
        draw_dates: (strategy === 'yearly' || strategy === 'transfer') ? drawDates : undefined, // Include dates for yearly and transfer strategies
        lotto_types: (strategy === 'yearly' || strategy === 'transfer') ? lotto_types : undefined, // Include lotto types for yearly and transfer strategies
        strategy,
        n_predictions,
      };

      logger.info(`Calling Python prediction service with ${draws.length} draws, strategy: ${strategy}`);

      // Calculate adaptive timeout based on number of draws and strategy
      const timeout = this.calculateTimeout(draws.length, strategy);

      const response = await axios.post<PredictionResponse>(
        `${this.pythonServiceUrl}/predict`,
        request,
        {
          timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data.success) {
        throw new Error('Prediction service returned unsuccessful response');
      }

      return response.data;
    } catch (error: any) {
      logger.error('Prediction generation failed', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Python service returned an error
          try {
            const errorData = error.response.data;
            let errorMessage = 'Prediction service error';
            
            if (typeof errorData === 'string') {
              errorMessage = errorData;
            } else if (typeof errorData === 'object' && errorData !== null) {
              // Safely access error properties
              if ('message' in errorData && typeof errorData.message === 'string') {
                errorMessage = errorData.message;
              } else if ('error' in errorData && typeof errorData.error === 'string') {
                errorMessage = errorData.error;
              } else if (Array.isArray(errorData)) {
                // Handle array responses - safely access first element
                if (errorData.length > 0 && errorData[0] !== undefined && errorData[0] !== null) {
                  errorMessage = String(errorData[0]);
                } else {
                  errorMessage = 'Prediction service returned an array error with no message';
                }
              }
            }
            
            throw new Error(errorMessage);
          } catch (err) {
            // If error extraction fails, use a generic message
            logger.error('Error extracting error message from Python service response', err);
            throw new Error('Prediction service returned an error. Please check the service logs.');
          }
        } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          // Request timed out
          const timeout = this.calculateTimeout(draws.length, strategy);
          throw new Error(
            `Prediction request timed out after ${Math.round(timeout / 1000)} seconds. ` +
            `With ${draws.length} draws, predictions may take longer. ` +
            `Try reducing the number of draws or using a simpler strategy.`
          );
        } else if (error.request) {
          // Request was made but no response
          throw new Error('Prediction service is not available. Please try again later.');
        }
      }

      throw error instanceof Error ? error : new Error('Unknown prediction error');
    }
  }

  /**
   * Analyze patterns without generating predictions
   */
  async analyzePatterns(draws: Draw[]): Promise<any> {
    try {
      if (draws.length < 50) {
        throw new Error(`Need at least 50 draws for analysis. Got ${draws.length}`);
      }

      const { winning } = this.convertDrawsToPythonFormat(draws);

      if (!winning || winning.length === 0) {
        throw new Error(`No valid winning numbers found after conversion. Original draw count: ${draws.length}`);
      }

      const response = await axios.post(
        `${this.pythonServiceUrl}/analyze`,
        { draws: winning },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('Pattern analysis failed', error);
      
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(
          error.response.data?.message || error.response.data?.error || 'Analysis failed'
        );
      }

      throw error instanceof Error ? error : new Error('Unknown analysis error');
    }
  }

  /**
   * Generate check-and-balance prediction based on past winning predictions
   * Analyzes which strategies have been most successful and uses the best one
   */
  async generateCheckAndBalancePrediction(
    draws: Draw[],
    lottoType?: string,
    limit: number = 100
  ): Promise<PredictionResponse> {
    try {
      logger.info('Generating check-and-balance prediction...');

      // Query winning predictions from database (matches >= 1)
      const winningPredictionsQuery = `
        SELECT 
          strategy,
          matches,
          predicted_numbers,
          lotto_type,
          created_at
        FROM prediction_history
        WHERE matches >= 1
          AND is_checked = TRUE
          ${lottoType ? `AND lotto_type = $1` : ''}
        ORDER BY created_at DESC
        LIMIT $${lottoType ? 2 : 1}
      `;

      const queryParams = lottoType ? [lottoType, limit] : [limit];
      const result = await pool.query(winningPredictionsQuery, queryParams);
      
      const winningPredictions = result.rows.map(row => ({
        strategy: row.strategy,
        matches: row.matches,
        predicted_numbers: row.predicted_numbers,
        lotto_type: row.lotto_type,
        created_at: row.created_at
      }));

      logger.info(`Found ${winningPredictions.length} winning predictions to analyze`);

      // If no winning predictions, return error - no fallback
      if (winningPredictions.length === 0) {
        logger.info('No winning predictions found - check-and-balance requires past wins/partials');
        throw new Error('NO_WINNING_PREDICTIONS');
      }

      // Analyze strategy performance locally to get recommended strategy
      let recommendedStrategy = 'ensemble';
      let strategyConfidence = 0;
      
      // Calculate strategy performance
      const strategyStats: Record<string, { wins: number; total: number; avgMatches: number }> = {};
      
      for (const pred of winningPredictions) {
        const strat = pred.strategy || 'unknown';
        if (!strategyStats[strat]) {
          strategyStats[strat] = { wins: 0, total: 0, avgMatches: 0 };
        }
        strategyStats[strat].wins += 1;
        strategyStats[strat].total += 1;
        strategyStats[strat].avgMatches += pred.matches || 0;
      }
      
      // Calculate scores
      const strategyScores: Record<string, number> = {};
      for (const [strat, stats] of Object.entries(strategyStats)) {
        const winRate = stats.wins / stats.total;
        const avgMatches = stats.avgMatches / stats.wins;
        strategyScores[strat] = winRate * 0.6 + (avgMatches / 5) * 0.4;
      }
      
      // Find best strategy
      const sorted = Object.entries(strategyScores).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        recommendedStrategy = sorted[0][0];
        strategyConfidence = sorted[0][1];
        if (sorted.length > 1) {
          strategyConfidence = sorted[0][1] - sorted[1][1]; // Difference from second best
        }
      }
      
      logger.info(`Recommended strategy: ${recommendedStrategy} (confidence: ${strategyConfidence.toFixed(2)})`);

      // Convert to Python format
      const converted = this.convertDrawsToPythonFormat(draws);
      let winning = converted.winning;
      let machine = converted.machine;
      let lotto_types = converted.lotto_types || [];

      // Validate draws
      const validWinning: number[][] = [];
      const validMachine: number[][] = [];
      const validLottoTypes: string[] = [];

      for (let i = 0; i < winning.length; i++) {
        const winDraw = winning[i];
        if (winDraw && Array.isArray(winDraw) && winDraw.length === 5) {
          if (winDraw.every(n => typeof n === 'number' && n >= 1 && n <= 90)) {
            validWinning.push(winDraw);
            const machDraw = (i < machine.length && machine[i] !== undefined) ? machine[i] : undefined;
            if (machDraw && Array.isArray(machDraw) && machDraw.length === 5 && 
                machDraw.every(n => typeof n === 'number' && n >= 0 && n <= 90)) {
              validMachine.push(machDraw);
            } else {
              validMachine.push([0, 0, 0, 0, 0]);
            }
            validLottoTypes.push(lotto_types[i] || '');
          }
        }
      }

      winning = validWinning;
      machine = validMachine;
      lotto_types = validLottoTypes;

      if (winning.length === 0) {
        throw new Error('No valid draws after validation');
      }

      // Extract draw dates and lotto types
      const drawDates: string[] = [];
      let drawIndex = 0;
      for (const draw of draws) {
        if (draw.winningNumbers && Array.isArray(draw.winningNumbers) && draw.winningNumbers.length === 5) {
          if (drawIndex < winning.length) {
            const date = typeof draw.drawDate === 'string' 
              ? draw.drawDate.split('T')[0]
              : String(draw.drawDate).split('T')[0];
            drawDates.push(date);
            drawIndex++;
          }
        }
      }

      // Generate prediction using recommended strategy
      logger.info(`Generating check-and-balance prediction using recommended strategy: ${recommendedStrategy}`);
      const predictions = await this.generatePredictions(draws, recommendedStrategy as any, 1);
      
      // Rename the prediction to check_balance
      if (recommendedStrategy in predictions.predictions) {
        predictions.predictions.check_balance = predictions.predictions[recommendedStrategy as keyof typeof predictions.predictions];
        delete predictions.predictions[recommendedStrategy as keyof typeof predictions.predictions];
      }
      
      // Add metadata about the recommended strategy
      (predictions as any).recommendedStrategy = recommendedStrategy;
      (predictions as any).strategyConfidence = strategyConfidence;
      (predictions as any).winningPredictionsAnalyzed = winningPredictions.length;

      logger.info('Check-and-balance prediction generated successfully');
      return predictions;

    } catch (error: any) {
      logger.error(`Check-and-balance prediction failed: ${error.message}`);
      
      // If no winning predictions, re-throw the error (no fallback)
      if (error.message === 'NO_WINNING_PREDICTIONS') {
        throw error;
      }
      
      // For other errors, still throw (no fallback)
      throw error;
    }
  }
}

export const predictionService = new PredictionService();

