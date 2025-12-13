#!/usr/bin/env node
/**
 * Scraping script that scrapes data and populates the database
 * 
 * Usage:
 *   npm run scrape
 *   npm run scrape -- --start-page 1
 *   npm run scrape -- --max-pages 5
 *   npm run scrape -- --reset (start from page 1)
 */

import { scraperService } from '../services/scraperService.js';
import { drawService } from '../services/drawService.js';
import { logger } from '../utils/logger.js';
import { loadScraperState, saveScraperState, resetScraperState, getNextPage } from '../utils/scraperState.js';
import { saveScrapedData } from '../utils/scrapedDataStorage.js';
// Import database to ensure connection pool is initialized
import '../database/db.js';

interface ScrapeOptions {
  startPage?: number;
  maxPages?: number;
  reset?: boolean;
  batchSize?: number;
}

async function scrapeAndPopulate(options: ScrapeOptions = {}): Promise<void> {
  const {
    startPage,
    maxPages,
    reset = false,
    batchSize = 100,
  } = options;

  // Reset state if requested
  if (reset) {
    await resetScraperState();
    logger.info('🔄 Reset scraper state - starting from page 1');
  }

  // Determine start page
  let actualStartPage: number;
  if (startPage !== undefined) {
    actualStartPage = startPage;
    logger.info(`📄 Using provided start page: ${actualStartPage}`);
  } else {
    actualStartPage = await getNextPage();
    logger.info(`📄 Continuing from last page: ${actualStartPage}`);
  }

  logger.info('🔍 Starting scraper...');
  logger.info(`Start page: ${actualStartPage}`);
  if (maxPages) {
    logger.info(`Max pages: ${maxPages}`);
  } else {
    logger.info('Max pages: unlimited');
  }

  try {
    // Scrape data
    const { draws, lastPage } = await scraperService.scrapeB2B(actualStartPage, maxPages);

    logger.info(`\n✅ Scraping completed. Found ${draws.length} draw(s)\n`);
    
    if (draws.length === 0) {
      logger.warn('⚠️  No draws found. This could mean:');
      logger.warn('   1. The website structure has changed (selectors need updating)');
      logger.warn('   2. No draws exist on the requested pages');
      logger.warn('   3. The website requires authentication or has anti-bot protection');
      logger.warn('\n💡 Tip: Inspect the actual website HTML to update selectors in scraperService.ts');
      return;
    }

    // Save scraped data to file
    await saveScrapedData(draws);
    logger.info(`💾 Saved ${draws.length} draws to file`);

    // Convert to CreateDrawInput format
    const allDraws = draws.map((draw) => {
      try {
        return scraperService.toCreateDrawInput(draw);
      } catch (error) {
        logger.error(`Error converting draw to CreateDrawInput:`, { draw, error });
        return null;
      }
    }).filter((draw): draw is NonNullable<typeof draw> => draw !== null);

    if (allDraws.length === 0) {
      logger.warn('⚠️  No valid draws to insert after conversion. Exiting.');
      return;
    }

    logger.info(`📋 Converted ${allDraws.length} draw(s) to database format`);

    // Verify database connection
    logger.info('🔌 Verifying database connection...');
    try {
      await drawService.getDraws({ limit: 1 });
      logger.info('✅ Database connection verified');
    } catch (error) {
      logger.error('❌ Database connection failed! Cannot insert draws.', error);
      throw error;
    }

    // Insert draws in batches
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const lastPageProcessed = lastPage;

    logger.info(`📦 Processing ${allDraws.length} draw(s) in batches of ${batchSize}...`);

    for (let i = 0; i < allDraws.length; i += batchSize) {
      const batch = allDraws.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(allDraws.length / batchSize);

      logger.info(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} draws)...`);

      try {
        const result = await drawService.batchInsertDraws(batch);
        totalInserted += result.inserted;
        totalSkipped += result.skipped;
        totalErrors += result.errors;

        logger.info(`  ✅ Batch ${batchNum} complete: Inserted: ${result.inserted}, Skipped (duplicates): ${result.skipped}, Errors: ${result.errors}`);
        
        if (result.errors > 0) {
          logger.warn(`  ⚠️  Batch ${batchNum} had ${result.errors} error(s)`);
        }
      } catch (error) {
        logger.error(`  ❌ Error inserting batch ${batchNum}:`, error);
        totalErrors += batch.length;
      }
    }

    // Update scraper state
    await saveScraperState({
      lastPage: lastPageProcessed,
      lastScrapeDate: new Date().toISOString(),
      totalScraped: (await loadScraperState()).totalScraped + draws.length,
    });

    logger.info('\n✅ Scraping and population completed!');
    logger.info(`📊 Summary:`);
    logger.info(`   - Total draws scraped: ${draws.length}`);
    logger.info(`   - Draws inserted: ${totalInserted}`);
    logger.info(`   - Draws skipped (duplicates): ${totalSkipped}`);
    logger.info(`   - Errors: ${totalErrors}`);
    logger.info(`   - Last page processed: ${lastPageProcessed}`);
    logger.info(`   - Next scrape will start from page: ${lastPageProcessed + 1}`);
  } catch (error) {
    logger.error('❌ Scraping failed', error);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs(): ScrapeOptions {
  const args = process.argv.slice(2);
  const options: ScrapeOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--start-page':
        if (nextArg) {
          options.startPage = parseInt(nextArg, 10);
          i++;
        }
        break;
      case '--max-pages':
        if (nextArg) {
          options.maxPages = parseInt(nextArg, 10);
          i++;
        }
        break;
      case '--batch-size':
        if (nextArg) {
          options.batchSize = parseInt(nextArg, 10);
          i++;
        }
        break;
      case '--reset':
        options.reset = true;
        break;
      case '--help':
        console.log(`
Usage: npm run scrape [options]

Options:
  --start-page PAGE     Starting page number (default: continue from last page)
  --max-pages PAGES     Maximum number of pages to scrape (default: unlimited)
  --batch-size SIZE     Number of draws per batch insert (default: 100)
  --reset               Reset state and start from page 1
  --help                Show this help message

Examples:
  npm run scrape                          # Continue from last page
  npm run scrape -- --reset               # Start from page 1
  npm run scrape -- --max-pages 5         # Scrape 5 pages from last position
  npm run scrape -- --start-page 1 --max-pages 10
        `);
        process.exit(0);
        break;
    }
  }

  return options;
}

// Main execution
async function main(): Promise<void> {
  try {
    const options = parseArgs();
    await scrapeAndPopulate(options);
    process.exit(0);
  } catch (error) {
    logger.error('Fatal error in scrape script', error);
    process.exit(1);
  }
}

// Always run when script is executed
main().catch((error) => {
  logger.error('Unhandled error', error);
  process.exit(1);
});

