#!/usr/bin/env node
/**
 * Script to populate database with historical lottery data from theb2b.com
 * 
 * Usage:
 *   npm run populate
 *   npm run populate -- --start-page 1 --max-pages 10
 *   npm run populate -- --batch-size 50
 */

import { scraperService } from '../services/scraperService.js';
import { drawService } from '../services/drawService.js';
import { logger } from '../utils/logger.js';
// Import database to ensure connection pool is initialized
import '../database/db.js';

interface PopulateOptions {
  startPage?: number;
  maxPages?: number;
  batchSize?: number;
  delay?: number;
}

async function populateDatabase(options: PopulateOptions = {}): Promise<void> {
  const {
    startPage = 1,
    maxPages,
    batchSize = 100, // Number of draws per batch insert
    delay = 1000, // 1 second delay between page requests (handled by scraper)
  } = options;

  logger.info('🚀 Starting database population...');
  logger.info(`Start page: ${startPage}`);
  if (maxPages) {
    logger.info(`Max pages: ${maxPages}`);
  } else {
    logger.info('Max pages: unlimited (will scrape until no more results)');
  }
  logger.info(`Batch size: ${batchSize} draws per insert`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  try {
    logger.info('📥 Scraping draws from theb2b.com...');
    logger.info(`   Start page: ${startPage}, Max pages: ${maxPages || 'unlimited'}`);
    
    const allScrapedDraws = await scraperService.scrapeB2B(startPage, maxPages);

    logger.info(`\n✅ Scraping completed. Found ${allScrapedDraws.length} draw(s)`);

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

    logger.info('\n✅ Database population completed!');
    logger.info(`📊 Summary:`);
    logger.info(`   - Total draws scraped: ${allScrapedDraws.length}`);
    logger.info(`   - Draws inserted: ${totalInserted}`);
    logger.info(`   - Draws skipped (duplicates): ${totalSkipped}`);
    logger.info(`   - Errors: ${totalErrors}`);
  } catch (error) {
    logger.error('❌ Fatal error during population', error);
    process.exit(1);
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
      case '--delay':
        if (nextArg) {
          options.delay = parseInt(nextArg, 10);
          i++;
        }
        break;
      case '--help':
        console.log(`
Usage: npm run populate [options]

Options:
  --start-page PAGE     Starting page number (default: 1)
  --max-pages PAGES     Maximum number of pages to scrape (default: unlimited)
  --batch-size SIZE     Number of draws per batch insert (default: 100)
  --delay MS            Delay between page requests in milliseconds (default: 1000, handled by scraper)
  --help                Show this help message

Examples:
  npm run populate
  npm run populate -- --start-page 1 --max-pages 10
  npm run populate -- --max-pages 5 --batch-size 50
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

