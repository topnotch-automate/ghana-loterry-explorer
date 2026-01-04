/**
 * Prediction Scheduler Service
 * 
 * Automatically checks predictions against actual draws at scheduled times:
 * - 2:00 PM daily (after morning/midday draws)
 * - 9:00 PM daily (after evening draws)
 */

import pool from '../database/db.js';
import { logger } from '../utils/logger.js';

interface CheckResult {
  totalChecked: number;
  predictions: Array<{
    predictionId: string;
    userId: string;
    matches: number;
    predictedNumbers: number[];
    winningNumbers: number[];
    drawDate: string;
    lottoType: string;
  }>;
}

/**
 * Check all unchecked predictions against available draws
 */
export async function checkAllPendingPredictions(): Promise<CheckResult> {
  const startTime = Date.now();
  logger.info('Starting scheduled prediction check...');

  const result: CheckResult = {
    totalChecked: 0,
    predictions: [],
  };

  try {
    // Get all unchecked predictions with their target draw dates
    const uncheckedPredictions = await pool.query(
      `SELECT 
        ph.id,
        ph.user_id,
        ph.predicted_numbers,
        ph.target_draw_date,
        ph.lotto_type,
        ph.strategy
       FROM prediction_history ph
       WHERE ph.is_checked = FALSE
         AND ph.target_draw_date <= CURRENT_DATE
       ORDER BY ph.target_draw_date DESC`
    );

    logger.info(`Found ${uncheckedPredictions.rows.length} unchecked predictions to process`);

    for (const prediction of uncheckedPredictions.rows) {
      try {
        // Convert target_draw_date to proper date format
        let targetDate: string;
        if (prediction.target_draw_date instanceof Date) {
          targetDate = prediction.target_draw_date.toISOString().split('T')[0];
        } else if (typeof prediction.target_draw_date === 'string') {
          const parsed = new Date(prediction.target_draw_date);
          targetDate = !isNaN(parsed.getTime()) 
            ? parsed.toISOString().split('T')[0] 
            : prediction.target_draw_date;
        } else {
          targetDate = String(prediction.target_draw_date);
        }

        logger.debug(`Checking prediction ${prediction.id} - lotto_type: ${prediction.lotto_type || 'any'}, target_date: ${targetDate}`);

        let drawResult;

        // PRIMARY MATCHING LOGIC: Match by LOTTO TYPE first
        // Find the most recent draw of this lotto type that happened on or after the prediction date
        if (prediction.lotto_type) {
          // Find draw by lotto type - draw date should be >= prediction date (same day or next day)
          drawResult = await pool.query(
            `SELECT id, draw_date, winning_numbers, lotto_type
             FROM draws
             WHERE lotto_type = $1
               AND DATE(draw_date) >= DATE($2)
               AND DATE(draw_date) <= DATE($2) + INTERVAL '1 day'
             ORDER BY draw_date ASC
             LIMIT 1`,
            [prediction.lotto_type, targetDate]
          );

          if (drawResult.rows.length === 0) {
            // Try finding any draw of this lotto type from the prediction date onwards
            drawResult = await pool.query(
              `SELECT id, draw_date, winning_numbers, lotto_type
               FROM draws
               WHERE lotto_type = $1
                 AND DATE(draw_date) >= DATE($2)
               ORDER BY draw_date ASC
               LIMIT 1`,
              [prediction.lotto_type, targetDate]
            );
          }

          if (drawResult.rows.length === 0) {
            // Still no match - check if there's a draw of this type from before (for older predictions)
            drawResult = await pool.query(
              `SELECT id, draw_date, winning_numbers, lotto_type
               FROM draws
               WHERE lotto_type = $1
               ORDER BY draw_date DESC
               LIMIT 1`,
              [prediction.lotto_type]
            );
            
            if (drawResult.rows.length > 0) {
              const drawDate = drawResult.rows[0].draw_date instanceof Date 
                ? drawResult.rows[0].draw_date.toISOString().split('T')[0]
                : String(drawResult.rows[0].draw_date).split('T')[0];
              
              // Only use if the draw is from the same day or after the prediction
              const predDateObj = new Date(targetDate);
              const drawDateObj = new Date(drawDate);
              
              if (drawDateObj < predDateObj) {
                logger.info(`No draw yet for ${prediction.lotto_type} on or after ${targetDate}. Latest available: ${drawDate}`);
                drawResult = { rows: [] }; // Clear - no valid draw yet
              }
            }
          }
        } else {
          // No lotto type specified - find the most recent draw from the prediction date
          drawResult = await pool.query(
            `SELECT id, draw_date, winning_numbers, lotto_type
             FROM draws
             WHERE DATE(draw_date) >= DATE($1)
               AND DATE(draw_date) <= DATE($1) + INTERVAL '1 day'
             ORDER BY draw_date ASC
             LIMIT 1`,
            [targetDate]
          );
        }

        if (drawResult.rows.length === 0) {
          logger.info(`No matching draw for prediction ${prediction.id} (type: ${prediction.lotto_type || 'any'}, from: ${targetDate})`);
          continue;
        }

        const draw = drawResult.rows[0];
        const predictedNumbers: number[] = prediction.predicted_numbers;
        const winningNumbers: number[] = draw.winning_numbers;

        // Calculate matches
        const matches = predictedNumbers.filter(num => winningNumbers.includes(num)).length;

        // Update prediction with results
        await pool.query(
          `UPDATE prediction_history 
           SET is_checked = TRUE,
               checked_at = NOW(),
               matches = $1,
               actual_draw_id = $2
           WHERE id = $3`,
          [matches, draw.id, prediction.id]
        );

        result.totalChecked++;
        result.predictions.push({
          predictionId: prediction.id,
          userId: prediction.user_id,
          matches,
          predictedNumbers,
          winningNumbers,
          drawDate: draw.draw_date,
          lottoType: draw.lotto_type,
        });

        logger.info(`Checked prediction ${prediction.id}: ${matches} matches (${prediction.strategy})`);
      } catch (predError) {
        logger.error(`Error checking prediction ${prediction.id}:`, predError);
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`Prediction check completed: ${result.totalChecked} predictions checked in ${duration}ms`);

    return result;
  } catch (error) {
    logger.error('Error in scheduled prediction check:', error);
    throw error;
  }
}

/**
 * Check predictions for a specific draw (called when new draw is added)
 */
export async function checkPredictionsForDraw(drawId: string): Promise<CheckResult> {
  logger.info(`Checking predictions for draw ${drawId}...`);

  const result: CheckResult = {
    totalChecked: 0,
    predictions: [],
  };

  try {
    // Get the draw details
    const drawResult = await pool.query(
      `SELECT id, draw_date, winning_numbers, lotto_type FROM draws WHERE id = $1`,
      [drawId]
    );

    if (drawResult.rows.length === 0) {
      logger.warn(`Draw ${drawId} not found`);
      return result;
    }

    const draw = drawResult.rows[0];

    // Find all unchecked predictions for this draw date
    const predictions = await pool.query(
      `SELECT 
        ph.id,
        ph.user_id,
        ph.predicted_numbers,
        ph.strategy
       FROM prediction_history ph
       WHERE ph.is_checked = FALSE
         AND ph.target_draw_date = $1
         AND (ph.lotto_type IS NULL OR ph.lotto_type = $2)`,
      [draw.draw_date, draw.lotto_type]
    );

    for (const prediction of predictions.rows) {
      const predictedNumbers: number[] = prediction.predicted_numbers;
      const winningNumbers: number[] = draw.winning_numbers;
      const matches = predictedNumbers.filter(num => winningNumbers.includes(num)).length;

      await pool.query(
        `UPDATE prediction_history 
         SET is_checked = TRUE,
             checked_at = NOW(),
             matches = $1,
             actual_draw_id = $2
         WHERE id = $3`,
        [matches, draw.id, prediction.id]
      );

      result.totalChecked++;
      result.predictions.push({
        predictionId: prediction.id,
        userId: prediction.user_id,
        matches,
        predictedNumbers,
        winningNumbers,
        drawDate: draw.draw_date,
        lottoType: draw.lotto_type,
      });
    }

    logger.info(`Checked ${result.totalChecked} predictions for draw ${drawId}`);
    return result;
  } catch (error) {
    logger.error(`Error checking predictions for draw ${drawId}:`, error);
    throw error;
  }
}

// Scheduler state
let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Calculate milliseconds until next scheduled check time (2 PM or 9 PM)
 */
function getNextCheckTime(): { time: Date; delay: number } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Schedule times: 2 PM (14:00) and 9 PM (21:00)
  const check2pm = new Date(today.getTime() + 14 * 60 * 60 * 1000);
  const check9pm = new Date(today.getTime() + 21 * 60 * 60 * 1000);
  const tomorrow2pm = new Date(today.getTime() + 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000);

  let nextCheck: Date;
  
  if (now < check2pm) {
    nextCheck = check2pm;
  } else if (now < check9pm) {
    nextCheck = check9pm;
  } else {
    nextCheck = tomorrow2pm;
  }

  const delay = nextCheck.getTime() - now.getTime();
  
  return { time: nextCheck, delay };
}

