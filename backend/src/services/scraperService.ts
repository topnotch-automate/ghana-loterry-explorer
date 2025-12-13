import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger.js';
import { parseAndNormalizeDate } from '../utils/dateParser.js';
import type { CreateDrawInput } from '../types/index.js';

export interface ScrapedDraw {
  drawDate: string;
  lottoType: string;
  winningNumbers: number[];
  machineNumbers: number[];
  source: string;
  metadata?: Record<string, unknown>;
}

export class ScraperService {
  private readonly requestDelay = 2000; // 2 second delay between requests (increased to avoid rate limiting)
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  private readonly baseUrl = 'https://www.theb2blotto.com/ajax/get_latest_results.php';
  private readonly timeout = 30000; // 30 seconds

  /**
   * Rate limiting helper
   */
  private async delay(ms: number = this.requestDelay): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch HTML content from theb2b.com AJAX endpoint
   */
  private async fetchPage(page: number): Promise<string | null> {
    try {
      // Construct URL with query parameter explicitly
      const url = `${this.baseUrl}?pn=${page}`;
      logger.info(`Fetching page ${page}: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Referer': 'https://www.theb2blotto.com/',
          'Origin': 'https://www.theb2blotto.com',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        timeout: this.timeout,
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors, we'll handle them
      });
      
      // Check response status
      if (response.status !== 200) {
        logger.warn(`Page ${page}: Received status ${response.status} ${response.statusText}`);
        return null;
      }

      if (!response.data) {
        logger.warn(`Page ${page}: Empty response received`);
        return null;
      }
      
      const htmlString = String(response.data);
      logger.info(`Page ${page}: Received ${htmlString.length} characters, status: ${response.status}`);
      
      // Check if response looks like HTML
      if (!htmlString.includes('<') || !htmlString.includes('>')) {
        logger.warn(`Page ${page}: Response doesn't look like HTML. Preview: ${htmlString.substring(0, 200)}`);
        return null;
      }

      // Check for common anti-bot indicators
      if (htmlString.includes('captcha') || htmlString.includes('robot') || htmlString.includes('blocked') || 
          htmlString.includes('access denied') || htmlString.toLowerCase().includes('cloudflare')) {
        logger.error(`Page ${page}: Possible anti-bot protection detected in response`);
        logger.debug(`Page ${page}: Response preview: ${htmlString.substring(0, 500)}`);
        return null;
      }

      // Check if we have the expected table structure
      if (!htmlString.includes('latestResults') && !htmlString.includes('<table') && !htmlString.includes('<tr')) {
        logger.warn(`Page ${page}: Response doesn't contain expected table structure`);
        logger.debug(`Page ${page}: Response preview: ${htmlString.substring(0, 500)}`);
        return null;
      }

      logger.debug(`Page ${page}: Response preview (first 300 chars): ${htmlString.substring(0, 300)}`);
      return htmlString;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const actualUrl = error.config?.url || error.request?.responseURL || 'unknown';
        logger.error(`Failed to fetch page ${page}`, {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: actualUrl,
          requestedUrl: `${this.baseUrl}?pn=${page}`,
        });
      } else {
        logger.error(`Failed to fetch page ${page}`, error);
      }
      return null;
    }
  }

  /**
   * Parse a table row into a ScrapedDraw object
   * HTML structure:
   * <tr>
   *   <td class="price"> - contains <span class="name">lottery type</span>
   *   <td class="date"> - contains <span>date</span> (format: d-M-yyyy)
   *   <td class="number"> - contains:
   *     <ul class="lottery-number-list lottery-number-list2"> - winning numbers
   *     <ul class="lottery-number-list lottery-number-list2 machine-numbers"> - machine numbers (optional)
   */
  private parseDrawRow(row: cheerio.Element, $: cheerio.CheerioAPI): ScrapedDraw | null {
    try {
      const $row = $(row);
      
      // Skip pagination rows (they have pagination elements)
      if ($row.find('.pagination').length > 0) {
        return null;
      }

      const cols = $row.find('td');
      if (cols.length < 3) {
        return null;
      }

      // Extract lotto type from first column
      const nameSpan = $(cols[0]).find('span.name');
      if (nameSpan.length === 0) {
        return null;
      }
      const lottoType = nameSpan.text().trim();
      if (!lottoType) {
        return null;
      }

      // Extract draw date from second column (just <span>, not <span.date>)
      const dateTd = $(cols[1]);
      const dateSpan = dateTd.find('span').first();
      if (dateSpan.length === 0) {
        return null;
      }
      const drawDate = dateSpan.text().trim();
      if (!drawDate) {
        return null;
      }

      // Extract winning numbers from third column
      // Winning numbers are in <ul class="lottery-number-list lottery-number-list2"> (without machine-numbers class)
      const numberTd = $(cols[2]);
      // Find ul with lottery-number-list but NOT machine-numbers (more explicit selector)
      const winningUl = numberTd.find('ul.lottery-number-list:not(.machine-numbers)');
      const winningNumbers: number[] = [];
      if (winningUl.length > 0) {
        winningUl.find('li').each((_, li) => {
          const text = $(li).text().trim();
          if (text && /^\d+$/.test(text)) {
            const num = parseInt(text, 10);
            if (!isNaN(num) && num >= 1 && num <= 90) {
              winningNumbers.push(num);
            }
          }
        });
      }

      // Extract machine numbers from third column
      // Machine numbers are in <ul class="lottery-number-list lottery-number-list2 machine-numbers">
      const machineUl = numberTd.find('ul.machine-numbers');
      const machineNumbers: number[] = [];
      if (machineUl.length > 0) {
        machineUl.find('li').each((_, li) => {
          const text = $(li).text().trim();
          if (text && /^\d+$/.test(text)) {
            const num = parseInt(text, 10);
            if (!isNaN(num) && num >= 1 && num <= 90) {
              machineNumbers.push(num);
            }
          }
        });
      }

      // Validate that we have meaningful data (at least winning numbers)
      if (winningNumbers.length === 0) {
        logger.debug(`Skipping row: No winning numbers found for ${lottoType} on ${drawDate}`);
        return null;
      }

      // Some draws may not have machine numbers, which is okay
      // But we need at least winning numbers

      return {
        drawDate: this.parseDate(drawDate),
        lottoType,
        winningNumbers,
        machineNumbers,
        source: 'theb2b.com',
        metadata: {
          scrapedAt: new Date().toISOString(),
          originalDate: drawDate,
        },
      };
    } catch (error) {
      logger.warn('Error parsing draw row', error);
      return null;
    }
  }

  /**
   * Scrape theb2b.com lottery results using pagination
   * This matches the Python scraper.py implementation
   * Returns draws and the last page processed
   */
  async scrapeB2B(startPage: number = 1, maxPages?: number): Promise<{ draws: ScrapedDraw[]; lastPage: number }> {
    const draws: ScrapedDraw[] = [];
    let page = startPage;
    let consecutiveEmptyPages = 0;
    const maxEmptyPages = 5; // Stop after 5 consecutive empty pages
    let lastSuccessfulPage = startPage - 1; // Track last page that had data

    logger.info(`Starting scrape from page ${startPage}...`);

    try {
      while (true) {
        // Check maxPages limit at the start of each iteration
        // If maxPages=3 and startPage=1, we want to process pages 1, 2, 3
        // So we break when page > 1+3-1 = 3, meaning after processing page 3, page becomes 4, then we break
        if (maxPages && page > startPage + maxPages - 1) {
          logger.info(`Reached maximum page limit (${maxPages} pages from page ${startPage}). Current page: ${page}`);
          break;
        }

        logger.info(`Fetching page ${page}...`);
        const html = await this.fetchPage(page);

        if (!html) {
          consecutiveEmptyPages++;
          if (consecutiveEmptyPages >= maxEmptyPages) {
            logger.info('Too many consecutive errors. Stopping.');
            break;
          }
          // Check maxPages before incrementing
          // If we've already processed maxPages pages, stop
          const pagesProcessed = page - startPage + 1;
          if (maxPages && pagesProcessed >= maxPages) {
            logger.info(`Reached maximum page limit (${maxPages} pages from page ${startPage}) after empty page. Current page: ${page}, Pages processed: ${pagesProcessed}`);
            break;
          }
          page++;
          await this.delay();
          continue;
        }

        // The response is just raw <tr> elements, not wrapped in a table/tbody
        // We need to wrap it in a container for cheerio to parse it properly
        const wrappedHtml = `<table><tbody>${html}</tbody></table>`;
        const $ = cheerio.load(wrappedHtml);
        
        // Now find all tr elements (they're direct children of tbody in our wrapped HTML)
        let rows = $('tbody tr').toArray();
        logger.debug(`Page ${page}: Found ${rows.length} row(s) in wrapped HTML`);

        // Log HTML structure for debugging
        if (rows.length === 0) {
          const hasTr = html.includes('<tr');
          const hasTd = html.includes('<td');
          const hasName = html.includes('span class="name"') || html.includes("span class='name'");
          logger.warn(`Page ${page}: No rows found. HTML structure check:`, {
            hasTr,
            hasTd,
            hasName,
            htmlLength: html.length,
          });
          
          // Save a sample of the HTML for inspection
          logger.debug(`Page ${page}: Full HTML (first 1000 chars): ${html.substring(0, 1000)}`);
        }

        logger.info(`Page ${page}: Found ${rows.length} table row(s) in HTML`);

        if (rows.length === 0) {
          logger.warn(`Page ${page}: No table rows found in HTML`);
          logger.debug(`Page ${page}: HTML preview: ${String(html).substring(0, 500)}`);
          consecutiveEmptyPages++;
          if (consecutiveEmptyPages >= maxEmptyPages) {
            logger.info('No more results found. Stopping.');
            break;
          }
          // Check maxPages before incrementing
          // If we've already processed maxPages pages, stop
          const pagesProcessed = page - startPage + 1;
          if (maxPages && pagesProcessed >= maxPages) {
            logger.info(`Reached maximum page limit (${maxPages} pages from page ${startPage}) after empty page. Current page: ${page}, Pages processed: ${pagesProcessed}`);
            break;
          }
          page++;
          await this.delay();
          continue;
        }

        // Reset consecutive empty pages counter
        consecutiveEmptyPages = 0;

        let pageDraws = 0;
        let parseErrors = 0;
        for (const row of rows) {
          const draw = this.parseDrawRow(row, $);
          if (draw) {
            draws.push(draw);
            pageDraws++;
          } else {
            parseErrors++;
          }
        }
        
        if (parseErrors > 0 && pageDraws === 0) {
          logger.warn(`Page ${page}: Could not parse any draws from ${rows.length} row(s). This might indicate the HTML structure has changed.`);
        }

        if (pageDraws > 0) {
          logger.info(`  ✓ Found ${pageDraws} draw(s) on page ${page} (Total: ${draws.length})`);
          lastSuccessfulPage = page; // Update last successful page
        } else {
          logger.info(`  - No valid draws on page ${page} (Total: ${draws.length})`);
        }

        // Check maxPages before incrementing
        // After processing page N, if N >= startPage + maxPages, we've processed enough pages
        // For startPage=1, maxPages=3: after processing page 3, page=3, check 3 >= 1+3 = 4? No, continue
        // Then page++ = 4, next iteration checks 4 > 1+3-1 = 3? Yes, break
        // So we need to check: if we've processed maxPages pages already
        const pagesProcessed = page - startPage + 1;
        if (maxPages && pagesProcessed >= maxPages) {
          logger.info(`Reached maximum page limit (${maxPages} pages from page ${startPage}) after processing page ${page}. Pages processed: ${pagesProcessed}`);
          break;
        }

        page++;
        await this.delay();
      }
    } catch (error) {
      logger.error('Error scraping theb2b.com', error);
    }

    logger.info(`Scraping completed. Total draws found: ${draws.length}, Last page: ${lastSuccessfulPage}`);
    return { draws, lastPage: lastSuccessfulPage };
  }

  /**
   * Scrape from theb2b.com (main entry point)
   * For backward compatibility, accepts date parameter but ignores it
   * since theb2b.com uses pagination instead of date-based queries
   */
  async scrapeAll(date?: string, startPage: number = 1, maxPages?: number): Promise<ScrapedDraw[]> {
    if (date) {
      logger.warn('Date parameter is ignored. theb2b.com uses pagination instead of date-based queries.');
    }
    
    try {
      const result = await this.scrapeB2B(startPage, maxPages);
      return result.draws;
    } catch (error) {
      logger.error('Error scraping from theb2b.com', error);
      return [];
    }
  }


  /**
   * Parse date string to ISO format (YYYY-MM-DD)
   * Uses unified date parser to handle ambiguous formats consistently
   */
  private parseDate(dateStr: string): string {
    return parseAndNormalizeDate(dateStr);
  }

  /**
   * Deduplicate draws by date and lotto type
   */
  private deduplicateDraws(draws: ScrapedDraw[]): ScrapedDraw[] {
    const seen = new Map<string, ScrapedDraw>();
    
    for (const draw of draws) {
      const key = `${draw.drawDate}-${draw.lottoType}`;
      if (!seen.has(key)) {
        seen.set(key, draw);
      } else {
        // If duplicate, prefer the one with more complete data
        const existing = seen.get(key)!;
        if (draw.source && !existing.source) {
          seen.set(key, draw);
        }
      }
    }
    
    return Array.from(seen.values());
  }

  /**
   * Convert ScrapedDraw to CreateDrawInput
   */
  toCreateDrawInput(scraped: ScrapedDraw): CreateDrawInput {
    return {
      drawDate: scraped.drawDate,
      lottoType: scraped.lottoType,
      winningNumbers: scraped.winningNumbers,
      machineNumbers: scraped.machineNumbers,
      source: scraped.source,
      metadata: scraped.metadata,
    };
  }
}

export const scraperService = new ScraperService();