import { Router } from 'express';
import { analyticsService } from '../services/analyticsService.js';
import { validate, analyticsTimeframeSchema } from '../utils/validation.js';

const router = Router();

// GET /api/analytics/frequency - Get frequency statistics
router.get('/frequency', async (req, res, next) => {
  try {
    const {
      daily,
      weekly,
      monthly,
      yearly,
      days,
      lottoType,
    } = req.query;

    const timeframe = validate(analyticsTimeframeSchema, {
      daily: daily === 'true',
      weekly: weekly === 'true',
      monthly: monthly === 'true',
      yearly: yearly === 'true',
      days: days ? parseInt(days as string, 10) : undefined,
    });

    const stats = await analyticsService.getFrequencyStats(
      timeframe,
      lottoType as string
    );

    res.json({ success: true, data: stats, count: stats.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/hot - Get hot numbers
router.get('/hot', async (req, res, next) => {
  try {
    const { days = '30', lottoType } = req.query;
    const daysNum = parseInt(days as string, 10);
    if (isNaN(daysNum) || daysNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid days parameter',
      });
    }

    const hotNumbers = await analyticsService.getHotNumbers(
      daysNum,
      lottoType as string
    );

    res.json({ success: true, data: hotNumbers, count: hotNumbers.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/cold - Get cold numbers
router.get('/cold', async (req, res, next) => {
  try {
    const { days = '30', lottoType } = req.query;
    const daysNum = parseInt(days as string, 10);
    if (isNaN(daysNum) || daysNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid days parameter',
      });
    }

    const coldNumbers = await analyticsService.getColdNumbers(
      daysNum,
      lottoType as string
    );

    res.json({ success: true, data: coldNumbers, count: coldNumbers.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/sleeping - Get sleeping numbers
router.get('/sleeping', async (req, res, next) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string, 10);
    if (isNaN(daysNum) || daysNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid days parameter',
      });
    }

    const sleepingNumbers = await analyticsService.getSleepingNumbers(daysNum);

    res.json({ success: true, data: sleepingNumbers, count: sleepingNumbers.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/stats - Get general statistics
router.get('/stats', async (req, res, next) => {
  try {
    const { lottoType } = req.query;
    const [totalDraws, dateRange] = await Promise.all([
      analyticsService.getTotalDrawCount(lottoType as string),
      analyticsService.getDateRange(),
    ]);

    res.json({
      success: true,
      data: {
        totalDraws,
        dateRange,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/cooccurrence - Get co-occurrence triplets
router.get('/cooccurrence', async (req, res, next) => {
  try {
    const {
      limit = '50',
      minCount = '1',
      days,
      lottoType,
      number,
    } = req.query;

    const limitNum = parseInt(limit as string, 10);
    const minCountNum = parseInt(minCount as string, 10);
    const daysNum = days ? parseInt(days as string, 10) : undefined;
    const numberNum = number ? parseInt(number as string, 10) : undefined;

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 500) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit parameter (must be between 1 and 500)',
      });
    }

    if (isNaN(minCountNum) || minCountNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid minCount parameter',
      });
    }

    let triplets;
    if (numberNum && !isNaN(numberNum)) {
      // Get co-occurrence for a specific number
      triplets = await analyticsService.getCoOccurrenceForNumber(
        numberNum,
        limitNum,
        daysNum
      );
    } else {
      // Get top co-occurrence triplets
      triplets = await analyticsService.getCoOccurrenceTriplets(
        limitNum,
        minCountNum,
        daysNum,
        lottoType as string
      );
    }

    res.json({ success: true, data: triplets, count: triplets.length });
  } catch (error) {
    next(error);
  }
});

// POST /api/analytics/cooccurrence/update - Update co-occurrence cache
router.post('/cooccurrence/update', async (req, res, next) => {
  try {
    const { days, lottoType } = req.body;
    const daysNum = days ? parseInt(days as string, 10) : undefined;

    await analyticsService.updateCoOccurrenceTriplets(daysNum, lottoType as string);

    res.json({
      success: true,
      message: 'Co-occurrence triplets updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;

