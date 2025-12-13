import { promises as fs } from 'fs';
import path from 'path';
import { logger } from './logger.js';

// Store state file in backend directory
const STATE_FILE = path.resolve(process.cwd(), '.scraper-state.json');

export interface ScraperState {
  lastPage: number;
  lastScrapeDate: string;
  totalScraped: number;
}

const DEFAULT_STATE: ScraperState = {
  lastPage: 0,
  lastScrapeDate: '',
  totalScraped: 0,
};

/**
 * Load scraper state from file
 */
export async function loadScraperState(): Promise<ScraperState> {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf-8');
    const state = JSON.parse(data) as ScraperState;
    logger.info(`📂 Loaded scraper state: Last page = ${state.lastPage}, Total scraped = ${state.totalScraped}`);
    return state;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      logger.info('📂 No existing scraper state found, starting from page 1');
      return DEFAULT_STATE;
    }
    logger.warn('⚠️  Error loading scraper state, using defaults', error);
    return DEFAULT_STATE;
  }
}

/**
 * Save scraper state to file
 */
export async function saveScraperState(state: Partial<ScraperState>): Promise<void> {
  try {
    const currentState = await loadScraperState();
    const newState: ScraperState = {
      ...currentState,
      ...state,
    };
    
    // Ensure directory exists
    const dir = path.dirname(STATE_FILE);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(STATE_FILE, JSON.stringify(newState, null, 2), 'utf-8');
    logger.info(`💾 Saved scraper state: Last page = ${newState.lastPage}, Total scraped = ${newState.totalScraped}`);
  } catch (error) {
    logger.error('❌ Error saving scraper state', error);
    throw error;
  }
}

/**
 * Get the next page to scrape (last page + 1)
 */
export async function getNextPage(): Promise<number> {
  const state = await loadScraperState();
  return state.lastPage + 1;
}

/**
 * Reset scraper state (start from page 1)
 */
export async function resetScraperState(): Promise<void> {
  await saveScraperState(DEFAULT_STATE);
  logger.info('🔄 Scraper state reset to defaults');
}

