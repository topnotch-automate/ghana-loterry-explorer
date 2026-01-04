#!/usr/bin/env tsx
/**
 * Scheduled Scraping Script
 * 
 * This script is designed to be run on a schedule (e.g., via cron or task scheduler)
 * to automatically scrape new lottery draws from theb2b.com
 * 
 * Usage:
 *   npm run scrape:scheduled
 *   or
 *   tsx src/scripts/scheduledScrape.ts [--max-pages N] [--dry-run]
 */

import { scraperService } from '../services/scraperService.js';
import { drawService } from '../services/drawService.js';
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

interface ScrapeResult {
  success: boolean;
  scraped: number;
  inserted: number;
  skipped: number;
  errors: number;
  duration: number;
  error?: string;
}

async function scheduledScrape(maxPages: number = 5, dryRun: boolean = false): Promise<ScrapeResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting scheduled scrape...', { maxPages, dryRun });

    if (dryRun) {
      logger.info('DRY RUN MODE: No data will be inserted');
    }

    // Scrape draws from theb2b.com
    const scrapeResult = await scraperService.scrapeB2B(1, maxPages);
    const scrapedDraws = scrapeResult.draws;

    logger.info(`Scraped ${scrapedDraws.length} draws from theb2b.com`);

    if (scrapedDraws.length === 0) {
      logger.warn('No draws were scraped. This might indicate an issue with the source or no new draws available.');
      return {
        success: true,
        scraped: 0,
        inserted: 0,
        skipped: 0,
        errors: 0,
        duration: Date.now() - startTime,
      };
    }

    if (dryRun) {
      logger.info('DRY RUN: Would insert the following draws:', scrapedDraws);
      return {
        success: true,
        scraped: scrapedDraws.length,
        inserted: 0,
        skipped: 0,
        errors: 0,
        duration: Date.now() - startTime,
      };
    }

    // Convert to CreateDrawInput format
    const drawInputs = scrapedDraws.map((draw) => scraperService.toCreateDrawInput(draw));

    // Batch insert draws
    const result = await drawService.batchInsertDraws(drawInputs);

    const duration = Date.now() - startTime;

    logger.info('Scheduled scrape completed', {
      scraped: scrapedDraws.length,
      inserted: result.inserted,
      skipped: result.skipped,
      errors: result.errors,
      duration: `${duration}ms`,
    });

    return {
      success: true,
      scraped: scrapedDraws.length,
      inserted: result.inserted,
      skipped: result.skipped,
      errors: result.errors,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Scheduled scrape failed', {
      error: errorMessage,
      duration: `${duration}ms`,
    });

    return {
      success: false,
      scraped: 0,
      inserted: 0,
      skipped: 0,
      errors: 1,
      duration,
      error: errorMessage,
    };
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const maxPagesArg = args.find(arg => arg.startsWith('--max-pages='));
  const maxPages = maxPagesArg ? parseInt(maxPagesArg.split('=')[1], 10) : 5;
  const dryRun = args.includes('--dry-run');

  scheduledScrape(maxPages, dryRun)
    .then((result) => {
      if (result.success) {
        process.exit(0);
      } else {
        logger.error('Scrape failed', result);
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error('Fatal error in scheduled scrape', error);
      process.exit(1);
    });
}

export { scheduledScrape };

