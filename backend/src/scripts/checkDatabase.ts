import pool from '../database/db.js';
import { logger } from '../utils/logger.js';

async function checkDatabase() {
  try {
    logger.info('Checking database connection...');
    
    // Test connection
    const result = await pool.query('SELECT NOW() as current_time');
    logger.info('✅ Database connection successful');
    logger.info(`Current database time: ${result.rows[0].current_time}`);
    
    // Check if draws table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'draws'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      logger.error('❌ Draws table does not exist');
      logger.info('Run migrations to create tables: npm run migrate');
      process.exit(1);
    }
    
    logger.info('✅ Draws table exists');
    
    // Check draw count
    const countResult = await pool.query('SELECT COUNT(*) as count FROM draws');
    const count = parseInt(countResult.rows[0].count, 10);
    logger.info(`📊 Total draws in database: ${count}`);
    
    if (count === 0) {
      logger.warn('⚠️  Database is empty - no draws found');
      logger.info('Run scraper to populate data: npm run scrape');
      logger.info('Or import data: npm run populate');
    } else {
      // Get date range
      const dateRange = await pool.query(`
        SELECT 
          MIN(draw_date) as min_date,
          MAX(draw_date) as max_date
        FROM draws
      `);
      
      logger.info(`📅 Date range: ${dateRange.rows[0].min_date} to ${dateRange.rows[0].max_date}`);
      
      // Get latest draw
      const latest = await pool.query(`
        SELECT draw_date, lotto_type, winning_numbers
        FROM draws
        ORDER BY draw_date DESC
        LIMIT 1
      `);
      
      if (latest.rows.length > 0) {
        logger.info(`🎲 Latest draw: ${latest.rows[0].draw_date} (${latest.rows[0].lotto_type})`);
        logger.info(`   Numbers: ${latest.rows[0].winning_numbers.join(', ')}`);
      }
    }
    
    // Check users table
    const usersCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      )
    `);
    
    if (usersCheck.rows[0].exists) {
      const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
      logger.info(`👥 Total users: ${userCount.rows[0].count}`);
    }
    
    await pool.end();
    logger.info('✅ Database check complete');
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Database check failed:', error);
    logger.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });
    
    if (error.code === 'ECONNREFUSED') {
      logger.error('💡 PostgreSQL server is not running or not accessible');
      logger.info('Make sure PostgreSQL is running and DATABASE_URL is correct');
    } else if (error.code === '28P01') {
      logger.error('💡 Authentication failed - check username/password in DATABASE_URL');
    } else if (error.code === '3D000') {
      logger.error('💡 Database does not exist - create it first');
    }
    
    process.exit(1);
  }
}

checkDatabase();

