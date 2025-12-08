/**
 * Script to identify and clean up duplicate draws caused by date format inconsistencies
 * 
 * This script finds draws that have the same lotto type and numbers but different date formats,
 * normalizes all dates, and removes duplicates.
 */

import pool from '../database/db.js';
import { parseAndNormalizeDate } from '../utils/dateParser.js';
import { logger } from '../utils/logger.js';

async function cleanupDuplicateDates() {
  try {
    logger.info('Starting duplicate date cleanup...');

    // First, find all draws and normalize their dates
    const allDraws = await pool.query(`
      SELECT id, draw_date, lotto_type, winning_numbers, machine_numbers
      FROM draws
      ORDER BY draw_date DESC
    `);

    logger.info(`Found ${allDraws.rows.length} draws to check`);

    // Group draws by normalized date, lotto type, and numbers
    const normalizedMap = new Map<string, string[]>(); // key: normalized key, value: array of IDs

    for (const draw of allDraws.rows) {
      const normalizedDate = parseAndNormalizeDate(draw.draw_date);
      const key = `${normalizedDate}|${draw.lotto_type}|${JSON.stringify(draw.winning_numbers)}|${JSON.stringify(draw.machine_numbers)}`;
      
      if (!normalizedMap.has(key)) {
        normalizedMap.set(key, []);
      }
      normalizedMap.get(key)!.push(draw.id);
    }

    // Find duplicates (same normalized key but different IDs)
    const duplicates: Array<{ ids: string[]; key: string }> = [];
    for (const [key, ids] of normalizedMap.entries()) {
      if (ids.length > 1) {
        duplicates.push({ ids, key });
      }
    }

    logger.info(`Found ${duplicates.length} sets of potential duplicates`);

    if (duplicates.length === 0) {
      logger.info('No duplicates found. All dates are already normalized.');
      return;
    }

    // Update all dates to normalized format
    let updated = 0;
    for (const draw of allDraws.rows) {
      const normalizedDate = parseAndNormalizeDate(draw.draw_date);
      if (draw.draw_date !== normalizedDate) {
        await pool.query(
          'UPDATE draws SET draw_date = $1 WHERE id = $2',
          [normalizedDate, draw.id]
        );
        updated++;
      }
    }

    logger.info(`Updated ${updated} dates to normalized format`);

    // Now remove duplicates (keep the first one, delete the rest)
    let deleted = 0;
    for (const { ids } of duplicates) {
      // Keep the first ID, delete the rest
      const idsToDelete = ids.slice(1);
      for (const id of idsToDelete) {
        await pool.query('DELETE FROM draws WHERE id = $1', [id]);
        deleted++;
      }
    }

    logger.info(`Deleted ${deleted} duplicate draws`);

    // Verify no duplicates remain
    const remainingDuplicates = await pool.query(`
      SELECT draw_date, lotto_type, winning_numbers, machine_numbers, COUNT(*) as count
      FROM draws
      GROUP BY draw_date, lotto_type, winning_numbers, machine_numbers
      HAVING COUNT(*) > 1
    `);

    if (remainingDuplicates.rows.length > 0) {
      logger.warn(`Warning: ${remainingDuplicates.rows.length} sets of duplicates still remain`);
      for (const dup of remainingDuplicates.rows) {
        logger.warn(`  - Date: ${dup.draw_date}, Lotto: ${dup.lotto_type}, Count: ${dup.count}`);
      }
    } else {
      logger.info('Successfully removed all duplicates!');
    }

  } catch (error) {
    logger.error('Error cleaning up duplicate dates:', error);
    throw error;
  }
}

// Run if executed directly
cleanupDuplicateDates()
  .then(() => {
    logger.info('Cleanup completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Cleanup failed:', error);
    process.exit(1);
  });

export { cleanupDuplicateDates };

