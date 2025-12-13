import { promises as fs } from 'fs';
import path from 'path';
import { logger } from './logger.js';
import type { ScrapedDraw } from '../services/scraperService.js';

// Store data file in backend directory
const DATA_FILE = path.resolve(process.cwd(), '.scraped-data.json');

/**
 * Save scraped draws to file
 */
export async function saveScrapedData(draws: ScrapedDraw[]): Promise<void> {
  try {
    const dir = path.dirname(DATA_FILE);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(
      DATA_FILE,
      JSON.stringify(draws, null, 2),
      'utf-8'
    );
    logger.info(`💾 Saved ${draws.length} scraped draws to file`);
  } catch (error) {
    logger.error('❌ Error saving scraped data', error);
    throw error;
  }
}

/**
 * Load scraped draws from file
 */
export async function loadScrapedData(): Promise<ScrapedDraw[]> {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    const draws = JSON.parse(data) as ScrapedDraw[];
    logger.info(`📂 Loaded ${draws.length} scraped draws from file`);
    return draws;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      logger.info('📂 No existing scraped data file found');
      return [];
    }
    logger.warn('⚠️  Error loading scraped data', error);
    return [];
  }
}

/**
 * Clear scraped data file
 */
export async function clearScrapedData(): Promise<void> {
  try {
    await fs.unlink(DATA_FILE);
    logger.info('🗑️  Cleared scraped data file');
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      logger.warn('⚠️  Error clearing scraped data', error);
    }
  }
}

/**
 * Check if scraped data exists
 */
export async function hasScrapedData(): Promise<boolean> {
  try {
    await fs.access(DATA_FILE);
    return true;
  } catch {
    return false;
  }
}

