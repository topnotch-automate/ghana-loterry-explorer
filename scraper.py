import requests
from bs4 import BeautifulSoup
import time
import psycopg2
from datetime import datetime
from typing import Optional, Dict, List
import sys

# --- Database setup ---
DB_CONFIG = {
    "host": "localhost",
    "port": 5433,
    "dbname": "ghana_lottery",
    "user": "postgres",
    "password": "Ghana@lottery"
}

# --- Scraper configuration ---
BASE_URL = "https://www.theb2blotto.com/ajax/get_latest_results.php"
DEFAULT_DELAY = 1  # seconds between requests
DEFAULT_TIMEOUT = 30  # seconds
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


def get_db_connection():
    """Create and return a database connection."""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except psycopg2.Error as e:
        print(f"Error connecting to database: {e}")
        sys.exit(1)


def init_database(conn):
    """Initialize the database table if it doesn't exist."""
    cur = conn.cursor()
    try:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS draws (
            id SERIAL PRIMARY KEY,
            lotto_type TEXT,
            draw_date DATE,
            winning_numbers INT[],
            machine_numbers INT[],
            UNIQUE(lotto_type, draw_date)
        )
        """)
        conn.commit()
        print("Database table initialized/verified.")
    except psycopg2.Error as e:
        print(f"Error initializing database: {e}")
        conn.rollback()
        raise
    finally:
        cur.close()


def parse_draw_row(row) -> Optional[Dict]:
    """
    Parse a table row into a draw dictionary.
    
    Args:
        row: BeautifulSoup element representing a table row
        
    Returns:
        Dictionary with draw data or None if parsing fails
    """
    try:
        cols = row.find_all("td")
        if len(cols) < 3:
            return None

        # Extract lotto type
        name_span = cols[0].find("span", class_="name")
        if not name_span:
            return None
        lotto_type = name_span.text.strip()
        if not lotto_type:
            return None

        # Extract draw date
        date_span = cols[1].find("span", class_="date")
        if not date_span:
            return None
        draw_date = date_span.text.strip()
        if not draw_date:
            return None

        # Extract winning numbers
        winning_ul = cols[2].find("ul", class_="lottery-number-list")
        winning_numbers = []
        if winning_ul:
            winning_numbers = [
                int(li.text.strip())
                for li in winning_ul.find_all("li")
                if li.text.strip().isdigit()
            ]

        # Extract machine numbers
        machine_ul = cols[2].find("ul", class_="machine-numbers")
        machine_numbers = []
        if machine_ul:
            machine_numbers = [
                int(li.text.strip())
                for li in machine_ul.find_all("li")
                if li.text.strip().isdigit()
            ]

        # Validate that we have meaningful data
        if not winning_numbers and not machine_numbers:
            return None

        return {
            "lotto_type": lotto_type,
            "draw_date": draw_date,
            "winning": winning_numbers,
            "machine": machine_numbers
        }
    except (ValueError, AttributeError) as e:
        print(f"Error parsing row: {e}")
        return None


def insert_draw(conn, draw: Dict) -> bool:
    """
    Insert a draw into the database.
    
    Args:
        conn: Database connection
        draw: Dictionary with draw data
        
    Returns:
        True if inserted, False if skipped (duplicate)
    """
    cur = conn.cursor()
    try:
        cur.execute("""
        INSERT INTO draws (lotto_type, draw_date, winning_numbers, machine_numbers)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (lotto_type, draw_date) DO NOTHING
        RETURNING id
        """, (
            draw["lotto_type"],
            draw["draw_date"],
            draw["winning"],
            draw["machine"]
        ))
        
        inserted = cur.rowcount > 0
        conn.commit()
        return inserted
    except psycopg2.Error as e:
        print(f"Error inserting draw: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()


def fetch_page(page: int) -> Optional[BeautifulSoup]:
    """
    Fetch a page of results from the API.
    
    Args:
        page: Page number to fetch
        
    Returns:
        BeautifulSoup object or None if fetch fails
    """
    try:
        response = requests.get(
            BASE_URL,
            params={"pn": page},
            headers={"User-Agent": USER_AGENT},
            timeout=DEFAULT_TIMEOUT
        )
        response.raise_for_status()
        return BeautifulSoup(response.text, "html.parser")
    except requests.RequestException as e:
        print(f"Error fetching page {page}: {e}")
        return None


def scrape_all_pages(start_page: int = 1, delay: float = DEFAULT_DELAY, max_pages: Optional[int] = None) -> int:
    """
    Scrape all pages of lottery results.
    
    Args:
        start_page: Starting page number
        delay: Delay in seconds between requests
        max_pages: Maximum number of pages to scrape (None for unlimited)
        
    Returns:
        Total number of draws inserted
    """
    conn = get_db_connection()
    init_database(conn)
    
    page = start_page
    total_inserted = 0
    total_skipped = 0
    consecutive_empty_pages = 0
    max_empty_pages = 3  # Stop after 3 consecutive empty pages

    print(f"Starting scrape from page {start_page}...")
    
    try:
        while True:
            if max_pages and page > start_page + max_pages - 1:
                print(f"Reached maximum page limit ({max_pages}).")
                break

            print(f"Fetching page {page}...on url {BASE_URL}")
            soup = fetch_page(page)
            
            if not soup:
                consecutive_empty_pages += 1
                if consecutive_empty_pages >= max_empty_pages:
                    print("Too many consecutive errors. Stopping.")
                    break
                page += 1
                time.sleep(delay)
                continue

            rows = soup.find_all("tr")
            
            if not rows:
                consecutive_empty_pages += 1
                if consecutive_empty_pages >= max_empty_pages:
                    print("No more results found. Stopping.")
                    break
                page += 1
                time.sleep(delay)
                continue

            # Reset consecutive empty pages counter
            consecutive_empty_pages = 0
            
            new_draws = []
            for row in rows:
                draw = parse_draw_row(row)
                if draw:
                    if insert_draw(conn, draw):
                        new_draws.append(draw)
                        total_inserted += 1
                    else:
                        total_skipped += 1

            if new_draws:
                print(f"  ✓ Inserted {len(new_draws)} new draw(s) (Total: {total_inserted}, Skipped: {total_skipped})")
            else:
                print(f"  - No new draws on this page (Total: {total_inserted}, Skipped: {total_skipped})")

            page += 1
            time.sleep(delay)

    except KeyboardInterrupt:
        print("\nScraping interrupted by user.")
    except Exception as e:
        print(f"Unexpected error: {e}")
    finally:
        conn.close()
        print(f"\nScraping completed. Total draws inserted: {total_inserted}, Skipped: {total_skipped}")
    
    return total_inserted


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Scrape lottery results from theb2b.com")
    parser.add_argument("--start-page", type=int, default=1, help="Starting page number (default: 1)")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY, help=f"Delay between requests in seconds (default: {DEFAULT_DELAY})")
    parser.add_argument("--max-pages", type=int, help="Maximum number of pages to scrape (default: unlimited)")
    
    args = parser.parse_args()
    
    scrape_all_pages(
        start_page=args.start_page,
        delay=args.delay,
        max_pages=args.max_pages
    )