/**
 * Run the scheduled check
 */
async function runScheduledCheck() {
  if (isRunning) {
    logger.debug('Scheduled check already running, skipping...');
    return;
  }

  isRunning = true;
  try {
    logger.info('=== Running scheduled prediction check ===');
    const result = await checkAllPendingPredictions();
    
    if (result.totalChecked > 0) {
      logger.info(`Scheduled check complete: ${result.totalChecked} predictions checked`);
      
      // Log summary of matches
      const matchSummary = result.predictions.reduce((acc, p) => {
        acc[p.matches] = (acc[p.matches] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      
      logger.info('Match summary:', matchSummary);
    } else {
      logger.info('Scheduled check complete: No pending predictions to check');
    }
  } catch (error) {
    logger.error('Scheduled check failed:', error);
  } finally {
    isRunning = false;
    
    // Schedule next check
    scheduleNextCheck();
  }
}

/**
 * Schedule the next check
 */
function scheduleNextCheck() {
  if (schedulerInterval) {
    clearTimeout(schedulerInterval);
  }

  const { time, delay } = getNextCheckTime();
  
  logger.info(`Next prediction check scheduled for: ${time.toLocaleString()} (in ${Math.round(delay / 1000 / 60)} minutes)`);
  
  schedulerInterval = setTimeout(() => {
    runScheduledCheck();
  }, delay);
}

/**
 * Start the prediction check scheduler
 */
export function startScheduler() {
  logger.info('Starting prediction check scheduler...');
  logger.info('Schedule: 2:00 PM and 9:00 PM daily');
  
  // Schedule the first check
  scheduleNextCheck();
  
  // Run an immediate check for any UNCHECKED predictions only
  // This does NOT reset already checked predictions
  setTimeout(async () => {
    logger.info('Running initial prediction check on startup (unchecked predictions only)...');
    try {
      const result = await checkAllPendingPredictions();
      if (result.totalChecked > 0) {
        logger.info(`Initial check complete: ${result.totalChecked} predictions checked`);
      } else {
        logger.info('Initial check complete: No pending predictions to check');
      }
    } catch (error) {
      logger.error('Initial prediction check failed:', error);
    }
  }, 5000); // Wait 5 seconds after startup
}

/**
 * Stop the scheduler
 */
export function stopScheduler() {
  if (schedulerInterval) {
    clearTimeout(schedulerInterval);
    schedulerInterval = null;
  }
  logger.info('Prediction check scheduler stopped');
}

/**
 * Manually trigger a prediction check (for testing or admin use)
 */
export async function triggerManualCheck(): Promise<CheckResult> {
  logger.info('Manual prediction check triggered');
  return checkAllPendingPredictions();
}

export default {
  startScheduler,
  stopScheduler,
  checkAllPendingPredictions,
  checkPredictionsForDraw,
  triggerManualCheck,
};
