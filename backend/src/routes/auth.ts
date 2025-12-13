import { Router } from 'express';
import { z } from 'zod';
import pool from '../database/db.js';
import { logger } from '../utils/logger.js';
import { ValidationError, ConflictError, UnauthorizedError } from '../utils/errors.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../utils/password.js';
import { generateToken } from '../utils/jwt.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    
    // Validate password strength
    const passwordValidation = validatePasswordStrength(body.password);
    if (!passwordValidation.valid) {
      throw new ValidationError('Password does not meet requirements', passwordValidation.errors);
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [body.email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      throw new ConflictError('Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(body.password);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, subscription_tier)
       VALUES ($1, $2, $3, 'free')
       RETURNING id, email, name, subscription_tier, created_at`,
      [body.email.toLowerCase(), passwordHash, body.name || null]
    );

    const user = result.rows[0];

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      subscriptionTier: user.subscription_tier,
    });

    logger.info(`New user registered: ${user.email}`);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          subscriptionTier: user.subscription_tier,
        },
        token,
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
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);

    // Find user
    const result = await pool.query(
      `SELECT id, email, password_hash, name, subscription_tier, subscription_expires_at
       FROM users
       WHERE email = $1`,
      [body.email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await verifyPassword(body.password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      subscriptionTier: user.subscription_tier,
    });

    logger.info(`User logged in: ${user.email}`);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          subscriptionTier: user.subscription_tier,
          isPro: user.subscription_tier === 'pro' &&
            (user.subscription_expires_at === null || new Date(user.subscription_expires_at) > new Date()),
        },
        token,
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
 * GET /api/auth/me
 * Get current user info
 * Protected by requireAuth middleware
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new UnauthorizedError('Not authenticated');
    }

    const result = await pool.query(
      `SELECT id, email, name, subscription_tier, subscription_expires_at, created_at, last_login_at
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
        id: user.id,
        email: user.email,
        name: user.name,
        subscriptionTier: user.subscription_tier,
        isPro,
        subscriptionExpiresAt: user.subscription_expires_at,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

