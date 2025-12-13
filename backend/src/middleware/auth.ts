import { Request, Response, NextFunction } from 'express';
import pool from '../database/db.js';
import { logger } from '../utils/logger.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt.js';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        subscriptionTier: 'free' | 'pro';
        isPro: boolean;
      };
    }
  }
}

/**
 * Middleware to check if user is authenticated
 * Uses JWT token from Authorization header
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      throw new UnauthorizedError('Authentication required. Please log in.');
    }

    // Verify token
    let payload;
    try {
      payload = verifyToken(token);
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired token. Please log in again.');
    }

    // Fetch user from database to get latest subscription status
    const result = await pool.query(
      `SELECT id, email, subscription_tier, subscription_expires_at
       FROM users
       WHERE id = $1`,
      [payload.userId]
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedError('User not found');
    }

    const user = result.rows[0];
    const isPro = user.subscription_tier === 'pro' &&
      (user.subscription_expires_at === null || new Date(user.subscription_expires_at) > new Date());

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      subscriptionTier: user.subscription_tier,
      isPro,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to check if user has Pro subscription
 */
export function requirePro(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (!req.user.isPro) {
    return next(
      new ForbiddenError(
        'Pro subscription required. Please upgrade to access advanced predictions.'
      )
    );
  }

  next();
}

/**
 * Optional auth - doesn't fail if no user, but attaches user if present
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (token) {
      try {
        const payload = verifyToken(token);
        
        const result = await pool.query(
          `SELECT id, email, subscription_tier, subscription_expires_at
           FROM users
           WHERE id = $1`,
          [payload.userId]
        );

        if (result.rows.length > 0) {
          const user = result.rows[0];
          const isPro = user.subscription_tier === 'pro' &&
            (user.subscription_expires_at === null || new Date(user.subscription_expires_at) > new Date());

          req.user = {
            id: user.id,
            email: user.email,
            subscriptionTier: user.subscription_tier,
            isPro,
          };
        }
      } catch (error) {
        // Token invalid/expired, but don't fail - just continue without user
        logger.debug('Optional auth token invalid', error);
      }
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors, just log
    logger.warn('Optional auth check failed', error);
    next();
  }
}

