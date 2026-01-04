#!/usr/bin/env tsx
/**
 * Diagnostic script to check database connection, environment, and configuration
 * 
 * Usage:
 *   npm run diagnose
 *   or
 *   tsx src/scripts/diagnose.ts
 */

import pool from '../database/db.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function diagnose() {
  logger.info('🔍 Running diagnostics...\n');

  // Check environment variables
  logger.info('📋 Environment Configuration:');
  logger.info(`   NODE_ENV: ${config.nodeEnv}`);
  logger.info(`   DATABASE_URL: ${config.database.url ? '✅ Set' : '❌ Missing'}`);
  if (config.database.url) {
    // Mask password in URL
    const maskedUrl = config.database.url.replace(/:([^:@]+)@/, ':****@');
    logger.info(`   Database URL: ${maskedUrl}`);
  }
  logger.info(`   LOG_LEVEL: ${config.logging.level}`);
  logger.info('');

  // Check log directory
  const projectRoot = join(__dirname, '../../..');
  const logDir = join(projectRoot, 'backend', 'logs');
  logger.info('📁 Log Directory:');
  logger.info(`   Path: ${logDir}`);
  logger.info(`   Exists: ${existsSync(logDir) ? '✅ Yes' : '❌ No'}`);
  if (existsSync(logDir)) {
    const fs = await import('fs');
    const files = fs.readdirSync(logDir);
    logger.info(`   Files: ${files.length} log file(s)`);
    if (files.length > 0) {
      files.slice(0, 5).forEach(file => {
        logger.info(`     - ${file}`);
      });
    }
  }
  logger.info('');

  // Test database connection
  logger.info('🔌 Database Connection:');
  try {
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    logger.info('   ✅ Connection successful');
    logger.info(`   PostgreSQL Version: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}`);
    logger.info(`   Server Time: ${result.rows[0].current_time}`);
  } catch (error) {
    logger.error('   ❌ Connection failed', error);
    logger.info('');
    logger.info('   Troubleshooting:');
    logger.info('   1. Check if PostgreSQL is running');
    logger.info('   2. Verify DATABASE_URL in .env file');
    logger.info('   3. Check database credentials');
    return;
  }
  logger.info('');

  // Check if tables exist
  logger.info('📊 Database Tables:');
  try {
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    logger.info(`   Found ${tables.length} table(s):`);
    tables.forEach(table => {
      logger.info(`     - ${table}`);
    });

    // Check draws table specifically
    if (tables.includes('draws')) {
      const countResult = await pool.query('SELECT COUNT(*) as count FROM draws');
      const count = parseInt(countResult.rows[0].count, 10);
      logger.info(`   ✅ Draws table exists with ${count} record(s)`);
    } else {
      logger.warn('   ⚠️  Draws table does not exist. Run schema.sql to create it.');
    }

    // Check number_cooccurrence table structure
    if (tables.includes('number_cooccurrence')) {
      const columnsResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'number_cooccurrence' 
        ORDER BY ordinal_position
      `);
      const columns = columnsResult.rows.map(row => row.column_name);
      logger.info(`   ✅ number_cooccurrence table exists`);
      logger.info(`   Columns: ${columns.join(', ')}`);
      
      if (columns.includes('number3')) {
        logger.info('   ✅ Table structure is correct (triplets)');
      } else {
        logger.warn('   ⚠️  Table structure is outdated (pairs). Run migration to update.');
      }
    } else {
      logger.info('   ℹ️  number_cooccurrence table does not exist (will be created when needed)');
    }
  } catch (error) {
    logger.error('   ❌ Error checking tables', error);
  }
  logger.info('');

  // Test scraper service
  logger.info('🌐 Scraper Service Test:');
  try {
    const { scraperService } = await import('../services/scraperService.js');
    logger.info('   ✅ ScraperService loaded successfully');
    logger.info('   Testing fetch (first page only)...');
    
    const testResult = await scraperService.scrapeB2B(1, 1);
    const testDraws = testResult.draws;
    if (testDraws.length > 0) {
      logger.info(`   ✅ Successfully scraped ${testDraws.length} draw(s) from page 1`);
      logger.info(`   Sample draw: ${testDraws[0].drawDate} - ${testDraws[0].lottoType}`);
    } else {
      logger.warn('   ⚠️  No draws found on page 1. This could indicate:');
      logger.warn('      - Website structure changed');
      logger.warn('      - Network/connectivity issues');
      logger.warn('      - Website requires authentication');
    }
  } catch (error) {
    logger.error('   ❌ Scraper test failed', error);
  }
  logger.info('');

  logger.info('✅ Diagnostics complete!');
  logger.info('');
  logger.info('💡 Next steps:');
  logger.info('   1. If database connection failed, check your .env file');
  logger.info('   2. If tables are missing, run: psql -d your_db -f src/database/schema.sql');
  logger.info('   3. If scraper failed, check network connectivity and website status');
  logger.info('   4. Check log files in backend/logs/ for detailed error messages');
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  diagnose()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Fatal error in diagnostics', error);
      process.exit(1);
    });
}

export { diagnose };

