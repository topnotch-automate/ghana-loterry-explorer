# Scraper and Populate Script Improvements

## Summary of Changes

The scraper and populate scripts have been significantly improved to address the following issues:

### ✅ Issues Fixed

1. **Scrape script now populates database** - Previously only displayed data, now saves to database
2. **Populate script uses saved data** - No longer re-scrapes if data already exists
3. **Remembers last page** - Continues from where it left off instead of starting from page 1
4. **Skips duplicate dates** - Uses `ON CONFLICT` to prevent duplicate inserts

## New Features

### 1. State Management (`backend/src/utils/scraperState.ts`)

- Tracks last scraped page number
- Stores last scrape date and total scraped count
- Persists state in `.scraper-state.json` file
- Automatically continues from last page on next run

### 2. Scraped Data Storage (`backend/src/utils/scrapedDataStorage.ts`)

- Saves scraped data to `.scraped-data.json` file
- Allows populate script to use saved data without re-scraping
- Can clear saved data when needed

### 3. Enhanced Scraper Service

- `scrapeB2B()` now returns both draws and last page processed
- Better tracking of which pages were successfully processed

## Usage

### Scrape Script (`npm run scrape`)

**Basic usage:**
```bash
npm run scrape                    # Continue from last page
npm run scrape -- --reset        # Start from page 1
npm run scrape -- --max-pages 5   # Scrape 5 pages from last position
npm run scrape -- --start-page 10 # Start from page 10
```

**What it does:**
1. Loads last page from state (or uses provided start page)
2. Scrapes data from theb2b.com
3. Saves scraped data to file
4. Populates database with scraped data
5. Updates state with last page processed
6. Skips duplicate dates automatically

### Populate Script (`npm run populate`)

**Basic usage:**
```bash
npm run populate                          # Use saved scraped data if available
npm run populate -- --force-scrape        # Force new scrape and populate
npm run populate -- --reset               # Reset state and start fresh
npm run populate -- --batch-size 50       # Use smaller batch size
```

**What it does:**
1. Checks for saved scraped data
2. If found, uses saved data (no re-scraping)
3. If not found or `--force-scrape` used, scrapes new data
4. Populates database with data
5. Updates state if new data was scraped

## File Structure

```
backend/
├── .scraper-state.json      # State file (last page, totals)
├── .scraped-data.json       # Saved scraped data
└── src/
    ├── scripts/
    │   ├── scrape.ts        # Scrape and populate script
    │   └── populate.ts         # Populate from saved data or scrape
    ├── utils/
    │   ├── scraperState.ts  # State management
    │   └── scrapedDataStorage.ts  # Data storage
    └── services/
        └── scraperService.ts  # Enhanced to return last page
```

## State File Format

`.scraper-state.json`:
```json
{
  "lastPage": 15,
  "lastScrapeDate": "2024-01-15T10:30:00.000Z",
  "totalScraped": 1500
}
```

## Duplicate Prevention

The system automatically skips duplicate dates using PostgreSQL's `ON CONFLICT` clause:

```sql
INSERT INTO draws (...)
VALUES (...)
ON CONFLICT (draw_date, lotto_type) DO NOTHING
```

This ensures:
- No duplicate inserts
- Fast batch processing
- Accurate skip counts

## Workflow Examples

### First Time Setup
```bash
# Start scraping from page 1
npm run scrape -- --reset --max-pages 10

# Next time, continue from page 11
npm run scrape -- --max-pages 10
```

### Daily Updates
```bash
# Scrape new data (continues from last page)
npm run scrape -- --max-pages 5

# Or use saved data if already scraped
npm run populate
```

### Force Fresh Scrape
```bash
# Reset and start fresh
npm run scrape -- --reset

# Or force populate to scrape new data
npm run populate -- --force-scrape
```

## Benefits

1. **Efficiency** - No redundant scraping
2. **Resumability** - Continue from where you left off
3. **Flexibility** - Use saved data or force new scrape
4. **Reliability** - Automatic duplicate prevention
5. **Progress Tracking** - Know exactly where you are

## Notes

- State files are stored in the `backend/` directory
- State files should be added to `.gitignore` (they're user-specific)
- Scraped data files can be large - consider cleaning up old files
- The system automatically handles duplicate dates/lotto types

