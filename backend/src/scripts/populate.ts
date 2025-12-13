#!/usr/bin/env node
/**
 * Script to populate database with scraped data
 * 
 * If scraped data exists in file, uses that data.
 * Otherwise, scrapes new data and then populates.
 * 
 * Usage:
 *   npm run populate
 *   npm run populate -- --force-scrape (force new scrape instead of using saved data)
 *   npm run populate -- --batch-size 50
 */

import { scraperService } from '../services/scraperService.js';
import { drawService } from '../services/drawService.js';
import { logger } from '../utils/logger.js';
import { loadScrapedData, hasScrapedData, clearScrapedData } from '../utils/scrapedDataStorage.js';
import { loadScraperState, saveScraperState, getNextPage, resetScraperState } from '../utils/scraperState.js';
// Import database to ensure connection pool is initialized
import '../database/db.js';

interface PopulateOptions {
  startPage?: number;
  maxPages?: number;
  batchSize?: number;
  forceScrape?: boolean;
  reset?: boolean;
}

async function populateDatabase(options: PopulateOptions = {}): Promise<void> {
  const {
    startPage,
    maxPages,
    batchSize = 100,
    forceScrape = false,
    reset = false,
  } = options;

  // Reset state if requested
  if (reset) {
    await resetScraperState();
    await clearScrapedData();
    logger.info('🔄 Reset scraper state and cleared saved data - starting fresh');
  }

  logger.info('🚀 Starting database population...');

  let allScrapedDraws;
  let shouldSaveState = false;
  let lastPageProcessed = 0;

  // Check if we should use saved scraped data
  if (!forceScrape && await hasScrapedData()) {
    logger.info('📂 Found saved scraped data, loading from file...');
    allScrapedDraws = await loadScrapedData();
    
    if (allScrapedDraws.length === 0) {
      logger.warn('⚠️  Saved data file is empty. Will scrape new data.');
      allScrapedDraws = null;
    } else {
      logger.info(`✅ Loaded ${allScrapedDraws.length} draws from saved data`);
      logger.info('💡 To force a new scrape, use: npm run populate -- --force-scrape');
    }
  }

  // If no saved data or force scrape, scrape new data
  if (!allScrapedDraws || forceScrape) {
    if (forceScrape) {
      logger.info('🔄 Force scrape requested, scraping new data...');
    } else {
      logger.info('📥 No saved data found, scraping draws from theb2b.com...');
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

    logger.info(`Start page: ${actualStartPage}`);
    if (maxPages) {
      logger.info(`Max pages: ${maxPages}`);
    } else {
      logger.info('Max pages: unlimited (will scrape until no more results)');
    }

    const scrapeResult = await scraperService.scrapeB2B(actualStartPage, maxPages);
    allScrapedDraws = scrapeResult.draws;
    lastPageProcessed = scrapeResult.lastPage;
    shouldSaveState = true;

    logger.info(`\n✅ Scraping completed. Found ${allScrapedDraws.length} draw(s)`);
  }

  if (allScrapedDraws.length === 0) {
    logger.warn('⚠️  No draws found. Exiting.');
    return;
  }

  logger.info(`📦 Processing ${allScrapedDraws.length} draw(s) in batches of ${batchSize}...`);

  // Convert to CreateDrawInput format
  const allDraws = allScrapedDraws.map((draw) => {
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

  logger.info(`📋 Converted ${allDraws.length} draw(s) to database format (${allScrapedDraws.length - allDraws.length} failed conversion)`);

  // Verify database connection before inserting
  logger.info('🔌 Verifying database connection before insert...');
  try {
    await drawService.getDraws({ limit: 1 });
    logger.info('✅ Database connection verified');
  } catch (error) {
    logger.error('❌ Database connection failed! Cannot insert draws.', error);
    throw error;
  }

  logger.info(`Batch size: ${batchSize} draws per insert`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Process in batches
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
      
      // Log sample of inserted draws for verification
      if (result.inserted > 0 && batchNum === 1) {
        logger.info(`  📝 Sample inserted draw: ${batch[0].drawDate} ${batch[0].lottoType}`);
      }
    } catch (error) {
      logger.error(`  ❌ Error inserting batch ${batchNum}:`, error);
      if (error instanceof Error) {
        logger.error(`  Error message: ${error.message}`);
        if (error.stack) {
          logger.error(`  Error stack: ${error.stack.substring(0, 500)}`);
        }
      }
      totalErrors += batch.length;
    }
  }

  // Update scraper state if we scraped new data
  if (shouldSaveState && lastPageProcessed > 0) {
    const state = await loadScraperState();
    await saveScraperState({
      lastPage: lastPageProcessed,
      lastScrapeDate: new Date().toISOString(),
      totalScraped: state.totalScraped + allScrapedDraws.length,
    });
  }

  logger.info('\n✅ Database population completed!');
  logger.info(`📊 Summary:`);
  logger.info(`   - Total draws processed: ${allScrapedDraws.length}`);
  logger.info(`   - Draws inserted: ${totalInserted}`);
  logger.info(`   - Draws skipped (duplicates): ${totalSkipped}`);
  logger.info(`   - Errors: ${totalErrors}`);
  if (shouldSaveState && lastPageProcessed > 0) {
    logger.info(`   - Last page processed: ${lastPageProcessed}`);
    logger.info(`   - Next scrape will start from page: ${lastPageProcessed + 1}`);
  }
}

// Parse command line arguments
function parseArgs(): PopulateOptions {
  const args = process.argv.slice(2);
  const options: PopulateOptions = {};

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
      case '--force-scrape':
        options.forceScrape = true;
        break;
      case '--reset':
        options.reset = true;
        break;
      case '--help':
        console.log(`
Usage: npm run populate [options]

Options:
  --start-page PAGE     Starting page number (default: continue from last page)
  --max-pages PAGES     Maximum number of pages to scrape (default: unlimited)
  --batch-size SIZE     Number of draws per batch insert (default: 100)
  --force-scrape        Force new scrape instead of using saved data
  --reset               Reset state and start from page 1
  --help                Show this help message

Examples:
  npm run populate                          # Use saved scraped data if available
  npm run populate -- --force-scrape        # Force new scrape and populate
  npm run populate -- --max-pages 5         # Scrape 5 pages and populate
  npm run populate -- --reset              # Reset and start fresh
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
    // Validate database connection
    const options = parseArgs();
    
    logger.info('🔌 Testing database connection...');
    await drawService.getDraws({ limit: 1 });
    logger.info('✅ Database connection successful');

    await populateDatabase(options);
    logger.info('✅ Script completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Failed to populate database', error);
    process.exit(1);
  }
}

// Always run when script is executed
main().catch((error) => {
  logger.error('Unhandled error in populate script', error);
  process.exit(1);
});

