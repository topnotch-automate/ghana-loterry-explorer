/**
 * Unified date parser that normalizes all date formats to YYYY-MM-DD
 * Handles ambiguous formats like 12/6/2025 vs 6/12/2025 by using smart detection
 */

/**
 * Parse and normalize date string to YYYY-MM-DD format
 * Handles multiple date formats and resolves ambiguity
 */
export function parseAndNormalizeDate(dateStr: string): string {
  if (!dateStr) {
    return new Date().toISOString().split('T')[0];
  }

  const trimmed = dateStr.trim();

  // Try ISO format first (YYYY-MM-DD) - unambiguous
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Try d-M-yyyy format (e.g., "5-12-2025" -> day-month-year)
  // This is the format used by the scraper
  const dMyyyyMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dMyyyyMatch) {
    const [, part1, part2, year] = dMyyyyMatch;
    const num1 = parseInt(part1, 10);
    const num2 = parseInt(part2, 10);
    
    // If first part > 12, it must be day-month-year
    // If second part > 12, it must be month-day-year
    // Otherwise, assume day-month-year (as per scraper format)
    let day: string;
    let month: string;
    
    if (num1 > 12) {
      // First part is day (e.g., "25-12-2025")
      day = part1.padStart(2, '0');
      month = part2.padStart(2, '0');
    } else if (num2 > 12) {
      // Second part is day (e.g., "12-25-2025")
      month = part1.padStart(2, '0');
      day = part2.padStart(2, '0');
    } else {
      // Ambiguous: assume day-month-year (scraper format)
      day = part1.padStart(2, '0');
      month = part2.padStart(2, '0');
    }
    
    return `${year}-${month}-${day}`;
  }

  // Try M/d/yyyy or d/M/yyyy format (slash separator)
  // IMPORTANT: For ambiguous dates, try both interpretations and use the one that results
  // in a valid date. This ensures "12/6/2025" and "6/12/2025" normalize to the same date
  // if they represent the same calendar date.
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, part1, part2, year] = slashMatch;
    const num1 = parseInt(part1, 10);
    const num2 = parseInt(part2, 10);
    
    // Try both interpretations: MM/DD/YYYY and DD/MM/YYYY
    const tryMMDD = new Date(`${year}-${part1.padStart(2, '0')}-${part2.padStart(2, '0')}`);
    const tryDDMM = new Date(`${year}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`);
    
    // Check which interpretation is valid
    const isValidMMDD = !isNaN(tryMMDD.getTime()) && 
                        tryMMDD.getFullYear() === parseInt(year, 10) &&
                        tryMMDD.getMonth() + 1 === parseInt(part1, 10) &&
                        tryMMDD.getDate() === parseInt(part2, 10);
    
    const isValidDDMM = !isNaN(tryDDMM.getTime()) && 
                        tryDDMM.getFullYear() === parseInt(year, 10) &&
                        tryDDMM.getMonth() + 1 === parseInt(part2, 10) &&
                        tryDDMM.getDate() === parseInt(part1, 10);
    
    // If both are valid and represent the same date, use that date
    if (isValidMMDD && isValidDDMM) {
      const mmddStr = `${year}-${String(tryMMDD.getMonth() + 1).padStart(2, '0')}-${String(tryMMDD.getDate()).padStart(2, '0')}`;
      const ddmmStr = `${year}-${String(tryDDMM.getMonth() + 1).padStart(2, '0')}-${String(tryDDMM.getDate()).padStart(2, '0')}`;
      
      if (mmddStr === ddmmStr) {
        // Both interpretations result in the same date - use it
        return mmddStr;
      }
    }
    
    // Use the valid interpretation, preferring DD/MM/YYYY to match scraper format
    if (isValidDDMM) {
      const month = String(tryDDMM.getMonth() + 1).padStart(2, '0');
      const day = String(tryDDMM.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    if (isValidMMDD) {
      const month = String(tryMMDD.getMonth() + 1).padStart(2, '0');
      const day = String(tryMMDD.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // If neither is valid, try smart detection based on value ranges
    let day: string;
    let month: string;
    
    if (num1 > 12) {
      // First part must be day (e.g., "25/12/2025" = DD/MM/YYYY)
      day = part1.padStart(2, '0');
      month = part2.padStart(2, '0');
    } else if (num2 > 12) {
      // Second part must be day (e.g., "12/25/2025" = MM/DD/YYYY)
      month = part1.padStart(2, '0');
      day = part2.padStart(2, '0');
    } else {
      // Both <= 12: ambiguous - default to DD/MM/YYYY to match scraper format
      day = part1.padStart(2, '0');
      month = part2.padStart(2, '0');
    }
    
    // Validate the final date
    const date = new Date(`${year}-${month}-${day}`);
    if (!isNaN(date.getTime()) && 
        date.getFullYear() === parseInt(year, 10) && 
        date.getMonth() + 1 === parseInt(month, 10) &&
        date.getDate() === parseInt(day, 10)) {
      return `${year}-${month}-${day}`;
    }
  }

  // Try MM-DD-YYYY format (dash separator, 2-digit)
  const mmddyyyyDashMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (mmddyyyyDashMatch) {
    const [, part1, part2, year] = mmddyyyyDashMatch;
    const num1 = parseInt(part1, 10);
    const num2 = parseInt(part2, 10);
    
    let day: string;
    let month: string;
    
    if (num1 > 12) {
      day = part1;
      month = part2;
    } else if (num2 > 12) {
      month = part1;
      day = part2;
    } else {
      // Default to MM-DD-YYYY
      month = part1;
      day = part2;
    }
    
    return `${year}-${month}-${day}`;
  }

  // Try JavaScript Date parser as fallback
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // If all else fails, return today's date
  console.warn(`Could not parse date: ${dateStr}, using today's date`);
  return new Date().toISOString().split('T')[0];
}

