import { Router } from 'express';
import { drawService } from '../services/drawService.js';
import { predictionService } from '../services/predictionService.js';
import { triggerManualCheck } from '../services/predictionScheduler.js';
import { requireAuth, requirePro, optionalAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import pool from '../database/db.js';

const router = Router();

/**
 * GET /api/predictions/health
 * Check if prediction service is available
 */
router.get('/health', async (req, res, next) => {
  try {
    const isHealthy = await predictionService.healthCheck();
    res.json({
      success: true,
      data: {
        available: isHealthy,
        message: isHealthy
          ? 'Prediction service is available'
          : 'Prediction service is not available',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/predictions/generate
 * Generate predictions (Pro users only)
 * 
 * Query params:
 * - strategy: 'ensemble' | 'ml' | 'genetic' | 'pattern' | 'intelligence' | 'yearly' | 'transfer' (default: 'ensemble')
 * - limit: number of historical draws to use (default: all)
 * - lottoType: filter by lotto type
 * - useTypeSpecificTable: 'true' to use type-specific table for better accuracy (default: 'false')
 */
router.post('/generate', requireAuth, requirePro, async (req, res, next) => {
  try {
    const { strategy = 'ensemble', limit, lottoType, useTypeSpecificTable } = req.query;
    const userId = req.user!.id;

    // Determine if we should use type-specific table
    const useTypeTable = useTypeSpecificTable === 'true' && lottoType;

    // Get historical draws
    const draws = await drawService.getDraws({
      lottoType: lottoType as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      useTypeSpecificTable: useTypeTable as boolean,
    });

    if (draws.length < 60) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient data',
        message: `Need at least 60 draws for predictions. Found ${draws.length} draws.`,
        minimum_required: 60,
      });
    }

    // Generate predictions
    const predictions = await predictionService.generatePredictions(
      draws,
      strategy as 'ensemble' | 'ml' | 'genetic' | 'pattern' | 'intelligence' | 'yearly' | 'transfer'
    );

    // Extract predicted numbers from the strategy-specific prediction set
    // For intelligence strategy, specifically look for 'intelligence' key
    let predictedNumbers: number[] = [];
    
    // Debug: Log the structure of predictions
    logger.debug(`Extracting predictions for strategy: ${strategy}`);
    logger.debug(`Available prediction keys: ${Object.keys(predictions.predictions).join(', ')}`);
    logger.debug(`Full predictions object: ${JSON.stringify(predictions.predictions, null, 2)}`);
    
    if (strategy === 'intelligence') {
      // For intelligence strategy, specifically look for 'intelligence' key
      if (predictions.predictions.intelligence) {
        logger.debug(`Found intelligence key in predictions`);
        logger.debug(`intelligence value: ${JSON.stringify(predictions.predictions.intelligence)}`);
        predictedNumbers = predictions.predictions.intelligence[0]?.numbers || [];
        logger.debug(`Extracted intelligence numbers: ${JSON.stringify(predictedNumbers)}`);
      } else {
        logger.warn(`Strategy is 'intelligence' but 'intelligence' key not found in predictions`);
      }
    } else {
      // For other strategies (including ensemble), use the strategy-specific key
      const strategyKey = strategy as keyof typeof predictions.predictions;
      if (predictions.predictions[strategyKey]) {
        logger.debug(`Found ${strategyKey} key in predictions`);
        predictedNumbers = predictions.predictions[strategyKey]?.[0]?.numbers || [];
        logger.debug(`Extracted ${strategyKey} numbers: ${JSON.stringify(predictedNumbers)}`);
      } else {
        // Fallback: use the first available prediction set
        logger.warn(`Strategy key '${strategyKey}' not found, using first available key`);
        const firstPredictionKey = Object.keys(predictions.predictions)[0];
        logger.debug(`Using first available key: ${firstPredictionKey}`);
        predictedNumbers = predictions.predictions[firstPredictionKey as keyof typeof predictions.predictions]?.[0]?.numbers || [];
      }
    }
    
    // Log for debugging
    if (predictedNumbers.length === 0) {
      logger.warn(`No predicted numbers extracted for strategy: ${strategy}. Available keys: ${Object.keys(predictions.predictions).join(', ')}`);
      logger.warn(`Full predictions structure: ${JSON.stringify(predictions, null, 2)}`);
    } else {
      logger.info(`Successfully extracted ${predictedNumbers.length} numbers for strategy: ${strategy}`);
    }

    // Auto-save to prediction history (optional, doesn't prevent manual saves)
    // Users can still manually save the same prediction if they want
    if (predictedNumbers.length === 5) {
      try {
        const result = await pool.query(
          `INSERT INTO prediction_history (
            user_id, strategy, prediction_data, lotto_type, 
            predicted_numbers, target_draw_date
           )
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, created_at`,
          [
            userId, 
            strategy, 
            JSON.stringify(predictions),
            lottoType as string || null,
            predictedNumbers,
            new Date().toISOString().split('T')[0] // Today's date as target
          ]
        );
        logger.info(`Auto-saved prediction for user ${userId}, prediction ID: ${result.rows[0].id}`);
      } catch (error: any) {
        // Log but don't fail the request - allow manual saves even if auto-save fails
        // This could be a duplicate or any other error, but we don't want to block the user
        if (error.code === '23505') {
          logger.debug(`Prediction already auto-saved, user can still save manually if needed`);
        } else {
          logger.warn('Failed to auto-save prediction history', error);
        }
      }
    } else {
      logger.warn(`Skipping auto-save: invalid prediction numbers (length: ${predictedNumbers.length})`);
    }

    res.json({
      success: true,
      data: predictions,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/predictions/analyze
 * Analyze patterns without generating predictions (Pro users only)
 * 
 * Query params:
 * - limit: number of historical draws to use (default: all)
 * - lottoType: filter by lotto type
 * - useTypeSpecificTable: 'true' to use type-specific table for better accuracy (default: 'false')
 */
router.post('/analyze', requireAuth, requirePro, async (req, res, next) => {
  try {
    const { limit, lottoType, useTypeSpecificTable } = req.query;

    // Determine if we should use type-specific table
    const useTypeTable = useTypeSpecificTable === 'true' && lottoType;

    const draws = await drawService.getDraws({
      lottoType: lottoType as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      useTypeSpecificTable: useTypeTable as boolean,
    });

    if (draws.length < 50) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient data',
        message: `Need at least 50 draws for analysis. Found ${draws.length} draws.`,
        minimum_required: 50,
      });
    }

    const analysis = await predictionService.analyzePatterns(draws);

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/predictions/:predictionId
 * Delete a saved prediction (authenticated users, can only delete their own)
 */
router.delete('/:predictionId', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const predictionId = req.params.predictionId;

    // Verify prediction belongs to user
    const predCheck = await pool.query(
      `SELECT id FROM prediction_history WHERE id = $1 AND user_id = $2`,
      [predictionId, userId]
    );

    if (predCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Prediction not found',
        message: 'Prediction does not exist or you do not have permission to delete it',
      });
    }

    // Delete the prediction
    await pool.query(
      `DELETE FROM prediction_history WHERE id = $1 AND user_id = $2`,
      [predictionId, userId]
    );

    res.json({
      success: true,
      message: 'Prediction deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/predictions/history
 * Get user's prediction history with win/loss status (authenticated users)
 */
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string, 10) || 20;

    const result = await pool.query(
      `SELECT 
        ph.id, 
        ph.strategy, 
        ph.prediction_data, 
        ph.lotto_type,
        ph.predicted_numbers,
        ph.target_draw_date,
        ph.matches,
        ph.is_checked,
        ph.checked_at,
        ph.created_at,
        d.id as actual_draw_id,
        d.draw_date as actual_draw_date,
        d.winning_numbers as actual_winning_numbers
       FROM prediction_history ph
       LEFT JOIN draws d ON ph.actual_draw_id = d.id
       WHERE ph.user_id = $1
       ORDER BY ph.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    // Format the response with win/loss indicators
    const formattedData = result.rows.map(row => ({
      id: row.id,
      strategy: row.strategy,
      predictionData: row.prediction_data,
      lottoType: row.lotto_type,
      predictedNumbers: row.predicted_numbers,
      targetDrawDate: row.target_draw_date,
      matches: row.matches || 0,
      isChecked: row.is_checked,
      checkedAt: row.checked_at,
      createdAt: row.created_at,
      actualDraw: row.actual_draw_id ? {
        id: row.actual_draw_id,
        drawDate: row.actual_draw_date,
        winningNumbers: row.actual_winning_numbers,
      } : null,
      // Win/loss indicator: 2+ matches is a "win", 1 match is "partial", 0 is "loss"
      status: row.is_checked 
        ? (row.matches >= 2 ? 'win' : row.matches >= 1 ? 'partial' : 'loss')
        : 'pending',
    }));

    res.json({
      success: true,
      data: formattedData,
      count: formattedData.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/predictions/save
 * Save a prediction manually (for future reference)
 * Accepts 2 numbers (two_sure), 3 numbers (three_direct), or 5 numbers (standard)
 */
router.post('/save', requireAuth, requirePro, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { numbers, strategy, lottoType, targetDrawDate } = req.body;

    // Accept 2 (two_sure), 3 (three_direct), or 5 (standard) numbers
    const validLengths = [2, 3, 5];
    if (!numbers || !Array.isArray(numbers) || !validLengths.includes(numbers.length)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prediction',
        message: 'Must provide 2, 3, or 5 numbers',
      });
    }

    // Validate numbers are in range 1-90
    if (!numbers.every(n => Number.isInteger(n) && n >= 1 && n <= 90)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid numbers',
        message: 'All numbers must be between 1 and 90',
      });
    }

    // Determine prediction type based on strategy or number count
    let predictionType = strategy || 'manual';
    if (numbers.length === 2 && !strategy) predictionType = 'two_sure';
    if (numbers.length === 3 && !strategy) predictionType = 'three_direct';

    const result = await pool.query(
      `INSERT INTO prediction_history (
        user_id, strategy, predicted_numbers, lotto_type, target_draw_date,
        prediction_data
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [
        userId,
        predictionType,
        numbers.sort((a, b) => a - b),
        lottoType || null,
        targetDrawDate || new Date().toISOString().split('T')[0],
        JSON.stringify({ manual: true, numbers, type: predictionType }),
      ]
    );

    res.json({
      success: true,
      data: {
        id: result.rows[0].id,
        numbers: numbers.sort((a, b) => a - b),
        createdAt: result.rows[0].created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/predictions/check/:predictionId
 * Manually check a prediction against a specific draw
 */
router.post('/check/:predictionId', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const predictionId = req.params.predictionId;
    const { drawId } = req.body;

    if (!drawId) {
      return res.status(400).json({
        success: false,
        error: 'Missing draw ID',
        message: 'Must provide drawId to check against',
      });
    }

    // Verify prediction belongs to user
    const predCheck = await pool.query(
      `SELECT id FROM prediction_history WHERE id = $1 AND user_id = $2`,
      [predictionId, userId]
    );

    if (predCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Prediction not found',
        message: 'Prediction does not exist or does not belong to you',
      });
    }

    // Check prediction against draw
    const result = await pool.query(
      `SELECT check_prediction_against_draw($1, $2) as matches`,
      [predictionId, drawId]
    );

    // Get updated prediction data
    const updated = await pool.query(
      `SELECT 
        ph.*,
        d.draw_date as actual_draw_date,
        d.winning_numbers as actual_winning_numbers
       FROM prediction_history ph
       LEFT JOIN draws d ON ph.actual_draw_id = d.id
       WHERE ph.id = $1`,
      [predictionId]
    );

    const row = updated.rows[0];
    const matches = result.rows[0].matches;

    res.json({
      success: true,
      data: {
        predictionId,
        matches,
        predictedNumbers: row.predicted_numbers,
        actualWinningNumbers: row.actual_winning_numbers,
        status: matches >= 2 ? 'win' : matches >= 1 ? 'partial' : 'loss',
        isChecked: row.is_checked,
        checkedAt: row.checked_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/predictions/subscription-status
 * Get current user's subscription status
 */
router.get('/subscription-status', optionalAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.json({
        success: true,
        data: {
          authenticated: false,
          tier: 'free',
          isPro: false,
        },
      });
    }

    res.json({
      success: true,
      data: {
        authenticated: true,
        tier: req.user.subscriptionTier,
        isPro: req.user.isPro,
        email: req.user.email,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/predictions/lotto-types
 * Get all available lotto types for prediction selection
 */
router.get('/lotto-types', async (req, res, next) => {
  try {
    const lottoTypes = await drawService.getAvailableLottoTypes();
    res.json({
      success: true,
      data: lottoTypes,
      count: lottoTypes.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/predictions/strategy-performance
 * Get strategy performance statistics based on actual draw dates (when predictions were checked)
 * Tracks matches by day, week, month, and year based on when the actual results came in
 */
router.get('/strategy-performance', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;

    // Get all checked predictions with their check dates (when actual draw happened)
    const result = await pool.query(
      `SELECT 
        ph.strategy,
        ph.matches,
        ph.checked_at,
        ph.created_at,
        d.draw_date
       FROM prediction_history ph
       LEFT JOIN draws d ON ph.actual_draw_id = d.id
       WHERE ph.user_id = $1
         AND ph.is_checked = TRUE
         AND ph.checked_at IS NOT NULL
       ORDER BY ph.checked_at DESC`,
      [userId]
    );

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Helper function to calculate performance for a time period
    const calculatePerformance = (startDate: Date) => {
      const strategyStats: Record<string, {
        totalMatches: number;
        totalPredictions: number;
        dailyMatches: Record<string, number>; // date -> matches
      }> = {};

      let totalMatches = 0;
      let totalPredictions = 0;
      const dailyMatches: Record<string, number> = {}; // Overall daily matches across all strategies

      for (const row of result.rows) {
        const checkedAt = row.checked_at ? new Date(row.checked_at) : null;
        if (!checkedAt || checkedAt < startDate) continue;

        const strategy = row.strategy || 'unknown';
        const matches = parseInt(row.matches, 10) || 0;
        
        // Get date string (YYYY-MM-DD) for daily tracking
        const dateKey = checkedAt.toISOString().split('T')[0];

        // Initialize strategy stats if needed
        if (!strategyStats[strategy]) {
          strategyStats[strategy] = {
            totalMatches: 0,
            totalPredictions: 0,
            dailyMatches: {},
          };
        }

        // Update strategy stats
        strategyStats[strategy].totalMatches += matches;
        strategyStats[strategy].totalPredictions += 1;
        strategyStats[strategy].dailyMatches[dateKey] = (strategyStats[strategy].dailyMatches[dateKey] || 0) + matches;

        // Update overall stats
        totalMatches += matches;
        totalPredictions += 1;
        dailyMatches[dateKey] = (dailyMatches[dateKey] || 0) + matches;
      }

      // Find best strategy (most total matches per strategy)
      let bestStrategy: string | null = null;
      let maxTotalMatches = 0;

      const strategyBreakdown: Record<string, {
        totalMatches: number;
        totalPredictions: number;
        averageMatches: number;
        dailyMatches: Record<string, number>;
      }> = {};

      // Build strategy breakdown and find best
      for (const [strategy, stats] of Object.entries(strategyStats)) {
        strategyBreakdown[strategy] = {
          totalMatches: stats.totalMatches,
          totalPredictions: stats.totalPredictions,
          averageMatches: stats.totalPredictions > 0 ? stats.totalMatches / stats.totalPredictions : 0,
          dailyMatches: stats.dailyMatches,
        };

        // Best strategy is the one with most total matches
        if (stats.totalMatches > maxTotalMatches) {
          maxTotalMatches = stats.totalMatches;
          bestStrategy = strategy;
        }
      }

      // Calculate totals across all strategies
      let totalMatchesAll = 0;
      let totalPredictionsAll = 0;
      for (const stats of Object.values(strategyStats)) {
        totalMatchesAll += stats.totalMatches;
        totalPredictionsAll += stats.totalPredictions;
      }

      return {
        bestStrategy,
        totalMatches: totalMatchesAll, // Total matches across all strategies
        totalPredictions: totalPredictionsAll, // Total predictions across all strategies
        averageMatches: totalPredictionsAll > 0 ? totalMatchesAll / totalPredictionsAll : 0,
        strategyBreakdown, // All strategies with their individual stats
        dailyMatches, // Matches per day in this period (overall)
        daysWithMatches: Object.keys(dailyMatches).length,
      };
    };

    const [week, month, year] = [
      calculatePerformance(weekAgo),
      calculatePerformance(monthAgo),
      calculatePerformance(yearAgo),
    ];

    res.json({
      success: true,
      data: {
        week,
        month,
        year,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/predictions/check-all
 * Manually trigger checking all pending predictions against draws
 * (Admin/Pro users can trigger this manually)
 */
router.post('/check-all', requireAuth, requirePro, async (req, res, next) => {
  try {
    logger.info(`Manual prediction check triggered by user ${req.user!.id}`);
    
    const result = await triggerManualCheck();
    
    res.json({
      success: true,
      data: {
        message: 'Prediction check completed',
        totalChecked: result.totalChecked,
        predictions: result.predictions.map(p => ({
          predictionId: p.predictionId,
          matches: p.matches,
          predictedNumbers: p.predictedNumbers,
          winningNumbers: p.winningNumbers,
          drawDate: p.drawDate,
          lottoType: p.lottoType,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/predictions/reset-checks
 * Reset only IMPROPERLY checked predictions back to unchecked status
 * 
 * Does NOT reset predictions that were properly checked within the correct timeframe:
 * - Checked within 24 hours after the target draw date
 * - Has a valid matches value (win/partial/loss)
 * 
 * (Pro users only)
 */
router.post('/reset-checks', requireAuth, requirePro, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const forceReset = req.query.force === 'true'; // Allow force reset if explicitly requested
    
    logger.info(`Resetting checked predictions for user ${userId} (force: ${forceReset})`);

    let result;
    
    if (forceReset) {
      // Force reset ALL checked predictions (only if explicitly requested)
      result = await pool.query(
        `UPDATE prediction_history
         SET is_checked = FALSE,
             checked_at = NULL,
             matches = NULL,
             actual_draw_id = NULL
         WHERE user_id = $1
           AND is_checked = TRUE
         RETURNING id`,
        [userId]
      );
    } else {
      // Only reset improperly checked predictions
      result = await pool.query(
        `UPDATE prediction_history
         SET is_checked = FALSE,
             checked_at = NULL,
             matches = NULL,
             actual_draw_id = NULL
         WHERE user_id = $1
           AND is_checked = TRUE
           AND (
             -- Reset if no matches value
             matches IS NULL
             -- Reset if checked more than 2 days after the draw date
             OR checked_at > (target_draw_date + INTERVAL '2 days')
             -- Reset if checked before the draw date
             OR checked_at < target_draw_date
           )
         RETURNING id`,
        [userId]
      );
    }

    const resetCount = result.rows.length;
    logger.info(`Reset ${resetCount} predictions for user ${userId}`);

    res.json({
      success: true,
      data: {
        message: resetCount > 0 
          ? `Reset ${resetCount} predictions to unchecked status`
          : 'All predictions are properly checked. Nothing to reset.',
        resetCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/predictions/reset-and-recheck
 * Reset ONLY improperly checked predictions and immediately re-check them
 * 
 * Properly checked predictions (that should NOT be reset):
 * - Predictions checked within 24 hours after the target draw date
 * - Predictions checked after 2 PM (for afternoon draws) or 9 PM (for evening draws)
 * 
 * Only resets predictions that:
 * - Were never properly checked (matches is NULL but is_checked is TRUE - shouldn't happen)
 * - Were checked more than 24 hours after the draw date
 * 
 * (Pro users only)
 */
router.post('/reset-and-recheck', requireAuth, requirePro, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    logger.info(`Reset and recheck triggered by user ${userId}`);
    
    // Only reset predictions that were NOT properly checked
    // A properly checked prediction:
    // - Has a valid matches value (0, 1, 2, 3, 4, or 5)
    // - Was checked within 24 hours after the target draw date
    const resetResult = await pool.query(
      `UPDATE prediction_history 
       SET is_checked = FALSE,
           checked_at = NULL,
           matches = NULL,
           actual_draw_id = NULL
       WHERE user_id = $1
         AND is_checked = TRUE
         AND (
           -- Reset if no matches value (shouldn't happen but safety check)
           matches IS NULL
           -- Reset if checked more than 2 days after the draw date (likely incorrect check)
           OR checked_at > (target_draw_date + INTERVAL '2 days')
           -- Reset if checked before the draw date (definitely wrong)
           OR checked_at < target_draw_date
         )
       RETURNING id`,
      [userId]
    );
    
    const resetCount = resetResult.rows.length;
    
    if (resetCount > 0) {
      logger.info(`Reset ${resetCount} improperly checked predictions for user ${userId}`);
    } else {
      logger.info(`No improperly checked predictions found for user ${userId}. All predictions are properly checked.`);
    }
    
    // Step 2: Run the check for any unchecked predictions
    const checkResult = await triggerManualCheck();
    
    res.json({
      success: true,
      data: {
        message: resetCount > 0 
          ? `Reset ${resetCount} improperly checked predictions and re-checked` 
          : `All predictions properly checked. Checked ${checkResult.totalChecked} pending predictions.`,
        resetCount,
        totalChecked: checkResult.totalChecked,
        predictions: checkResult.predictions.map(p => ({
          predictionId: p.predictionId,
          matches: p.matches,
          predictedNumbers: p.predictedNumbers,
          winningNumbers: p.winningNumbers,
          drawDate: p.drawDate,
          lottoType: p.lottoType,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/predictions/check-balance
 * Generate check-and-balance prediction based on past winning predictions
 * This analyzes which strategies have been most successful and uses the best one
 */
router.post('/check-balance', requireAuth, requirePro, async (req, res, next) => {
  try {
    const { limit, lottoType, useTypeSpecificTable } = req.query;
    const userId = req.user!.id;

    // Determine if we should use type-specific table
    const useTypeTable = useTypeSpecificTable === 'true' && lottoType;

    // Get historical draws
    const draws = await drawService.getDraws({
      lottoType: lottoType as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      useTypeSpecificTable: useTypeTable as boolean,
    });

    if (draws.length < 60) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient data',
        message: `Need at least 60 draws for predictions. Found ${draws.length} draws.`,
        minimum_required: 60,
      });
    }

    // Generate check-and-balance prediction
    let predictions;
    try {
      predictions = await predictionService.generateCheckAndBalancePrediction(
        draws,
        lottoType as string,
        limit ? parseInt(limit as string, 10) : 100
      );
    } catch (error: any) {
      // Handle case where no winning predictions exist
      if (error.message === 'NO_WINNING_PREDICTIONS') {
        return res.status(400).json({
          success: false,
          error: 'NO_WINNING_PREDICTIONS',
          message: 'Check-and-balance requires past winning or partial predictions to analyze. Please try other prediction strategies or check back later once you have some successful predictions.',
          code: 'NO_WINNING_PREDICTIONS',
        });
      }
      // Re-throw other errors
      throw error;
    }

    // Extract predicted numbers
    let predictedNumbers: number[] = [];
    if (predictions.predictions.check_balance) {
      predictedNumbers = predictions.predictions.check_balance[0]?.numbers || [];
    } else {
      // Fallback: use first available prediction
      const firstPredictionKey = Object.keys(predictions.predictions)[0];
      predictedNumbers = predictions.predictions[firstPredictionKey as keyof typeof predictions.predictions]?.[0]?.numbers || [];
    }

    if (predictedNumbers.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'No prediction generated',
        message: 'Check-and-balance prediction failed to generate valid numbers.',
      });
    }

    // Auto-save to prediction history
    try {
      const result = await pool.query(
        `INSERT INTO prediction_history (
          user_id, strategy, prediction_data, lotto_type, 
          predicted_numbers, target_draw_date
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [
          userId,
          'check_balance',
          JSON.stringify(predictions),
          lottoType as string || null,
          predictedNumbers,
          new Date().toISOString().split('T')[0]
        ]
      );
      logger.info(`Auto-saved check-and-balance prediction for user ${userId}, prediction ID: ${result.rows[0].id}`);
    } catch (error: any) {
      if (error.code !== '23505') {
        logger.warn('Failed to auto-save check-and-balance prediction history', error);
      }
    }

    res.json({
      success: true,
      data: {
        ...predictions,
        recommendedStrategy: (predictions as any).recommendedStrategy || 'ensemble',
        strategyConfidence: (predictions as any).strategyConfidence || 0,
        winningPredictionsAnalyzed: (predictions as any).winningPredictionsAnalyzed || 0,
      },
      predictedNumbers,
      strategy: 'check_balance',
      message: 'Check-and-balance prediction generated successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;

