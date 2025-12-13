import { Router } from 'express';
import { z } from 'zod';
import pool from '../database/db.js';
import { logger } from '../utils/logger.js';
import { ValidationError, UnauthorizedError } from '../utils/errors.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Validation schema
const subscriptionSchema = z.object({
  tier: z.enum(['free', 'pro']),
  expiresAt: z.string().datetime().optional(),
  paymentReference: z.string().optional(),
});

/**
 * POST /api/subscriptions/upgrade
 * Upgrade user to Pro subscription
 * In production, this would integrate with payment provider (Stripe, PayPal, etc.)
 */
router.post('/upgrade', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const body = subscriptionSchema.parse(req.body);

    // For now, we'll create a simple upgrade
    // In production, verify payment with payment provider first
    const expiresAt = body.expiresAt 
      ? new Date(body.expiresAt)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    // Update user subscription
    await pool.query(
      `UPDATE users 
       SET subscription_tier = $1, 
           subscription_expires_at = $2,
           updated_at = NOW()
       WHERE id = $3`,
      ['pro', expiresAt, userId]
    );

    // Record in subscription history
    await pool.query(
      `INSERT INTO subscription_history (user_id, tier, expires_at, payment_reference)
       VALUES ($1, $2, $3, $4)`,
      [userId, 'pro', expiresAt, body.paymentReference || null]
    );

    logger.info(`User ${userId} upgraded to Pro subscription`);

    res.json({
      success: true,
      data: {
        message: 'Subscription upgraded successfully',
        tier: 'pro',
        expiresAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(new ValidationError('Validation failed', error.errors));
    }
    next(error);
  }
});

/**
 * GET /api/subscriptions/status
 * Get user's subscription status
 */
router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;

    const result = await pool.query(
      `SELECT subscription_tier, subscription_expires_at, created_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedError('User not found');
    }

    const user = result.rows[0];
    const isPro = user.subscription_tier === 'pro' &&
      (user.subscription_expires_at === null || new Date(user.subscription_expires_at) > new Date());

    res.json({
      success: true,
      data: {
        tier: user.subscription_tier,
        isPro,
        expiresAt: user.subscription_expires_at,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/subscriptions/history
 * Get user's subscription history
 */
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;

    const result = await pool.query(
      `SELECT tier, started_at, expires_at, payment_reference, created_at
       FROM subscription_history
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

