#!/usr/bin/env node
/**
 * Quick scraping script to test and preview scraped data
 * 
 * Usage:
 *   npm run scrape
 *   npm run scrape -- --start-page 1
 *   npm run scrape -- --max-pages 5
 */

import { scraperService } from '../services/scraperService.js';
import { logger } from '../utils/logger.js';

interface ScrapeOptions {
  startPage?: number;
  maxPages?: number;
}

async function testScrape(options: ScrapeOptions = {}): Promise<void> {
  const { startPage = 1, maxPages } = options;

  logger.info('🔍 Testing scraper...');
  logger.info(`Start page: ${startPage}`);
  if (maxPages) {
    logger.info(`Max pages: ${maxPages}`);
  } else {
    logger.info('Max pages: unlimited');
  }

  try {
    const draws = await scraperService.scrapeB2B(startPage || 1, maxPages);

    logger.info(`\n✅ Found ${draws.length} draw(s):\n`);
    
    if (draws.length === 0) {
      logger.warn('⚠️  No draws found. This could mean:');
      logger.warn('   1. The website structure has changed (selectors need updating)');
      logger.warn('   2. No draws exist on the requested pages');
      logger.warn('   3. The website requires authentication or has anti-bot protection');
      logger.warn('\n💡 Tip: Inspect the actual website HTML to update selectors in scraperService.ts');
    } else {
      // Show first 10 draws as preview
      const previewCount = Math.min(10, draws.length);
      draws.slice(0, previewCount).forEach((draw, index) => {
        console.log(`\n📋 Draw ${index + 1}:`);
        console.log(`   Date: ${draw.drawDate}`);
        console.log(`   Type: ${draw.lottoType}`);
        console.log(`   Winning Numbers: ${draw.winningNumbers.join(', ')}`);
        console.log(`   Machine Numbers: ${draw.machineNumbers.join(', ')}`);
        console.log(`   Source: ${draw.source}`);
        if (draw.metadata) {
          console.log(`   Metadata: ${JSON.stringify(draw.metadata, null, 2)}`);
        }
      });
      
      if (draws.length > previewCount) {
        console.log(`\n... and ${draws.length - previewCount} more draw(s)`);
      }
    }
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
      case '--help':
        console.log(`
Usage: npm run scrape [options]

Options:
  --start-page PAGE     Starting page number (default: 1)
  --max-pages PAGES     Maximum number of pages to scrape (default: unlimited)
  --help                Show this help message

Examples:
  npm run scrape
  npm run scrape -- --start-page 1 --max-pages 5
  npm run scrape -- --max-pages 10
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
    await testScrape(options);
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

