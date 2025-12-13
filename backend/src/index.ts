import express from 'express';
import cors from 'cors';
import drawsRouter from './routes/draws.js';
import analyticsRouter from './routes/analytics.js';
import predictionsRouter from './routes/predictions.js';
import authRouter from './routes/auth.js';
import subscriptionsRouter from './routes/subscriptions.js';
import seoRouter from './routes/seo.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { AppError } from './utils/errors.js';

const app = express();

// Middleware
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));
// JSON body parser with error handling for "null" string
app.use(express.json({
  strict: false,
}));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`, { query: req.query, body: req.body });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// SEO Routes (must be before API routes to avoid conflicts)
app.use('/', seoRouter);

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/draws', drawsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/predictions', predictionsRouter);

// Error handling middleware
app.use((err: Error | AppError, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Handle JSON parse errors (e.g., when body is "null" string)
  if (err instanceof SyntaxError && 'body' in err && err.message.includes('JSON')) {
    logger.warn('JSON parse error, treating as empty body', err);
    req.body = {};
    return next();
  }

  if (err instanceof AppError) {
    logger.warn(`AppError: ${err.message}`, err);
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      details: config.nodeEnv === 'development' ? err.details : undefined,
    });
  }

  // Unknown errors
  logger.error('Unhandled error', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
  });
});

app.listen(config.port, () => {
  logger.info(`🚀 Server running on http://localhost:${config.port}`);
  logger.info(`📊 API available at http://localhost:${config.port}/api`);
  logger.info(`🌍 Environment: ${config.nodeEnv}`);
});

